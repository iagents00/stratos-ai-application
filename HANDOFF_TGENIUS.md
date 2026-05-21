# HANDOFF — Crear tenant "Tgenius" (nuevo subdominio multi-cliente)

> Documento de traspaso para una sesión NUEVA de Claude Code. Pegá este archivo
> (o pedile que lo lea: `HANDOFF_TGENIUS.md`) en el chat nuevo. Objetivo: montar
> **Tgenius** como cliente/tenant propio — igual que se hizo con Grupo 28 —
> **sin afectar a Duke ni a Grupo 28**, con diseño personalizado y todo lo que
> tiene el CRM hoy (incluidos los agentes de Telegram y el motor proactivo).

---

## 0) Cómo se "transfiere" el acceso (leer primero)
- **MCP / GitHub / n8n NO se transfieren por texto.** Son conectores a nivel de
  la cuenta de Claude del cliente (Ivan, `synergyfornature@gmail.com`). En el
  chat nuevo, habilitá los conectores: **Supabase, GitHub, n8n** (toggle en el
  menú de conectores). Con eso, la sesión nueva tiene el mismo acceso.
- La conexión MCP de Supabase fue **inestable** (se cae cada tanto). Si pasa:
  toggle off/on de "Supabase" en el menú de conectores del chat.
- **NUNCA** pegar secretos (service_role key, etc.) en el chat.

## 1) Infra y accesos (sin secretos)
- **Repo GitHub:** `iagents00/stratos-ai-application` (solo este repo está
  permitido por el MCP de GitHub).
- **Rama de trabajo de esta línea:** `claude/review-setup-guidelines-KR1ao`
  (todas las migraciones 022→040 del motor proactivo + RPCs del bot están acá).
- **Supabase (un solo proyecto, multi-org):** ref `glulgyhkrqpykxmujodb`
  ("Stratos Capital Group", Pro, us-west-2). El aislamiento entre clientes es
  por `organization_id` + RLS, **no** por proyectos separados.
- **n8n:** workflows del bot de Telegram + motor proactivo (CRON).
- **Vercel:** despliega `main`. Cambios de frontend requieren merge a `main`.

## 2) Organizaciones existentes (tabla `public.organizations`)
| Cliente | organization_id | clientId | Notas |
|---|---|---|---|
| Duke / Stratos | `00000000-0000-0000-0000-000000000001` | `duke` | cliente original |
| Grupo 28 | `9afe40d2-7163-4407-a4cd-5346799ecd3c` | `grupo28` | tenant externo |
| **Tgenius** | **(CREAR — nuevo UUID)** | `tgenius` | a montar |

## 3) Arquitectura multi-cliente (un bundle, config por cliente)
Lee `CLAUDE.md` (sección "ZONA CRÍTICA — ARQUITECTURA MULTI-CLIENTE") y
`SETUP_DEV_GRUPO28.md`. Resumen:
- `src/clients/_shared/defaults.js` — config base que todos heredan.
- `src/clients/index.js` — resolver + registry (`getClientIdByOrgId`,
  `getOrgIdByClientId`, `resolveRedirectForUser`).
- `src/clients/duke/config.js`, `src/clients/grupo28/config.js` — configs.
- `src/main.jsx` — `resolveClientFromLocation()` resuelve el cliente por
  hostname/path al boot. Rutas: `/grupo28`, subdominio `grupo28.…`, override QA
  `?app&client=grupo28`.
- `src/contexts/ClientOrgGuard.jsx` — post-login, si la org del user no matchea
  el cliente del path, redirige (`window.location.replace`).
- `src/app/constants/navigation.js` — `canAccessModule()`: clientes externos
  ven solo CRM, Perfil, Papelera.
- Aislamiento de datos: RLS por `organization_id` (automático).

## 4) PASOS para crear Tgenius (replicar patrón Grupo 28)
Todo **aditivo**, con dry-run en lo de Supabase, sin tocar Duke/Grupo28:

**A. Supabase**
1. `INSERT` en `public.organizations` una fila para Tgenius → obtener su UUID
   (no hardcodear; usar el id generado). Nombre ej. "Tgenius".
2. (Opcional) seed de proyectos/etapas si Tgenius quiere pipeline propio.

**B. Frontend (PR + review del owner — CODEOWNERS)**
3. Crear `src/clients/tgenius/config.js` (copiar `grupo28/config.js`):
   - `id:"tgenius"`, `tenant.clientId:"tgenius"`,
     `tenant.organizationId:"<uuid nuevo>"`, `tenant.supabaseRef:"glulgyhkrqpykxmujodb"`.
   - **Diseño personalizado:** `brand` (logoText, accent, accentLight, favicon),
     `name`, `legalName`, `tagline`.
   - `features`: prender/apagar módulos (igual que grupo28).
   - `crm`: defaultProjects, advisorMetricsTab, discoverySimplified, etc.
4. Registrar Tgenius en `src/clients/index.js` (registry + resolver path
   `/tgenius` y subdominio `tgenius.stratoscapitalgroup.com`).
5. Mapear org↔client en el guard (`getClientIdByOrgId`/`getOrgIdByClientId`).
6. `.github/CODEOWNERS`: asignar `src/clients/tgenius/**` (igual que grupo28).
7. Branch `feature/tgenius-*`, PR, review.

**C. Usuarios / correos (como con Grupo 28 / iAgents)**
8. Crear los usuarios de Tgenius en `auth.users` + `public.profiles` con
   `organization_id = <uuid Tgenius>` y el `role` correspondiente. Mails tipo
   `admin@tgenius.…` / los que pida el cliente. (El password se setea con
   `crypt(... , gen_salt('bf'))`; no se puede leer, solo resetear.)
   Para clientes externos: `crm_only=true` si aplica, y `view_all_leads` según.

**D. Agentes de Telegram + motor proactivo (ya son multi-tenant casi del todo)**
9. **Bot de Telegram (`bot_nlu_dispatch` + `bot_*`):** ya resuelven la org desde
   `profiles.telegram_chat_id` → es **org-agnóstico**. Los asesores de Tgenius
   vinculan su Telegram con el mismo flujo (`bot_pair_by_name`) y todo opera
   sobre su org automáticamente. No requiere cambios de código.
10. **Motor proactivo (`fn_proactive_*`):** las funciones aceptan
    `payload.organization_id` pero **defaultean a Duke** si no se pasa. Para
    Tgenius: en n8n **siempre pasar `organization_id = <uuid Tgenius>`** en los
    scans/get_pending/etc. Además crear su fila en `public.proactive_config`
    (org Tgenius, `enabled=false`, `shadow_mode=true` al principio). El bot de
    reportes resuelve `manager_telegram_id(s)` por la org → los admins de
    Tgenius reciben.
11. Workflows n8n: clonar los de Duke apuntando a la org de Tgenius (mismas RPCs,
    distinto `organization_id` y credenciales del bot de Tgenius si usan otro
    bot de Telegram).

**E. Verificación de aislamiento**
12. Confirmar que ningún cambio de Tgenius lee/escribe filas de Duke/Grupo28
    (todo filtra por `organization_id`). RLS lo refuerza.

## 5) Reglas de seguridad (heredadas — respetarlas siempre)
- Nada de `DROP`/`DELETE`/`TRUNCATE`/`UPDATE` masivo/`ALTER` sobre datos/objetos
  existentes sin OK escrito del cliente (decir qué cambia + cuántas filas).
- **Siempre** dry-run `BEGIN/ROLLBACK` y mostrar el resultado antes de aplicar.
- Preferir aditivo (`IF NOT EXISTS`, objetos nuevos). Ante duda → frenar y preguntar.
- No merge a `main` ni deploy sin OK explícito.
- Todo scopeado a la org correcta; nunca tocar otras orgs.
- Funciones SQL para n8n: `SECURITY DEFINER` + `GRANT EXECUTE ... TO service_role`
  (revocar anon/authenticated salvo que corresponda).

## 6) Estado actual del motor proactivo (Duke) — referencia
Migraciones 022→040 en `supabase/migrations/` (source-of-truth; ya aplicadas en
prod vía MCP). RPCs `fn_proactive_*`: get_config, scan_zooms, scan_inactive,
get_pending (serializa 1 solicitud/asesor + abre lock), enqueue, mark,
open/check/close_report, scan_escalations, expire_stale, scan_insist,
inact_action (contacte/reagendar/ficha/perdido), log_plan, reschedule_start/apply,
test_simulate. Bot: `bot_nlu_dispatch` (+ `_core`), `bot_list_priority`,
`bot_set_priority`. Config en `public.proactive_config` (per-org), reportes en
`public.proactive_pending_reports`. Doc de integración: `n8n/INTEGRATION_CHATWOOT_RETELL.md`.

## 7) Tip para el chat nuevo
Empezá pidiéndole: "leé `CLAUDE.md`, `SETUP_DEV_GRUPO28.md`, `src/clients/grupo28/config.js`
y `src/clients/index.js`, y este `HANDOFF_TGENIUS.md`; luego proponeme el plan
para crear Tgenius (org Supabase + config cliente + routing + CODEOWNERS +
usuarios) con dry-run, sin tocar Duke ni Grupo 28."
