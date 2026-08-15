# Duke Meta Ads Round Robin

Fecha de analisis: 2026-08-11
Actualizado: 2026-08-13

## Decision

Usar el portafolio/cuenta activa `DUKE DEL CARIBE MKT (661863492474992)` dentro de `El Duke del Caribe`.

No conviene crear un portafolio nuevo como primera via porque el portafolio activo ya tiene campanas con entrega, aprendizaje, cuenta publicitaria, pagina/Instagram y prueba social. Un portafolio nuevo solo agrega friccion mientras el objetivo urgente es que los leads entren a Stratos AI.

La campana nueva debe salir como duplicado de la base ganadora, no desde cero. La idea es conservar al maximo la segmentacion, ubicaciones, optimizacion y alcance que ya funcionan, y cambiar solamente:

- destino: formulario instantaneo / Lead Ads;
- oferta: desarrollos desde USD $97,000;
- preguntas del formulario;
- conexion n8n -> Supabase -> Stratos AI;
- nombre de campana/conjunto/anuncio para distinguir el round-robin.

Si Meta no permite cambiar el objetivo/destino de una campana de WhatsApp/conversaciones a formulario, crear una campana nueva con objetivo `Leads`, pero copiando punto por punto el conjunto de anuncios ganador. La decision clave sigue igual: audiencia heredada, no audiencia inventada.

## Ruta Viva Recomendada

Para cumplir el objetivo urgente de que el cliente llegue al WhatsApp del asesor y tambien quede reflejado en Stratos AI, usar como destino de anuncio este formulario-router:

`https://glulgyhkrqpykxmujodb.supabase.co/functions/v1/duke-lead-router`

Flujo:

1. El cliente abre el link desde el anuncio.
2. Completa nombre, WhatsApp, email opcional y ciudad de interes.
3. La Edge Function crea/actualiza el lead en Supabase/Stratos con etapa `Contáctame Ya`.
4. El RPC asigna por round-robin en el pool `duke_ads_round_robin`.
5. La pagina redirige al cliente al WhatsApp del asesor asignado con el mensaje perfilado.

Asesores activos en esta rotacion:

- Marco Lopez -> `+52 984 876 3357`
- Ken Duke -> `+52 984 218 1660`
- Carlos Reyes -> `+52 984 179 4415`

Estado tecnico:

- Edge Function: `duke-lead-router`
- Deploy: `glulgyhkrqpykxmujodb`
- JWT: desactivado para uso publico
- Health check: `https://glulgyhkrqpykxmujodb.supabase.co/functions/v1/duke-lead-router?health=1`
- Ruta bonita preparada en la app cuando se publique frontend: `/duke/desarrollos-97k`

Estado actual 2026-08-13:

- Router publico probado por HTTP POST.
- Resultado: lead creado en `Contáctame Ya`.
- Asignacion devuelta: `Marco Lopez`.
- WhatsApp generado: `https://wa.me/529848763357?...`
- Limpieza: lead temporal eliminado.
- Pool restaurado: Marco, Ken y Carlos Reyes activos con `assigned_count = 0` y `last_assigned_member_id = null`.

Prueba final realizada:

- Lead temporal: `Prueba Router Codex Final`
- Resultado: creado en `Contáctame Ya`
- Asignacion: `Marco Lopez`
- WhatsApp generado: `https://wa.me/529848763357?...`
- Limpieza: lead temporal eliminado y puntero de round-robin restaurado a inicio.

Uso en Meta Ads:

- Prioridad inmediata: campaña con destino `Sitio web` o anuncio que abra el link del router.
- Si se usa formulario instantaneo de Meta, mantener n8n/Lead Ads conectado al RPC; esa via mete el lead al CRM, pero no garantiza que el cliente abra el WhatsApp asignado en el mismo paso salvo que el cierre del formulario lo mande al router.
- No usar Chatwoot para este flujo nuevo.

## Campana Base

La mejor base activa hoy es:

- Campana: `GAEL - BAY VIEW GRAND 2026 no9295`
- Campaign id visible en Ads Manager: `120214350079710137`
- Anuncio: `VIDEO TOUR BAY VIEW GRAND`
- Resultado hoy: 2 conversaciones
- Costo por resultado hoy: $92.66
- Presupuesto visible: $250 diarios
- Copy visto: `Departamento Ocean View en Cancun Mexico #inversionesinmobiliarias #realestate #cancunmexico #propiedadesdelujo #DepartamentosFrenteAlMar`
- CTA: WhatsApp
- Prueba social vista: 7.2 mil reacciones, 709 comentarios, 192 compartidos

Historico relevante revisado:

- `BAY VIEW GRAND - Cancun 2025 LS`: 125 conversaciones en diciembre 2024
- `BAY VIEW GRAND - Cancun 2025 LS - DUKE`: 68 conversaciones en diciembre 2024
- `ADORA Tulum - a DUKE`: 44 conversaciones en diciembre 2024

## Bloqueo En Meta

Historico 2026-08-12: Ads Manager mostraba saldo/facturacion pendiente. Por eso `Duplicar` y `Editar` aparecian deshabilitados con el mensaje de saldo por liquidar.

No se debe publicar ni tocar pagos sin confirmacion de accion y presupuesto. La parte CRM/Supabase ya puede quedar lista.

Estado revisado el 2026-08-12:

- Cuenta: `DUKE DEL CARIBE MKT (661863492474992)`.
- Meta sigue mostrando: `Cuenta publicitaria restringida Tus anuncios no se están entregando porque no pudimos procesar tu último pago`.
- `Duplicar` y `Editar` siguen deshabilitados con: `Esta cuenta publicitaria tiene un saldo que se debe liquidar para poder realizar esta acción`.
- Al abrir `Pagar`, Meta redirige a `business.facebook.com/security/twofactor/reauth/...`; esto requiere que el usuario complete 2FA/reautenticacion.
- No se publico nada.

Borrador creado en Ads Manager antes del bloqueo final:

- Campana: `DUKE - Desarrollos desde USD 97K - Round Robin - 2026`
- Campaign id: `120246723565640137`
- Conjunto: `Duke Riviera Maya - Formulario - MX/US - Round Robin`
- Ad set id: `120246723565650137`
- Anuncio: `Duke - Desde USD 97K - Formulario Lead Ads`
- Ad id: `120246723565630137`
- Objetivo: `Clientes potenciales`
- Categoria especial: `Vivienda`
- Pais: `Mexico`
- Conversion: `Formularios instantaneos`
- Pagina: `El duke del Caribe`
- Instagram: `eldukedelcaribe`
- Presupuesto heredado/default visible: `$250 MXN diarios`
- Estado: `En borrador`
- Error en revision: `Error de permiso: El objeto al que intentas acceder no está visible para ti o la acción que intentas realizar está restringida a ciertos tipos de cuenta. (#1487194)`

Estado revisado el 2026-08-13 despues del pago:

- Cuenta correcta: `DUKE DEL CARIBE MKT (661863492474992)`.
- Business/portfolio id: `134611108788032`.
- Borrador activo: `DUKE - Desarrollos USD 97K - Lead Form RR - Base Gael`.
- Campaign id: `120246724024850137`.
- Ad set id: `120246724024840137`.
- Ad id: `120246724024860137`.
- Conjunto convertido a destino `Sitio web`.
- Objetivo de rendimiento ajustado a visitas a pagina de destino porque el pixel no tenia eventos suficientes para optimizar leads web.
- URL aplicada en el anuncio: `https://glulgyhkrqpykxmujodb.supabase.co/functions/v1/duke-lead-router`.
- Enlace visible aplicado: `stratoscapitalgroup.com`.
- Revision del anuncio: la URL aparece en `Revisar` y Meta muestra `Se guardaron todos los cambios`.
- Advertencia visible: `Tu anuncio no se entregara en 1 ubicacion` (placement), no bloqueo de URL.
- Estado final: borrador listo para publicar. No se presiono `Publicar` porque ese boton acepta condiciones de Meta y activa entrega/gasto.

## Funnel Recomendado

Objetivo: Leads.

Conversion: formulario instantaneo o flujo Meta Lead Ads que entregue `field_data` a n8n.

Categoria: vivienda/housing si Meta la solicita para anuncios inmobiliarios. Esto implica respetar restricciones de audiencia y no segmentar por atributos sensibles.

Segmentacion:

- Duplicar el conjunto de anuncios de `GAEL - BAY VIEW GRAND 2026 no9295`.
- Si el objetivo actual no se puede convertir a formulario, crear campana `Leads` nueva y copiar manualmente la segmentacion del conjunto de anuncios base.
- Mantener la misma audiencia, ubicaciones, presupuesto base, atribucion, estrategia de puja y placements, salvo que Meta obligue ajustes por categoria de vivienda/housing.
- Evitar rehacer intereses/demografia desde cero; si se necesita optimizar, hacerlo como variante B despues de que el formulario ya este generando leads en Stratos.
- El primer objetivo no es encontrar una audiencia nueva; es convertir el alcance probado de Bay View Grand en leads con formulario y asignacion automatica.

Oferta:

`Desarrollos en Riviera Maya desde USD $97,000`

Copy principal:

`Invierte o estrena en la Riviera Maya con Duke del Caribe. Desarrollos seleccionados desde USD $97,000 en Cancun, Playa del Carmen y Tulum. Dejanos tus datos y te mandamos opciones reales por WhatsApp.`

Titulares:

- `Desarrollos desde USD $97,000`
- `Propiedades en Riviera Maya`
- `Opciones desde 97 mil dolares`

Pregunta de filtro final:

1. `En que ciudad te gustaria ver propiedades desde USD $97,000`
   - Cancun
   - Playa del Carmen
   - Tulum
   - Cualquiera de las 3

Aviso en cierre del formulario:

`Gracias. Te contactaremos por WhatsApp o llamada para enviarte opciones disponibles segun la ciudad que elegiste.`

Campos:

- Nombre completo
- Telefono
- Email

## Stratos/Supabase

Aplicado en `stratos-prod` (`glulgyhkrqpykxmujodb`):

- Tabla `lead_assignment_pools`
- Tabla `lead_assignment_pool_members`
- RPC `fn_upsert_lead_from_meta_ads(payload jsonb, p_pool_key text)`
- Pool `duke_ads_round_robin`

Pool inicial creado:

- Gael G
- Ken Duke
- Cecilia Mendoza
- Marco Lopez
- Carlos Ayala

Pool activo de lanzamiento actualizado con la hoja operativa:

- Marco Lopez -> `+529848763357`
- Ken Duke -> `+529842181660`
- Carlos Reyes -> `+529841794415`

Gael G y Cecilia Mendoza quedan registrados en Stratos, pero fuera de esta rotacion de lanzamiento. El slot legacy de `Carlos Ayala` se reutiliza como `Carlos Reyes` si no existe todavia un perfil dedicado de Carlos Reyes, porque el objetivo urgente es que el lead vaya al asesor que hoy tiene el telefono.

La funcion:

- Deduplica por `meta_lead_id` y telefono.
- Crea nuevos leads en `Contáctame Ya`.
- Reasigna solo si el lead es nuevo o estaba sin owner real (`iAgents`).
- Conserva owner si el lead ya tenia asesor.
- Guarda metadata de Meta (`lead_id`, `form_id`, `campaign_id`, `adset_id`, `ad_id`).
- Captura la ciudad/interes del formulario en `bio` y expediente.
- Agrega nota en expediente.
- Crea una fila en `advisor_whatsapp_notifications` para avisar al asesor asignado.

Pruebas en transaccion con rollback:

- Resultado: `ok: true`
- Ruta de carrusel objetivo: `Marco Lopez` -> `Ken Duke` -> `Carlos Reyes`
- Etapa: `Contáctame Ya`
- Perfilamiento capturado: `profile_city`
- Notificacion de WhatsApp al asesor: `pending`
- Lead de prueba no quedo persistido.

## n8n

Workflow importable para upsert directo desde payload normalizado:

`n8n/workflows/duke-meta-ads-round-robin.json`

Endpoint de destino Supabase:

`POST https://glulgyhkrqpykxmujodb.supabase.co/rest/v1/rpc/fn_upsert_lead_from_meta_ads`

Body:

```json
{
  "payload": {
    "leadgen_id": "META_LEAD_ID",
    "form_id": "META_FORM_ID",
    "page_id": "META_PAGE_ID",
    "campaign_id": "META_CAMPAIGN_ID",
    "adset_id": "META_ADSET_ID",
    "ad_id": "META_AD_ID",
    "campaign_name": "Duke desarrollos desde USD 97,000",
    "field_data": [
      { "name": "full_name", "values": ["Nombre Cliente"] },
      { "name": "phone_number", "values": ["+52 999 000 1111"] },
      { "name": "email", "values": ["cliente@example.com"] },
      { "name": "presupuesto", "values": ["USD 97k-150k"] },
      { "name": "zona", "values": ["Cancun"] }
    ],
    "source": "meta_ads"
  },
  "p_pool_key": "duke_ads_round_robin"
}
```

Notas de implementacion:

- Si se usa el nodo oficial `Facebook Lead Ads Trigger` de n8n, conectarlo directo al normalizador del workflow.
- Si se usa webhook generico de Meta, antes hay que enriquecer el `leadgen_id` con Graph API para obtener `field_data`.
- No usar Chatwoot para este flujo de campanas nuevas.

Workflow importable para avisar al asesor por WhatsApp Cloud API:

`n8n/workflows/duke-advisor-whatsapp-queue-pump.json`

Webhook de produccion esperado:

`https://personal-n8n.suwsiw.easypanel.host/webhook/duke-advisor-wa-notifications`

Variables requeridas en n8n:

- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_CLOUD_API_TOKEN` o `WHATSAPP_TOKEN` o `META_WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID` o `META_WHATSAPP_PHONE_NUMBER_ID`
- Opcional: `SUPABASE_URL`
- Opcional: `META_GRAPH_VERSION` o `WHATSAPP_GRAPH_VERSION`

El workflow no reclama la cola si falta token o `phone_number_id`, para no marcar leads como fallidos antes de tiempo.

Estado UI revisado:

- Existe un workflow en n8n: `INBOUND · Meta Lead Ads (formularios) → Stratos [carrusel]`.
- Estado visible: `Offline`.
- Ese workflow apunta a RPCs viejas: `fn_carrusel_next` e `ingest_inbound_lead`.
- Recomendacion: no activarlo tal cual; actualizarlo o sustituirlo por el receptor directo Supabase + el pump de avisos.

## Receptor Directo Supabase

Como alternativa mas directa a n8n, quedo desplegada la Edge Function:

`https://glulgyhkrqpykxmujodb.supabase.co/functions/v1/meta-lead-ads`

Archivo:

`supabase/functions/meta-lead-ads/index.ts`

Deploy realizado / actualizado:

```bash
supabase functions deploy meta-lead-ads --no-verify-jwt --use-api --project-ref glulgyhkrqpykxmujodb
```

Secrets configurados:

- `META_LEAD_ADS_VERIFY_TOKEN=<ver Supabase secrets>`
- `META_GRAPH_VERSION=v26.0`
- `META_LEAD_ADS_POOL_KEY=duke_ads_round_robin`

Prueba de verificacion Meta:

```bash
curl 'https://glulgyhkrqpykxmujodb.supabase.co/functions/v1/meta-lead-ads?hub.mode=subscribe&hub.verify_token=$META_LEAD_ADS_VERIFY_TOKEN&hub.challenge=after-secret-ok'
```

Resultado esperado/confirmado:

```text
after-secret-ok
```

Prueba de verificacion actual:

```text
meta-webhook-ok
```

Seguridad de POST:

- Sin `META_APP_SECRET` o `META_LEAD_ADS_POST_SECRET`, el POST responde `server_misconfigured`.
- Esto es intencional para evitar inyeccion de leads falsos antes de terminar la conexion.

Aviso a asesor:

- La Edge Function puede despertar n8n despues de guardar un lead si existe `N8N_ADVISOR_WA_WEBHOOK`.
- No setear `N8N_ADVISOR_WA_WEBHOOK` hasta que el workflow de n8n este importado, activo y con variables de WhatsApp Cloud API configuradas.
- URL esperada cuando este activo: `https://personal-n8n.suwsiw.easypanel.host/webhook/duke-advisor-wa-notifications`.

Pendiente para activar receptor directo:

- Crear/elegir Meta App con Webhooks de Page `leadgen`.
- Completar reautenticacion/2FA de Meta.
- Configurar callback URL con la Edge Function.
- Verify token: el valor de `META_LEAD_ADS_VERIFY_TOKEN` en Supabase secrets.
- Suscribir la pagina `El duke del Caribe` al campo `leadgen`.
- Setear en Supabase:
  - `META_APP_SECRET`
  - `META_PAGE_ACCESS_TOKEN` con permisos para leer leads.
- Importar/activar en n8n `duke-advisor-whatsapp-queue-pump.json`.
- Confirmar variables de n8n para WhatsApp Cloud API.
- Setear en Supabase `N8N_ADVISOR_WA_WEBHOOK` cuando el workflow de n8n este activo.

Comando cuando ya existan esos valores:

```bash
supabase secrets set META_APP_SECRET='...' META_PAGE_ACCESS_TOKEN='...' --project-ref glulgyhkrqpykxmujodb
```

Comando para conectar el pump de avisos despues de activarlo:

```bash
supabase secrets set N8N_ADVISOR_WA_WEBHOOK='https://personal-n8n.suwsiw.easypanel.host/webhook/duke-advisor-wa-notifications' --project-ref glulgyhkrqpykxmujodb
```

La funcion usa Graph API `v26.0` y, por cada `leadgen_id`, obtiene `field_data` para llamar la RPC `fn_upsert_lead_from_meta_ads`.

## Checklist De Salida

- Liquidar/revisar bloqueo de facturacion en Ads Manager.
- Completar reautenticacion/2FA de Meta para que billing confirme que el pago libero la cuenta.
- Duplicar la campana/conjunto base de Gael/Bay View Grand para heredar segmentacion y alcance.
- Cambiar oferta/copy/formulario a `desde USD $97,000`.
- Confirmar categoria de vivienda/housing si Ads Manager la pide.
- Conectar el formulario a n8n o al receptor directo Supabase `meta-lead-ads`.
- Activar el pump de avisos de n8n para WhatsApp del asesor.
- Hacer prueba con un lead real de formulario.
- Confirmar que aparece en Stratos AI en `Contáctame Ya` con asesor del round-robin.
- Confirmar que el asesor asignado recibe WhatsApp con cliente, telefono, email, ciudad y campana.

## Fuentes

- Meta Business Help: https://www.facebook.com/business/help/1198401317374558
- Meta Business Help, Lead Ads con formularios instantaneos: https://www.facebook.com/business/help/761812391313386
- Meta Developers, Graph API versions: https://developers.facebook.com/docs/graph-api/changelog/versions/
- Meta Developers, Webhooks for Leads: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/
- Meta Developers, Retrieving Leads: https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/retrieving
- n8n Docs, Facebook Lead Ads Trigger: https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.facebookleadadstrigger
- n8n Docs, Respond to Webhook: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook

## Estado 2026-08-15

Landing publicada. Antes vivia solo en el working tree local, nunca se
commiteo, asi que `stratoscapitalgroup.com/duke-100k` devolvia el shell de la
app de Stratos y no la landing. PRs #620 y #621.

- URL para Meta: `https://stratoscapitalgroup.com/duke/desarrollos-97k`
- Es un archivo estatico en `public/duke/desarrollos-97k/`. Vercel lo sirve
  directo sin arrancar el bundle del SPA, que es lo que conviene para el
  navegador in-app de Meta.
- Alias por ruta React (`/duke-100k`, `/desarrollos-97k`, `/duke-97k`)
  renderean el mismo diseno via `src/landing/DukeLeadRouter.jsx`.
- Verificado en produccion a 375px y 360px: cabe en una sola pantalla, el CTA
  queda visible sin scroll y no hay desborde horizontal.
- La landing muestra la oferta `desde USD $97,000` para que haya message match
  con el anuncio.
- `?advisor=marco|ken|carlos` cambia el WhatsApp de destino. Los tres numeros
  son espejo del pool; si cambian en Supabase hay que cambiarlos tambien en
  `public/duke/desarrollos-97k/index.html` y en `DukeLeadRouter.jsx`.

Pools verificados en `stratos-prod`:

- `duke_ads_round_robin`: Marco Lopez `+529848763357`, Ken Duke
  `+529842181660`, Carlos Reyes `+529841794415` (activos). Gael G, Cecilia
  Mendoza y Carlos Ayala quedan inactivos.
- `duke_ads_marco`: solo Marco Lopez. Es el pool al que cae el anuncio de
  Mondrian segun la rama `isMondrianMarco` del normalizador de n8n.

Nota: el telefono de Marco en versiones anteriores de este doc
(`+529842536828`) estaba desactualizado. Produccion tiene `+529848763357`.

## Ingesta De Leads: Estado Real

Con formulario instantaneo, el lead NO llega a Stratos hasta que exista una
via de ingesta. Hoy no existe: la Edge Function `meta-lead-ads` responde
`server_misconfigured` a proposito porque faltan `META_APP_SECRET` y
`META_PAGE_ACCESS_TOKEN` en Supabase secrets.

Hay dos caminos. El segundo es mas simple porque no requiere crear una Meta
App ni manejar secretos.

1. Edge Function `meta-lead-ads` + webhook `leadgen` de Meta. Requiere Meta
   App, `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN` y suscribir la pagina.
2. n8n con el trigger nativo. La credencial OAuth vive en n8n y el nodo
   resuelve `field_data` solo. Workflow listo para importar:
   `n8n/workflows/duke-meta-lead-ads-trigger.json`.

Pasos del camino 2:

- Importar el workflow en n8n.
- Crear la credencial `Facebook Lead Ads OAuth2` y conectarla con la cuenta
  que administra `El duke del Caribe`.
- Elegir pagina y formulario en el nodo trigger.
- Confirmar que `SUPABASE_SERVICE_ROLE_KEY` este en las variables de n8n.
- Activar el workflow y mandar un lead de prueba desde la vista previa del
  formulario en Meta.
- Confirmar que cae en `Contactame Ya` con asesor del round-robin.

Firma del RPC verificada en produccion:
`fn_upsert_lead_from_meta_ads(payload jsonb, p_pool_key text) returns jsonb`,
que es exactamente lo que manda el nodo HTTP del workflow.

## Pendiente En Meta

- Formulario instantaneo tipo "Mas volumen" y sin pantalla de revision, para
  que sea de un solo paso.
- Pantalla final apuntando a `https://stratoscapitalgroup.com/duke/desarrollos-97k`.
- El boton azul del anuncio ya quedo en `Mas informacion`. El boton de la
  pantalla final del formulario es un desplegable con opciones fijas de Meta;
  confirmar en pantalla que opciones ofrece.
- No presionar `Publicar` sin confirmar presupuesto: ese boton activa entrega
  y gasto.
