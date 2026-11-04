# Bot Telegram — Cobertura completa del CRM

Análisis y plan de implementación para que el bot de Telegram pueda ejecutar **todos los movimientos del CRM** y traer **todos los datos del cliente** desde Stratos AI.

Fecha del análisis: 2026-05-11.

---

## 1. Inventario — qué se registra de un cliente

Una ficha completa de cliente contiene 11 grupos de información:

### 1.1 Perfil base
`name`, `email`, `phone` (clave única), `source`, `created_at`, `updated_at`, `deleted_at` (soft-delete).

### 1.2 Estado en el pipeline
`stage` (10 valores canónicos), `score` 0-100, `hot` boolean, `is_new` boolean, `priority`, `priority_order`.

Etapas: `Nuevo Registro → Primer Contacto → Seguimiento → Zoom Agendado → Zoom Concretado → Visita Agendada → Visita Concretada → Negociación → Cierre → Perdido`.

### 1.3 Presupuesto y proyecto
`budget` (texto), `presupuesto` (bigint en USD), `project`, `project_id`, `campaign`, `campaign_id`.

### 1.4 Perfil cualitativo
`bio`, `risk`, `friction`, `tag`.

### 1.5 Próxima acción
`next_action` (texto), `next_action_at` (timestamptz, preferido), `next_action_date` (texto legacy, se sincroniza con `next_action_at` por trigger).

### 1.6 Actividad
`seguimientos` (contador), `last_activity`, `days_inactive`.

### 1.7 Asignación
`asesor_id` (FK profiles), `asesor_name` (snapshot), `organization_id`.

### 1.8 Agente IA y prioridad
`ai_agent` (`reactivar` / `seguimiento` / `callcenter` / `calificar`), `priority`, posición en `profiles.crm_prefs.pinned[]`.

### 1.9 Tareas
Tabla `lead_tasks` (id, text, done, due_at, done_at, priority, order_idx) + JSONB legacy `leads.tasks`.

### 1.10 Comunicaciones e historial
- `comunicaciones` (id, tipo, resumen, transcripcion, ocurrio_en, duracion_segundos).
- `lead_events` (cambios de etapa, asignación, agente IA…).
- `audit_log` (auditoría de bajo nivel, generado por triggers).
- `lead_assignments` (historial de reasignaciones).
- `action_history` JSONB legacy en `leads`.

### 1.11 Expediente
Tabla `expediente_items` (id, tipo `texto`/`audio`/`pdf`/`documento`, titulo, descripcion, storage_path, mime_type, size_bytes). Es el repositorio formal de notas y documentos por cliente.

---

## 2. Acciones del CRM (UI web) que el bot debe poder hacer

Mapeadas a la RPC que las cubre. Las marcadas **NUEVA** se crean en `008_bot_full_crm_coverage.sql`.

| # | Acción del CRM | RPC que la ejecuta | Estado |
|---|---|---|---|
| 1 | Crear lead | `bot_upsert_lead` | ✅ deployada |
| 2 | Actualizar campos | `bot_update_lead_fields` | ✅ |
| 3 | Cambiar etapa | `bot_update_lead_fields(stage)` | ✅ |
| 4 | Subir/bajar score | `bot_update_lead_fields(score)` | ✅ |
| 5 | Marcar/desmarcar hot | `bot_update_lead_fields(hot)` | ✅ |
| 6 | Set próxima acción + fecha | `bot_upsert_lead` / `bot_update_lead_fields` | ✅ |
| 7 | Reasignar asesor | `bot_update_lead_fields(new_asesor_name)` | ✅ |
| 8 | Soft-delete | `bot_soft_delete_lead` | ✅ |
| 9 | Ver lead (ficha) | `bot_get_lead_by_phone`, `bot_view_lead` | ✅ |
| 10 | Ver contexto completo | `bot_get_lead_full_context` | ✅ |
| 11 | Buscar por nombre | `bot_search_leads_by_name` | ✅ |
| 12 | Búsqueda global (nombre/email/teléfono parcial) | **`bot_quick_search`** | NUEVA |
| 13 | Listar leads filtrados | `bot_list_leads_by_filter` | ✅ |
| 14 | Resumen del pipeline | `bot_list_pipeline_summary` | ✅ |
| 15 | KPIs del asesor / organización | **`bot_get_dashboard_stats`** | NUEVA |
| 16 | Listar pendientes (agenda) | `bot_list_pending` | ✅ |
| 17 | Listar tareas del lead | **`bot_list_tasks`** | NUEVA |
| 18 | Crear tarea | `bot_add_task` | ✅ |
| 19 | Completar tarea | `bot_complete_task` | ✅ |
| 20 | Registrar seguimiento corto | `bot_add_seguimiento` | ✅ |
| 21 | Registrar comunicación detallada | `bot_add_comunicacion` | ✅ |
| 22 | Timeline del lead | **`bot_get_lead_history`** | NUEVA |
| 23 | Agregar nota al expediente | **`bot_add_expediente_note`** | NUEVA |
| 24 | Agregar voz transcrita al expediente | **`bot_add_expediente_voice`** | NUEVA |
| 25 | Listar expediente | **`bot_list_expediente`** | NUEVA |
| 26 | Asignar agente IA | **`bot_set_ai_agent`** | NUEVA |
| 27 | Pinear / unpinear lead | **`bot_pin_lead`** | NUEVA |
| 28 | Registrar deal cerrado | `bot_create_deal` | ✅ |

Cobertura tras aplicar la migración: **28 acciones del CRM → 25 RPCs**. Lo que falta queda explícitamente fuera del bot por diseño:

- Edición de catálogos (proyectos, campañas, tags). Eso es solo web.
- Reorden manual de prioridad. Solo web (drag & drop).
- Gestión de asesores y permisos. Solo web.

---

## 3. Estado actual del workflow n8n

**Archivo:** `n8n/workflows/stratos-telegram-bot-v4.json`

**Tools cableadas actualmente (6):**
1. `consume_telegram_pairing_code`
2. `bot_pair_by_name`
3. `bot_get_lead_by_phone`
4. `bot_upsert_lead`
5. `bot_add_seguimiento`
6. `bot_list_pending`

**Tools cableadas tras la migración (25):** ver lista completa en `system-prompt-asesor-v2.md`.

---

## 4. Plan de instalación (3 pasos)

### Paso 1 — Aplicar la migración a Supabase producción

Abre **Supabase Dashboard → SQL Editor → New Query**, copia el contenido de `supabase/migrations/008_bot_full_crm_coverage.sql` y ejecuta. Después corre la verificación:

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'bot_list_tasks',
    'bot_add_expediente_note',
    'bot_add_expediente_voice',
    'bot_list_expediente',
    'bot_set_ai_agent',
    'bot_pin_lead',
    'bot_get_lead_history',
    'bot_get_dashboard_stats',
    'bot_quick_search'
  )
ORDER BY routine_name;
-- Debe devolver las 9 filas.
```

Y refresca el caché de PostgREST:
```sql
NOTIFY pgrst, 'reload schema';
```

### Paso 2 — Cablear las 9 RPCs nuevas en n8n (workflow v4 → v5)

Duplica el workflow `stratos-telegram-bot-v4` y renómbralo `v5`. En el nodo **AI Agent**, agrega un **Tool: HTTP Request** por cada RPC nueva. Plantilla:

- **Method:** POST
- **URL:** `{{$env.SUPABASE_URL}}/rest/v1/rpc/<nombre_rpc>`
- **Authentication:** Header Auth
  - `apikey: {{$env.SUPABASE_SERVICE_ROLE_KEY}}`
  - `Authorization: Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}`
  - `Content-Type: application/json`
- **Body (JSON):** según los parámetros de cada RPC (las firmas exactas están en la migración).

Ejemplo para `bot_add_expediente_note`:
```json
{
  "p_telegram_chat_id": {{ $('Telegram Trigger').first().json.message.chat.id }},
  "p_phone": "{{$fromAI('phone')}}",
  "p_titulo": "{{$fromAI('titulo')}}",
  "p_contenido": "{{$fromAI('contenido')}}",
  "p_source": "telegram"
}
```

En la descripción del tool, pega el resumen de la sección **Tools disponibles** del `system-prompt-asesor-v2.md` (línea por línea) para que el modelo sepa cuándo invocarla.

### Paso 3 — Pegar el nuevo system prompt y activar

1. En el nodo **AI Agent → Options → System Message**, reemplaza todo con el contenido de `system-prompt-asesor-v2.md` (sólo lo que está debajo de la línea horizontal).
2. Asegúrate de que el nodo de Postgres Chat Memory siga apuntando a `n8n_chat_histories` (memoria conversacional).
3. Activa el workflow v5 y desactiva el v4.
4. Manda al bot un mensaje de prueba:
   - "qué tengo hoy" → ejercita `bot_list_pending`
   - "cómo voy este mes" → ejercita `bot_get_dashboard_stats`
   - "agrega al expediente de <nombre>: <texto>" → ejercita `bot_add_expediente_note`

---

## 5. Variables de entorno requeridas en n8n

```
SUPABASE_URL=https://glulgyhkrqpykxmujodb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # service_role, NO anon
TELEGRAM_BOT_TOKEN=123456789:ABC...   # del BotFather
```

Las RPCs `bot_*` están otorgadas a `service_role` específicamente — el bot no requiere autenticación de usuario, sino que se identifica al asesor pasando `p_telegram_chat_id` (la BD valida el pareo).

---

## 6. Qué hace cada RPC nueva (referencia rápida)

### `bot_list_tasks(chat_id, phone, only_pending=true) → jsonb`
Lista tareas del lead con sus `id` (los necesitas para `bot_complete_task`). Devuelve `{ success, lead_id, lead_name, count, tasks: [{ id, text, done, due_at, priority, order_idx }] }`.

### `bot_add_expediente_note(chat_id, phone, titulo, contenido, source='telegram') → jsonb`
Inserta un item `tipo='texto'` en `expediente_items` **y** lo appendea a `leads.notas` para compatibilidad con la UI actual.

### `bot_add_expediente_voice(chat_id, phone, titulo, transcripcion, duracion_seg?, storage_path?) → jsonb`
Inserta item `tipo='audio'` en `expediente_items` **y** registra una `comunicacion` paralela con la transcripción (para el timeline cronológico).

### `bot_list_expediente(chat_id, phone, limit=10) → jsonb`
Lista los items del expediente, más recientes primero.

### `bot_set_ai_agent(chat_id, phone, agent_key) → jsonb`
Asigna o quita el agente IA. Valores: `reactivar`, `seguimiento`, `callcenter`, `calificar`, o NULL/vacío para quitar. Registra un `lead_event`.

### `bot_pin_lead(chat_id, phone, pinned=true) → jsonb`
Manipula `profiles.crm_prefs.pinned[]` del asesor. Idempotente — pinear dos veces no duplica.

### `bot_get_lead_history(chat_id, phone, limit=20) → jsonb`
Mezcla `lead_events` + `comunicaciones` en orden cronológico inverso. Devuelve `{ events: [{ source, type, action, occurred_at, metadata }] }`.

### `bot_get_dashboard_stats(chat_id, scope='me') → jsonb`
KPIs del asesor: total, activos, cerrados, hot, score promedio, pipeline en USD, pendientes hoy, vencidos. `scope='org'` solo para roles director/ceo/admin/super_admin.

### `bot_quick_search(chat_id, query, limit=10) → jsonb`
Busca por nombre, email o dígitos del teléfono. Devuelve hasta 25 resultados ordenados por score. **Esto es lo que llama el bot cuando el asesor menciona a alguien sin teléfono.**

---

## 7. Lo que NO está cubierto (decisiones explícitas)

- **No envía mensajes al cliente** (WhatsApp, email, llamada). El bot solo registra lo que el asesor ya hizo.
- **No agenda calendario externo** (Google Calendar, Zoom). Solo guarda `next_action_at`.
- **No edita catálogos** (proyectos, campañas, tags, asesores). Solo web.
- **No hard-delete.** Solo soft-delete (recuperable desde web).
- **No reordena prioridad.** Sólo añade/quita del set pinned; el orden manual es drag & drop en web.

---

## 8. Próximos pasos opcionales (Fase 3)

Si la cobertura completa funciona bien, los siguientes pasos naturales son:

1. **Notificaciones push del bot al asesor** — cron diario que llame `bot_list_pending` y envíe los pendientes del día a las 8 AM por Telegram.
2. **Recordatorios de próxima acción** — al llegar `next_action_at`, mandar mensaje al asesor.
3. **Reactivación automática** — cron semanal que detecte leads con `ai_agent='reactivar'` y proponga acciones (llama a la Edge Function `suggest-next-actions`).
4. **Comandos slash** — `/agenda`, `/kpi`, `/buscar <nombre>` para atajos más rápidos.
5. **Sub-bot WhatsApp** — replicar el mismo conjunto de RPCs vía WhatsApp Business.

Todos estos viven como **nuevos workflows en n8n**, sin tocar el repo de la app web (regla del proyecto: agentes IA viven en n8n).
