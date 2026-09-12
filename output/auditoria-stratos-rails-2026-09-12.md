# Auditoría de Stratos AI y evolución de Stratos Rails

Fecha: 12 de septiembre de 2026. Estado: implementación en rama aislada; pendiente validación del despliegue y la base productiva.

## Conclusión

Stratos tiene las piezas de un sistema comercial amplio y ya incluía Stratos Rails, pero el recorrido diario todavía permitía perder gestiones y mostrar una sensación falsa de avance. La prioridad de esta entrega es cerrar ese circuito: elegir una acción, registrar lo ocurrido, definir el siguiente paso con fecha, confirmar su persistencia y conservar evidencia.

La referencia correcta es **Vixiees**, que describe “Sales on Rails” como reglas de contacto y asignación, próxima tarea, registro de resultados y recuperación de pendientes. Se tomó ese principio operativo, sin copiar su producto ni asumir sus promesas comerciales. Fuentes: [cómo funciona Vixiees](https://www.vixiees.com/how-it-works) y [su propuesta de CRM](https://www.vixiees.com/landing/crm).

## Alcance y versión

- Se consultó la aplicación pública actual en `app.stratoscapitalgroup.com/?rails=1`; el HTML del 12 de septiembre carga `index-DMFdegNF.js`. Se recorrió la demo disponible en ese dominio. No se inició sesión en una cuenta real ni se enviaron mensajes a clientes.
- Código base: `origin/main`, commit `e08d0c9`, obtenido al iniciar esta revisión. El checkout original estaba atrasado y contenía cambios locales; se preservó.
- Implementación: rama `codex/stratos-rails-audit-20260912`, carpeta `/Users/ivanrodriguezruelas/stratos-rails-audit-20260912`.
- Auditoría transversal de estructura, contratos RPC, configuración por cliente, documentación, compilación, dependencias y riesgos de interfaz. Revisión profunda y pruebas de comportamiento sobre Rails, su integración con CRM, ajustes y dos indicadores de Comando/CRM.
- Las comprobaciones SQL ejecutan PostgreSQL embebido con un esquema mínimo compatible con el contrato de Rails. No prueban todos los triggers, políticas históricas, datos y jobs existentes en Supabase productivo.
- No se afirma que cada operación de Caja, nómina, ERP, WhatsApp, telefonía, IA, marketing y documentos haya sido ejecutada o certificada. El inventario del repositorio y su compilación no demuestran el funcionamiento de sus servicios externos.

## Hallazgos y cambios

| Prioridad | Hallazgo comprobado | Resolución en esta rama |
|---|---|---|
| Alta | “Hecho” retiraba una tarjeta y aumentaba progreso antes de conocer el resultado de la RPC. | Confirmación del servidor antes de retirar la tarjeta. Error visible y posibilidad de reintento. |
| Alta | Mover modificaba la ficha y la agenda por caminos separados, con aviso de éxito anticipado. | Una transacción guarda resultado, compromiso, fecha, agenda e historial. |
| Alta | La RPC anterior verificaba organización, pero no propiedad del lead; la inserción directa de agenda podía evitar el proceso. | Comprobación de organización, cuenta activa, asesor o rol administrador; retiro de escritura directa de agenda y evidencia. |
| Alta | Opt-out, borrado y algunos cambios de estado no retiraban acciones congeladas. | Exclusión en motor y comprobación nuevamente en servidor. El orden se mantiene solo para acciones válidas. |
| Alta | Una tarjeta antigua podía sobrescribir un compromiso recién editado. | Bloqueo de fila y comprobación del `updated_at` que el asesor había visto. |
| Alta | Reintentar una respuesta perdida podía duplicar trabajo. | Identificador de gestión y registro inmutable; reintento idempotente. |
| Alta | Todo Zoom agendado se trataba como una cita de hoy, incluso sin fecha utilizable. | Cita de hoy, cita pasada y fecha pendiente tienen acciones distintas; se respetan compromisos y reactivaciones futuras. |
| Alta | Se filtraban las gestiones cerradas después del tope de siete y se podía mostrar “terminaste” con más cartera pendiente. | Exclusión antes del límite, total visible y reposición del bloque. No se declara completado todo el día. |
| Alta | La configuración compartida podía recibir una respuesta tardía de otra organización; el guardado fallido quedaba activado localmente. | Estado por sesión/organización, publicación confirmada, exclusión de operaciones simultáneas y errores explícitos. |
| Alta | Actualizar Rails reescribía `meta_config` completo tras una lectura, con riesgo de pisar otros cambios. | Escritura atómica de la clave Rails, preservación del resto y comprobación de versión esperada y organización. |
| Media | Contadores de Mi día podían sumar gestiones accesibles de otros asesores. | Se conserva el actor y se cuentan solo sus cierres; los cierres ajenos siguen evitando duplicados. |
| Alta | Rechazos deterministas bloqueaban el borrador y reintentos inciertos revalidaban la fecha. | Validación tras trim, corrección editable ante rechazo y reenvío idéntico incluso después de vencer la fecha; probado en fixture UI local. |
| Media | El enlace de WhatsApp incluía literalmente instrucciones del coach como borrador para el cliente. | Abre el chat sin copiar instrucciones internas. El asesor redacta el mensaje. |
| Media | “Primer contacto” se aplicaba a clientes en segundo intento por `isNew`; se mostraba una caída “100×” sin evidencia vinculada. | Restricción por etapa y texto apoyado en el estado registrado. |
| Media | La inactividad se infería de cualquier edición de metadatos. | Prioridad a fecha explícita de contacto y campos de inactividad; se deja de usar `updated_at` como prueba de una conversación. |
| Media | La vista Rails mantenía visible el pipeline debajo, además de renderizar sus filas y selectores. | El pipeline se monta al abrir el CRM completo. Los portales de alta y expediente siguen disponibles. Botón de regreso a Mi día. |
| Media | Ajustes tenían guardado por blur, interruptores sin nombre y controles pequeños. | Borrador explícito, guardar/descartar, campos asociados a etiquetas, controles de 44 px y estados de carga/error. |
| Alta | El modal Nuevo cliente no gestionaba correctamente foco, Escape y etiquetas principales. | Semántica de diálogo, aislamiento del fondo, foco inicial, ciclo de Tab, devolución del foco y Escape; nombres en campos principales. |
| Alta | Comando mostraba 100% en filas vacías. Además mezclaba leads creados y eventos ocurridos en el período como si fueran una cohorte de conversión. | Presentación como actividad comercial del período, conteos separados y barras sin porcentaje de conversión inventado. |
| Media | “Activos hoy” incluía prioridad manual y hasta dos días de inactividad. | Conteo y etiqueta explícitos de clientes marcados como prioritarios. |
| Alta/Media | `npm audit` reportó 12 vulnerabilidades en dependencias de producción y desarrollo. | Actualizaciones compatibles con los rangos declarados. Resultado posterior: 0 vulnerabilidades reportadas. |

## Proceso construido

1. **Entrada y responsable.** El CRM conserva su alta y asignación. Rails trabaja la cartera accesible; el servidor verifica nuevamente quién puede gestionar cada lead.
2. **Selección del momento.** El motor prioriza primer contacto, compromisos vencidos, citas, clientes marcados como prioritarios, calificación y reactivación. Respeta bajas, cierres y fechas futuras.
3. **Trabajo en bloques.** Siete acciones por defecto, configurables entre una y doce. El total pendiente permanece visible. Cambios de teléfono, estado o consentimiento se reflejan sin conservar datos viejos de una tarjeta.
4. **Gestión.** Contactado, sin respuesta o reprogramado. Se registra canal, resultado, siguiente acción y fecha/hora futura. Los atajos de mañana, tres días y una semana son ayudas editables, no una cadencia automática.
5. **Confirmación.** Una transacción escribe compromiso, agenda, intento cuando corresponde y evidencia. Reprogramar no incrementa contactos. El expediente recibe una entrada de historial identificada como Stratos Rails.
6. **Continuidad.** El próximo pendiente ocupa el lugar disponible. Un siguiente paso programado para más tarde el mismo día puede volver a aparecer cuando venza. La jornada utiliza la zona del navegador, mostrada junto al horario; no se presupone una zona corporativa global.
7. **Control administrativo.** Configuración con borrador y guardado explícito. El rol y la organización se verifican en servidor. Rails sigue apagado por defecto; esta entrega no lo activa para ningún equipo.

## Cobertura del resto de Stratos

| Área | Lo que se revisó | Lo que requiere validación adicional |
|---|---|---|
| Acceso, planes y clientes | Estructura de configuración, verificador de contexto para Duke, Grupo28, NSG, Vega y TGenius; entrada pública/demo. | Sesiones reales de cada rol, planes vigentes y aislamiento integral de todas las tablas. |
| CRM y expediente | Integración de Rails, alta, navegación, motor de acciones, agenda y guardado. | Edición tradicional `updateLead`, cola offline, reasignación concurrente y paginación con cartera completa. |
| Comando y productividad | Cálculo que mezclaba cohortes/eventos y porcentajes vacíos; compilación de módulos. | Reconciliación de cada KPI con datos operativos y fuentes de eventos de producción. |
| Copilot e IA | Presencia de módulos y registro estático de RPC. | Evaluaciones de exactitud, herramientas autorizadas, consumo, latencia y fallos del proveedor con una sesión de prueba. |
| WhatsApp, llamadas y Telegram | Enlaces de contacto en Rails y contratos existentes en el repositorio. | Entrega real, webhooks, ventanas de contacto, retries, opt-out en todos los canales y deduplicación externa. |
| Caja, finanzas, ERP y RR. HH. | Inventario, compilación y registro estático de funciones llamadas por el frontend. | Flujos transaccionales en staging, permisos de funciones financieras, conciliaciones y cierre de períodos. |
| Marketing, landing pages y documentos | Módulos existentes, dependencias compartidas y validación documental. | Publicación, formularios públicos, subida de archivos y autorización real de enlaces/documentos. |
| Seguridad y operación | Dependencias, permisos del nuevo circuito, pruebas negativas y evidencia inmutable de Rails. | Prueba completa de RLS, backups/restauración, secretos de servidor, rate limits y jobs de Supabase/n8n. |

## Lo que todavía falta para un Sales on Rails completo

El nuevo circuito es la base operativa. **No constituye aún un orquestador automático de todo el negocio.** Son siguientes entregas explícitas:

- Clasificador y agenda persistida del lado servidor sobre la cartera completa, para que paginación/cache del navegador no oculten pendientes. Esta versión muestra los clientes cargados.
- Cadencias configurables por industria y canal: máximos de intentos, horarios laborales, festivos, pausas, ausencia del asesor y escalamiento por SLA. No asumir que seis intentos sirven para todos los negocios.
- Reglas de avance de etapa y evidencias de calificación: presupuesto, necesidad, autoridad de compra/co-decisor, disponibilidad y resultado de la cita. Tener campos en la base no equivale a aplicar sus reglas.
- Unificar gestiones Rails, llamadas, WhatsApp, Copilot y edición tradicional en un registro de eventos común. El contrato nuevo protege la ruta Rails; no reemplaza todas las escrituras existentes.
- Medición del proceso por eventos: tiempo de primera respuesta, compromisos cumplidos a tiempo, clientes sin segundo intento y recuperación. Separar métricas del proceso de bonos/rankings.
- Piloto con un equipo y datos reales de prueba antes de activar para todas las empresas. Probar cada pipeline personalizado; las reglas actuales mantienen las etapas comerciales existentes de Stratos.

## Validación y entrega

Ver resultados en `rails-pruebas.txt`, `auditoria-dependencias.json`, `auditoria-lint-resumen.json` y las capturas bajo `.impeccable/review/`.

31 pruebas automatizadas de motor, configuración, recuperación y PostgreSQL embebido pasan. En navegador se comprobó validación previa, rechazo editable, reintento idéntico con fecha vencida, avance de cola, navegación y Escape del alta. El lint transversal registró 353 errores y 30 avisos históricos en 219 archivos; no se presenta como aprobado.

La compilación base pasa. Existen errores históricos de ESLint en archivos grandes; se registran por separado y se comparan con la base en los archivos modificados. Un verificador estático de RPC solo prueba que el nombre está registrado: la verificación de permisos en la base sigue siendo un paso del despliegue.

Antes de producción: aplicar y revisar la migración **243_rails_circuito_confirmado.sql** en staging con los triggers y políticas reales; validar roles y una gestión completa con recarga; coordinar actualización de frontend y de clientes abiertos. La RPC antigua pasa a rechazar gestiones sin el nuevo contrato, por lo que un frontend antiguo no debe seguir operando Rails durante la transición. Publicar ambos cambios de manera coordinada, ejecutar el centinela de RPC y habilitar primero un piloto. Conservar las evidencias escritas ante cualquier reversión de interfaz.

Esta rama no ejecutó migraciones ni cambió datos o configuración productivos.
