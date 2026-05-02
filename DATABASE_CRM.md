# Stratos AI — Esquema de Base de Datos del CRM

> **Audiencia:** desarrolladores que trabajan en el frontend, el bot de Telegram (n8n), o cualquier integración futura con IA.
> **Estado:** migrations 001 → 007 aplicadas en producción (proyecto Supabase `glulgyhkrqpykxmujodb`). Migration 008 lista para aplicar.

---

## 1. Modelo en una pantalla

```
organizations
   │
   ├─ profiles            (asesores, admins — incluye telegram_chat_id)
   │
   ├─ leads               (clientes — perfil completo)
   │     ├─ comunicaciones        (llamadas, WhatsApp, Zoom, … con transcripts)   ← migration 008
   │     ├─ expediente_items      (docs, INE, comprobantes, fotos, audios)         ← migration 008
   │     └─ audit_log             (trazabilidad de cambios en leads / profiles)
   │
   └─ audit_log
```

**Multi-tenant pool model**: cada fila lleva `organization_id`. RLS aísla a una org de otra.

---

## 2. Tablas y para qué sirven

### 2.1 `leads` — el cliente

Una fila contiene **todo el perfil del CRM**: contacto, etapa del pipeline, scoring IAOS, presupuesto, próxima acción, asesor asignado, notas en texto plano del expediente, action_history (jsonb) y tasks (jsonb).

Campos clave:

| Campo | Tipo | Para qué |
|---|---|---|
| `id` | uuid | PK |
| `organization_id` | uuid | tenancy |
| `asesor_id` / `asesor_name` | uuid / text | dueño del lead (RLS de prod matchea por `asesor_name = current_user_name()`) |
| `name`, `phone`, `email` | text | contacto |
| `phone_normalized` | text | lookup único por org (lo usa el bot) |
| `stage` | text | etapa pipeline (10 valores: Nuevo Registro → Cierre/Perdido) |
| `score` | int | IAOS 0-100 |
| `hot`, `is_new` | bool | flags |
| `budget` / `presupuesto` | text / bigint | libre + parseado |
| `bio`, `risk`, `tag`, `friction` | text | perfil narrativo |
| `next_action`, `next_action_at`, `next_action_date` | text/timestamptz/text | próximo paso |
| `last_activity` | text | última cosa que pasó |
| `seguimientos` | int | contador (se actualiza solo al insertar en `comunicaciones`) |
| `notas` | text | expediente narrativo en texto plano (auto-save desde la UI) |
| `action_history` | jsonb | timeline de cambios automáticos |
| `tasks` | jsonb | checklist interno |
| `fecha_ingreso` | timestamptz | primer contacto real (≠ `created_at`) |
| `playbook` | jsonb | guía de IA para este lead |
| `telegram_user_id` | bigint | si vino del bot |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | auditoría / soft delete |

**Reglas:**
- Nunca borres con `DELETE`. Usa `UPDATE … SET deleted_at = now()`.
- No actualices `seguimientos` a mano: insertar en `comunicaciones` lo bumpea solo.
- El frontend escribe directo a la tabla (`supabase.from('leads').update(...)` y `.insert(...)`).

---

### 2.2 `comunicaciones` — historial de contactos (con transcripts para IA)

**Esta tabla es la base sobre la que se construyen las funciones de IA.** Cada llamada, WhatsApp, Zoom o visita es una fila con su **transcripción completa**.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `organization_id`, `lead_id`, `asesor_id` | uuid | tenancy + ownership (auto-rellenados por trigger) |
| `tipo` | text | `llamada` · `whatsapp` · `sms` · `email` · `zoom` · `meet` · `teams` · `visita` · `nota` · `otro` |
| `direccion` | text | `inbound` · `outbound` · `interno` |
| `ocurrio_en` | timestamptz | cuándo pasó realmente |
| `duracion_segundos` | int | duración |
| `resumen` | text | 1–2 líneas que escribe el asesor |
| `resultado` | text | `contactado` · `no_contesto` · `interesado` · `cierre` · etc. |
| **`transcript`** | **text** | **transcripción completa. TEXT acepta hasta 1 GB con TOAST — un Zoom de 4 horas (~500 KB) cabe sobrado.** |
| `transcript_lang` / `transcript_provider` / `transcript_confidence` | text/text/numeric | metadata de transcripción |
| `audio_url`, `recording_url` | text | apuntan a Supabase Storage |
| `attachments` | jsonb | adjuntos extra |
| `ai_summary`, `ai_key_points`, `ai_sentiment`, `ai_intents`, `ai_topics`, `ai_action_items` | text/jsonb/text/jsonb/text[]/jsonb | rellenados por worker IA |
| `ai_model`, `ai_analyzed_at`, `ai_token_count` | text/timestamptz/int | tracking |

**Cómo se llena:**
1. El asesor sube/registra el contacto desde la UI, o el bot lo manda por Telegram, o n8n lo recibe del webhook de Twilio/Zoom.
2. Si hay audio, un job de IA lo transcribe → `transcript`.
3. Otro job analiza `transcript` y rellena los campos `ai_*`.
4. El trigger `bump_lead_seguimientos` ya incrementó `leads.seguimientos` y actualizó `last_activity`.

**Búsqueda:** índice GIN en español sobre `resumen + transcript + ai_summary`. Usa la RPC `search_comunicaciones('financiamiento bancario')`.

---

### 2.3 `expediente_items` — documentos y archivos del cliente

INE, pasaporte, comprobantes de ingresos, contratos, fotos, audios sueltos, notas largas. Todo lo que **no es una conversación** pero forma parte del expediente.

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `organization_id`, `lead_id`, `created_by` | uuid | tenancy |
| `tipo` | text | `nota` · `texto` · `transcripcion` · `documento` · `pdf` · `imagen` · `foto` · `video` · `audio` · `audio_message` · `ine` · `pasaporte` · `comprobante_ingresos` · `comprobante_domicilio` · `rfc` · `curp` · `acta_constitutiva` · `estado_cuenta` · `contrato` · `propuesta` · `cotizacion` · `otro` |
| `titulo` | text | |
| `contenido` | text | para tipos texto/nota/transcripcion |
| `file_path` | text | path en Supabase Storage (no URL pública) |
| `file_size_bytes`, `file_mime_type` | bigint, text | metadata del archivo |
| `ai_extracted_text` | text | OCR de un PDF, transcripción de un audio. **Permite buscar y razonar sobre el contenido del archivo.** |
| `ai_summary`, `ai_metadata`, `ai_analyzed_at`, `ai_model` | — | igual patrón que comunicaciones |
| `tags` | text[] | etiquetas libres |
| `source` | text | `manual` · `telegram` · `email_parser` · etc. |

**Storage convention** (configurar en Supabase Dashboard → Storage):
- Bucket privado `expediente-files` con política RLS por `organization_id`.
- Path sugerido: `{organization_id}/{lead_id}/{uuid}-{filename}`.
- Bucket privado `call-recordings` para audios y videos de llamadas/Zoom; retención 90 días.

---

### 2.4 `profiles`, `audit_log`, `organizations`

- **`profiles`**: una fila por usuario. Incluye `role` (`super_admin/admin/ceo/director/asesor`), `organization_id`, `telegram_chat_id` (para el bot).
- **`audit_log`**: append-only. Triggers automáticos en `leads` y `profiles` registran cada INSERT/UPDATE/DELETE con diff. **No se aplica a `comunicaciones` / `expediente_items`** (ver §4 de la migration 008 — evita duplicar transcripts).
- **`organizations`**: un cliente del SaaS. `plan`, `seats`, `subscription_status`.

---

## 3. RLS — quién ve qué

Todas las tablas tienen RLS activo. Las reglas:

| Tabla | Lectura | Escritura |
|---|---|---|
| `leads` | misma org **Y** (admin **O** `can_view_all_leads()` **O** `asesor_name = current_user_name()`) | igual |
| `comunicaciones` | misma org **Y** existe el lead visible para el caller (delegado a RLS de leads) | igual + admin-or-creator para UPDATE |
| `expediente_items` | igual que comunicaciones | igual |
| `audit_log` | super_admin/admin/ceo ven todo; resto ve solo sus propias acciones | append-only desde triggers |

**Patrón clave** en comunicaciones / expediente: la visibilidad se delega a la RLS de `leads`. Si el usuario puede `SELECT` el lead, puede ver sus comms y expediente. Esto reusa automáticamente las reglas de asesor sin duplicarlas.

---

## 4. RPCs — cómo el frontend / bot / IA hablan con la BD

**Llamar siempre por RPC, no por queries crudos** — así no acoplas el cliente al schema.

### `add_comunicacion(...)` → `uuid`
Inserción canónica desde el frontend autenticado. RLS aplica.
```js
const { data: id } = await supabase.rpc('add_comunicacion', {
  p_lead_id: leadId,
  p_tipo: 'zoom',
  p_resumen: 'Zoom de seguimiento — interesado en Torre 25',
  p_transcript: fullTranscript,        // string de cualquier tamaño
  p_direccion: 'outbound',
  p_resultado: 'interesado',
  p_duracion_segundos: 1820,
  p_recording_url: 'storage://call-recordings/...',
  p_metadata: { zoom_meeting_id: '8245...' },
})
```

### `add_expediente_item(...)` → `uuid`
```js
await supabase.rpc('add_expediente_item', {
  p_lead_id: leadId,
  p_tipo: 'ine',
  p_titulo: 'INE de Rafael',
  p_file_path: 'uploaded/path/in/storage.jpg',
  p_file_size: 254118,
  p_file_mime: 'image/jpeg',
  p_tags: ['identificacion', 'vigente'],
})
```

### `get_lead_ai_context(lead_id, max_comms?, max_exp?)` → `jsonb`
**Este es el payload que la IA recibe como contexto.** Devuelve:
```json
{
  "lead":          { ...todos los campos del lead },
  "asesor":        { id, name, role, ... },
  "comunicaciones":[ { ...incluye transcript completo y campos ai_* }, ... ],
  "expediente":    [ { ...incluye ai_extracted_text }, ... ],
  "generated_at":  "2026-04-30T..."
}
```

### `search_comunicaciones(query, lead_id?, tipo?, limit?)`
Full-text search en español. Devuelve filas ordenadas por relevancia con un `snippet` resaltado.

### `bot_add_comunicacion(chat_id, phone, tipo, resumen, transcript, direccion, metadata, audio_url, recording_url, duracion_segundos)`
Versión `service_role` para n8n / webhooks. Identifica al asesor por `telegram_chat_id`, resuelve el lead por `phone_normalized` dentro de su org, bypassa RLS (`SECURITY DEFINER`).

### `bot_add_seguimiento(chat_id, phone, tipo, resumen, metadata)` — actualizado en 008
La RPC que ya usa el bot v4 de n8n. **Después de migration 008**: además de bumpear el contador y appendear a `notas`, inserta una fila estructurada en `comunicaciones`. **El bot v4 funciona sin cambios** y empieza a producir historial estructurado automáticamente.

### Otras RPCs ya existentes (de migrations 006-007)
- `bot_upsert_lead(chat_id, phone, datos…)` — crea/actualiza lead desde el bot.
- `bot_get_lead_by_phone(chat_id, phone)` — consulta ficha.
- `bot_list_pending(chat_id)` — pendientes del día.
- `request_telegram_pairing_code()` / `consume_telegram_pairing_code(code)` — pareo.
- `identify_asesor_by_telegram(chat_id)` — identificación.

---

## 5. Flujos típicos

### A) Asesor registra una llamada desde la app
1. UI llama `add_comunicacion(tipo='llamada', resumen, transcript?, ...)`.
2. Trigger `comunicaciones_set_org` rellena `organization_id` y `asesor_id`.
3. Trigger `comunicaciones_bump_counter` incrementa `leads.seguimientos` y actualiza `last_activity`.
4. Worker async detecta `ai_analyzed_at IS NULL` → llama Claude → rellena `ai_summary`, `ai_intents`, etc.

### B) Bot Telegram registra un seguimiento
1. Asesor: "llamé a Juan 555-1234, no contestó".
2. n8n llama `bot_add_seguimiento(chat_id, '555-1234', 'llamada', 'no contestó')`.
3. RPC inserta fila en `comunicaciones` (el trigger bumpea contador), appendea legacy a `notas`.

### C) IA responde "qué propondrías a este lead"
1. Frontend llama `get_lead_ai_context(lead_id)`.
2. Backend mete el JSON resultante en el system prompt de Claude.
3. Claude razona con perfil + últimas 20 conversaciones (transcripts) + INE/comprobantes ya extraídos.

### D) Búsqueda "todos los leads que mencionaron crédito hipotecario"
1. UI llama `search_comunicaciones('crédito hipotecario')`.
2. Recibe filas con `lead_id`, `snippet`, `rank`.
3. Agrupa por `lead_id` y muestra.

---

## 6. Pipeline de análisis con IA

```
[ Captura: UI / Bot / Webhook ]
        │
        ▼
   comunicaciones (transcript = texto crudo)
        │
        ▼
  Worker async (n8n / Supabase Edge Function)
   ├─ busca filas con ai_analyzed_at IS NULL
   ├─ llama Claude con el transcript
   └─ UPDATE: ai_summary, ai_key_points, ai_sentiment,
              ai_intents, ai_topics, ai_action_items,
              ai_model, ai_analyzed_at, ai_token_count
        │
        ▼
  Disponible para reporting / RAG / dashboards
```

**Modelos recomendados**: Claude Sonnet 4.6 para análisis individual (rápido y barato); Claude Opus 4.7 para análisis estratégicos sobre `get_lead_ai_context`.

**RAG futuro**: si activas la extensión `pgvector` en Supabase, descomenta la columna `embedding vector(1536)` en migration 008 y agrega un índice IVFFlat. Búsqueda semántica con `<->` en vez de `@@`.

---

## 7. Cómo aplicar la migration 008

```bash
# Opción A — Supabase Dashboard
# 1. Abre supabase.com → proyecto glulgyhkrqpykxmujodb → SQL Editor → New query
# 2. Pega supabase/migrations/008_comunicaciones_y_expediente.sql
# 3. Run. Es idempotente, puedes correrla varias veces.

# Opción B — Supabase CLI
supabase db push
```

**Verificación post-deploy** (queries listas al final del archivo SQL):
```sql
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public'
   AND table_name IN ('comunicaciones','expediente_items');

SELECT routine_name FROM information_schema.routines
 WHERE routine_schema='public'
   AND routine_name IN (
     'get_lead_ai_context','add_comunicacion','add_expediente_item',
     'bot_add_comunicacion','bot_add_seguimiento','search_comunicaciones'
   );
```

---

## 8. Reglas para devs (no romper esto)

1. **Nunca insertar directamente en `audit_log`** — los triggers lo hacen solos. Solo el cliente puede insertar eventos `entity_type='auth'`.
2. **Nunca actualizar `leads.seguimientos` a mano** — insertar en `comunicaciones` lo sincroniza vía trigger.
3. **Nunca borrar con `DELETE`** — `UPDATE … SET deleted_at = now()`. Las RLS y los índices ya filtran por `deleted_at IS NULL`.
4. **Usar las RPCs**, no INSERTs crudos para comunicaciones / expediente — los triggers necesitan que `auth.uid()` esté disponible.
5. **Tamaño de transcript**: no hay límite duro hasta 1 GB. Si vas a guardar audios crudos > 5 min, súbelos a Storage y guarda solo la URL en `audio_url`/`recording_url`. La transcripción sí puede vivir en `transcript`.
6. **Multi-tenant**: nunca queries sin RLS desde el cliente. Si necesitas saltar RLS, es una RPC `SECURITY DEFINER` con auditoría.

---

## 9. Estado de migrations

| # | Archivo | Status |
|---|---|---|
| 001 | `001_initial_schema.sql` | ✅ aplicada |
| 002 | `002_leads_complete_schema.sql` | ✅ aplicada |
| 003 | `003_audit_log.sql` | ✅ aplicada |
| 004 | `004_performance_tuning.sql` | ✅ aplicada |
| 005 | `005_multi_tenant_scale.sql` | ✅ aplicada |
| 006 | `006_telegram_bot_support.sql` | ✅ aplicada |
| 007 | `007_telegram_bot_asesor_mode.sql` | ✅ aplicada |
| 008 | `008_comunicaciones_y_expediente.sql` | ⚠️ **PENDIENTE — APLICAR** |

---

*Última actualización: 2026-04-30. Auditada contra producción `glulgyhkrqpykxmujodb`.*
