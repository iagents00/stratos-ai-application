# Stratos AI · Telegram CRM Bot v5 — Paridad CRM

Bot v5 de Telegram que da al asesor (y a los admins) **paridad operativa con el CRM web**:
todo lo que se puede hacer en `app.stratoscapitalgroup.com → CRM` ahora se puede hacer
desde Telegram, conservando RLS, auditoría y multi-tenant.

> **Auditoría inicial vía MCP Supabase** detectó que la BD de producción ya tenía 13
> migraciones aplicadas (incluida `bot_crm_rpcs` del 30/abr) que crean 13 RPCs `bot_*`.
> v5 expone esos 13 RPCs + el único nuevo (`bot_soft_delete_lead`, migración `009`).

---

## 1. Qué cambia respecto a v4

| Aspecto | v4 | v5 |
|---|---|---|
| Tools en el AI Agent | 5 | **15** |
| Búsqueda por nombre | ✗ | `bot_search_leads_by_name` |
| Filtrar leads por etapa/asesor | ✗ | `bot_list_leads_by_filter` |
| Resumen de pipeline | ✗ | `bot_list_pipeline_summary` |
| Reasignar lead (admins/dirs) | ✗ | `bot_update_lead_fields` (`p_new_asesor_name`) |
| Comunicación rica (duración + transcripción) | ✗ | `bot_add_comunicacion` |
| Tareas (crear / completar) | ✗ | `bot_add_task`, `bot_complete_task` |
| Cerrar deal | ✗ | `bot_create_deal` |
| Descartar lead | ✗ | `bot_soft_delete_lead` ← **NUEVO RPC** |
| Ficha rica (tasks/playbook/history) | parcial vía `bot_get_lead_by_phone` | **`bot_view_lead`** + `bot_get_lead_full_context` |
| `maxTokensToSample` Claude | 1024 | 1500 |
| System message | ~3 KB | ~9 KB con guía de cuándo usar cada tool |

`bot_get_lead_by_phone` (de v4) **se reemplaza** por `bot_view_lead`, que devuelve
los mismos campos plus `tasks`, `playbook`, `action_history`, `project_id`,
`campaign_id`. La RPC vieja sigue existiendo en BD por compatibilidad pero el bot
ya no la invoca.

---

## 2. Mapa Tool → RPC Supabase

```
consume_telegram_pairing_code   → public.consume_telegram_pairing_code
bot_view_lead                   → public.bot_view_lead
bot_get_lead_full_context       → public.bot_get_lead_full_context
bot_search_leads_by_name        → public.bot_search_leads_by_name
bot_list_leads_by_filter        → public.bot_list_leads_by_filter
bot_list_pending                → public.bot_list_pending
bot_list_pipeline_summary       → public.bot_list_pipeline_summary
bot_upsert_lead                 → public.bot_upsert_lead
bot_update_lead_fields          → public.bot_update_lead_fields
bot_add_seguimiento             → public.bot_add_seguimiento
bot_add_comunicacion            → public.bot_add_comunicacion
bot_add_task                    → public.bot_add_task
bot_complete_task               → public.bot_complete_task
bot_create_deal                 → public.bot_create_deal
bot_soft_delete_lead            → public.bot_soft_delete_lead   ← migración 009
```

Todas usan `SECURITY DEFINER` y se invocan con la `service_role` por header.
Cada RPC valida internamente con `telegram_chat_id` quién es el asesor y aplica
permisos por rol (asesor vs super_admin/admin/ceo/director).

Los códigos de error normalizados que el bot ya sabe mapear a respuesta humana:

| `error` | Respuesta del bot |
|---|---|
| `asesor_not_paired` | Flujo de pareo `/conectar 12345678` |
| `lead_not_found` | "No encontré ese cliente. Verifica el teléfono." |
| `invalid_phone` | "Ese número no parece válido." |
| `forbidden` | "Ese cliente está asignado a otro asesor." |
| `reassign_forbidden` | "Solo un director o admin puede reasignar." |
| `new_asesor_not_found` | "No encuentro ese asesor." |
| `task_not_found` | "No encuentro esa tarea." |
| `invalid_amount` | "El monto debe ser un número positivo." |

---

## 3. Despliegue

### 3.1. Aplicar migración 009 (única nueva)

Vía MCP (recomendado):

```bash
# Ya aplicado en producción glulgyhkrqpykxmujodb · 02-may-2026
# Si necesitas reaplicar:
#   apply_migration { name: "bot_soft_delete_lead", query: <SQL del archivo> }
```

Vía Supabase Dashboard:

1. SQL Editor → New Query
2. Pega `supabase/migrations/009_bot_soft_delete_lead.sql`
3. Run

Vía Supabase CLI (si la usan):

```bash
supabase db push
```

### 3.2. Importar el workflow v5

1. n8n → **Workflows** → **Import from file**
2. Sube `n8n/workflows/stratos-telegram-bot-v5.json`
3. Asigna las credenciales **iguales** a las del v4:
   - `STRATOS BOT` (Telegram)
   - `OpenAi account`
   - `Anthropic Stratos`
   - `Postgres Supabase Oficial`
   - `Redis`
4. Variables de entorno (proyecto n8n):
   - `SUPABASE_URL = https://glulgyhkrqpykxmujodb.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY = <service_role>`
5. **Apaga el v4** y enciende el v5 (mismo bot Telegram → no puede haber dos
   triggers activos sobre el mismo `STRATOS BOT`).
6. Ejecuta `/conectar XXXXXXXX` desde Telegram con un código generado en el web.

### 3.3. Rollback

- v5 y v4 comparten todas las credenciales y la RPC `consume_telegram_pairing_code`.
- Para rollback: apaga v5, enciende v4. **No** hace falta tocar la BD —
  `bot_soft_delete_lead` queda inerte si nadie la llama.

---

## 4. Arquitectura del workflow

```
Telegram Trigger
    └─▸ Switch (voice / image / text)
        ├─▸ Get VOICE → TRANSCRIBE AUDIO  → audio input
        ├─▸ Get IMAGE → ANALIZA IMAGEN    → image input
        └─▸ text input
                                          ▼
                                       Merge → Sort → Aggregate → INPUT FINAL
                                                                       │
                                                                       ▼
                              (buffer Redis 1s para juntar mensajes en ráfaga)
                                                                       │
                                                                       ▼
                                                                 Identify asesor
                                                                       │
                                                                       ▼
                                                                   AI Agent
                                                          (Claude Sonnet 4.5)
                                                          + Postgres Chat Memory
                                                          + 15 ai_tool nodes
                                                                       │
                                                                       ▼
                                                                IF_NOT_Error
                                                              ┌──┴──┐
                                                              ▼     ▼
                                                       RESPOND   ERROR
                                                       MESSAGE  MESSAGE
```

42 nodos en total. Toda la pipeline pre-LLM (transcripción, OCR, buffer Redis,
identificación de asesor) es idéntica al v4 — el cambio quirúrgico está en el
**AI Agent**: nuevo system prompt + 15 tools en lugar de 5.

---

## 5. Smoke tests vía MCP (ya ejecutados)

| Caso | Resultado |
|---|---|
| Sin pareo: 6 RPCs distintas devuelven `asesor_not_paired` | OK |
| Asesor regular borra lead propio | OK (success) |
| Asesor regular borra lead ajeno | OK (`forbidden`) |
| Asesor regular intenta reasignar | OK (`reassign_forbidden`) |
| Asesor regular cambia stage de lead propio | OK (success) |
| Admin borra lead ajeno | OK (success) |
| Restauración de leads + desemparejamiento de prueba | OK |

Para repetir contra producción usa el flujo del archivo
`supabase/migrations/009_bot_soft_delete_lead.sql` (sección verificación
post-deploy en los comentarios finales).

---

## 6. Pendientes y siguiente sprint

- [ ] **Pareo a producción**: hoy hay 0 asesores con `telegram_chat_id`. Pasar
  el flujo de pareo del frontend al modo "general available" para que los 8
  asesores activos hagan `/conectar`.
- [ ] **Restauración de leads borrados**: tool `bot_restore_lead` (admin-only)
  para deshacer `bot_soft_delete_lead`. Se puede añadir en migración `010`.
- [ ] **Subida de fotos a `expediente_items`**: hoy v5 solo describe la imagen
  con OpenAI; no la guarda. Próxima fase: subir a Supabase Storage con
  `add_expediente_item`.
- [ ] **Tags / Playbook**: aún no expuestos al bot. Las tablas existen pero no
  hay RPC `bot_*` para ellas — añadir en migración `010`.
