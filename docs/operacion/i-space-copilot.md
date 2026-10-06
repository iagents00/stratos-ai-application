# Copilot de proyectos y traspaso a Codex

## Estado y activación

El desglose del tablero y la preparación de prompts por tarjeta funcionan sin consultar un modelo. El motor nuevo `project-copilot` está desplegado pero **desactivado en el frontend** (`PROJECT_COPILOT_ENABLED = false`): la prueba real del proveedor devolvió HTTP 429 `credit_balance_exhausted`. Mantener el motor existente hasta verificar lectura, escritura y respuesta completas del nuevo motor. No presentar el nuevo motor como validado solo por compilarlo.

Antes de activar: reponer saldo de la cuenta correspondiente a `OPENAI_API_KEY` en Supabase o actualizar ese secreto por el canal de administración; ejecutar una consulta de proyectos, crear/editar una tarea de validación con checklist, comprobar el resultado y la ausencia de duplicados, después habilitar la bandera mediante PR y verificar producción. Nunca copiar llaves al navegador, repositorio, historial ni tablero.

## Arquitectura

`src/lib/project-copilot.js` llama a la Edge Function usando la sesión de Supabase, con identificador único por mensaje, sin reintentar escrituras automáticamente. La función verifica el usuario y su organización antes de cargar datos o consumir IA. La habilitación inicial se limita a I Space. Lee proyectos, miembros, tareas paginadas y 24 mensajes recientes; no lee otros tenants ni todo el almacén del IAOS.

El modelo predeterminado es `gpt-5.4` en Responses API, configurable con `PROJECT_COPILOT_MODEL`, con almacenamiento del proveedor desactivado. La clave permanece en el servidor. El límite de contexto es 2.000 tareas y un lote admite 120 cambios. No hay búsqueda web, ejecución de código ni herramientas externas en este motor.

`_shared/project-copilot.mjs` define el contrato y las instrucciones: una acción independiente por tarjeta, checklist de aceptación, conservación de notas, identificación por ID, sin inventar miembros, fechas o resultados. `compileProjectPlan` valida el lote y resuelve referencias temporales anteriores. `apply_i_space_project_plan` vuelve a validar campos y organización dentro de una transacción, bajo RLS de las tablas existentes. Controla versiones, duplicados, referencias, ciclos, checklist y avance con bloqueos. Un fallo revierte todo el lote. El recibo por usuario y solicitud permite reconocer una escritura ya confirmada. No borra ni archiva registros.

La migración [264_i_space_project_agent.sql](../../supabase/migrations/264_i_space_project_agent.sql) añade la función y los recibos privados. Fue aplicada a Stratos; no se ejecutó el historial de migraciones. Se probaron atómicamente 90 cambios de desglose y la repetición de su ID, además del rechazo de checklist incompleto, responsable externo, ciclos, versión obsoleta y acceso anónimo. Los datos y respaldos de negocio quedan fuera del repositorio.

## Prompts y circuito de trabajo

Cada editor de tarea ofrece **Preparar prompt para Codex** y **Copiar prompt**. La instrucción usa el formulario actual e incluye proyecto sugerido, ID, contexto, alcance, aceptación, dependencias y entrega con pruebas/enlaces. Los borradores se identifican como tales; generar/copiar un prompt no guarda el formulario ni completa la tarea.

Destinos sugeridos: `stratos-ai-application` para desarrollo de la plataforma/Huli, `Amistad-app12` para la aplicación Amistad, `IAOS SEP7` para coordinación y memoria. Para trabajo comercial y de contenido, revisar el destino antes de pegar. El generador no consulta el código ni el historial de esos proyectos.

Circuito disponible: elegir tarjeta → copiar prompt → trabajar en el proyecto correspondiente de Codex → devolver evidencia a la tarjeta → revisar criterios y estado. Una respuesta del modelo no constituye evidencia de ejecución externa.

## Integración directa con Codex e IAOS

Es una ampliación propuesta, **no una conexión activa**. Codex ofrece SDK, `codex exec` y app-server para ejecución, sesiones y aprobaciones ([documentación oficial](https://developers.openai.com/blog/codex-as-a-platform)). El navegador público de Stratos no puede por sí mismo controlar la aplicación local ni hereda su autenticación.

Un puente posterior debe tener ejecutor local o alojado, lista explícita de repositorios permitidos por usuario, cola autenticada, autorización por trabajo, estado y cancelación, entrega de PR/evidencia y conciliación sin marcar automáticamente producción como verificada. Las credenciales de Codex quedan en el ejecutor. No exponer shell, tokens o el vault completo al dashboard. El IAOS puede recibir decisiones/resúmenes autorizados; no mezclar indiscriminadamente contexto de empresas con el espacio privado.

La consulta del inventario local confirmó los proyectos de destino, pero el runtime de recordatorios IAOS no está configurado en este equipo y su otra base no respondió al chequeo. Esto no afecta el Kanban de Stratos; no equivale a una conexión IAOS validada.

## Referencias y operación

[Function calling](https://developers.openai.com/api/docs/guides/function-calling) · [Modelo GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4).

Reversión de la interfaz: deshabilitar la bandera y revertir el PR. La función nueva no sustituye funciones de otros tenants. Conservar los recibos y los datos; cualquier reversión de contenido requiere revisar el respaldo privado y cambios posteriores, sin restablecimiento masivo.
