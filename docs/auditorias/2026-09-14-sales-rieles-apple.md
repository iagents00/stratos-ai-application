# Sales Rieles · auditoría y refinación de interfaz

14 de septiembre de 2026. Base: web v428, rama codex/system-audit-live-20260912. Skills aplicadas: apple-design e impeccable (refinación de interfaz existente, modo Operate). Alcance: Mi Día del vendedor y configuración de Ventas sobre Rieles del administrador.

## Problemas resueltos

| Hallazgo | Resultado |
|---|---|
| Todas las tarjetas abiertas competían por atención | Un cliente expandido; los demás siguen disponibles en filas compactas, sin alterar prioridad |
| Acciones de contacto y resultado tenían el mismo peso | Contacto principal, consulta secundaria y resultados agrupados después del contacto |
| Al completar se perdía el foco del teclado | Pasa al siguiente cliente o al estado final de lista, después del guardado confirmado |
| Resultados diarios mezclados en una línea | Conteos con etiquetas y avance separado de la lista actual |
| Vista previa del admin lejos de los campos en móvil | Lateral en escritorio y dentro de la instrucción abierta en móvil |
| Apariencia dispersa entre estilos inline y CSS | Paleta local compartida en rails-theme.js; componentes y estados en Rails.css |
| Contraste de acción principal dependía del tema | Variante oscura del acento en modo claro con texto blanco; menta con texto oscuro en modo oscuro |
| El reset global ocultaba las casillas de reglas en el CRM real | Apariencia nativa restituida solo en esas casillas; fixture carga ahora el CSS global de la app |
| Poca respuesta táctil y soporte de preferencias | Respuesta al presionar, foco visible, movimiento/transparencia/contraste reducidos y colores forzados |

La estética usa tipografía del sistema, espaciado en rem, superficies sobrias y un único material translúcido funcional en la barra de publicación. No agrega librerías, sonidos, envíos automáticos ni animaciones de entrada decorativas. La interfaz conserva la identidad de Stratos.

## Verificación

- 15 tests Node aprobados; guardas de Rieles y gate de sintaxis/referencias/hooks aprobados. El lint completo mantiene 361 avisos históricos fuera del alcance.
- Compilación web aprobada. Detector de interfaz sobre los archivos intervenidos: sin hallazgos emitidos; no equivale a certificación de accesibilidad.
- Navegador con fixture aislado: error de escritura conserva cliente; éxito cambia foco; realizados, sin respuesta y reprogramados se cuentan por separado; siguiente lista disponible al terminar.
- Estados de carga, fallo de lectura y sin pendientes verificados. Un fallo de lectura no ofrece botones para registrar resultados.
- Admin: borrador visible, interpolación de datos en vista previa, publicación deshabilitada en demo. No se cambiaron reglas reales de una organización.
- Escritorio oscuro, móvil claro de 390×844 y ancho intermedio de 820 px revisados. Sin desbordamiento horizontal, incluso con nombres largos. Botón de contacto medido en 44 px; controles de texto a 16 px en móvil.
- Botón primario claro medido: fondo rgb(6,122,94), texto blanco. Enlaces de teléfono inspeccionados con número ficticio reservado; no se efectuaron llamadas ni mensajes.
- Preferencias reducidas implementadas por CSS; no se certificó una prueba asistiva completa ni todos los dispositivos físicos.

Reproducción local: npm run dev y /tests/fixtures/rails-qa.html. El fixture solo usa datos sintéticos y persistencia inyectada; incluye selección de escenarios y fallo de guardado. No forma parte de las rutas productivas.

## Límites y publicación

La entrega v429 se publicó y pasó el diagnóstico de tres dominios. La comprobación de integración encontró un conflicto con el reset global de inputs, corregido en v430 con cambio de service worker. El manifiesto /release.json identifica el commit efectivo; el registro final aparece abajo.

Esta refinación no despliega la migración SQL 243, no completa la auditoría de permisos remotos y no acredita una restauración de Supabase/n8n. Se conservan los pendientes documentados en la auditoría del 13 de septiembre, incluyendo la reprogramación en dos escrituras y la jornada UTC. La configuración solo está habilitada para admin/super_admin en la aplicación; la garantía adicional del servidor sigue pendiente de acceso y despliegue.

## Entrega comprobada

- **Web v430 publicada**: commit `b25bda5ef4a56efab92f5b987896cc9845c52df6`, despliegue `dpl_GtDnqfKoTest3pWXFnVtHLgdLSvB`, READY en producción.
- Checks de release y planos aprobados. Los tres dominios devolvieron recursos y versiones coherentes; diagnóstico total 639 ms. Medición puntual de disponibilidad, no tiempo de recuperación.
- Sesión real: administración y Mi Día renderizados; un cliente expandido y nueve filas compactas con la configuración existente de diez por lista. Casillas de reglas comprobadas con apariencia nativa auto y acento del tema, visibles en captura del CRM real.
- Se conserva la configuración organizativa existente, incluido su estado inactivo. La QA usa la vista previa administrativa por URL; no activa el proceso para el equipo.
- [Evidencia de publicación](../operacion/evidencias/2026-09-14-v430.json). El PR 755 conserva revisión obligatoria para integrar a main. El commit posterior de esta evidencia no cambia la interfaz publicada.

En la recarga final hubo un fallo transitorio de lectura de agenda: la interfaz mostró error y retiró las acciones de escritura. Reintentar recuperó la lista real. Se verificó la recuperación visible, sin atribuir una causa remota ni certificar disponibilidad continua.

## Ajuste solicitado de color y publicación · v431

La captura del usuario mostraba superficies azul gris y una barra de publicación que tapaba las reglas y carecía de margen lateral. Se sustituyen los neutros oscuros de Rieles por fondo #050505, superficie #0A0A0A, texto #EDEDED y secundario #A0A0A0. El acento de acciones y el tema claro se conservan.

La publicación deja de ser sticky: permanece al final del formulario, con borde completo, radio de 12 px y padding lateral de 24 px en escritorio / 20 px en móvil. No se cambian permisos, instrucciones ni persistencia.

Verificación: captura de escritorio y móvil 390×844, superficies computadas rgb(10,10,10), publicación después del editor sin superposición, controles dentro de sus límites y página de 390 px sin desbordamiento. Tema claro conserva superficie blanca. Compilación aprobada y detector sin hallazgos. El manifiesto de la publicación identifica la versión efectiva.
