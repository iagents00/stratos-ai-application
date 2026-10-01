# Auditoría de Comando — 17 de septiembre de 2026

Correcciones locales en el código. No se desplegaron ni se modificaron clientes, citas o acciones de producción. Se conservan los cambios que ya existían en el repositorio.

## Fallos corregidos

| Área | Problema | Corrección |
| --- | --- | --- |
| Totales y asesores | PDF y tabla atribuían Zooms con reglas distintas; faltaban autores sin leads nuevos y leads sin asesor | Un agregador compartido por tabla, totales y modelo del PDF. Se incluyen Sin asignar y Cuentas inactivas |
| Evolución | Histórico mostraba sólo 12 meses; registros sin fecha desaparecían de la gráfica | Se usa toda la extensión histórica y un grupo Sin fecha. La suma de cada columna coincide con su total |
| Conversiones | El embudo dividía eventos de clientes antiguos entre leads nuevos; podía mostrar 100% sin base | Barras de actividad sin conversiones entre poblaciones distintas. El PDF calcula la proporción con Zoom dentro de la misma cohorte; sin denominador muestra — |
| Gráficas | Barras positivas para valores cero y marca Hoy en el último día de un rango antiguo | Cero tiene ancho cero, incluido el PDF. Hoy aparece sólo en el intervalo que contiene la fecha actual |
| Definiciones | Intentos se llamaban contactos y etapas posteriores se llamaban calificados | Gestionados y Seguimiento+ describen las reglas existentes. Las visitas se etiquetan como agendadas, sin afirmar que se completaron |
| Seguimientos | Contadores de texto podían concatenarse; valores inválidos o negativos contaminaban totales | Conversión a enteros no negativos. Se aclara que son acumulados de los leads de la cohorte |
| Fechas | DATE podía interpretarse como medianoche UTC y aparecer el día anterior | Interpretación local de YYYY-MM-DD, validación de fechas y límites inclusivos del día final |
| Hitos | Una próxima acción o una reprogramación podía reescribir la fecha del primer hito | Se conserva el hito registrado. Una fecha de cita válida sólo completa una agenda sin fecha en etapas de agenda |
| Rango global | Productividad y agenda operativa ignoraban el rango | Productividad usa fecha programada o creación. Agenda, gráficas y resúmenes usan fecha de cita; subperíodos se explican como intersecciones |
| Carga completa | Zooms y acciones podían quedarse en el límite de respuesta de Supabase | Lectura paginada con orden estable y organización explícita; no se publica una carga parcial como éxito. El helper también alimenta la cartera del App |
| Errores y concurrencia | Cargas fallidas parecían vacías, peticiones viejas podían sobrescribir datos y guardados rechazados cerraban el editor | Error y reintento visibles, control de solicitudes vigentes, comprobación de filas modificadas, borrador conservado y bloqueo de exportaciones incompletas |
| Productividad | No se actualizaba al cambiar organización ni reflejaba el rango; estados se contaban de forma solapada | Recarga, visibilidad y suscripción por organización. Resumen con estados separados y avance completadas/total |
| Agenda | Registros sin responsable se perdían en desgloses y estados desconocidos se mostraban como agendados | Sin asignar, Sin clasificar y Otros para conservar el total en gráficas |
| Calendario y móvil | El calendario quedaba debajo de la tabla y no permitía rangos futuros para citas | Superposición corregida, cierre por Escape o clic exterior y fechas futuras en Comando con agenda. Sin desbordamiento a 390 px |
| Legibilidad | Descripciones de métricas casi invisibles en oscuro | Uso del token de texto secundario legible en las vistas del Comando |

## Validación realizada

- 10 pruebas automáticas: atribución, conciliación tabla/gráfica/PDF, histórico completo, registros sin fecha, zonas horarias, cambios de dueño, contadores, productividad, paginación de 1,243 registros y errores de red. Pasan en America/Los_Angeles y Pacific/Auckland.
- ESLint de los componentes y módulos afectados: sin errores ni advertencias.
- `npm run build`: correcto, incluido el guardián de rendimiento móvil. Persiste la advertencia de Vite por paquetes mayores de 500 kB.
- Navegador local con fuentes de datos ficticias y Supabase sustituido por un adaptador en memoria: navegación, filtros, búsqueda, creación, validación de cliente obligatorio, edición de Discovery, error de guardado con conservación del borrador, reintento, cambio de estatus y actualización de gráficas.
- Productividad: 50% mensual y 67% histórico con el conjunto de prueba; carga fallida muestra error y se recupera con Recargar.
- Rango personalizado 20–22 de octubre: aplicado a agenda y resumen; sin citas, asistencia muestra —. Gráficas históricas conservan Sin fecha y Sin asignar.
- Vista clara de escritorio y oscura a 390 px: comprobadas. Se restauró el tamaño del navegador.
- Modelo real del PDF generado con jsPDF desde Node, renderizado con Poppler y revisado en sus dos páginas. Tabla y totales conciliados; sin cortes ni barras positivas para cero.

Comando para repetir las pruebas: `node --test tests/comando-metrics.test.mjs`.

## Límites de la comprobación

La agenda operativa cuenta citas. Los indicadores del pipeline cuentan el primer hito por lead y fase, incluyendo los inferidos que se identifican como tales. Esas dos fuentes no deben sumarse ni exigirse iguales. El autor del movimiento no demuestra quién presentó un Zoom; una etapa posterior tampoco prueba la asistencia real.

No se hizo una conciliación fila por fila de la base de producción ni pruebas de escritura o eliminación de datos reales. No se verificó el diálogo de compartir en iOS/Android. Los botones de PDF se ejercitaron en navegador, pero no se pudo capturar su descarga mediante la herramienta; la verificación del archivo se hizo con el mismo modelo y constructor de PDF en Node. El despliegue y la comprobación posterior en producción quedan pendientes.

Evidencia local de prueba: `output/comando-audit-2026-09-17/` (fixture aislado, modelo, PDF y renders; datos ficticios).
