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

## Alta controlada de una empresa nueva

1. Obtener autorización del dueño para compartir activos y registrar su número
   por coexistencia en su propio portafolio. Esto no se hace mediante esta migración.
2. Registrar el canal y su asesor en la empresa correcta. No usar una fila protegida.
3. Operaciones habilita modo lectura y la ruta del canal con las RPC privadas
   `fn_activate_whatsapp_readonly(uuid)` y
   `fn_set_whatsapp_readonly_route(uuid,uuid,boolean)`, exclusivamente por servidor.
   Comprobar empresa/canal/asesor antes de invocarlas; nunca desde el navegador.
4. Configurar únicamente ese remitente o una suscripción con recursos específicos
   en Infobip. No cambiar el webhook global ni las suscripciones de remitentes actuales.
5. Enviar un mensaje de prueba autorizado desde un contacto controlado y responder
   desde WhatsApp Business. Verificar lead, asesor, etapa, entrada, eco, bandeja y
   visibilidad. No prometer acceso a grupos o importación histórica.
6. Acreditar el recorrido y aprobar las pruebas en soporte. El botón actual de
   aprobación no inscribe automáticamente una ruta en el receptor nuevo.

## Evidencia y recuperación

- `node --test tests/infobip-receiver.test.mjs tests/infobip-receiver-db.test.mjs`.
- `node tests/sql/infobip-receiver-isolation.mjs`: PostgreSQL aislado, protección
  legacy y simulación 20 empresas x 20 asesores; no son 400 conexiones reales.
- `tests/sql/infobip-receiver-live-rollback.sql`: ensayo transaccional en Stratos
  después de instalar, con Auth/triggers/RLS reales. Dos empresas y 24 asesores
  ficticios, sin sesiones ni mensajes externos; finaliza con rollback.
- Comprobar `activeVersionId == versionId` del workflow nuevo y HTTP sin/con
  autenticación. Un lote vacío prueba transporte sin crear leads.
- Reversa: desactivar SOLO el workflow nuevo y deshabilitar sus rutas mediante la
  RPC privada. Conservar columnas y mensajes; no borrar datos ni tocar los flujos
  anteriores. El rollback web no revierte la base ni n8n.

Pendiente independiente: piloto real, permisos/aprobaciones y capacidad comercial
de Meta/Infobip. No asumir números ilimitados ni que verificar Duke aprueba Stratos.

Fuentes primarias del contrato de transporte:

- https://www.infobip.com/docs/reporting/webhooks
- https://www.infobip.com/docs/subscriptions/available-events
- https://www.infobip.com/docs/whatsapp/get-started/embedded-signup
