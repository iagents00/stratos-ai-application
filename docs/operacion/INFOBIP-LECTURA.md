# Receptor Infobip de solo lectura

Alcance: mensajes nuevos y ecos de WhatsApp Business App. No envía mensajes,
no importa historial, no registra números ni modifica los receptores existentes.
El código preparado no acredita por sí mismo despliegue o un piloto real.

## Instalación aislada

- Migración incremental 271 completa la parte de ingesta de 265. No repetir el
  historial remoto ni sustituir `fn_activate_whatsapp_readonly` ya instalada.
- Respaldar funciones, columnas, índices, triggers, políticas y workflows antes
  de aplicar. Usar `apply_migration`; lock timeout 2 s y statement timeout 30 s.
- Todos los canales presentes al instalar quedan `protected=true` en la tabla
  privada de rutas. La RPC de habilitación los rechaza. No migrar Duke o NSG.
- El índice de entrada solo cubre el espejo nuevo (`channel_id IS NOT NULL`);
  no cambia la escritura del receptor NSG. Chatwoot conserva su requisito de
  conversación mediante una restricción equivalente para `provider=chatwoot`.
- Ninguna ruta nueva queda habilitada automáticamente. La organización debe
  estar activa y en modo lectura, y el asesor debe pertenecer a esa empresa.

## Workflow nuevo, no sustitución

El generador es `tools/workflows/infobip-readonly-receiver.mjs`. Crear un workflow
separado con credencial Basic nueva y referencia a la credencial Supabase Stratos.
No modificar, desactivar ni republicar un flujo existente.

Rutas POST relativas al host n8n operativo:

- `/webhook/stratos-infobip-readonly-in-v1`: `INBOUND_MESSAGE`.
- `/webhook/stratos-infobip-readonly-echo-v1`: `BUSINESS_APP_MESSAGE_ECHO`.

Autenticación Basic obligatoria, sin secretos en URLs o Git. Este receptor es
administrado exclusivamente por operaciones Stratos y su proveedor de confianza:
**no compartir su credencial central con partners o clientes**. Una cuenta Infobip
administrada por un tercero requiere un ingreso separado con credencial y alcance
propios, no reutilizar esta clave global.

Normaliza el formato Infobip `results[]`; dirección fijada por el endpoint.
No interpreta arbitrariamente envolturas Meta ni acepta `organization_id`,
`asesor_id` o `channel_id` del payload. Un formato no reconocido recibe 400; errores
de persistencia devuelven 503, no un falso 200. Infobip debe usar los dos eventos y
la autenticación exacta; comprobar un evento real antes de activar cada canal.
Las ejecuciones no guardan cuerpos de mensajes ni cabeceras de autenticación.

## Alta desde el panel de soporte

1. Crear o elegir la empresa y un usuario activo que recibirá sus leads. En
   **WhatsApp**, seleccionar esa empresa, asesor y número internacional.
2. Pulsar **Abrir Infobip y vincular por QR**. El titular autoriza sus activos y
   escanea el QR desde WhatsApp Business. En este flujo de Infobip seleccionar
   **No compartir chats**: no se importa el historial. Preferir el portafolio del
   cliente; cualquier alojamiento temporal debe quedar identificado expresamente.
3. Volver a Stratos y pulsar **Ya lo vinculé en Infobip · Conectar a Stratos**.
   También sirve si el número ya se registró antes de abrir el panel. El servidor
   comprueba el remitente (incluidos alias mexicanos 52/521), la empresa y el asesor.
   Prepara el canal y crea o reutiliza dos suscripciones exclusivas de ese número,
   una de entrada y otra de eco, sin reemplazar reglas existentes.
4. Escribir desde otro WhatsApp al número conectado. El panel comprueba durante dos
   minutos la recepción real, el lead y su asignación; después se puede usar
   **Comprobar recepción**. Solo entonces muestra **Recibiendo leads**. Un QR o
   casillas marcadas por el navegador no acreditan el funcionamiento.
5. Para comprobar el espejo de respuestas, el asesor escribe manualmente desde
   WhatsApp Business. Esa evidencia se muestra por separado: un saludo automático
   no prueba el eco manual. No prometer acceso a grupos ni importación histórica.

La cuenta Infobip y el portafolio Meta **no determinan la empresa del CRM**. La
ruta privada une número, organización y asesor. Un número ya asignado a otra
empresa, un canal protegido o un receptor específico diferente detienen el alta.
Los reintentos reutilizan proceso, canal y suscripciones; no crean copias.

## Preparación inicial del servidor (una vez por cuenta operativa)

- Aplicar únicamente la migración incremental 322 y desplegar `whatsapp-admin`
  conservando JWT. Las cuatro RPC nuevas solo admiten `service_role`; el actor se
  obtiene de la sesión verificada, no de un campo enviado por el navegador.
- La clave Infobip debe permitir consultar remitentes y `subscriptions:manage`.
  Configurar en servidor `INFOBIP_READONLY_IN_PROFILE_ID`,
  `INFOBIP_READONLY_ECHO_PROFILE_ID` e `INFOBIP_READONLY_AUTH_ID`. Son referencias a
  perfiles ya preparados en la **misma cuenta operativa de confianza**, con las
  dos URL exactas anteriores y la credencial existente del receptor.
- El panel no recibe la clave API ni la contraseña Basic. Si faltan referencias,
  pide completar la preparación inicial sin volver a registrar el número.
- La automatización solo crea suscripciones con `resources:[remitente]` y un
  evento. No actualiza ni elimina perfiles, seguridad, grupos o reglas de Duke.
  Una configuración del número que reenvíe por HTTP con mayor prioridad requiere
  revisión; la prueba real permanecerá pendiente si el evento no llega.
- Una cuenta de proveedor de un tercero requiere ingreso aislado y credencial
  propios; no introducir allí las referencias ni credenciales del receptor central.

## Evidencia y recuperación

- `node --test tests/infobip-receiver.test.mjs tests/infobip-receiver-db.test.mjs`.
- `node tests/sql/infobip-receiver-isolation.mjs`: PostgreSQL aislado, protección
  legacy y simulación 20 empresas x 20 asesores; no son 400 conexiones reales.
- `tests/sql/infobip-receiver-live-rollback.sql`: ensayo transaccional en Stratos
  después de instalar, con Auth/triggers/RLS reales. Dos empresas y 24 asesores
  ficticios, sin sesiones ni mensajes externos; finaliza con rollback.
- Comprobar `activeVersionId == versionId` del workflow nuevo y HTTP sin/con
  autenticación. Un lote vacío prueba transporte sin crear leads.
- Reversa de un alta individual: deshabilitar únicamente su ruta mediante la RPC
  privada y conciliar solo las suscripciones de ese número. **No desactivar el
  receptor compartido:** ya puede atender a otras empresas. Conservar columnas,
  leads y mensajes; no borrar datos ni tocar los flujos anteriores. Para revertir
  la automatización del panel, restaurar web/Edge y conservar las RPC aditivas.
  El rollback web no revierte la base ni n8n.

Piloto acreditado el 12-nov-2026: dos mensajes reales crearon un solo lead en la
empresa de Gerardo y lo asignaron a su usuario. Su número se registró en el
portafolio Jarvis AIOS; eso no cambia su empresa en el CRM. El eco de una respuesta
manual sigue sin acreditar. No asumir números ilimitados ni que verificar Duke
aprueba Stratos; permisos, límites y costos del proveedor son independientes.

Fuentes primarias del contrato de transporte:

- https://www.infobip.com/docs/reporting/webhooks
- https://www.infobip.com/docs/subscriptions/available-events
- https://www.infobip.com/docs/whatsapp/get-started/embedded-signup
- https://www.infobip.com/docs/api/platform/subscriptions-api/subscription/create-subscription
- https://www.infobip.com/docs/subscriptions/inbound-messages-subscription-routing
