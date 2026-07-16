# Replicar el asistente para una marca nueva (white-label) — receta corta

> Objetivo: montar el asistente (bot Telegram + Copilot + motores proactivos) para **otra marca** (p.ej. **Vega**),
> agregándole o quitándole funciones, con el **mínimo esfuerzo** y **sin romper Duke**. Leé antes `SKILL.md` (arquitectura)
> y `FLUJOS-N8N.md` (qué es cada flujo). Esta es la lista de pasos + las reglas de oro.

## 0. El modelo mental (por qué replicar es barato)

Hay **3 capas** y solo UNA se toca de verdad por marca:

| Capa | ¿Se comparte o se clona? |
|---|---|
| **CRM web** (este repo) | **Se comparte** — un solo bundle, config por cliente en `src/clients/<id>/config.js` (ver CLAUDE.md → "Arquitectura multi-cliente"). Marca nueva = una carpeta de config + su `organizationId`. |
| **Cerebro** (RPCs Supabase `bot_nlu_dispatch_gvintell` + familia) | **Se comparte** — es org-scoped. La misma función atiende a todas las orgs; filtra por `organization_id`. Casi nunca se duplica. |
| **Flujos n8n** (bot + motores proactivos) | **Se clonan por marca** — cada marca tiene su bot de Telegram (token propio) y su set de motores proactivos apuntando a su `organization_id`. |

> Regla base: **datos y bot = por tenant; código y cerebro = compartidos.** Si te descubrís copiando lógica de negocio a un
> flujo, parала: casi siempre va en el cerebro (SQL), no en n8n (n8n solo transporta).

## 1. Alta del tenant (Supabase) — CREAR, nunca DROP

1. Insertá la **org** en `organizations` → obtenés su `organization_id` (UUID).
2. Insertá/actualizá `proactive_config` para esa org (timezone, quiet hours, `enabled=true`, `shadow_mode` para arrancar en pruebas).
3. Los `profiles` de esa marca llevan ese `organization_id`. El aislamiento (RLS) hace el resto.
4. **NO** crear una base nueva salvo que el cliente exija datos 100% separados. Mismo proyecto Supabase, otra org.

## 2. Config del cliente en el CRM web (este repo)

1. `src/clients/<marca>/config.js` con `tenant.organizationId`, `brand` (logo, nombre, colores), y **`features`** (qué módulos ve).
2. Registrar la marca en `src/clients/index.js` y su ruta/subdominio (`/vega` o `vega.stratoscapitalgroup.com`).
3. **Quitar funciones = apagar flags** en su `config.js` (`features.rrhh=false`, etc.). **Agregar = prender flag** (y si es módulo
   nuevo, gatearlo con flag en `_shared/defaults.js`, default off). No se bifurca código: se prende/apaga.

## 3. Bot de Telegram de la marca

1. BotFather → token nuevo. Cargalo como credencial n8n (como `Stratos Asistente CRM` para Duke).
2. **Clonar** el flujo bot base (`vM5Yu1HRmUDPOCg7`) → cambiar: credencial del bot, y el `organization_id`/URL de Supabase en los
   nodos `Global Config`. El cerebro es el mismo RPC (ya es org-scoped por el chat del asesor vinculado).
3. Vinculación: cada asesor hace `/conectar <código>` (mismo mecanismo `consume_pair`).

## 4. Copilot web de la marca

- **Sale casi gratis:** el Copilot usa el mismo cerebro. Prender `features.copilotModule` en su config. Si la marca usa un webhook
  n8n propio para el Copilot, clonar `8ZasBukTkSx26m2A` apuntando a su org. **Paridad obligatoria** (ver reglas de oro).

## 5. Motores proactivos de la marca (lo más manual)

Por cada motor que la marca quiera (ver menú en `FLUJOS-N8N.md §B`), **clonar** el flujo Duke equivalente y cambiar en sus
`Global Config`: `SUPABASE_URL` (mismo proyecto), `SUPABASE_SERVICE_ROLE_KEY` y **`ORGANIZATION_ID`** de la marca.

**Menú de motores (prendé solo los que la marca use):**
- Próxima acción (3h/10min/escalada) → clonar `WN8H1pdpLiMtCkg6`.
- Zoom brief + inactividad + reactivar → clonar `QrFPXkunxroqIKqJ`.
- Validar plan del asesor → clonar `maeqwEsPOgsg5vLk`.
- Zoom 1h/15min + visitas → clonar `zng1i1bXSMVLBBSv`.
- Recordatorios personales → clonar `RHAdSKmpXZ0hqLqY`.
- Tareas de equipo → ya es multi-tenant (`Sv4SOmMzfGF1Nh1A`); puede servir a la marca sin clonar si compartís el motor.

**⚠️ En CADA flujo de entrega, incluí el nodo `Log Proactive Copilot`** (si no, los avisos no llegan al Copilot). Patrón del nodo:

```
HTTP Request (POST)  →  https://<PROJECT>.supabase.co/rest/v1/rpc/fn_log_proactive_copilot
Headers: apikey + Authorization: Bearer <ANON KEY> · Content-Type: application/json · Prefer: return=minimal
Body (JSON):
{
  "p_chat_id": {{ $json.chat?.id || $json.result?.chat?.id || $('Split Reminders').item.json.advisor_telegram_id }},
  "p_content": {{ JSON.stringify($json.text || $json.result?.text || $('Split Reminders').item.json.payload?.text || 'Recordatorio proactivo') }},
  "p_role": "ai"
}
```
Conectalo DESPUÉS del nodo `TG …` que envía el aviso. Luego **publicá** el flujo.

## 6. Agregar / quitar una función del asistente

- **Función conversacional nueva** (ej. "recomendar por presupuesto"): va en el **cerebro** (SQL, un detector en
  `bot_nlu_dispatch_gvintell_required_fields_orig` + su función). Como el cerebro es compartido, **queda disponible para todas las
  marcas** al toque. Si una marca NO la debe tener, gatearla por `organization_id` dentro de la función.
- **Función proactiva nueva** (un aviso nuevo): un `fn_proactive_scan_*` que encola + un flujo n8n que consume y entrega (con su
  nodo Log→Copilot).
- **Quitar una función a una marca:** apagar su flujo proactivo (deactivate) o su feature flag; y/o gatear en el cerebro por org.

## 7. Caso concreto: montar el asistente para **Vega**

> **Vega YA existe y funciona** (arrancó con 2 flujos: `Vega Telegram bot` `oZ1gJv1O7gAR4MRO` + `VEGA_TeamActions_Coach`
> `7DvhtooPx7zJbvVx`; org de Vega, bot `ASISTENTE_CRM_VEGA_BOT`, zona Buenos Aires, lenguaje de obra, avisa al obrero). Es la
> prueba viva de esta receta y el mejor molde para copiar. Ver `FLUJOS-N8N.md §E`.

1. ¿Vega es del mismo CRM Stratos o una instancia aparte? Si es del mismo → nueva org + config `src/clients/vega/`. Si quiere datos
   separados → proyecto Supabase propio (más caro de mantener; evitá salvo exigencia).
2. Decidir con Vega **qué funciones sí y cuáles no** (usar el menú de `FLUJOS-N8N.md §B` como carta). Prender solo esas.
3. Bot Telegram Vega (token) + clonar bot base → su org. Copilot: prender flag.
4. Clonar SOLO los motores proactivos que Vega quiera, cada uno a su `organization_id`, **con su nodo Log→Copilot**, y publicar.
5. Arrancar en `shadow_mode=true` unos días; validar en vivo; luego apagar shadow.
6. Registrar todo en el AIOS (changelog + este catálogo con los IDs nuevos de Vega).

---

## ⭐ Reglas de oro (si respetás estas, no se rompe nada)

1. **Paridad Telegram ↔ Copilot:** todo cambio al asistente debe quedar andando en **las dos superficies** (mismo cerebro).
2. **Log→Copilot en cada entrega proactiva:** sin ese nodo, el aviso llega a Telegram pero no al Copilot (lección 16-jul).
3. **CREATE sí, DROP no:** en DB creá funciones/columnas; nunca borres sin OK + backup. Preferí `apply_migration`.
4. **Publicar ≠ guardar en n8n:** tras editar, `publish_workflow` y verificá `activeVersionId`.
5. **Nunca cruzar tenants:** toda query/flujo apunta a un `organization_id` explícito. Nunca mezclar Stratos (`glulgyhkrqpykxmujodb`)
   con Gvintell (`vfakuhpumgwsnmczzkhk`).
6. **El texto lo genera la DB, no el LLM:** el LLM solo elige tool+args (y redacta briefings). La lógica vive en SQL, reusable por todas las marcas.
7. **Registrá en el AIOS:** DB/n8n no quedan en git de los repos de producto → toda edición va al `changelog` del AIOS + este catálogo.
