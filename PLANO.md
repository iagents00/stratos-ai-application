# PLANO DE INSTALACIONES

> **Generado automáticamente. No lo edites a mano.**
> Lo produce `scripts/generar-plano.mjs` leyendo el código.
>
> `MAPA.md` es el plano arquitectónico: dónde está cada cuarto.
> **Este es el de instalaciones: por dónde pasan las tuberías y el cableado.**
> De dónde viene un lead, dónde se escribe, qué se rompe si tocás algo, y dónde
> está la llave de paso cuando algo revienta.

---

## 1. Dónde vive todo en producción

Antes que nada: las direcciones. Si algo falla, es en alguno de estos lugares.

| Qué | Dónde | Para qué |
|---|---|---|
| Código | GitHub `iagents00/stratos-ai-application` | Rama `main` = producción |
| Web | Vercel → `app.stratoscapitalgroup.com` | Despliega solo al mergear a `main` |
| Sitio público | `stratoscapitalgroup.com` | Landing de marketing |
| Base de datos | Supabase `glulgyhkrqpykxmujodb` | Postgres + Auth + RLS |
| Automatizaciones | n8n `personal-n8n.suwsiw.easypanel.host` | Entrada de leads, bots, recordatorios |
| App Android | GitHub Releases → `android-latest` | Se compila sola al tocar `mobile/` |
| App iOS | GitHub Actions → `iOS TestFlight` | Manual, con "Run workflow" |

---

## 2. Llaves de paso

Los archivos donde un error no rompe una pantalla: rompe **todo**. Si vas a
tocar alguno, leé primero la sección de ZONAS CRÍTICAS de `CLAUDE.md`.

- `src/lib/supabase.js`
  Cliente de Supabase. `flowType` debe seguir en `implicit`: con `pkce` se rompe el login. Trae URL y key hardcodeadas como respaldo porque Vercel no siempre tiene las variables.
- `src/lib/auth.js`
  Login, sesión y timeouts. Los valores de `GETSESSION_TIMEOUT` y `PROFILE_TIMEOUT` están calibrados: subirlos revive el bug de «Conectando con el servidor…».
- `src/contexts/AuthContext.jsx`
  Estado global de sesión. Solo limpia storage en `SIGNED_OUT`; limpiar en otros eventos mataba sesiones vivas.
- `src/lib/lead-save.js`
  Guardado de leads con triple respaldo. Es el camino por el que entra el dinero: si falla, se pierden leads.
- `public/sw.js`
  Service Worker. `CACHE_VERSION` se sube en cada merge a main; es el marcador para verificar que el deploy salió.
- `src/app/constants/navigation.js`
  Qué módulo ve cada rol y cada cliente. Un error acá le abre módulos a quien no debe.
- `mobile/capacitor.config.json`
  Shell de la app móvil. `webDir` apunta a `../dist`: el CRM va EMPAQUETADO en el binario. Volver a poner `server.url` haría que cargue remoto y se pierde el offline.

---

## 3. Instalación eléctrica — por dónde corren los datos

Cada tabla de Supabase que el código toca, y desde qué archivos. Si cambiás una
columna, estos son los archivos que hay que revisar.

| Tabla | Archivos | Dónde se usa |
|---|---|---|
| `profiles` | 6 | `app/views/Caja.jsx` · `app/views/ChatEquipo.jsx` · `app/views/FinanzasAdmin.jsx` _+3_ |
| `evidencia` | 5 | `app/views/CRM/components.jsx` · `app/views/Caja.jsx` · `app/views/ChatEquipo.jsx` _+2_ |
| `team_expenses` | 4 | `app/views/Caja.jsx` · `app/views/Copilot.jsx` · `app/views/FinanzasAdmin.jsx` _+1_ |
| `leads` | 3 | `app/views/Caja.jsx` · `app/views/FinanzasAdmin.jsx` · `app/views/WhatsApp.jsx` |
| `expediente_items` | 2 | `app/views/CRM/LeadChatHistory.jsx` · `app/views/CRM/LeadNotesTimeline.jsx` |
| `mkt_tasks` | 2 | `app/views/Marketing.jsx` · `app/views/PlanSemanal.jsx` |
| `team_actions` | 2 | `app/App.jsx` · `app/views/ProductividadTab.jsx` |
| `catalogo_proyectos` | 1 | `app/views/ERP.jsx` |
| `device_tokens` | 1 | `lib/push-native.js` |
| `discovery_data` | 1 | `app/views/CRM/LeadDiscoveryPanel.jsx` |
| `fin_invoices` | 1 | `app/views/CuentasCobro.jsx` |
| `lead_related_contacts` | 1 | `app/views/CRM/LeadRelatedContacts.jsx` |
| `mkt_brands` | 1 | `app/views/Marketing.jsx` |
| `mkt_daily_reports` | 1 | `app/views/Marketing.jsx` |
| `mkt_pipeline_columns` | 1 | `app/views/Marketing.jsx` |
| `mkt_pipeline_items` | 1 | `app/views/Marketing.jsx` |
| `mkt_projects` | 1 | `app/views/Marketing.jsx` |
| `mkt_requests` | 1 | `app/views/Marketing.jsx` |
| `organizations` | 1 | `hooks/useRailsConfig.js` |
| `scheduled_calls` | 1 | `hooks/useScheduledCalls.js` |
| `voice_call_logs` | 1 | `app/views/CRM/LeadVoiceCalls.jsx` |
| `whatsapp_messages` | 1 | `lib/whatsapp-chat.js` |
| `whatsapp_outbox` | 1 | `lib/whatsapp-chat.js` |

### Funciones del servidor (RPC)

Lógica que corre **dentro** de Postgres, no en el navegador. Si una falla, el
error no está en el frontend.

| Función | Llamada desde |
|---|---|
| `fn_comando_nsg` | `app/views/ComandoOps.jsx` · `app/views/Nomina.jsx` |
| `fn_doc_guardar` | `app/views/CuentasCobro.jsx` · `app/views/InformeAvances.jsx` |
| `fn_doc_link_agregar` | `app/features/MetaPanel/DocsStratos.jsx` · `app/views/InformeAvances.jsx` |
| `add_expediente_item` | `app/views/CRM/LeadNotesTimeline.jsx` |
| `copilot_log_msg` | `app/views/Copilot.jsx` |
| `copilot_log_msg_media` | `app/views/Copilot.jsx` |
| `create_portfolio_link` | `app/views/LandingPages/index.jsx` |
| `fn_bulk_reassign_leads` | `app/views/WhatsApp.jsx` |
| `fn_call_targets` | `app/App.jsx` |
| `fn_chat_channels` | `app/views/ChatEquipo.jsx` |
| `fn_chat_create_channel` | `app/views/ChatEquipo.jsx` |
| `fn_chat_messages` | `app/views/ChatEquipo.jsx` |
| `fn_chat_read` | `app/views/ChatEquipo.jsx` |
| `fn_chat_send` | `app/views/ChatEquipo.jsx` |
| `fn_docs_listar` | `app/features/MetaPanel/DocsStratos.jsx` |
| `fn_fin_cuenta_cobro_cliente` | `app/views/CuentasCobro.jsx` |
| `fn_fin_cuenta_cobro_persona` | `app/views/CuentasCobro.jsx` |
| `fn_fin_invoice_set_monto` | `app/views/CuentasCobro.jsx` |
| `fn_fin_invoices_list` | `app/views/CuentasCobro.jsx` |
| `fn_fin_set_nomina` | `app/views/Nomina.jsx` |
| `fn_get_my_recovery_email` | `app/views/Profile.jsx` |
| `fn_get_my_timezone` | `app/views/Profile.jsx` |
| `fn_informe_avances` | `app/views/InformeAvances.jsx` |
| `fn_informe_borrador` | `app/views/InformeAvances.jsx` |
| `fn_informe_nota_agregar` | `app/views/InformeAvances.jsx` |
| `fn_informe_nota_borrar` | `app/views/InformeAvances.jsx` |
| `fn_informe_notas_listar` | `app/views/InformeAvances.jsx` |
| `fn_llamada_en_curso` | `app/App.jsx` |
| `fn_mkt_intel` | `app/App.jsx` |
| `fn_set_my_recovery_email` | `app/views/Profile.jsx` |
| `fn_set_my_timezone` | `app/views/Profile.jsx` |
| `fn_start_team_call` | `app/App.jsx` |
| `fn_wa_conversations` | `hooks/useWhatsAppInbox.js` |
| `fn_wa_mark_read` | `hooks/useWhatsAppInbox.js` |
| `fn_wa_outbox_retry` | `lib/whatsapp-chat.js` |
| `fn_wa_toggle_pin` | `hooks/useWhatsAppInbox.js` |
| `mkt_approve_evidence` | `app/views/Copilot.jsx` |
| `mkt_attach_evidence_to` | `app/views/Copilot.jsx` |
| `mkt_comment_evidence` | `app/views/Copilot.jsx` |
| `mkt_evidence_candidates` | `app/views/Copilot.jsx` |
| `rails_agenda_hoy` | `lib/agenda.js` |
| `rails_marcar_accion` | `lib/agenda.js` |
| `resolve_portfolio_link` | `app/views/LandingPages/PublicLanding.jsx` |

---

## 4. Instalación hidráulica — qué entra y sale de la casa

Servicios de terceros con los que habla el código.

| Servicio | Usado en |
|---|---|
| `personal-n8n.suwsiw.easypanel.host` | 13 archivos |
| `glulgyhkrqpykxmujodb.supabase.co` | 4 archivos |
| `drive.google.com` | 3 archivos |
| `brokers.mycocay.com` | 1 archivo |
| `brokers.simca.mx` | 1 archivo |
| `cal.com` | 1 archivo |
| `calendly.com` | 1 archivo |
| `docs.google.com` | 1 archivo |
| `ionic.io` | 1 archivo |
| `maps.app` | 1 archivo |
| `meet.google.com` | 1 archivo |
| `mexicorealestatesolutions.com` | 1 archivo |

---

## 5. Muros de carga — radio de impacto

Cuántos archivos dependen de cada uno. Tocar los de arriba se siente en toda la
casa; por eso mismo son los que más cuidado piden.

| Archivo | Archivos que lo importan |
|---|---|
| `design-system/tokens.js` | **70** |
| `lib/supabase.js` | **40** |
| `hooks/useAuth.js` | **35** |
| `hooks/useViewport.js` | **28** |
| `app/SharedComponents.jsx` | **19** |
| `hooks/useClient.js` | **16** |
| `lib/native.js` | **9** |
| `app/views/CRM/zoom-metrics.js` | **6** |
| `app/components/Logo.jsx` | **5** |
| `app/views/CRM/date-range.js` | **5** |
| `lib/utils.js` | **4** |
| `lib/offline-mode.js` | **4** |
| `design-system/primitives.jsx` | **4** |
| `lib/audit.js` | **4** |
| `app/constants/labels.js` | **4** |

---

## 6. El tablero eléctrico — variables de entorno

| Variable | Consumida en |
|---|---|
| `VITE_SUPABASE_ANON_KEY` | `app/App.jsx` · `lib/supabase.js` |
| `VITE_SUPABASE_URL` | `app/App.jsx` · `lib/supabase.js` |
| `VITE_APP_URL` | `main.jsx` |
| `VITE_DIAGNOSTICO_CALCOM_URL` | `landing/Diagnostico.jsx` |
| `VITE_DIAGNOSTICO_STRATOS_WEBHOOK_URL` | `lib/webhook-diagnostico-stratos.js` |
| `VITE_TELEGRAM_BOT_USERNAME` | `app/views/Profile.jsx` |

> `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` tienen valores de respaldo
> escritos en `src/lib/supabase.js`. Es a propósito: sin ellos, un deploy sin
> variables configuradas apuntaba a un dominio inexistente y el login se colgaba.

---

## 7. Flujos críticos

Los tres caminos que hay que entender. Todo lo demás se deduce de estos.

### 7.1 Cómo entra un lead y dónde queda

1. **Meta Ads dispara el formulario**
   El anuncio capta al prospecto.
2. **n8n recibe el webhook y reparte** → `n8n/workflows/duke-meta-lead-ads-trigger.json`
   Asigna asesor por round-robin.
3. **Se escribe en Supabase**
   Tabla `leads`, con `asesor_name` para que RLS lo filtre.
4. **El CRM lo lee y lo pinta** → `src/app/views/CRM/index.jsx`
   El asesor lo ve en su pipeline.
5. **Alta manual desde el CRM** → `src/lib/lead-save.js`
   Cuando el asesor lo carga a mano, pasa por acá, no directo a Supabase.

### 7.2 Cómo se inicia sesión

1. **El usuario escribe correo y contraseña** → `src/landing/LoginScreen.jsx`
   Pantalla de login.
2. **signInWithPassword contra Supabase** → `src/lib/auth.js`
   Sin OAuth ni magic links: por eso no hay redirects que whitelistear.
3. **La sesión queda en localStorage** → `src/lib/supabase.js`
   Con la key por defecto del SDK. No sobreescribirla.
4. **AuthContext la hidrata al abrir** → `src/contexts/AuthContext.jsx`
   Con timeout suave: si tarda, muestra login pero NO borra la sesión.
5. **Se resuelve a qué cliente pertenece** → `src/contexts/ClientOrgGuard.jsx`
   Por `organization_id`, y redirige si entró por el path equivocado.

### 7.3 Cómo alguien borra su propia cuenta

1. **Lo exige Apple**
   Guideline 5.1.1(v): una app que permite crear cuentas tiene que permitir borrarlas desde adentro.
2. **El panel en el Perfil** → `src/app/views/Profile.jsx`
   Pide escribir el correo completo. Un botón de 'confirmar' a secas se toca sin leer.
3. **La Edge Function decide, no el navegador** → `supabase/functions/delete-my-account/index.ts`
   A quién se borra sale del JWT de quien llama. Desplegada y activa en producción.
4. **Guarda contra dejar la org huérfana**
   Si es el único admin de su organización, se rechaza: nadie podría volver a dar de alta a nadie.
5. **Los leads NO se borran**
   Son registros de la empresa, no de la persona. La interfaz lo dice explícitamente.

### 7.4 Cómo cobra Stratos, y dónde NO cobra

1. **La pantalla de Planes muestra precios** → `src/landing/PricingScreen.jsx`
   Es presentación: muestra los planes y un botón de Apple Pay.
2. **⚠️ El botón de pago NO cobra nada** → `src/landing/PricingScreen.jsx`
   `handlePay` espera 2.2 segundos con setTimeout y muestra «pago exitoso». No hay Stripe, MercadoPago, Conekta ni ninguna pasarela en el repo. Es una maqueta. Si un cliente real le da clic, cree que pagó y no se cobró nada.
3. **El plan Enterprise manda a un correo** → `src/landing/PricingScreen.jsx`
   Muestra un alert con ventas@stratoscapitalgroup.com.
4. **El cobro real es manual, fuera del sistema**
   Se acuerda por fuera y se registra a mano.
5. **Cuentas de cobro internas** → `src/app/views/CuentasCobro.jsx`
   Para facturar a clientes y personas del equipo. Es contabilidad interna, no cobro al cliente final.
6. **Caja: ingresos y egresos** → `src/app/views/Caja.jsx`
   Libro de movimientos sobre `team_expenses`. Los gastos entran por Telegram.

### 7.5 Cómo funciona el Copilot (tiene DOS caminos)

1. **Camino determinista: va directo a Supabase** → `src/app/views/Copilot.jsx`
   Aprobar evidencia, adjuntarla, comentar. Son RPCs (`mkt_approve_evidence`, `mkt_attach_evidence_to`, `mkt_comment_evidence`). NO pasan por la IA, así que si esto falla el problema está en Postgres o en RLS.
2. **Camino del cerebro: webhook a n8n con GPT-4o** → `src/app/views/Copilot.jsx`
   Lo conversacional. El prompt y el modelo viven en n8n, NO en este repo: si el Copilot responde raro, el cambio se hace allá.
3. **Lector de comprobantes (OCR)** → `src/app/views/Copilot.jsx`
   Otro webhook de n8n donde Claude lee la imagen y saca el monto.
4. **Todo queda registrado**
   `copilot_log_msg` y `copilot_log_msg_media` guardan la conversación en Supabase.

### 7.6 Cómo llega un cambio a producción

1. **Rama, commit y PR**
   `main` está protegida por CODEOWNERS.
2. **Subir CACHE_VERSION** → `public/sw.js`
   Es el marcador para verificar el deploy después.
3. **Merge a main**
   Vercel despliega solo.
4. **Verificar**
   `curl app.stratoscapitalgroup.com/sw.js` y confirmar la versión nueva.
5. **La app móvil NO se entera sola** → `mobile/capacitor.config.json`
   Desde ago-2026 empaqueta el CRM dentro del binario, así que abre sin red. Los datos siguen en vivo, pero un cambio de interfaz necesita un release nuevo por TestFlight o Play.

---

## 8. Cuándo algo se rompe

| Síntoma | Dónde mirar primero |
|---|---|
| Nadie puede entrar | `src/lib/supabase.js` y `src/lib/auth.js`. Revisar que Supabase esté arriba. |
| Entra pero se sale al recargar | `src/contexts/AuthContext.jsx`. Casi siempre es un timeout mal calibrado. |
| Dejaron de llegar leads | n8n primero, no el CRM. El webhook de Meta es el sospechoso. |
| Un usuario ve una versión vieja | `CACHE_VERSION` en `public/sw.js` no se subió en el último merge. |
| La app móvil no abre | El bundle va dentro del binario, así que abrir siempre abre. Si carga pero sin datos, el problema es Supabase, no Vercel. |
| Un módulo se le abrió a quien no debe | `src/app/constants/navigation.js` y las políticas RLS de Supabase. |
| El Copilot responde raro o no responde | ¿Falló una acción concreta (aprobar, comentar)? Es RPC de Supabase. ¿Falló lo conversacional? El prompt vive en n8n, no en este repo. |
| Un cliente dice que pagó y no le llegó | Revisar la sección 9: el botón de pago no cobra. El cobro real es manual. |
| Alguien reporta un error y no hay rastro | No hay registro de errores en producción. Pedirle captura de la consola del navegador. |

---

## 9. Riesgos abiertos

Cosas que hoy están así y conviene decidir qué hacer con ellas.

| Riesgo | Dónde | Por qué importa |
|---|---|---|
| **El botón de pago no cobra** | `src/landing/PricingScreen.jsx` | `handlePay` simula con `setTimeout` y muestra «pago exitoso». Un cliente puede creer que pagó. Además, Apple exige In-App Purchase para bienes digitales: un botón de pago falso es motivo de rechazo. |
| **Sin registro de errores en producción** | — | No hay Sentry ni equivalente. Cuando algo falla en el teléfono de un asesor, no queda rastro: la única fuente es que alguien avise. |

---

## 10. Cómo pedir un arreglo para que salga a la primera

Cuando algo se rompe, esto es lo que hace la diferencia entre arreglarlo en un
intento o en cinco. Al reportar, incluí:

1. **Qué pantalla.** Mirá `MAPA.md` sección 1, o el texto que ves en el menú.
2. **Qué decía el botón o el texto.** Con eso, `npm run buscar "texto"` da el
   archivo y la línea exactos.
3. **Qué esperabas y qué pasó.** «Le di a Generar PDF y no pasó nada» es
   suficiente; «no funciona» no lo es.
4. **A quién le pasa.** ¿A todos, a un rol, a un cliente? Si es a uno solo,
   suele ser permisos (`navigation.js` o RLS), no un bug de código.
5. **Si es en el teléfono o en la computadora.** El WebView de iOS se comporta
   distinto: ahí no hay Service Worker, y los `<a download>` no abren nada.

Con esos cinco datos, la sección 8 de este plano casi siempre dice dónde mirar
antes de abrir un solo archivo.

---

_Todas las referencias de este plano fueron verificadas contra el disco._
