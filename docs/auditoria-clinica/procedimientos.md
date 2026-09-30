# Procedimientos propuestos — pendientes de aprobación y simulacro

No son políticas ya adoptadas por la clínica. Los responsables y plazos deben asignarse antes de su aplicación con pacientes reales.

## Acceso y separación de funciones

1. La dirección autoriza por escrito el alta y el rol de cada empleado con finalidad y organización.
2. El administrador crea una cuenta individual; verifica identidad, pertenencia, recuperación y permisos. El piloto actual permite un único administrador, por lo que no debe compartirse para simular roles.
3. QA comprueba que recepción no accede a funciones clínicas que no le correspondan y que ninguna cuenta ve otra organización. Usar usuarios y datos ficticios autorizados.
4. Registrar alta, cambios y bajas sin anotar contraseñas. Revisar accesos periódicamente con frecuencia aprobada.
5. En una baja, retirar permisos, revocar sesiones y comprobar el rechazo efectivo de acceso. No borrar expedientes para dar de baja a una persona.

## Incidente de seguridad o datos

1. Registrar hora, quién detecta, sistema afectado y un identificador de solicitud si existe. No copiar expedientes, claves ni tokens a chats o tickets.
2. Avisar al responsable de incidentes y al responsable de privacidad de la clínica. Mantener una vía alternativa de contacto documentada.
3. Contener mediante restricciones de acceso y rotación cuando corresponda; conservar evidencia y no destruir logs. Evaluar también Huli, autenticación y hosting.
4. Determinar alcance, personas afectadas y riesgo; el responsable de privacidad evalúa las comunicaciones y obligaciones legales aplicables con asesoría, sin inventar un plazo universal.
5. Recuperar el servicio, verificar controles y documentar causa, medidas y comprobación posterior. Cerrar con aceptación de responsables y ejercicio de seguimiento.

## Continuidad, respaldos y recuperación

1. Identificar dónde está el expediente fuente. No suponer que Stratos respalda Huli o que una caché local es un respaldo clínico.
2. Solicitar evidencia del proveedor sobre cobertura, frecuencia, cifrado, ubicación, retención, acceso y recuperación. Acordar RPO y RTO con la clínica.
3. Ejecutar una restauración en un entorno separado con datos ficticios. Comparar integridad, documentos, firmas e historial; documentar duración y fallos.
4. Probar exportación y lectura para cambio de proveedor y contingencias. Guardar evidencia sin información de pacientes reales en este repositorio.
5. Definir cómo operar durante una caída, registrar atención y reconciliar después sin duplicados ni pérdida de autoría. Una agenda vacía no acredita que el proveedor no tenga citas si la consulta falló.

## Verificación diaria de uso

Confirmar cuenta y tenant, profesional y sede, fecha y zona horaria. Revisar mensajes de error y conexión antes de interpretar una lista vacía. Registrar o modificar citas en Huli y actualizar Stratos para confirmar. Mantener la documentación clínica en el expediente validado. Cerrar sesión y proteger el dispositivo al terminar.

## Prueba móvil pendiente

Identificar iPhone, versión iOS, versión y build de App Store. Probar login, redirección al tenant, búsqueda, agenda, disponibilidad, fecha/sede, enlace a Huli, cierre de sesión y acceso posterior denegado, bloqueo/reanudación, reinicio, red lenta, sin red y reconexión. Documentar resultados y no marcar aprobado por el funcionamiento del servidor web.
