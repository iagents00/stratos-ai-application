# Handoff — Bot de Telegram con registro completo en CRM

> **Para**: el próximo dev que tome esta tarea con Claude Code en una sesión nueva del proyecto Stratos AI.
> **Objetivo**: que el bot de Telegram registre **todo** lo que hace el asesor (llamadas, WhatsApp, Zoom, visitas, notas) en el CRM como filas estructuradas en `comunicaciones`, listas para análisis IA futuro.

---

## TL;DR

1. **Aplicar la migration 008** en Supabase (un Run en SQL Editor).
2. **Confirmar smoke tests** post-deploy (queries listas al final del SQL).
3. **No tocar n8n** — el bot v4 ya queda funcional automáticamente porque `bot_add_seguimiento` se actualizó en la migration 008 para que ADEMÁS de bumpear contador, inserte en `comunicaciones`.
4. **(Opcional, fase 2)**: añadir un nuevo tool al workflow n8n para enviar transcripciones largas vía `bot_add_comunicacion`.

Tiempo estimado: 30 min (sin el opcional).

---

## Contexto del proyecto

- Stack: React 18 + Vite + Supabase (Postgres) + n8n (bot Telegram).
- Supabase project ID: `glulgyhkrqpykxmujodb` · cuenta: `synergyfornature@gmail.com`.
- El bot vive como workflow en n8n: `n8n/workflows/stratos-telegram-bot-v4.json` (es el activo).
- Regla del proyecto: **todo agente de IA va en n8n**, no en código del repo.
- Voz del bot: sin emojis, pocas palabras, confirma antes de escribir. Ver `MEMORY.md`.

---

## Lo que ya está en el repo

- ✅ `supabase/migrations/008_comunicaciones_y_expediente.sql` — migration completa, idempotente, auditada contra producción.
- ✅ `DATABASE_CRM.md` — referencia del schema para devs.
- ✅ `n8n/workflows/stratos-telegram-bot-v4.json` — bot funcional. Usa estos RPCs:
  - `identify_asesor_by_telegram` (al inicio de cada turno)
  - `consume_telegram_pairing_code` (pareo)
  - `bot_get_lead_by_phone` (consulta)
  - `bot_upsert_lead` (alta/edición)
  - `bot_add_seguimiento` ← **este es el que se actualiza en migration 008**
  - `bot_list_pending` (agenda)

---

## Qué cambia con migration 008

### Antes (estado actual de prod)
Cuando el asesor le dice al bot _"llamé a Juan, no contestó"_:
1. Bot llama `bot_add_seguimiento(chat_id, '555-1234', 'llamada', 'no contestó')`.
2. RPC bumpea `leads.seguimientos += 1`.
3. RPC appendea a `leads.notas` un texto tipo `[28-Apr 14:30 · llamada] no contestó`.
4. **No queda fila estructurada**. La IA futura no puede analizar nada.

### Después (con migration 008)
Mismo input. Misma firma de RPC. Mismo retorno. Pero ahora:
1. RPC inserta una fila en `comunicaciones`:
   ```
   tipo='llamada', resumen='no contestó', asesor_id, lead_id,
   organization_id, ocurrio_en=now(), direccion='outbound'
   ```
2. El trigger `bump_lead_seguimientos` bumpea el contador (ya no lo hace la RPC manualmente).
3. La RPC sigue appendeando a `leads.notas` para no romper la UI legacy.
4. **Bot v4 funciona sin tocar nada.** Pero ahora hay historial estructurado.

---

## Plan de aplicación

### Paso 1 — Aplicar migration 008 (5 min)

**Vía Supabase Dashboard** (recomendado primera vez):
1. Abrir https://supabase.com → proyecto `glulgyhkrqpykxmujodb` → SQL Editor → New query.
2. Pegar el contenido de `supabase/migrations/008_comunicaciones_y_expediente.sql`.
3. Run. Idempotente.

**Vía CLI**:
```bash
supabase db push
```

### Paso 2 — Smoke tests (5 min)

En SQL Editor:

```sql
-- Tablas creadas
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public'
   AND table_name IN ('comunicaciones','expediente_items');
-- Esperado: 2 filas

-- RPCs disponibles
SELECT routine_name FROM information_schema.routines
 WHERE routine_schema='public'
   AND routine_name IN (
     'get_lead_ai_context','add_comunicacion','add_expediente_item',
     'bot_add_comunicacion','bot_add_seguimiento','search_comunicaciones'
   );
-- Esperado: 6 filas

-- Test funcional: insertar una comm de prueba en un lead real
SELECT public.add_comunicacion(
  (SELECT id FROM public.leads WHERE phone_normalized IS NOT NULL LIMIT 1),
  'nota',
  'Smoke test desde migration 008',
  'Esta es una transcripción de prueba para validar el pipeline.'
);
-- Esperado: devuelve un UUID

-- Verificar que el counter de seguimientos se bumpeó
-- (solo ocurre si tipo es llamada/whatsapp/etc, no para 'nota')

-- Verificar context para IA
SELECT public.get_lead_ai_context(
  (SELECT id FROM public.leads WHERE phone_normalized IS NOT NULL LIMIT 1),
  10, 10
);
-- Esperado: jsonb con lead, asesor, comunicaciones (incluye la del paso anterior), expediente

-- Limpiar smoke test
DELETE FROM public.comunicaciones WHERE resumen='Smoke test desde migration 008';
```

### Paso 3 — Test end-to-end con el bot (10 min)

1. Abre Telegram, manda al bot: _"llamé a [un teléfono real de tu CRM], no contestó"_.
2. Bot confirma → tú dices "sí".
3. En SQL Editor:
   ```sql
   SELECT id, tipo, resumen, ocurrio_en, asesor_id
   FROM public.comunicaciones
   ORDER BY created_at DESC
   LIMIT 1;
   ```
4. Esperado: aparece la fila con `tipo='llamada'`, `resumen='no contestó'`, `asesor_id` correcto.
5. Verificar:
   ```sql
   SELECT name, seguimientos, last_activity, notas
   FROM public.leads
   WHERE phone_normalized = '<el-tel-normalizado>';
   ```
6. Esperado: `seguimientos +1`, `last_activity` actualizado, `notas` con el append.

### Paso 4 — (Opcional) Tool de transcripción larga en n8n

Para casos donde tienes la transcripción completa de un Zoom o WhatsApp voice, añadir un nuevo tool al workflow:

- **Nombre**: `bot_add_comunicacion`
- **URL**: `{{ $env.SUPABASE_URL }}/rest/v1/rpc/bot_add_comunicacion`
- **Method**: POST · auth con `SUPABASE_SERVICE_ROLE_KEY`
- **Body**:
  ```json
  {
    "p_telegram_chat_id": "{{ $('Telegram Trigger').item.json.message.chat.id }}",
    "p_lead_phone": "{{ $fromAI('phone') }}",
    "p_tipo": "{{ $fromAI('tipo') }}",
    "p_resumen": "{{ $fromAI('resumen') }}",
    "p_transcript": "{{ $fromAI('transcript') }}",
    "p_recording_url": "{{ $fromAI('recording_url') }}",
    "p_duracion_segundos": "{{ $fromAI('duracion') }}"
  }
  ```
- **System message addendum**:
  > Si el asesor pega o adjunta una transcripción larga (más de 200 caracteres) o un link a una grabación, usa `bot_add_comunicacion` en vez de `bot_add_seguimiento`. La transcripción completa va en `p_transcript`. La IA podrá analizarla después.

---

## Prompt EXACTO para Claude Code en la nueva sesión

Copia y pega esto en una conversación nueva de Claude Code abierta en `/Users/ivanrodriguezruelas/Stratos AI`:

```
Tarea: dejar el bot de Telegram registrando todo en el CRM como filas estructuradas en `comunicaciones`, listo para análisis IA futuro.

Lee primero estos archivos para tener contexto:
- DATABASE_CRM.md
- HANDOFF_TELEGRAM_BOT.md
- supabase/migrations/008_comunicaciones_y_expediente.sql

La migration 008 ya está escrita y auditada contra producción. Los pasos son:

1. Aplica la migration 008 al Supabase de producción (project_id glulgyhkrqpykxmujodb). Usa el MCP de Supabase si está disponible (apply_migration o execute_sql), o instrúyeme cómo hacerlo desde el dashboard si no.

2. Corre los smoke tests del paso 2 de HANDOFF_TELEGRAM_BOT.md y muéstrame los resultados.

3. Pídeme que haga un test real con el bot de Telegram (paso 3) y verifica conmigo que aparece la fila en `comunicaciones`.

4. Si todo OK, pregúntame si quiero también añadir el tool opcional `bot_add_comunicacion` al workflow n8n (paso 4 — para transcripciones largas de Zoom/voice). Si digo que sí, edita `n8n/workflows/stratos-telegram-bot-v4.json` añadiendo el nodo y actualizando el system message.

Reglas:
- No toques nada del frontend de React.
- No edites migrations 001-007.
- Si una smoke test falla, NO sigas — diagnostica y reporta antes de avanzar.
- Si el MCP de Supabase no está disponible, pídeme que aplique la migration manualmente desde el dashboard y espera mi confirmación antes del paso 2.
```

---

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `function bot_add_seguimiento(bigint, text, text, text, jsonb) does not exist` después de aplicar 008 | Schema cache de PostgREST stale | `NOTIFY pgrst, 'reload schema';` (la migration ya lo hace, pero a veces tarda 1-2 seg) |
| Bot dice "Registrado" pero `comunicaciones` está vacía | El asesor no está pareado o el lead no se encontró por `phone_normalized` | Verificar `SELECT telegram_chat_id FROM profiles WHERE name=...` y `SELECT phone_normalized FROM leads WHERE name=...` |
| Counter `seguimientos` se incrementa 2 veces | Doble bump (manual + trigger) | No debería pasar con la migration 008 — verifica que el body de `bot_add_seguimiento` quedó como en 008 (sin el UPDATE manual de seguimientos) |
| RLS bloquea SELECT desde la app | El frontend hace queries crudos a `comunicaciones` sin pasar por RPC | Usar `supabase.rpc('get_lead_ai_context', ...)` o revisar policy `comunicaciones_select` |
| Error `column "embedding" does not exist` | Alguien descomentó la línea de pgvector sin instalar la extensión | `CREATE EXTENSION IF NOT EXISTS vector;` o volver a comentar la columna |

---

## Roadmap futuro (no bloqueante)

Una vez aplicada 008, queda preparado el terreno para:

1. **Worker de análisis IA** — Edge Function que cada N minutos busca filas con `ai_analyzed_at IS NULL AND transcript IS NOT NULL`, llama a Claude, rellena `ai_summary`, `ai_intents`, `ai_sentiment`, etc.
2. **Wiring del expediente en la UI** — el componente `UpdateChatPanel` (`src/app/views/CRM/components.jsx` ~L1418) hoy guarda items solo en `useState`. Cablearlo a `add_expediente_item` RPC. Buckets de Storage (`expediente-files`, `call-recordings`) hay que crearlos en el dashboard de Supabase.
3. **Reporting nuevo** — dashboards que usen `search_comunicaciones` y agrupen por `ai_topics` / `ai_sentiment` para insights de pipeline.
4. **RAG semántico** — habilitar `pgvector`, descomentar `embedding vector(1536)` en migration 008 y añadir índice IVFFlat. Búsqueda por similitud en vez de keywords.

---

*Documento creado: 2026-04-30. Producción auditada en proyecto `glulgyhkrqpykxmujodb`.*
