# Prompt para el dev externo (Claude Code en otra laptop, mismo repo)

> El dev clona el repo de Stratos AI, abre Claude Code en la raíz del proyecto, y pega TODO lo que está entre las dos líneas `---` de abajo como primer mensaje.

El dev tiene acceso a las cuentas de Supabase y n8n del proyecto.

---

# Tarea

Necesito que dejes listo el bot de Telegram del CRM para que registre todo lo que hace el asesor (llamadas, WhatsApp, Zoom, visitas, notas) como filas estructuradas en una tabla `comunicaciones` en Supabase. Esto prepara el terreno para que en el futuro la IA analice conversaciones completas (transcripts de Zoom, WhatsApp voice, etc.).

Tienes acceso completo a Supabase y n8n del proyecto.

# Contexto

- Stratos AI — CRM inmobiliario. React 18 + Vite + Supabase + n8n.
- Supabase project ID: `glulgyhkrqpykxmujodb` (cuenta `synergyfornature@gmail.com`).
- Dashboard: https://supabase.com/dashboard/project/glulgyhkrqpykxmujodb
- SQL Editor: https://supabase.com/dashboard/project/glulgyhkrqpykxmujodb/sql/new
- Bot Telegram: workflow n8n en `n8n/workflows/stratos-telegram-bot-v4.json`. Ya está activo y funcional usando los RPCs `bot_upsert_lead`, `bot_get_lead_by_phone`, `bot_add_seguimiento`, `bot_list_pending`.
- **Reglas del proyecto** (no romper):
  - Sin emojis en código ni respuestas (ver `CLAUDE.md` y `MEMORY.md`).
  - Todo agente IA va en n8n, no en el repo.
  - No tocar el frontend de React para esta tarea.
  - No editar migrations 001-007.

# Lo que ya está hecho (no rehagas, solo léelo)

Estos archivos ya existen en el repo y están auditados contra producción:

- `supabase/migrations/008_comunicaciones_y_expediente.sql` — migration que crea `comunicaciones`, `expediente_items`, los RPCs nuevos, y reescribe `bot_add_seguimiento` por dentro para que el bot v4 actual empiece a registrar estructurado SIN tocar n8n.
- `DATABASE_CRM.md` — referencia del schema completo del CRM.
- `HANDOFF_TELEGRAM_BOT.md` — guía detallada con troubleshooting.

# Estado actual de producción (verificado)

7 de 8 migrations ya aplicadas. Solo falta la 008. En producción ya existen:
- `organizations` (3 filas), `profiles` (10), `leads` (118), `audit_log` (697).
- `leads.phone_normalized`, `leads.organization_id`, `profiles.telegram_chat_id`.
- Helpers `set_updated_at`, `current_organization_id`, `is_admin_or_above`, `audit_trigger_func`.
- Diccionario FTS `spanish` disponible.
- Las tablas `comunicaciones` y `expediente_items` NO existen aún (apply limpio).

# Plan a ejecutar

## Paso 0 — Sincronizar repo
```bash
git status
git pull --rebase
```
Si hay cambios locales sin commitear, repórtamelo y NO sigas.

## Paso 1 — Lee los archivos clave en orden
1. `DATABASE_CRM.md`
2. `HANDOFF_TELEGRAM_BOT.md`
3. `supabase/migrations/008_comunicaciones_y_expediente.sql`

No me hagas preguntas hasta haberlos leído.

## Paso 2 — Aplica migration 008 a producción

Si tienes el MCP de Supabase configurado en este Claude Code (tools `mcp__supabase__*`), aplícala directo con `project_id = glulgyhkrqpykxmujodb` usando `apply_migration` o `execute_sql`. La migration es idempotente.

Si no tienes el MCP, abre el SQL Editor del dashboard, pega el contenido de `supabase/migrations/008_comunicaciones_y_expediente.sql` y dale Run. Reporta el output completo (errores incluidos).

## Paso 3 — Smoke tests

Corre estos 3 queries y reporta los resultados:

```sql
-- 1. Tablas creadas (esperado: 2 filas)
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public'
   AND table_name IN ('comunicaciones','expediente_items');

-- 2. RPCs disponibles (esperado: 5 filas)
SELECT routine_name FROM information_schema.routines
 WHERE routine_schema='public'
   AND routine_name IN (
     'add_comunicacion','add_expediente_item','get_lead_ai_context',
     'bot_add_comunicacion','search_comunicaciones'
   );

-- 3. Test funcional
SELECT public.add_comunicacion(
  (SELECT id FROM public.leads WHERE phone_normalized IS NOT NULL LIMIT 1),
  'nota',
  'Smoke test post-008',
  'Transcripción de prueba.'
);
SELECT id, tipo, resumen FROM public.comunicaciones
 WHERE resumen='Smoke test post-008';
DELETE FROM public.comunicaciones WHERE resumen='Smoke test post-008';
```

Si algún resultado no es el esperado, NO sigas — diagnostica primero.

## Paso 4 — Test end-to-end del bot

Pídeme (al dueño del proyecto) que mande al bot de Telegram algo como:

> llamé a [un teléfono real del CRM], no contestó

Cuando el bot confirme y yo diga "sí", verifica con:

```sql
SELECT id, tipo, resumen, ocurrio_en, asesor_id, lead_id, organization_id
FROM public.comunicaciones
ORDER BY created_at DESC LIMIT 1;
```

Tiene que aparecer la fila estructurada con `tipo='llamada'`. Si aparece, el deploy es exitoso. Si no, diagnostica.

## Paso 5 — (Opcional) Tool n8n para transcripts largos

Pregúntame si quiero ahora añadir el tool `bot_add_comunicacion` al workflow n8n para soportar transcripciones largas de Zoom y WhatsApp voice (detalle en `HANDOFF_TELEGRAM_BOT.md` Paso 4).

Si digo que sí:
- Edita `n8n/workflows/stratos-telegram-bot-v4.json` añadiendo el nodo nuevo y actualizando el system message según `HANDOFF_TELEGRAM_BOT.md`.
- Commitea con mensaje claro: `git add n8n/ && git commit -m "n8n: add bot_add_comunicacion tool for long transcripts"`
- Push: `git push origin main` (o crea PR si así prefieren).
- Recuérdame que hay que re-importar el workflow actualizado a n8n.

Si digo que no, queda pendiente.

# Reglas a no romper

- Migrations 001-007: no editar.
- Frontend (`src/`): no tocar.
- Si un smoke test falla, no avances.
- Sin emojis en código ni respuestas.
- Cualquier cambio al repo: commit con mensaje claro.

# Reporte final

Cuando termines, dame un resumen con:

1. Migration 008 aplicada: sí / no (y si fue por MCP o dashboard).
2. Los 3 smoke tests: pasaron / no (con resultados crudos).
3. Test del bot Telegram: pasó / no (mostrando la fila creada en `comunicaciones`).
4. Tool opcional `bot_add_comunicacion` en n8n: añadido / pendiente.
5. Commits creados (si los hubo): SHA y mensajes.

---

*Fin del prompt. El dev externo copia todo lo de arriba (entre las dos líneas `---`) y lo pega como primer mensaje en su Claude Code.*
