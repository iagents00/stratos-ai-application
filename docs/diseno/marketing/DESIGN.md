---
name: Stratos AI — sitio público
description: Sistema visual de la landing oficial blanca de Stratos AI, documentado desde su implementación.
colors:
  ink: "#0A1B2E"
  navy: "#112B4A"
  cyan: "#00D1FF"
  cyan-soft: "#7EE9FF"
  cyan-ink: "#007D99"
  muted: "#526477"
  line: "#DFE7EE"
  surface: "#F6F8FA"
  motion-surface: "#F6F7F8"
  text-selection: "#E5EBF0"
  network-line: "#B6C5D1"
  network-node: "#38546F"
  network-ring: "#9BAFBE"
  network-signal: "#294C68"
  network-sky: "#59BFF4"
  network-green: "#00DB40"
  white: "#FFFFFF"
  hover-surface: "#F1F7FA"
  hover-border: "#A3B3C1"
  badge: "#DDF8FF"
typography:
  display:
    fontFamily: '"Stratos Switzer", "Stratos Inter", sans-serif'
    fontSize: "64px"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-.025em"
  headline:
    fontFamily: '"Stratos Switzer", "Stratos Inter", sans-serif'
    fontSize: "clamp(36px, 4.3vw, 48px)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-.025em"
  title:
    fontFamily: '"Stratos Switzer", "Stratos Inter", sans-serif'
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-.025em"
  body:
    fontFamily: '"Stratos Inter", sans-serif'
    fontSize: "16px"
    lineHeight: 1.6
  label:
    fontFamily: '"Stratos Inter", sans-serif'
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: '"Stratos Inter", sans-serif'
    fontSize: "12px"
    lineHeight: 1.6
rounded:
  badge: "6px"
  control: "10px"
  promotion: "12px"
  price-card: "16px"
  panel: "24px"
  tab: "999px"
spacing:
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "28": "28px"
  "32": "32px"
  "48": "48px"
  "64": "64px"
  "96": "96px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "13px 20px"
  button-primary-hover:
    backgroundColor: "{colors.navy}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "13px 20px"
  button-secondary-hover:
    backgroundColor: "{colors.hover-surface}"
  button-white:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "13px 20px"
  module-tab:
    backgroundColor: "{colors.white}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.tab}"
    padding: "10px 17px"
  module-tab-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
  price-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.price-card}"
    padding: "28px"
  module-panel:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "28px"
  motion-card:
    backgroundColor: "{colors.motion-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "36px"
---

# Design System: Stratos AI — sitio público

## Overview

**Creative North Star: "Mostrar el sistema funcionando"**

Este documento describe exclusivamente la landing de [LandingMarketing.jsx](../../../src/landing/LandingMarketing.jsx), sus estilos, el demostrador de módulos, [FeatureMotion.jsx](../../../src/landing/FeatureMotion.jsx) y [HeroFlowBackdrop.jsx](../../../src/landing/HeroFlowBackdrop.jsx). El [brief de la superficie](../../../.impeccable/surfaces/src-landing-landingmarketing-jsx.md) conserva la estrategia y las referencias elegidas por el usuario: Savio, claridad editorial de OpenAI y acabado sobrio de Apple. La dirección está fijada por esas referencias y por la identidad Stratos; este registro extrae el sistema construido, sin reemplazar `DESIGN.md`, `PRODUCT.md` ni el lenguaje de Rails en la raíz.

El blanco domina el lienzo. La tinta azul sostiene los títulos, los controles, la selección de módulos y una sección de contraste. El hero incorpora una constelación geométrica de nodos y conexiones azul gris tenues, con destellos azul cielo y verde vivo autorizados por el usuario y el centro despejado para el texto; el cian conserva los detalles de marca. La tipografía ligera deja respirar la composición, mientras las capturas reales del producto aportan la evidencia visual. El usuario descartó las maquetas generadas: la interfaz mostrada procede de componentes reales con datos de demostración. Dos flujos ilustrativos explican la tesis del refinamiento: **consulta → contexto** y **actividad registrada → visibilidad**, con trazos SVG ligeros sobre gris muy claro y radios de panel ya establecidos.

**Key Characteristics:**

- Blanco amplio, lectura editorial y títulos de peso regular.
- Switzer para exhibición e Inter para lectura y controles.
- Capturas reales, sin interfaz inventada ni datos de clientes productivos.
- Exploración manual o automática de módulos, con movimiento reducido y suspensión por visibilidad.
- Sistema local al marketing; el CRM y la entrada común conservan sus temas.

Las fuentes de implementación son [LandingMarketing.css](../../../src/landing/LandingMarketing.css), [ModuleShowcase.css](../../../src/landing/ModuleShowcase.css), [ModuleShowcase.jsx](../../../src/landing/ModuleShowcase.jsx), [module-showcase.mjs](../../../src/landing/module-showcase.mjs) y [marketing-content.js](../../../src/landing/marketing-content.js). La cabecera YAML registra sus tokens; el [sidecar](.impeccable/design.json) añade estados, movimiento, breakpoints y límites que ese esquema no expresa.

La evidencia de la landing anterior está en [desktop.png](../../../.impeccable/review/marketing-2026-10-16/desktop.png), [mobile.png](../../../.impeccable/review/marketing-2026-10-16/mobile.png) y [user-320.png](../../../.impeccable/review/marketing-2026-10-16/user-320.png): capturas completas de anchos (1440, 390 y 320 px). Sus reportes mecánicos y [manifiesto](../../../.impeccable/review/marketing-2026-10-16/detector-manifest.json) conservan los resultados originales, incluidos avisos. La [revisión motion](../../../.impeccable/review/motion-2026-10-16/REVIEW.md), sus [capturas](../../../.impeccable/review/motion-2026-10-16/CAPTURES.json) y sus [24 comprobaciones](../../../.impeccable/review/motion-2026-10-16/QA.json) documentan el estado anterior, incluida la corrección de rótulos móviles. El fondo del hero, el wordmark y los sliders sin controles cuentan con [revisión independiente ship](../../../.impeccable/review/hero-flow-2026-10-16/REVIEW.md), [23 comprobaciones confirmadas](../../../.impeccable/review/hero-flow-2026-10-16/QA.json) y ocho capturas de cuatro tamaños. La galería conserva exactamente su altura entre seis estados, y la visibilidad real del documento en Chromium permanece diferenciada de su prueba sintética. Este registro no inventa un recibo QUALBAR ni acredita resultados comerciales o un despliegue productivo.

## Colors

La paleta combina tinta azul profunda con cian nítido y neutros claros, sin trasladar la paleta de esta landing a la plataforma autenticada.

### Primary

- **Tinta Stratos** (`ink`): texto principal, botones de acceso, selección del flujo y bloque de AI Call Center.
- **Azul medianoche** (`navy`): frase rotatoria, detalles de marca y hover del primario.

### Secondary

- **Cian Stratos** (`cyan`): detalles de marca y foco del enlace para saltar al contenido.
- **Cian suave** (`cyan-soft`): icono y foco sobre el bloque oscuro de AI Call Center.
- **Cian de lectura** (`cyan-ink`): iconos de verificación en precios; la galería usa tinta Stratos para sus verificaciones.

### Neutral

- **Blanco** (`white`): lienzo principal, navegación y tarjetas.
- **Superficie fría** (`surface`): secciones alternas y agrupaciones.
- **Gris de flujos** (`motion-surface`): fondo muy claro de las dos tarjetas explicativas, tomado de la referencia fijada.
- **Gris de selección** (`text-selection`): selección de texto general; la galería usa tinta y blanco para su selección local.
- **Red azul gris** (`network-line`, `network-node`, `network-ring`, `network-signal`): conexiones, nodos, anillos y señales decorativas del hero, con opacidades contenidas sobre blanco.
- **Luz azul cielo y verde vivo** (`network-sky`, `network-green`): señales y nodos decorativos del hero, y conexiones de las dos tarjetas explicativas. El hero usa halo radial SVG localizado; las tarjetas usan núcleo fino, estela tenue y anillo de llegada. Sin filtros ni blur.
- **Azul claro de interacción** (`hover-surface`): hover secundario y paneles suaves.
- **Texto secundario** (`muted`): explicaciones, pies y navegación de menor énfasis.
- **Línea clara** (`line`): límites de tarjetas, separadores y controles secundarios.
- **Borde de interacción** (`hover-border`): delimitación de hover, enlaces y scrollbars.
- **Cian de distintivo** (`badge`): fondo del distintivo del plan destacado.

**The Marketing Scope Rule.** Las variables de color de marketing pertenecen a su contenedor; no redefinen la identidad visual de los tenants, el login ni Rails.

## Typography

**Display Font:** Stratos Switzer, con Stratos Inter y sans-serif de respaldo. **Body Font:** Stratos Inter, con sans-serif de respaldo. Ambos nombres son alias locales de `@font-face`, normal, pesos variables (100–900), con `font-display: swap`; no modifican internamente los archivos originales.

La pareja combina títulos abiertos de peso regular con textos y etiquetas precisos. No se usa una familia monoespaciada en esta superficie. Los títulos equilibran líneas; el cuerpo usa ajuste de texto cuidado y medidas de lectura acotadas.

### Hierarchy

- **Display:** titular inicial centrado. Baja a (48 px) hasta el breakpoint de (760 px) y a `clamp(32px, 9.3vw, 38px)` hasta (480 px); a (350 px) o menos usa (32 px).
- **Headline:** encabezados editoriales. En móvil pasan a (36 px), luego (32 px) con interlínea (1.14). El demostrador utiliza su propia escala fluida, `clamp(32px, 4.2vw, 48px)`, e interlínea (1.08).
- **Title:** títulos de tarjetas y paneles; hay ajustes ópticos locales según su anatomía. El panel de módulo usa `clamp(26px, 2.7vw, 32px)` e interlínea (1.13), y (28 px) en móvil.
- **Body:** base de lectura; las introducciones usan (17–18 px), explicaciones de panel (15 px), y texto de capacidades o contexto (13–14 px). Las medidas observadas van de (36–55 ch) en explicaciones hasta (70 ch) en notas generales.
- **Label:** acciones y pestañas. La navegación usa (13 px); sus enlaces móviles suben a (15 px). Los controles principales se mantienen en peso (500).
- **Caption:** contexto secundario y notas de oferta. El rótulo que identifica cada captura como demostración usa (10 px); la declaración general usa (11 px).

La [procedencia y las licencias de fuentes](../../../public/fonts/marketing/README.md) son parte del sistema. Switzer utiliza la FFL 2.0 incluida en [Switzer-FFL.txt](../../../public/fonts/marketing/Switzer-FFL.txt): admite uso comercial y autohospedaje propios, pero restringe redistribuir el binario en repositorios. Por ello `switzer-variable.woff2` está ignorado en Git. El [preparador](../../../scripts/prepare-marketing-font.mjs) descarga el original oficial antes de `dev` y `build` web, verifica su SHA-256 fijado (`d1bf801ffb1a6096def70a7c532255722ad87d948b13a8a586e342f7091f8ee4`), reutiliza una copia válida y escribe de forma atómica, con timeout de (15 s). Una instalación limpia depende de esa descarga. No se añade este paso a `build:app`.

Inter 4.1 conserva el archivo oficial completo, incluido Latin Extended, con SHA-256 `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`. Se versiona con [Inter-OFL.txt](../../../public/fonts/marketing/Inter-OFL.txt), SIL OFL 1.1. Ninguna de las dos fuentes se recorta, convierte ni modifica.

## Layout

El contenedor editorial tiene ancho máximo (1120 px) e incluye márgenes internos de (24 px). La navegación blanca es sticky, de (72 px) de alto. Los destinos internos compensan esa barra mediante margen de scroll (96 px). El hero centra título, explicación y dos acciones; después aparece la exploración de producto. Las secciones usan separación vertical amplia, mientras precios, Enterprise y FAQ agrupan información comparable.

El panel del demostrador distribuye texto e imagen en columnas (0.68:1.32), dando aproximadamente dos tercios a la captura, con relleno de (28 px) y separación (24 × 28 px). Los seis paneles comparten una misma área de retícula, que conserva la altura del más alto para evitar saltos; los inactivos permanecen ocultos y sin interacción. La imagen conserva su relación de aspecto y `object-fit: contain`; el panel mantiene su altura mínima de escritorio, mientras la figura se centra sin fondo gris, radio ni altura mínima propios: el marco viene integrado en el activo. Las dos tarjetas motion sustituyen la antigua retícula de cuatro beneficios; precios sigue en tres columnas, sectores en cuatro y FAQ en dos. Las separaciones recurrentes están en la cabecera, con valores ópticos locales que no constituyen una retícula universal.

Los breakpoints de la landing son (1029, 760, 480 y 350 px). Hasta (1029 px), el menú desplegable sustituye navegación y acciones de escritorio; sectores pasa a dos columnas. Hasta (760 px), se apilan flujo, tarjetas motion, precios, Enterprise y FAQ y cambia la composición del fondo del hero. El titular y los demostradores no muestran botones de inicio, pausa ni repetición. Las siete frases del titular comparten una celda CSS grid que conserva la altura de la más alta en cada ancho, sin la antigua reserva fija de dos líneas. Hasta (480 px), las dos acciones del hero ocupan filas completas, sectores usa una columna y la franja de servicios admite scroll horizontal. Hasta (350 px), el contenedor reduce sus márgenes internos a (20 px).

El demostrador tiene breakpoints propios de (900 y 700 px). El primero coloca introducción, captura y capacidades en una columna, elimina la altura mínima y reparte las capacidades en tres columnas. Hasta (700 px), las seis pestañas forman una retícula visible de (3 × 2), las capacidades se apilan y la captura gana ancho mediante margen lateral de (-12 px). Los diagramas motion cambian a conexiones verticales cuando su propio contenedor mide (385 px) o menos. La tabla comparativa conserva ancho mínimo (640 px), con scroll dentro de una región enfocada, sin ensanchar la página.

El [router](../../../src/main.jsx) conserva como único dominio público de marketing `www.getstratosai.com`; localhost y `127.0.0.1` sin `?app` sirven la vista de desarrollo. La entrada común `/login`, los clientes explícitos, los demás dominios y la app nativa mantienen la resolución existente de la plataforma; las rutas públicas especiales conservan precedencia. La landing no cambia sesiones, permisos, organizaciones ni guardas. El enlace de entrada respeta `VITE_APP_URL`; cuando recibe una raíz la normaliza a `/login` y elimina el flag `app`.

## Elevation & Depth

Las superficies generales permanecen planas, sin desenfoque de fondo. El blanco, los fondos fríos y los bordes finos separan las agrupaciones. Las entradas y los iconos de salida de los flujos usan una sombra local discreta (`0 3px 8px rgba(10,27,46,.05)`) sobre gris claro. El bloque de AI Call Center invierte tinta y fondo para producir contraste; el header conserva fondo sólido al quedar sticky. La interfaz real mostrada dentro de las capturas puede contener su propio lenguaje de profundidad, que no se convierte en una regla del marketing.

El refinamiento del 16 de octubre incorpora seis composiciones blancas en [framed-20261016](../../../public/marketing/modules/framed-20261016/), todas de (1440 × 1020 px). El [marco HTML/CSS](../../../scripts/marketing-screenshot-frame.html) aporta un anillo translúcido de (15 px), radio exterior de (30 px), radio interior de (12 px) y sombra exterior `0 7px 14px rgba(10,27,46,.07)`. Los PNG originales se colocan a escala 1:1 en (x36, y36), salvo Métricas en (x58, y92); el interior RGB del WebP lossless coincide con el original en el área preservada. La composición añade el marco alrededor, sin redibujar la interfaz ni usar IA.

El fondo del hero conserva 50 nodos, 108 conexiones y cuatro rutas en PC; 28 nodos, 42 conexiones y cuatro rutas hasta 760px. Cada ruta tiene un núcleo fino y una estela muy tenue en azul cielo o verde vivo; ocho nodos iluminados en PC y móvil usan gradientes radiales SVG locales. La máscara mantiene despejado el centro. Una sola pasada de 6s, escalonada, termina como máximo en 9s en ambos tamaños y se rearma cada 16s solo visible y en primer plano: quedan 7s reales de descanso. Movimiento reducido usa luz de 8s sin desplazamiento y un periodo de 24s, con al menos 13s de descanso. Un único timeout de baja frecuencia se limpia al ocultar, salir de viewport, activar modo seguro o desmontar; volver al hero reinicia una pasada limpia. Sin animación CSS infinita, RAF, WAAPI, filtros, blur, canvas ni React por fotograma.

El movimiento comunica cambio de estado. Los botones y el chevrón de FAQ transicionan en (160 ms, ease-out). El panel de módulos aparece en (180 ms) con `cubic-bezier(.23, 1, .32, 1)` y suspende esa aparición mientras el demostrador contiene foco visible de teclado; sus pestañas responden a presión con `scale(.97)` en (120 ms), sin transformar el foco. El demostrador avanza cada (2800 ms) cuando está visible, sin foco de teclado y con documento activo. El hover no lo detiene. Movimiento reducido conserva el ciclo de contenido con cambios sin desplazamiento. Elegir una pestaña reinicia el intervalo completo sin bloquear la reproducción: click y touch no retienen una pausa por foco; la exploración con teclado sí la mantiene hasta salir o volver al puntero. Al despejar la última razón independiente, el recorrido se reanuda con un intervalo completo y sin cambios atrasados. El [controlador](../../../src/landing/module-showcase.mjs) mantiene estas reglas fuera de React.

El titular usa una instancia independiente del mismo controlador de (2800 ms), con crossfade y desplazamiento corto en (240 ms), `cubic-bezier(.23, 1, .32, 1)`. Se suspende fuera del viewport o con documento oculto. Con movimiento reducido conserva las siete opciones y usa solo crossfade de opacidad de 160 ms, sin desplazamiento. Las siete frases comparten la misma celda sin alterar la altura del hero; la galería mantiene su propio índice e intervalo.

Los diagramas explican entrada → Copilot o Comando → tres resultados mediante una sola pasada SVG de (6 s, linear, ×1). Un núcleo de (1.8 px), opacidad máxima (.88), y una estela de (6 px), opacidad máxima (.16), recorren las conexiones en azul cielo y verde vivo; anillos locales de (1 px) señalan la llegada al hub y a los resultados. La entrada llega primero, el hub responde y después parten las tres ramas. La secuencia termina por completo y descansa (10 s) antes del siguiente inicio, con periodo normal de (16 s). Movimiento reducido conserva una pasada de opacidad de (6 s), sin dash ni desplazamiento, con periodo de (24 s) y descanso de (18 s). No se añaden controles de reproducción.

Cada tarjeta observa su propio diagrama con `IntersectionObserver`: se inicia al alcanzar al menos (15 %) de visibilidad, de modo que la segunda tarjeta apilada empieza cuando se ve. Fuera del viewport, con documento oculto o `data-lowfx`, se cancela el timeout y se suspende la animación; al volver se reinicia una pasada limpia. La orientación SVG inactiva permanece pausada. `ResizeObserver` mide el ancho real del diagrama para conectar las rutas al hub fijo de (64 px), sin trabajo por fotograma; el cambio a vertical sigue en contenedor de (385 px) o menos, y las ramas móviles comienzan bajo el rótulo del hub. El pie conserva la declaración de flujos ilustrativos. Se usan HTML/CSS y SVG nativos, sin GIF pesado, animación CSS infinita, filtros, blur, RAF, WAAPI, nuevas dependencias ni capturas de producto; el guard de rendimiento móvil de Safari permanece intacto.

**The Quiet State Rule.** `prefers-reduced-motion` conserva la rotación del contenido para mostrar todas las opciones, elimina desplazamientos y entradas del panel y suaviza el titular con opacidad. El fondo y los dos diagramas sustituyen el viaje de señales por luz lenta y finita. La exploración manual y la pausa por foco de teclado permanecen disponibles. Fuera de pantalla, con documento oculto o `data-lowfx`, el fondo y cada diagrama dejan de programar recorridos.

## Shapes

Los controles tienen esquinas suavizadas; los grandes paneles de producto y las tarjetas motion usan la curva amplia de (24 px) fijada por la referencia. Las tarjetas de precio conservan un radio intermedio. Las pestañas del demostrador son cápsulas; en móvil cada una tiene su propio borde y la retícula prescinde del riel exterior. Los bordes son de (1 px); el plan destacado cambia el color del borde, sin desplazamiento ni sombra. Los radios de la cabecera describen estas anatomías locales, no una sustitución de los radios del CRM.

El header utiliza únicamente el wordmark **Stratos AI** como marca. El logo S conserva la identidad y colores proporcionados por el usuario en el footer y los hubs ilustrativos; su [metadato de procedencia](../../../public/branding/stratos-logo-web-20261016.webp.json) registra la conversión a WebP, sin generación de imagen.

## Components

### Buttons

Acciones sólidas de tinta con texto blanco; la secundaria usa blanco, texto tinta y borde claro. La acción blanca aparece sobre el bloque oscuro. Los CTAs son enlaces reales y los controles de estado son botones. El tamaño táctil principal es de al menos (48 px) en escritorio y (44 px) en móvil pequeño. El foco visible usa contorno de (2 px) con separación exterior de (4 px); en el demostrador la separación es (3 px), pasa a (-4 px) dentro de las pestañas y usa blanco sobre la seleccionada oscura.

Solicitar acceso conserva el contacto [WhatsApp +1 747 977 9711](https://wa.me/17479779711) y mensajes específicos por plan, con apertura segura en otra pestaña. Iniciar diagnóstico enlaza a `/diagnostico`; Iniciar sesión usa la entrada normalizada de la aplicación. Los pies conservan privacidad y términos. No se implementa un formulario ni un checkout nuevo en esta landing.

### Navigation

Header compacto con wordmark Stratos AI, enlaces de sección, login y acceso. El menú móvil expone `aria-expanded`, `aria-controls` y nombre de abrir/cerrar. Escape cierra el menú y devuelve el foco a su botón; elegir una sección también lo cierra. El enlace inicial permite saltar al contenido principal. Los enlaces de menor énfasis adquieren subrayado o tinta al interactuar.

### Module showcase

Seis pestañas: Copilot, CRM, Mi Espacio, Métricas, Comando e iAgents. La seleccionada usa tinta Stratos y texto blanco; las demás conservan blanco, texto secundario y borde claro en móvil. Tienen roles `tablist`, `tab` y `tabpanel`, selección explícita, foco itinerante y navegación con flechas, Home y End. La rotación no anuncia cada cambio mediante una región viva. La selección manual conserva el avance automático cuando se despeja la interacción, sin botones de inicio o pausa; movimiento reducido conserva la navegación automática y manual con cambios sin desplazamiento. Si una imagen falla, el panel conserva un texto de vista previa y su descripción.

Cada captura identifica **Datos de demostración**. La [procedencia de los activos](../../../public/marketing/modules/README.md) detalla dimensiones, componentes y límites. Cinco imágenes proceden de la demo local. iAgents procede del componente real IACRM renderizado sin cambios en un harness local, porque la demo común no expone ese módulo; las solicitudes remotas estuvieron bloqueadas. Sus cifras y rótulos LIVE/Activo son ejemplos del componente, no evidencia de conexiones ni resultados reales. La disponibilidad de módulos y conexiones depende de cada empresa. Las capturas no contienen datos de clientes productivos.

### Cards / Containers

Dos tarjetas explicativas sustituyen la antigua retícula de beneficios. **Consulta → contexto:** Consultar cartera → Copilot → Clientes / Pendientes / Próximos pasos. **Actividad registrada → visibilidad:** Actividad registrada → Comando → Cartera / Equipo / Métricas. [FeatureMotion.css](../../../src/landing/FeatureMotion.css) mantiene fondo gris muy claro y radio de panel; cada diagrama tiene una descripción accesible y el pie aclara que es ilustrativo y depende de permisos y configuración. Representan consulta y lectura de actividad registrada, sin prometer acciones autónomas, envíos o guardados sin confirmación. La galería conserva las capturas reales. El flujo Habla / Procesa / Claridad mantiene sus tres botones con `aria-pressed` y cambio manual de captura; la comparación conserva su tabla semántica.

Las tarjetas comerciales conservan los planes y contenido de `marketing-content.js`: Start ($37 USD/mes; regular $147; 3 usuarios), Growth ($97; regular $297; 10 usuarios) y Scale ($297; regular $797; 25 usuarios). Growth mantiene el distintivo Más elegido. Enterprise conserva desde ($1,200 USD/mes) e implementación desde ($5,000 USD). La información de promoción y tarifa regular permanece visible. Estos importes registran el contenido preservado al 16 de octubre de 2026; el archivo de contenido es la fuente para cambios comerciales posteriores. El tarifario autenticado `PricingScreen.jsx` no forma parte de este rediseño.

### FAQ

Ocho pares de preguntas y respuestas conservan el contenido comercial existente, con ajustes de puntuación. Se usa `details` / `summary` nativo, con divisores y chevrón que refleja apertura. Las respuestas permanecen seleccionables y la interacción funciona sin un controlador personalizado de acordeón.

**The Real Product Rule.** Las imágenes presentan la interfaz existente con su procedencia y rótulo de demostración. No agregar maquetas generadas, conexiones inventadas ni datos de clientes a los activos públicos.

### Copilot en primer plano

La captura de Copilot se renovó con una consulta real al formulario de la demo: «Dame la ficha de Alex Ejemplo». La respuesta muestra etapa, presupuesto y próxima acción desde los fixtures ficticios existentes; la demo también permite consultar hasta tres seguimientos sin afirmar citas de hoy ni confirmar asignaciones. El componente conserva su interfaz y tipografía. Se capturó a 684 × 474 píxeles CSS con DPR 2: el PNG físico de 1368 × 948 entra intacto en el mismo marco blanco de 1440 × 1020. El texto aparente se duplica, hasta aproximadamente 14.7px cuando la galería muestra la imagen a 650.8px. La composición móvil permanece igual por petición del usuario; el menor ancho sigue reduciendo proporcionalmente el texto de la captura.

El nuevo [asset y su procedencia](../../../public/marketing/modules/copilot-closeup-20261016/README.md) se comparten entre galería y paso «Habla» mediante `moduleScreenshotSrc`. Los otros cinco módulos mantienen sus archivos anteriores. La [evidencia de la captura y QA](../../../.impeccable/review/copilot-closeup-2026-10-16/QA.json) conserva la igualdad de píxeles interiores, cuatro anchos sin desbordamiento ni cambios de altura entre módulos y el límite móvil. Una consulta de Cancún se probó en producción solo para comprobar su respuesta; esa conversación no forma parte del material público.

## Do's and Don'ts

### Do:

- **Do** conservar blanco dominante, selección de módulos en tinta y blanco, detalles cian y tipografía de peso regular en esta superficie.
- **Do** mantener las capturas completas dentro de su marco, con proporción original, alt descriptivo y declaración de datos demo.
- **Do** conservar teclado, foco visible, objetivos táctiles, suspensión por visibilidad y transiciones reducidas al ampliar los módulos.
- **Do** mantener planes, contactos, login y diagnóstico conectados a sus fuentes y rutas existentes.
- **Do** verificar fuentes por hash y conservar las licencias originales junto a los activos permitidos.

### Don't:

- **Don't** propagar estilos o alias de marketing al CRM, Rails o marcas de clientes.
- **Don't** versionar el binario Switzer ni usarlo como fuente redistribuida para plantillas de terceros.
- **Don't** presentar capturas demo, indicadores LIVE locales o una revisión visual como resultados productivos verificados.
- **Don't** hacer que la rotación automática bloquee la exploración manual o ignore movimiento reducido.
- **Don't** incluir componentes, capturas, fuentes ni logo de esta landing en el paquete nativo: `vite.config.js` los excluye en `build:app`.

La [revisión independiente del encuadre Copilot](../../../.impeccable/review/copilot-closeup-2026-10-16/REVIEW.md) obtuvo `disposition: ship`; cubre el refinamiento de la captura y sus consumidores.

La red del hero se construye desde una mitad regular reflejada exactamente en X. Las señales cielo y verde vivo #00DB40 parten en fase desde los nodos interiores hacia los exteriores; sus longitudes son iguales por dispositivo. preserveAspectRatio="none" conserva toda la geometría y halos dentro del marco, con margen inferior. Verde extraído de la referencia proporcionada por el usuario, convertido a sRGB; sin incorporar el logo de WhatsApp al sitio.

La [revisión final de red simétrica y reproducción](../../../.impeccable/review/active-sliders-2026-10-16/REVIEW.md) obtuvo `disposition: ship`, con geometría en cuatro tamaños y17checks de sliders.

El refinamiento de luces en las dos tarjetas tiene [23 comprobaciones locales aprobadas](../../../.impeccable/review/feature-glows-2026-10-16/QA.json) y 201 pruebas de la suite aprobadas. La [revisión independiente acotada](../../../.impeccable/review/feature-glows-2026-10-16/REVIEW.md) obtuvo `disposition: ship` sin correcciones materiales; el QA local está aprobado y la comprobación de producción se realiza después de integrar. Las revisiones históricas anteriores conservan su alcance.
