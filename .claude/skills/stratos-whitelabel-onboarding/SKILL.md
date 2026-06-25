---
name: stratos-whitelabel-onboarding
description: >-
  Receta COMPLETA para montar / clonar / operar el Asistente CRM por Telegram de STRATOS
  (bot @Strato_sasistente_crm_bot; tenants Duke del Caribe, Stratos Sales, Grupo28; white-label).
  Úsala cuando haya que: dar de alta un tenant/org nuevo de Stratos, conectar su CRM
  (app.stratoscapitalgroup.com o su ruta/subdominio como /stratos-sales o /grupo28), crearle su bot
  de Telegram y dominio, entender/editar las funciones de Supabase del "cerebro" conversacional o el
  motor proactivo, arreglar el bot, o replicar todo. Cubre la diferencia entre usuarios asesor
  (normales) y admin (reciben las notificaciones/escalados).
---

# STRATOS — Asistente CRM por Telegram (white-label onboarding & operación)

> Esta skill captura TODO lo necesario para reproducir el sistema que ya funciona en producción.
> Sistema gemelo: el repo `Gvintell` tiene la skill equivalente (`gvintell-whitelabel-onboarding`).
> STRATOS y GVINTELL son **forks del mismo CRM** con esquema casi idéntico; los conceptos aquí aplican
> a ambos, pero **cada uno vive en su propia base Supabase** (aislamiento absoluto).

## 0. Constantes del proyecto (STRATOS)

| Cosa | Valor |
|---|---|
| Supabase project ref | `glulgyhkrqpykxmujodb` |
| Supabase URL | `https://glulgyhkrqpykxmujodb.supabase.co` |
| MCP server (en Claude) | `stratos-prod` |
| Bot Telegram | `@Strato_sasistente_crm_bot` (credencial n8n `Stratos Asistente CRM`, id `OTi7c2CC4gqxRapz`) |
| Dominio CRM | `app.stratoscapitalgroup.com` (+ ruta por tenant, p.ej. `/stratos-sales`, `/grupo28`) |
| Org Duke del Caribe | `00000000-0000-0000-0000-000000000001` |
| Otros tenants | Stratos Sales, Grupo28 (cada uno su `organization_id`) |
| Zona horaria | **Duke = SIEMPRE `America/Cancun` (regla fija).** Otros tenants vía `fn_user_tz` (profile→config→Cancún) |
| n8n | `https://personal-n8n.suwsiw.easypanel.host` (REST API con header `X-N8N-API-KEY`) |

> ⚠️ NUNCA mezclar con GVINTELL. Gvintell usa ref `vfakuhpumgwsnmczzkhk` y org `c1d2e3f4-…`.
> Son bases distintas: imposible que una acción cruce de tenant, pero hay que apuntar SIEMPRE al ref correcto.

## 1. Arquitectura — cómo fluye un mensaje

```
Telegram (asesor)
  → n8n "stratos telegram bot v5 — completo" (BOTv5, id vM5Yu1HRmUDPOCg7)
      • Switch UPDATE_TYPE (texto / voz→Whisper / foto / callback)
      • Set Input (text|voice)  → input_text crudo (NO reescribir comandos, ver §9)
      • IS_PAIR_CMD: /conectar 12345678 → consume_pair (vincula Telegram↔perfil)
      • Check Reporte (fn_proactive_check_report) → ¿hay reporte proactivo abierto?
      • Keep Context (JS) → route_reschedule / route_next_action / route_validar + isForcedBypass
      • IF Awaiting Reschedule / IF Awaiting Next Action / IF Reporte → ramas proactivas
      • si no, AI Agent (LLM) con UNA tool: bot_nlu_dispatch → RPC bot_nlu_dispatch_gvintell
  → Supabase RPC (el "cerebro")
  → respuesta de la tool → Telegram (la DB genera el texto; el LLM NO inventa)
```

El **cerebro está en Supabase** (plpgsql SECURITY DEFINER). El LLM solo elige `tool_name`+`args` y devuelve
el texto de la tool. La detección de comandos es **determinista en SQL**.

> Nota nombres: aunque las RPC se llaman `bot_nlu_dispatch_gvintell*` (origen del fork), en la base de Stratos
> operan sobre las orgs de Stratos. El nombre es histórico; NO implica conexión con la base de Gvintell.

## 2. Modelo de datos (tablas clave)

- **profiles**: `id, organization_id, name, role, telegram_chat_id (unique), timezone, view_all_leads, active`.
  - `role`: `asesor` (normal) | `admin|super_admin|ceo|director` (mando).
  - Índice único `uniq_profiles_telegram_chat_id`: un mismo Telegram = un solo perfil en TODA la base Stratos.
- **leads**: `id, organization_id, name, phone, stage, source, asesor_id, asesor_name, next_action,
  next_action_at, next_action_date, score, deleted_at, zoom_join_url`.
- **proactive_config** (1 por org): `enabled, shadow_mode, test_asesor_names[], zoom_stage_label
  ('Zoom Agendado'), zoom_reminder_hours (Duke=3), terminal_stages[] (Duke: Cierre, Rotación, Postventa),
  timezone ('America/Cancun'), manager_telegram_id`.
- **proactive_reminders**: cola (`tipo, scheduled_at, dedupe_key, status, payload`).
- **proactive_pending_reports**: reporte abierto (`kind, status, lead_id, advisor_telegram_id, expires_at,
  escalated_at, outcome`). **Guard: 1 reporte abierto por asesor a la vez.**
- **comunicaciones**, **expediente_items**, **audit_log**: historial/notas (lo que escribe el bot queda aquí).
- **bot_pending_confirm** / **tg_bot_activity**: confirmación de borrado / log de interacciones.

## 3. Roles: asesor vs admin (quién recibe las notificaciones)

- **Asesor** (`role='asesor'`): recibe SUS recordatorios (zoom, próxima acción, inactividad); ve/opera SOLO
  sus leads (`asesor_id = su profile.id`). Ej Duke: Araceli Oneto (`telegram_chat_id` vinculado).
- **Mando** (`role in ('super_admin','admin','ceo','director')`): NO recibe recordatorios operativos; recibe
  **escalados** (asesor sin plan, reportes vencidos) y ve todo (`view_all_leads`). Destinatarios admin:
  ```sql
  select coalesce(array_agg(telegram_chat_id order by telegram_chat_id), array[]::bigint[])
  from public.profiles
  where organization_id = v_org and role in ('super_admin','admin','ceo','director')
    and coalesce(active,true)=true and telegram_chat_id is not null;
  ```
  Para recibir por Telegram, el admin debe tener su `telegram_chat_id` vinculado. El escalado SIEMPRE queda
  además en `expediente_items` + `audit_log` (visible en el CRM web aunque el admin no tenga Telegram).

## 4. El cerebro conversacional (funciones Supabase)

Entry RPC que llama el bot: **`bot_nlu_dispatch_gvintell(p_telegram_chat_id, p_tool_name, p_args)`**.

Orden interno:
1. Desempaqueta `args.query` anidado.
2. **Confirmación de borrado** (`bot_pending_confirm`): "sí/no" (regex con `($|\s)`, §9).
3. **Detección determinista por texto** (prioridad sobre el LLM), normalizando acentos:
   - `^/?(menu|inicio|start|home)` o `^(hola|buenas|ayuda)$` → `menu`
   - `^/?clientes` o `(mis clientes|cuales son ... mis clientes|lista de clientes|mis leads)` → **`mis_clientes`**
   - `^/?(agenda|pendientes|proximas)` o `(que tengo hoy|mi agenda|mis pendientes|proximas acciones)` → **`agenda`**
   - `^/?(kpis|kpi|indicadores)` o `(como voy|mis numeros)` → `kpis`
   - `^/?(pipeline|embudo)` → `pipeline`
   - `^/?(buscar|busca|search)` → `search_client`
4. Ruteo:

| tool_name | Función | Qué hace |
|---|---|---|
| `mis_clientes` | `bot_mis_clientes(tg)` | **Lista de clientes** del asesor (nombre · etapa · próx) |
| `agenda`/`list_pending` | `bot_proximas_acciones(tg)` | **Próximas acciones** ordenadas (vencidas/pronto) |
| `add_client` | `bot_create_lead_smart(tg,args)` | Crea lead (extrae teléfono, parsea fecha). Asignar a otro asesor = solo admin |
| `delete_client` | `bot_delete_lead(tg,query)` | Borrado SEGURO con confirmación |
| `kpis` | base `dashboard` | KPIs del asesor (leads, calientes, pipeline, pendientes, vencidos) |
| `pipeline` | base `pipeline_summary` | Pipeline por etapa |
| `search_client` | base `quick_search` | Busca lead |
| (otros) | `bot_nlu_dispatch_gvintell_v2(...)` | ver abajo |

> En Stratos el entry **remapea** los nombres del fork a los del CRM base: `kpis→dashboard`,
> `pipeline→pipeline_summary`, `search_client→quick_search`, `menu→menu` (vía `bot_nlu_dispatch`).

**`bot_nlu_dispatch_gvintell_v2`** maneja directo (con `fn_user_tz` + `parse_relative_or_abs_es`):
`update_next_action`, `change_stage`, `set_zoom_datetime`, `assign_client` (solo admin); lo demás cae a
`bot_nlu_dispatch` → `bot_nlu_dispatch_core` (base: `menu, dashboard, pipeline_summary, quick_search,
view_lead, list_pending, upsert_lead, update_fields, add_*`, etc.).

> ⚠️ FORK: en Stratos se ELIMINÓ el guard `if v_org <> '<org gvintell>' then return bot_nlu_dispatch(...)`
> de `_v2`, para que atienda TODAS las orgs de Stratos (Duke/Sales/Grupo28). Cada query es org-scoped.

**Fechas (determinista):** `parse_relative_or_abs_es(texto, tz)` + `parse_es_datetime_tgenius`:
`en/dentro de N (min|horas|días|semanas)`, `media hora`, `hoy/mañana HH`, `lunes..domingo HH` (próxima
ocurrencia), `dd/mm[/yyyy] HH:MM`, ISO. Para Duke tz = `America/Cancun` (regla). Aplicar con prefer-future +
guard anti-pasado/anti-año-absurdo (evita "01/11" o "2023" alucinados por el LLM).

## 5. Motor proactivo (recordatorios)

scan → enqueue → get_pending → open report → enviar.
- Scans: `fn_proactive_scan_zooms` (Duke: 3 h antes), `fn_proactive_scan_inactive`,
  `fn_proactive_next_action_reminders` (`next_action_3h` ventana [-3h,-10min], `next_action_10min`).
- Consumo: `fn_proactive_get_pending(payload)` con `payload.tipo_in` (cada motor sus tipos) + guard de
  **1 reporte abierto por asesor**. Abre con `fn_proactive_open_report_v2`.
- Reparto por motor (n8n):
  - `STR_NextAction_Engine` consume `next_action_3h/10min` y envía "TG Send NextAction 3h".
  - `Fase 3 · Validar pendientes` (id `QrFPXkunxroqIKqJ`) consume `tipo_in=['zoom_brief','inactividad']`
    y envía "TG Send Zoom" (con botones: plan / reagendar / **Ver ficha**).
- Tipos de reporte: `zoom_brief, inactividad, next_action_3h, awaiting_plan, awaiting_reschedule, awaiting_next_action`.
- Handlers (mismos que el gemelo): `fn_proactive_next_action_action` (ficha/listo/posponer30/cancelar),
  `fn_proactive_inact_action` (contacte/reagendar/ficha/perdido; "reagendar" deja `awaiting_reschedule` y
  PIDE fecha — no default ni cierra), `fn_proactive_reschedule_start/_apply` (prefer-future; zoom vs
  seguimiento), `fn_proactive_plan_start`, **`fn_proactive_plan_giveup`** ("no tengo plan" → cierra + escala
  al coordinador + libera), `fn_proactive_check_report`, `fn_proactive_close_report`, `_log_plan`,
  `_scan_next_action_escalations`, `_expire_stale`.

## 6. n8n — flujos

- **BOTv5** "stratos telegram bot v5 — completo" (`vM5Yu1HRmUDPOCg7`). Nodos clave:
  - `Global Config` (Set): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN` (+ `ORGANIZATION_ID`
    si el bot sirve una sola org; si sirve varias, la org se resuelve desde el `telegram_chat_id`).
  - `Set Input (text)`: texto **crudo**, sin mapa de reescritura (§9).
  - `Check Reporte` → `Keep Context` (routes + isBypassCmd) → `IF Awaiting Reschedule`(`route_reschedule===true`)
    → `IF Awaiting Next Action`(`route_next_action===true`) → `IF Reporte` (**`route_validar===true`**, NO `has_report`).
  - Tool del AI Agent `bot_nlu_dispatch` (toolHttpRequest) → URL `…/rest/v1/rpc/bot_nlu_dispatch_gvintell`.
  - Ruta proactiva: `IF Proact` → `TG Answer Proact` → `TG Quitar Botones` (editMessageText texto modificado +
    `onError: continueRegularOutput`) → `Switch Proact Action` (`proact_plan`/`proact_reagendar`/`proact_inact`/`proact_next:`).
    El proact_next: va a `STR Build NextAction Input` → `STR Call NextAction Callbacks` (`STR_NextAction_Callbacks`,
    id `GyXc2FgSreG6HOCT`) → `fn_proactive_next_action_action` → "TG Send Reply".
- Motores/sub-flujos: `STR_NextAction_Engine` (`9rb9xkcCmS3YWfRV`), `STR_NextAction_Callbacks` (`GyXc2FgSreG6HOCT`),
  `Fase 3 · Validar pendientes` (`QrFPXkunxroqIKqJ`, envía zoom_brief/inactividad), `Fase 3 · Validar Reporte`
  (`maeqwEsPOgsg5vLk`, valida el plan con un Coach LLM → OK cierra+log+avisa gerente; "no tengo plan" → giveup).
- Validación de plan (BOTv5): `Build Validar Input` (calcula flag `giveup`) → `IF No Plan`
  (`$json.giveup===true`) → true: `Call Plan Giveup` (`fn_proactive_plan_giveup`) → `TG Giveup Asesor`;
  false: `Call Validar Reporte` (sub-flujo Coach).

## 7. Receta para dar de alta un tenant/org nuevo (Sales, Grupo28, …)

1. **Supabase**: crear la org + `proactive_config` (enabled, zoom_stage_label, zoom_reminder_hours,
   terminal_stages, timezone) + `profiles` (asesores + ≥1 admin con telegram). Las funciones ya son globales
   (resuelven org desde `telegram_chat_id`); `_v2` ya no tiene guard de org.
2. **Bot Telegram**: usar `@Strato_sasistente_crm_bot` (multi-tenant, org por asesor) o, si quieren white-label,
   crear bot propio con @BotFather + clonar flujos.
3. **n8n** (si bot propio): clonar BOTv5 + motores vía REST:
   - Swap credencial Telegram en nodos `telegram`/`telegramApi`; regenerar `webhookId`.
   - `Global Config`: token/URL/service_role/ORGANIZATION_ID del tenant.
   - Remap nodos `executeWorkflow` a los IDs clonados.
   - PUT con `settings` reducido a `{"executionOrder":"v1"}`. Activar con `POST /workflows/{id}/activate`.
4. **System prompt** del AI Agent: branding del tenant; mapeo de tool_name idéntico.
5. **Dominio/ruta**: `app.stratoscapitalgroup.com/<tenant>` (o subdominio).
6. **Conectar Telegram** (§8) para asesores y admin.
7. **Smoke test** (§10).

## 8. Conectar Telegram (asesor o admin)

CRM web → **Perfil → "Conectar Telegram"** → **código de 8 dígitos** (caduca). En el bot: `/start` + código,
o `/conectar 12345678`. Responde "Conectado, <nombre>". `consume_pair` + índice único: un Telegram = un perfil
en toda la base Stratos (si ya está en otro perfil, hay que desconectarlo primero).

## 9. GOTCHAS — bugs reales ya resueltos (NO repetir)

1. **PostgreSQL `\b` NO es límite de palabra** (es backspace). Usar `($|\s)` o `\y`. (Rompía `/clientes`, "sí/no".)
2. **Set Input no debe reescribir comandos** (`/clientes→'ayuda'` mandaba al menú y rompía el bypass). Texto crudo.
3. **`TG Quitar Botones`**: `editMessageText` con el mismo texto → "message is not modified" → Bad Request que
   rompe el botón. Fix: editar el texto con un marcador + `onError: continueRegularOutput`.
4. **`IF Reporte` evalúa `route_validar`** (respeta `isForcedBypass`), NO `has_report`. Si no, con reporte abierto
   cualquier comando caía en validación de plan = loop.
5. **`Keep Context` isBypassCmd** debe reconocer comandos naturales ("mis clientes", "que tengo hoy", "como voy",
   "kpis", "pipeline", "menu"...) para ESCAPAR de un reporte abierto.
6. **Fechas**: parser con `en/dentro de N`, `hoy/mañana`, días de semana, `dd/mm`; aplicar con prefer-future +
   guard anti-pasado/anti-año-absurdo. Duke SIEMPRE `America/Cancun`.
7. **Reagendar**: mantener `awaiting_reschedule` y PEDIR fecha (no default de 2 días, no cerrar).
   `reschedule_apply` distingue zoom vs seguimiento (no forzar "Zoom Agendado" en un seguimiento).
8. **"No tengo plan"** → `fn_proactive_plan_giveup`: cierra + escala al coordinador (nota en expediente/audit) +
   libera al asesor (no loop).
9. **Guard 1-reporte-por-asesor**: un backlog grande de `inactividad` puede tapar zoom/próxima acción
   (le pasó a Araceli). Vigilar / priorizar / limitar encolado diario.
10. **`mis_clientes` ≠ `agenda`**: "mis clientes" = lista de clientes; "agenda"/"que tengo hoy" = próximas acciones.
11. **`bot_list_my_clients_v2` (del CRM base) estaba roto** → se usa `bot_mis_clientes` (creada para esto).
12. **Aislamiento**: toda query es `WHERE organization_id = <org del asesor>`. Stratos y Gvintell son **bases
    Supabase distintas** → imposible cruce. Dentro de Stratos, cada org solo ve lo suyo.
13. **El dispatch HONRA el tool del clasificador; la detección por texto es solo FALLBACK** (fix 25-jun-2026).
    `bot_nlu_dispatch_gvintell` tiene un bloque de detección por texto (`^agenda`, `^clientes`, `^menu`…). Antes corría
    SIEMPRE y pisaba el `tool_name` explícito → "Agendá un Zoom con X" se desviaba a la agenda (no agendaba). Ahora ese
    bloque va envuelto en `if v_tool in ('','menu') then … end if` → si el clasificador YA eligió herramienta, se respeta.
    Mató la clase entera (visita, zoom, y cualquier acción cuyo texto arranque con "agenda"/"menú"). **No volver a parchar
    caso-por-caso en n8n (Parse Pick): la causa vive en la base.**
14. **Resolvers de cliente por nombre: SIEMPRE accent-insensitive** (`public.unaccent(name) ilike public.unaccent('%'||v_name||'%')`).
    `change_stage`/`set_zoom_datetime`/`update_next_action` en `_v2` lo hacían SIN unaccent → "hector prueba" no encontraba
    "Héctor Prueba". `assign_client` ya estaba bien; ahora todos igual. (fix 25-jun-2026)
15. **WHITE-LABEL — lógica específica de un cliente va en CONFIG por tenant, NUNCA hardcodeada.** Patrón (caso "Bay View
    Grand", 25-jun): los DATOS del tenant viven en `organizations.meta_config` (jsonb) — p.ej. `campaign_aliases` —, y una
    función genérica los lee: `fn_resolve_campaign(org, texto)` normaliza la campaña por alias del org (si el org no tiene
    config, devuelve el texto tal cual → cero efecto en otros tenants). Inyectado en `bot_upsert_lead`. **Regla:** antes de
    meter un `if cliente='Duke'` o quemar un nombre en el prompt, preguntarse "¿esto debería viajar al clonar a otro tenant?".
    Si no, va en `meta_config`/tabla `*_config` con `organization_id`. Igual que `proactive_config`, `terminal_stages`, etc.

## 10. Smoke test (SQL, reemplaza `<TG>` por el telegram_chat_id de un asesor; Araceli Duke = 7464451486)

```sql
select t, public.bot_nlu_dispatch_gvintell(<TG>,'',jsonb_build_object('input_text',t))#>>'{reply,text}'
from (values ('mis clientes'),('/clientes'),('agenda'),('que tengo hoy'),('kpis'),
             ('pipeline'),('menu'),('busca a Diana')) x(t);
select public.parse_relative_or_abs_es('en 3 horas','America/Cancun');
select public.parse_relative_or_abs_es('el jueves 3pm','America/Cancun');
```
En Telegram (`@Strato_sasistente_crm_bot`): `mis clientes`, `agenda`, `kpis`, crear cliente con próx. acción
"en 4 horas", reagendar respondiendo "mañana 3pm", tocar "Ver ficha del cliente" en un recordatorio de zoom,
y responder "no tengo plan" tras "este es mi plan" para ver el escalado al coordinador.
