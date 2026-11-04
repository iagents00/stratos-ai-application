# Stratos Bot v5 — Arquitectura

**Filosofía:** Postgres-first. Toda la lógica del bot (qué texto mostrar, qué botones, qué confirmaciones, qué validaciones) vive en SQL. n8n es un transport layer delgado.

**Beneficio:** una persona que trabaja con n8n no necesita tocar JSONs grandes para iterar el bot. Cambios visuales (palabras, botones, flujos) = editar funciones SQL y recargar el schema cache.

---

## Diagrama

```
                          Telegram
                             │
            ┌────────────────┴───────────────┐
            ▼                                ▼
     "message" update              "callback_query" update
            │                                │
   ┌────────┴────────┐                       │
   │   AI Agent      │              ┌────────┴────────┐
   │  (Claude 4.5)   │              │ bot_handle_     │
   │  1 tool only    │              │   callback()    │
   │                 │              │ (sin IA)        │
   └────────┬────────┘              └────────┬────────┘
            │                                │
            ▼                                │
   ┌─────────────────┐                       │
   │ bot_nlu_        │                       │
   │   dispatch()    │                       │
   │ (SUPABASE RPC)  │                       │
   └────────┬────────┘                       │
            │                                │
            └────────────────┬───────────────┘
                             │
                             ▼
                  { reply: { text,
                             inline_keyboard }}
                             │
                             ▼
                       Telegram sendMessage
```

---

## Las tres capas

### Capa Supabase (SQL puro)

Es donde vive todo. Tres migraciones la construyen:

| Archivo | Qué agrega |
|---|---|
| `008_bot_full_crm_coverage.sql` | 9 RPCs faltantes (expediente, agente IA, pin, historial, KPIs, tareas, búsqueda) |
| `009_bot_reply_envelope.sql` | Helpers de formato y teclados + 8 wrappers `*_v2` + tablas (`bot_config`, `bot_pending_actions`, `bot_rate_limit`) + HMAC para firma de callback_data |
| `010_bot_dispatcher.sql` | Las dos funciones maestras: `bot_nlu_dispatch` y `bot_handle_callback` + `_bot_stage_action` + `_bot_execute_pending` |

### Capa n8n (workflow JSON)

Un solo archivo: `stratos-telegram-bot-v5.json`. ~13 nodos.

| Nodo | Función |
|---|---|
| `Telegram Trigger` | Recibe `message` y `callback_query`. |
| `Global Config` | Lee `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` de `$env` (no hardcoded). |
| `Switch UPDATE_TYPE` | 4 ramas: callback / voice / photo / text. |
| `RPC bot_handle_callback` | HTTP directo. Sin IA. |
| `TG Answer Callback` | Apaga el spinner del botón. |
| `TG Get Voice` + `Whisper Transcribe` | Voz → texto. |
| `Set Input (voice)` / `Set Input (text)` | Normaliza payload para el agente. |
| `AI Agent` | Claude Sonnet 4.5 con UNA sola tool: `bot_nlu_dispatch`. |
| `Anthropic Chat Model` | El modelo. |
| `Postgres Chat Memory` | Memoria persistente en `n8n_chat_histories` (session=`tg:{chat_id}`). |
| `bot_nlu_dispatch` (tool) | HTTP tool que el agente invoca. |
| `Merge` + `Normalize Reply` | Junta ambas ramas y normaliza la salida. |
| `Switch HAS_KEYBOARD` | Si hay botones → sendMessage con reply_markup; si no → sendMessage plano. |

### Capa Telegram (UX)

El usuario ve:
- **Botones inline** (toda respuesta puede traerlos).
- **Texto plano sin Markdown ni emojis** (regla de marca).
- **Confirmaciones [Sí][Cancelar]** antes de cada write.

---

## Catálogo de `tool_name` (para `bot_nlu_dispatch`)

Documentado en detalle en [system-prompt-asesor-v3.md](system-prompt-asesor-v3.md). Resumen:

**Reads (sin confirmación):** `menu`, `list_pending`, `dashboard`, `view_lead`, `quick_search`, `pipeline_summary`, `list_expediente`, `lead_history`, `list_tasks`.

**Writes (con confirmación [Sí][Cancelar]):** `upsert_lead`, `update_fields`, `add_seguimiento`, `add_comunicacion`, `add_expediente_note`, `add_expediente_voice`, `add_task`, `set_ai_agent`, `create_deal`, `soft_delete`.

**Inmediatas (sin confirmación, idempotentes):** `pin_lead`, `complete_task`.

**Stub Fase 2:** `image`.

---

## Catálogo de `callback_data` (para `bot_handle_callback`)

Formato: `<action>:<payload>:<hmac8>`. La firma se valida antes de ejecutar.

| action | payload | Ejecuta |
|---|---|---|
| `menu` | `_` | `bot_render_menu` |
| `view` | `<phone>` | `bot_view_lead_v2` |
| `pending` | `_` | `bot_list_pending_v2` |
| `kpi` | `me` / `org` | `bot_get_dashboard_stats_v2` |
| `pipeline` | `_` | `bot_list_pipeline_summary_v2` |
| `list` | `mine` | `bot_list_pending_v2(168)` |
| `searchprompt` | `_` | devuelve "Escríbeme nombre/email/teléfono…" |
| `expediente` | `<phone>` | `bot_list_expediente_v2` |
| `history` | `<phone>` | `bot_get_lead_history_v2` |
| `stagepick` | `<phone>` | muestra teclado con 10 etapas |
| `stage` | `<phone>:<slug>` | `bot_update_lead_fields(stage=...)` |
| `nextpick` | `<phone>` | pide próxima acción por texto |
| `taskprompt` | `<phone>` | pide texto de la tarea |
| `taskdone` | `<task_id>` | `bot_complete_task` |
| `agentpick` | `<phone>` | muestra teclado con 4 agentes |
| `agent` | `<phone>:<key>` | `bot_set_ai_agent` (key='none' para quitar) |
| `pin` | `<phone>:1` o `<phone>:0` | `bot_pin_lead(pinned)` |
| `confirm` | `<token>` | `_bot_execute_pending(token)` (ejecuta el write) |
| `cancel` | `<token>` | marca pending como consumed sin ejecutar |

---

## Cómo agregar una nueva acción

### Caso A — quiero un nuevo intent en lenguaje natural

Ej: el asesor dice "marca a Juan como visitado" y quiero que cambie etapa a Visita Concretada.

Esto YA funciona con `update_fields(stage='Visita Concretada')`. No agregues nada. Iterar el system prompt en `system-prompt-asesor-v3.md` con un ejemplo few-shot bastará.

### Caso B — quiero una operación nueva (no existe RPC base)

Pasos:

1. **SQL — la RPC base.** Crea `bot_<nombre>(chat_id, args...)` siguiendo el patrón de las existentes (identifica al asesor con `identify_asesor_by_telegram`, valida, ejecuta, devuelve `{ success, data }` o `{ error, code }`).

2. **SQL — el wrapper v2** (opcional, solo si no la consume `bot_nlu_dispatch` directamente). Compón el sobre con helpers `_bot_fmt_*` y `_bot_kb_*`.

3. **SQL — agrega un `when` en `bot_nlu_dispatch`** con el nuevo `tool_name`. Si es write, llama `_bot_stage_action(action_type, args, summary)`. Si es read inmediato, ejecuta y devuelve el sobre.

4. **SQL — agrega un `when` en `_bot_execute_pending`** si es write (mapea `action_type` a la RPC real).

5. **Prompt v3 — agrega el `tool_name` al catálogo** del system prompt, con un ejemplo few-shot.

Listo. **No tocas el JSON del workflow** ni reimportas en n8n. El cambio es solo SQL + prompt.

### Caso C — quiero un nuevo botón en un teclado existente

1. Edita el helper `_bot_kb_*` correspondiente en la 009.
2. Agrega un nuevo `when` en `bot_handle_callback` (010) para procesar el callback.
3. Recarga schema cache: `NOTIFY pgrst, 'reload schema';`.

---

## Cómo migrar de v4 a v5 (rollback ready)

1. **Aplicar las 3 migraciones** (008, 009, 010) en Supabase. Son idempotentes — usar `create or replace` y `create table if not exists`. No tocan las RPCs originales que la app web usa.
2. **Crear un bot de Telegram dev** con BotFather (`/newbot`, sufijo `_dev`). Guardar token.
3. **Importar `stratos-telegram-bot-v5.json` en n8n**, asignar credentials, conectar al bot dev.
4. **Pegar el system prompt v3** en el nodo `AI Agent → Options → System Message` (reemplazando el placeholder `PEGAR_AQUI_EL_CONTENIDO_DE_system-prompt-asesor-v3.md`).
5. **Configurar env vars** en el ejecutor n8n: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY` (Whisper), `ANTHROPIC_API_KEY` (Claude).
6. **Probar los 10 casos** del checklist (sección Verificación más abajo).
7. **Cambiar el token al bot de producción**, activar v5, desactivar v4. Monitorear 24h.
8. **Rollback**: desactivar v5 y reactivar v4. Las migraciones SQL son aditivas, no necesitan rollback.

---

## Verificación end-to-end (10 casos)

1. **Pareo deep link**: `/start XXXXXXXX` → "Conectado, Juan García" + menú raíz.
2. **Menú por botón**: tap `[Agenda]` → lista de pendientes con un botón por lead.
3. **NLU lectura**: "cómo voy" → KPIs en texto formateado.
4. **NLU escritura**: "pasa a Juan 555-1234 a zoom concretado y reagenda mañana 11am" → confirmación con `[Sí][Cancelar]` → tap Sí → "Listo. Voy a actualizar Juan García…".
5. **Botón cambia etapa**: en ficha, tap `[Cambiar etapa]` → 10 botones → tap `[Zoom Concretado]` → "Actualizado. Etapa → Zoom Concretado".
6. **Voz al expediente**: audio "agrégale a Marco 555-1234 que su esposa decide" → Whisper → confirmación → tap Sí → verificar 1 row en `expediente_items` (tipo=`audio`) + 1 en `comunicaciones`.
7. **Soft delete**: "elimina a Marco 555-1234" → confirmación con nombre completo → tap Sí → `deleted_at` se llena.
8. **Callback inválido**: alterar el HMAC del callback_data → `bot_handle_callback` devuelve "Acción expirada. Pídela de nuevo.".
9. **Pending expira**: stage_action → esperar 11 min → tap `[Sí]` → "Esta confirmación venció. Vuelve a pedirlo.".
10. **Stub Fase 2**: `/imagen kpi` → "Captura del UI llegará pronto. Mientras tanto:" + KPIs en texto.

---

## Trade-offs y decisiones

- **¿Por qué una supertool y no 25 individuales?** El AI Agent en n8n cobra costo proporcional al número de tools descritas (cada una en el prompt). 1 supertool con un catálogo en el system prompt = mismo expresividad, ⅙ del costo, ⅓ de la latencia, 0 nodos de tool extra que cablear.
- **¿Por qué Postgres-first y no Edge Function?** Las funciones SQL ya existen, n8n ya conecta a Supabase con service_role, no requiere infraestructura adicional, y el HMAC + RLS dan suficiente seguridad. Una Edge Function (Deno) sería ~5ms más rápida pero agrega un servicio que mantener.
- **¿Por qué staging de writes (bot_pending_actions)?** Confirma sin estado en el agente. La IA puede equivocarse y proponer un write — la BD nunca ejecuta sin que el asesor toque `[Sí]`. La confirmación es 100% determinista, sobrevive a reinicios de n8n.
- **¿Por qué `_v2` y no reemplazar las RPCs originales?** La app web sigue llamando las originales. Las `_v2` solo agregan el `reply` para el bot. Cero impacto en la web.

---

## Roadmap

**v5.1 (próxima iteración)**:
- Notificaciones push diarias (cron 8 AM con pendientes del día). Workflow separado en n8n que llama `bot_list_pending`.
- Recordatorios al llegar `next_action_at`.

**v6 — Imágenes del UI**:
- Servicio de screenshot (Browserless / Satori / endpoint propio).
- Reemplazar el branch stub `tool_name='image'` en `bot_nlu_dispatch` con una llamada al servicio.
- Cambio mínimo en n8n: agregar un `sendPhoto` cuando `reply.photo_url` exista.

**v7 — WhatsApp**:
- Cambiar el `Telegram Trigger` por `WhatsApp Trigger`. Reusar todo lo demás (las RPCs no saben de qué canal vienen).
