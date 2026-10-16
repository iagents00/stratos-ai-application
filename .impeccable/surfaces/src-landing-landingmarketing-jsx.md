---
version: 1
slug: "src-landing-landingmarketing-jsx"
primary_target: "src/landing/LandingMarketing.jsx"
related_targets: ["src/landing/LandingMarketing.css","src/landing/ModuleShowcase.jsx","src/landing/ModuleShowcase.css","src/landing/FeatureMotion.jsx","src/landing/FeatureMotion.css","src/landing/HeroFlowBackdrop.jsx","src/landing/HeroFlowBackdrop.css"]
---

# Sitio oficial de Stratos AI

Modo: Persuade. Rediseño visual autorizado por el usuario el 16 de octubre de 2026. Referencias fijadas: Savio, claridad editorial de OpenAI y acabado sobrio de Apple. Conservar la identidad Stratos, precios, contactos, rutas y slider inicial. Imágenes: capturas reales de la aplicación, interfaz intacta con datos demo. El usuario descartó las maquetas generadas.

## Direction contract

THESIS: Mostrar el sistema funcionando mediante capturas reales y exploración de sus módulos.

Tesis del refinamiento motion: consulta → contexto y actividad registrada → visibilidad. Dos diagramas explicativos conectan una entrada, Copilot o Comando y tres salidas de lectura; no representan envíos, guardados ni acciones autónomas sin confirmación.

OWN-WORLD: Blanco dominante, tinta #0A1B2E, cian #00D1FF, azul #112B4A. Luz azul cielo #59BFF4 y verde vivo #00DB40 solo en las conexiones decorativas del hero, solicitadas por el usuario. Switzer ligera e Inter; controles 10px y paneles 24px. Fondos claros discretos, sin imágenes decorativas detrás de la interfaz.

Refinamiento solicitado: las capturas se presentan como imágenes de 1440 × 1020 sobre blanco, con un marco redondeado de cristal translúcido y sombra suave. La interfaz se conserva a escala 1:1; el marco se compone fuera de ella. Se mantiene la galería y su comportamiento.

Refinamiento construido: tarjetas gris muy claro (#F6F7F8) con radio 24px, siguiendo la referencia fijada. Conexiones SVG con dos recorridos automáticos limitados de 5.6s (11.44s incluida la demora final), luego estado quieto sin controles de inicio, pausa o repetición. Fuera de pantalla, documento oculto o movimiento reducido detienen el movimiento. No se incorpora GIF pesado ni bucle infinito, respetando el guard móvil de Safari. La galería da aproximadamente dos tercios a la captura en escritorio y muestra seis cápsulas en 3×2 hasta 700px, con selección tinta #0A1B2E y texto blanco; las seis fichas comparten una retícula que conserva la altura máxima. Las siete frases del hero comparten celda para conservar altura y cambian cada 2800ms con crossfade de 240ms; los sliders reanudan al despejar la interacción, sin pausa manual persistente.

Fondo hero construido: SVG geométrico sobre blanco, 50 nodos/108 conexiones/4 rutas en escritorio y 28 nodos/42 conexiones/4 rutas hasta 760px. Una máscara radial deja despejado el centro. Ráfagas finitas de 6s × 1, con máximo 9s en ambos tamaños y rearmado cada 16s solo visible/foreground; ocho destellos en nodos tanto PC como móvil, con núcleo fino y estela tenue. Movimiento reducido usa únicamente luz suave de 8s con periodo 24s. Un timeout de baja frecuencia cancelado offscreen/hidden/lowfx y reinicio limpio al regresar. Sin etiquetas, datos, filtros, blur, canvas ni React por fotograma.

STORY: Entender qué organiza Stratos, explorar sus módulos, consultar planes y solicitar acceso o diagnóstico.

FIRST VIEWPORT: Header blanco compacto con wordmark Stratos AI sin icono, título centrado con siete frases rotatorias sobre una constelación geométrica de nodos y conexiones navy tenues, dos acciones y pestañas del demostrador. El fondo conserva el blanco y la lectura clara en PC y móvil; la imagen real domina su panel. No hay botones de inicio o pausa de sliders.

FORM: Galería de producto y lectura editorial, posición 5, semilla 580ee6e8. La referencia visual elegida por el usuario fija la dirección.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Sistema documentado

La implementación de marketing tiene su propio [DESIGN.md](../../docs/diseno/marketing/DESIGN.md) y [sidecar](../../docs/diseno/marketing/.impeccable/design.json). Ese boundary conserva los documentos de Rails en la raíz. Las capturas y reportes de revisión están en [marketing-2026-10-16](../review/marketing-2026-10-16/); el documento de diseño no sustituye el veredicto independiente.

La [revisión motion anterior](../review/motion-2026-10-16/REVIEW.md) y sus [comprobaciones](../review/motion-2026-10-16/QA.json) documentan la corrección de ramas móviles que comienzan debajo de los rótulos. El nuevo fondo del hero, el wordmark y los sliders sin controles tienen su [revisión independiente ship](../review/hero-flow-2026-10-16/REVIEW.md) y [23 comprobaciones](../review/hero-flow-2026-10-16/QA.json) con capturas en 1440, 834, 390 y 320 px; la altura es estable y los límites de visibilidad real del harness están diferenciados de la cobertura sintética.

Refinamiento Copilot: captura real de la ficha de Alex Ejemplo, con datos ficticios devueltos por el formulario demo. Encuadre de 684 × 474 CSSpx a DPR 2, sin cambios de tipografía ni repintado; mismo marco blanco de 1440 × 1020 y texto aparente al doble de tamaño. Activo versionado compartido por galería y «Habla», sin modificar los otros cinco screenshots, sliders ni layout móvil. [Evidencia y límites](../review/copilot-closeup-2026-10-16/QA.json).

La [revisión independiente del encuadre Copilot](../review/copilot-closeup-2026-10-16/REVIEW.md) obtuvo `disposition: ship`; cubre el refinamiento de la captura y sus consumidores.

Refinamiento de reproducción: seis módulos y siete frases continúan cada 2800ms también con movimiento reducido; hover ya no pausa la galería. El teclado conserva pausa mientras explora, y hidden/offscreen suspenden ambos controladores. Sin botones de reproducción. La transición reducida del titular usa solo opacidad160ms.

La red del hero se construye desde una mitad regular reflejada exactamente en X. Las señales cielo y verde vivo #00DB40 parten en fase desde los nodos interiores hacia los exteriores; sus longitudes son iguales por dispositivo. preserveAspectRatio="none" conserva toda la geometría y halos dentro del marco, con margen inferior. Verde extraído de la referencia proporcionada por el usuario, convertido a sRGB; sin incorporar el logo de WhatsApp al sitio.

La [revisión final de red simétrica y reproducción](../review/active-sliders-2026-10-16/REVIEW.md) obtuvo `disposition: ship`, con geometría en cuatro tamaños y17checks de sliders.
