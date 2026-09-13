# Contrato de producto: Stratos Rails

Este documento delimita la superficie **Mi día / Proceso** dentro del Stratos existente. No sustituye las configuraciones de cada empresa ni define el alcance de Caja, ERP, marketing o RR. HH.

## Usuario y trabajo

El asesor necesita saber a quién atender, por qué ahora y qué conseguir. Después de actuar debe dejar un resultado y un siguiente paso con fecha. El administrador configura las reglas de su organización y decide cuándo activar el proceso para el equipo.

## Reglas observables

- La entrada muestra un bloque corto de acciones y el total pendiente de la cartera cargada. Siete por defecto; entre una y doce configurables.
- La prioridad se calcula con los datos disponibles. Fechas futuras, bajas de contacto, eliminaciones y etapas cerradas se respetan; una cita sin fecha no se anuncia como cita de hoy.
- La gestión requiere canal, resultado, siguiente paso y fecha/hora futura, indicando la zona horaria.
- Una gestión se retira al confirmar el servidor. Rechazos definidos conservan un borrador editable; respuestas inciertas conservan el identificador y los datos del envío para reintentar sin duplicación.
- Contactado, sin respuesta y reprogramado se distinguen. Los contadores personales no atribuyen trabajo del equipo al asesor actual.
- La evidencia y el compromiso se escriben en una transacción. Un asesor no puede gestionar fichas de otros asesores; administradores activos pueden hacerlo dentro de su organización.
- La configuración se guarda explícitamente y permanece apagada por defecto. Un error no cambia el estado confirmado.
- La demo señala su naturaleza y conserva las gestiones simuladas durante la sesión, reiniciándolas al recargar.
- El CRM y el expediente siguen disponibles. Rails extiende el sistema existente.

## Dirección de interfaz

Conservar el lenguaje visual existente, sus temas claro/oscuro y su navegación. Dar prioridad al cliente, la razón y el paso concreto. Usar controles táctiles de al menos 44 px, etiquetas vinculadas, foco visible y errores recuperables. La gestión se abre dentro de la tarjeta; el alta de cliente conserva su diálogo.

## Alcance comprobable

La auditoría, las pruebas y los límites de esta entrega están en [la auditoría del 12 de septiembre](output/auditoria-stratos-rails-2026-09-12.md). No se declara implementado un orquestador servidor de cadencias, horarios laborales, escalamiento o medición integral multicanal. La validación del despliegue productivo queda separada de las pruebas locales.
