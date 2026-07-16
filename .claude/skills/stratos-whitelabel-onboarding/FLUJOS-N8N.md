# Catálogo de flujos n8n — STRATOS (Duke · Sales · Grupo28)

> **Fuente de verdad de QUÉ hace cada flujo.** Todo vive en un solo proyecto n8n personal
> (`Ivan Rodriguez <iagents.nsg@gmail.com>`, id `LHzlopCYE43fij1S`) en `https://personal-n8n.suwsiw.easypanel.host`.
> Las carpetas ("caletas") del proyecto están desordenadas y NO son confiables para saber qué es qué → **usá este catálogo.**
> Última auditoría: **2026-07-16**. Al crear/renombrar/archivar un flujo, actualizá esta tabla + el changelog del AIOS.

## Cómo está organizado el mundo n8n de Stratos

- **Un CRM, varios tenants (orgs de Supabase `glulgyhkrqpykxmujodb`):** Duke del Caribe (`00000000-0000-0000-0000-000000000001`),
  Stratos Sales, Grupo28 (`9afe40d2-7163-4407-a4cd-5346799ecd3c`). Cada tenant = su `organization_id`; el aislamiento es por RLS.
- **El "cerebro" NO es un flujo:** es el RPC de Supabase `bot_nlu_dispatch_gvintell` (+ familia). El bot de Telegram y el Copilot
  web son solo **transporte** que llama ese RPC. Ver `SKILL.md §1`.
- **Convención de nombres:** los flujos nuevos usan prefijo **`STRATOS_...`**. Los motores proactivos viejos se **clonaron de
  GVINTELL/TGenius** y conservan nombres genéricos tipo **`Fase 3 · ...`** — no te confundas, ESOS también son de Stratos/Duke
  (mirá la URL de Supabase adentro: si apunta a `glulgyhkrqpykxmujodb` es Stratos; si a `vfakuhpumgwsnmczzkhk` es Gvintell).
- **Regla de despacho proactivo (CRÍTICA, lección 16-jul):** todo flujo que ENTREGA un aviso a Telegram del asesor DEBE tener,
  después del nodo `TG …`, un nodo **`Log Proactive Copilot`** (HTTP → RPC `fn_log_proactive_copilot`, key anon) para que el aviso
  también quede en `tg_bot_activity` y aparezca en el Copilot/campanita. Si falta ese nodo, el aviso llega a Telegram pero NO al Copilot.

---

## A. Núcleo del asistente (Duke) — ACTIVOS, no tocar sin skill

| Flujo | ID | Rol | Log→Copilot |
|---|---|---|---|
| **stratos telegram bot v5 — completo** | `vM5Yu1HRmUDPOCg7` | **EL bot de Telegram de Duke.** Recibe texto/voz/foto/callback → AI Agent (1 tool `bot_nlu_dispatch`) → RPC cerebro → responde. Sanitiza Markdown (`mdSafe`). | n/a (respuestas del bot ya se loguean solas) |
| **Stratos CRM Copilot — Webhook Router** | `8ZasBukTkSx26m2A` | **El Copilot web** embebido en el CRM. Espejo del bot: `copilot-transcribe` → clasificador → mismo RPC `bot_nlu_dispatch_gvintell` → loguea en `tg_bot_activity`. | n/a |

## B. Motores proactivos (Duke) — los que "avisan solos" — ACTIVOS

> Patrón común: un cron **escanea** (`fn_proactive_scan_*`) y **encola** en la tabla `proactive_reminders`; otro cron **consume**
> (`fn_proactive_get_pending`) y **entrega** por Telegram. Escalada a admins = se resuelve la lista `manager_telegram_ids` en n8n.

| Flujo | ID | Qué avisa | Log→Copilot |
|---|---|---|---|
| **STRATOS_NextAction_Engine** | `WN8H1pdpLiMtCkg6` | Próxima acción del lead: T-3h pide plan (briefing LLM), T-10min "¿listo?", T-1h sin plan → escala al asesor + **alerta admin**. | ✅ (en todos los TG Send) |
| **Fase 3 · Validar pendientes** | `QrFPXkunxroqIKqJ` | Zoom brief T-3h + **inactividad** (lead sin movimiento) + **insist** + **reactivar** (borrador) + **alerta admin zoom**. Clonado de TGenius. | ✅ (verificado con filas reales) |
| **Fase 3 · Validar Reporte** | `maeqwEsPOgsg5vLk` | Valida el "plan" que el asesor manda al tocar **"Enviar mi plan"** (coach LLM: completo/incompleto) + resumen al gerente. | ✅ |
| **STRATOS_ZoomVisitas Avisos (Duke)** | `zng1i1bXSMVLBBSv` | Zoom T-1h (con/ sin plan) + T-15min + visitas 30/15/7/1 días. | ✅ (**nodo agregado 16-jul** — antes faltaba → era el bug de "Oye tu Zoom no llegaba al Copilot") |
| **STRATOS_PersonalReminders (Duke)** | `RHAdSKmpXZ0hqLqY` | Recordatorios personales del asesor ("recordame …"). | ✅ (**agregado 16-jul**, verificado e2e) |
| **STRATOS_TeamActions_Coach (Duke + Sales)** | `Sv4SOmMzfGF1Nh1A` | Tareas de agenda asignadas al equipo, con botones ✅/⏳/❌ (`team_action:*`). Sirve Duke **y** Sales. | ✅ (**agregado 16-jul**) |
| **STRATOS_NotasPostZoom_Coach (Duke)** | `AnxnnjFwOPvTXrUx` | (Coach de notas post-Zoom) — **INACTIVO** hasta cablear el callback en la base. | — |

## C. Integraciones / operación (Duke y generales)

| Flujo | ID | Rol | Estado |
|---|---|---|---|
| **NSG - Registrar en CRM Stratos** | `hasQ3tuAPC4ilY28` | El buscador NSG mete el prospecto elegido al CRM de Stratos. | Activo |
| **STRATOS - Backup Diario a Drive** | `43fyfBIDcyLB0y2t` | 08:00 vuelca tablas de negocio a JSON y sube a Drive de Iván. | Activo |
| **STRATOS - Password Recovery Email** | `hV7mADwc0RnhLkGo` | "Olvidé mi contraseña": recibe código de la Edge Function y lo manda por Gmail. Todos los tenants. | Activo |
| **INBOUND · Meta Directo (Gael, Carlos, Ken, Ceci)** | `aJdFcIJAsGQsNBQj` | WhatsApp Cloud API directo de Meta → `ingest_inbound_lead`. | **Latente**: prendido pero sin webhooks de Meta conectados. |
| **Stratos · Propiedades — Sync Sheet DRIVES** | `T2JygOdNV3UQmdwX` | Sincroniza fichas técnicas de propiedades desde Google Sheet. | Inactivo |

## D. Stratos SALES (tenant aparte — funnel + agente WhatsApp "Sofia")

> Otro tenant del mismo CRM. Pipeline comercial con Retell (voz) + Cal.com (agenda) + WhatsApp (Sofia). Numerados `01`–`09`.

| Flujo | ID |
|---|---|
| STRATOS-SALES - 01 - Diagnostico Webhook | `nnffqz2cBxqlYF64` |
| STRATOS-SALES - 02 - Cron Rescate 5min | `4MFBJY7LG202kYFv` |
| STRATOS-SALES - 03 - Calcom Webhook | `Wq2MY83z9GUaCcvU` |
| STRATOS-SALES - 04 - Cron Recordatorios | `xjatAjDs7k2SKZV7` |
| STRATOS-SALES - 05 - Post-Call Retell webhook | `6FRq9pj9FCeBAtIJ` |
| STRATOS-SALES - 06 - Sofia Tool Book Appointment | `GAk1ml5IsiYbNQbg` |
| STRATOS-SALES - 07 - Sofia Tool Update Lead | `k8U4X6vZvcYLpWqM` |
| STRATOS-SALES - 08 - Cron Recordatorios INTERNOS Telegram | `fjQcmj71o0KPBCbe` |
| STRATOS-SALES - 09 - WhatsApp Agent Sofia | `x7JtpPSgoPkaxYwe` |
| STRATOS_SALES_NextAction_Engine | `M7A3hIdKWfYoj5HF` |
| STRATOS_SALES_Proactive_Engine | `k2uAYShEHjOUGxVc` |

## E. OTRA MARCA YA VIVA: VEGA (ejemplo real de white-label)

> Vega YA es un tenant funcionando — prueba de que la receta de `REPLICAR-WHITELABEL.md` funciona. Es una constructora
> (tareas de **obra**, avisa al **obrero**), org de Vega, bot propio `ASISTENTE_CRM_VEGA_BOT`, zona **Buenos Aires**. **No toca Duke.**

| Flujo | ID | Rol |
|---|---|---|
| **Vega Telegram bot** | `oZ1gJv1O7gAR4MRO` | El bot de Telegram de Vega (token propio). |
| **VEGA_TeamActions_Coach** | `7DvhtooPx7zJbvVx` | Motor de seguimiento de tareas de obra (clon del coach de Duke, apuntando a la org de Vega). |

> Vega arrancó con SOLO estas 2 piezas (bot + 1 motor proactivo). Ese es el mínimo para una marca nueva; se le agregan más motores
> del menú §B según lo que pida. Si Vega usa Copilot web, su motor necesitaría el nodo `Log Proactive Copilot` (hoy parece Telegram-only).

## F. LEGACY / DUPLICADOS

### Ya ARCHIVADOS el 2026-07-16 (reversibles: "Unarchive" en n8n)
- `9rb9xkcCmS3YWfRV` — **STR_NextAction_Engine (OFF · CRUZADO)** — el que "leía TGenius y enviaba por bot Stratos"; **este es el que
  confundió a otra IA** (Antigravity conectó a él). Reemplazado por `STRATOS_NextAction_Engine`.
- `oVQfe8tH5CbI0OLj` — Telegram CRM Bot **v4** (reemplazado por el v5 `vM5Yu1HRmUDPOCg7`).
- `O20wxeWlu3BTK091`, `rRycw3YpjVG4XZEm` — copias "Postgres-first" del bot v5.
- `rY4Yci5OdQ6O5g8O` — **SHEET - AGENT** (agente viejo sobre Google Sheets, pre-Postgres).
- `xyVnpym5QuoCC6uY` — **STRATOS_TeamActions_Coach (Duke)** solo (reemplazado por Duke+Sales `Sv4SOmMzfGF1Nh1A`).

### Pendientes de archivar A MANO (el MCP no pudo: tienen "MCP access" apagado en su tarjeta de n8n)
- `2b5cyhWwvhms8yGt` (stratos telegram bot), `tL5BpCeGxfSZ5rtP` (v5 copia), `1huf7v7oAN7OnYHV` (v5 copy). Los 3 **inactivos**;
  archivarlos desde la UI de n8n (tarjeta → Archive) o prender "MCP access" y reintentar.

### NO tocar (activos o de otro tenant)
- `4q8VXXjjcwZfEkP5` **SHEET Append Nota** — **ACTIVO** (tool de sub-workflow). No archivar sin verificar quién lo llama.
- **Familia TGenius `TG_ / TGN_`** (`WpkjVeunGdapsuvp`, `H9LHzGeCQQndT8SD`, `OlRaJTEzEUiJmZ4A`, `WYUzUvfJviPTsOu2`…) — son de **Gvintell/TGenius** (otro tenant), NO de Stratos. Viven en el mismo n8n; dejarlos.
- Experimentos inactivos sueltos (`UtNA7MVIorQMtXgJ` ERP, `b94aS5Vt4o793qvr` Despertador, `TazjcLFfFm6GMyGj`/`pA47MeX3R1GPnooK` Codigo Pareo, `fw5NTN3JUKWgNZkQ` API INTERNA) — inactivos; archivar cuando se confirme que nada los usa.

---

## Chequeo rápido de salud (para "¿por qué X no llega al Copilot?")

1. ¿El aviso llega a **Telegram**? Si no → problema en el scan/consume o el cron (ver ejecuciones del flujo).
2. ¿Llega a Telegram pero **no al Copilot**? → el flujo que lo entrega **no tiene el nodo `Log Proactive Copilot`** (o no está
   publicado). Buscá el flujo en la tabla B/C, mirá la columna **Log→Copilot**, y si falta, agregalo (patrón en `REPLICAR-WHITELABEL.md §5`).
3. Verificación en DB: `select telegram_chat_id, content, created_at from tg_bot_activity where role='ai' and created_at > now()-interval '15 min' order by created_at desc;`
4. **Publicar ≠ guardar:** tras editar un flujo, `publish_workflow` y confirmá que `activeVersionId` cambió (si no, corre la versión vieja).
