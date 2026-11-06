# Insistencia de Copilot

Cada persona puede configurar la insistencia en la campana del encabezado de Copilot o en Perfil. También puede escribir **Activa la insistencia** o **Desactiva la insistencia**.

- Activa, valor inicial: un seguimiento cada tres minutos hasta responder.
- Desactivada: hasta dos seguimientos adicionales al aviso inicial, separados por tres minutos. Una respuesta detiene el ciclo antes de alcanzar ese límite.
- **Lo voy a hacer** y **No voy a poder** detienen la insistencia sin completar ni cancelar la actividad.
- Completar, eliminar, cambiar el estado o reprogramar la actividad detiene el ciclo anterior. Una fecha nueva genera un ciclo nuevo cuando se entrega su recordatorio.
- Se conservan los horarios silenciosos y las ventanas de trabajo existentes. Los avisos de calendario iniciales mantienen sus horarios. No se persiguen recibos, comprobantes ni anuncios informativos.

## Funcionamiento

La migración `291_copilot_reminder_followups.sql` captura únicamente recordatorios que pasan a enviados después de instalarla. No convierte el historial antiguo en avisos nuevos. Agrupa las fases de una misma tarea o cita por organización, persona, actividad y fecha; Zoom y próxima acción de la misma cita comparten un ciclo.

`copilot_reminder_followups` conserva el contador, la próxima fecha y la respuesta. El proceso `copilot-followups-tick` revisa cada treinta segundos lo que venció y programa el siguiente aviso al menos tres minutos después del envío anterior. Un bloqueo transaccional y una clave única por repetición evitan duplicados. Una pausa o caída produce un único aviso fresco al recuperarse, sin descargar avisos acumulados.

Los seguimientos se entregan en el historial de Copilot y por el mecanismo existente de push de la app/web, según las suscripciones y permisos del dispositivo. No añaden un envío independiente a Telegram. La versión móvil 4.9.9 incluye el interruptor y las respuestas directas. Las respuestas reconocibles y los comandos de insistencia que las versiones anteriores registran en el historial también actualizan el seguimiento.

Las respuestas por botón contienen el identificador exacto del ciclo. Una respuesta breve como “sí” solo se interpreta como confirmación cuando el último turno corresponde a ese recordatorio. El servidor deriva la persona de `auth.uid()` y rechaza identificadores ajenos. Una confirmación incierta no se reenvía al modelo ni se reintenta automáticamente.

## Validación y operación

- Pruebas PostgreSQL aisladas: intervalos, repetición ilimitada, límite reducido, cambios de modo, aislamiento de usuarios, reconocimiento del contexto, reprogramaciones y cambios de estado.
- Interfaz comprobada con datos aislados en móvil y escritorio, temas claro/oscuro, respuesta por botón, comando de texto y recuperación de una respuesta de red perdida.
- Compilaciones web y app, guardia de App Store, pruebas de respuesta y permisos, validación de RPC y mapas del proyecto.
- Prueba transaccional en Stratos con `ROLLBACK`: migración real, registro del cron, captura, tres repeticiones, cambio de preferencia y respuesta. Los HTTP de `pg_net` se ejecutan después del commit, por lo que esta prueba revierte también su cola de envío ([documentación](https://supabase.com/docs/guides/database/extensions/pg_net)).
- Verificar que `cron.job` contiene `copilot-followups-tick` activo, que sus últimas ejecuciones terminan correctamente y que las dos RPC nuevas aparecen como OK en `fn_qa_rpc_del_front()`.
- Aplicar solo la migración 291 al proyecto Stratos. Nunca ejecutar todo el historial.

Para detener operativamente este motor se puede desactivar únicamente su job de cron; eso conserva preferencias, historial y respuestas. No reactivar los escaneos de insistencia antiguos en paralelo. Las notas de implementación y pruebas no equivalen a una aprobación de App Store ni a una publicación en Google Play: esos estados se verifican por separado.
