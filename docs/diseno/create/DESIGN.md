---
name: Stratos AI · Create · dossier de propiedades
description: Dossier personal de lectura tranquila, comparación y consulta contextual.
colors:
  paper: "#06070a"
  ink: "#f6f8fb"
  muted: "#b6bcc7"
  line: "#2b3039"
  accent: "#dce4f1"
  summary: "#11141b"
  cover: "#06070a"
  cover-button: "#e8f0fb"
  cover-button-hover: "#fff"
  next: "#0e1117"
  primary-hover: "#dce4f1"
  secondary-hover: "#21252e"
  favorite-selected: "#303949"
typography:
  display:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(48px, 7.6vw, 96px)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-.035em"
  property-title:
    fontFamily: '"Stratos Montserrat", Inter, sans-serif'
    fontSize: "clamp(29px, 3.2vw, 44px)"
    fontWeight: 550
    lineHeight: 1.18
    letterSpacing: "-.025em"
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    lineHeight: 1.65
  section:
    fontFamily: '"Stratos Montserrat", Inter, sans-serif'
    fontSize: "clamp(28px, 3.2vw, 42px)"
    fontWeight: 550
    lineHeight: 1.2
    letterSpacing: "-.025em"
rounded:
  button: "8px"
  property: "12px"
  favorite: "50%"
spacing:
  action-gap: "10px"
  property-gap: "40px"
  property-gap-mobile: "24px"
components:
  button-cover:
    backgroundColor: "{colors.cover-button}"
    textColor: "{colors.cover}"
    rounded: "{rounded.button}"
    padding: "11px 17px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.button}"
    padding: "11px 17px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "11px 17px"
  property-summary:
    backgroundColor: "{colors.summary}"
    padding: "clamp(24px, 3vw, 38px)"
  favorite:
    textColor: "{colors.accent}"
    rounded: "{rounded.favorite}"
    width: "44px"
    height: "44px"
---

# Design System: Create · dossier de propiedades

## Overview

**Creative North Star: "Dossier personal de propiedades"**

Una portada negra con un degradado azul suave, amplia y tipográfica presenta el nombre completo del cliente como elemento principal, precedido por «Exclusivo para». «Portafolio personalizado» identifica el documento. Después aparecen el mensaje personal del asesor, el índice y las propiedades con información útil para comparar y consultar.

**Preferencia persistente explícita del usuario:** conservar el negro original. La petición tipográfica más reciente incorpora Montserrat para subtítulos y jerarquía secundaria, mientras Inter conserva el nombre del cliente y la prosa. El usuario rechazó la dirección verde con serif; no reintroducirla sin una nueva petición explícita. Su nueva petición autoriza degradados azules suaves sobre el negro, prioridad móvil y movimiento sutil, preservando el protagonismo del nombre en Inter.

El alcance es exclusivamente el dossier implementado en PortfolioDocument. Los documentos de diseño y producto de la raíz corresponden a Rails y no son la autoridad visual de esta superficie. La barra y el panel de compartir del asesor conservan su sistema existente en LandingPagePreview; no se redefinen aquí.

**Key Characteristics:**
- Portada negra con azul suave y el nombre completo del cliente en gran formato.
- Mensaje personal después de la portada, índice con precios y comparación útil.
- Fichas con resumen tonal y detalle legible.
- Información real de cada propiedad y consulta contextual por WhatsApp.

## Colors

La paleta local utiliza negro, superficies oscuras y texto claro; el dossier declara `color-scheme: dark`.

### Primary

`ink` identifica texto principal y fondos de botones de acción; `accent` distingue enlaces, corazones e iconos. Los botones principales usan texto `paper` y hover `primary-hover`. El botón de portada usa `cover-button` y, con puntero fino que permite hover, `cover-button-hover`.

### Neutral

`paper` y `cover` mantienen el negro original. `summary` separa el resumen de ficha y `next` el cierre. `muted` organiza texto secundario; `line` separa bloques. Los degradados de portada, resumen y cierre añaden azul oscuro sin cambiar el fondo negro del documento. Sus recetas completas se conservan en el sidecar porque no son colores sólidos. La paleta general no reintroduce verde ni dorado; los acentos originales de cada propiedad pueden conservar esos tonos sin cambiar la identidad del dossier.

## Typography

Inter y sus respaldos de sistema mantienen el h1 del nombre completo, la prosa y los controles generales. La base es 16px con altura 1.65. Montserrat, mediante el alias local `Stratos Montserrat` y respaldo Inter, define h2, h3, h4, nombres del índice, títulos de pasos. «Exclusivo para» utiliza también Montserrat, tamaño `clamp(16px, 1.6vw, 21px)`, peso 500, altura 1.5 y espaciado .015em.

La carta usa h2 de `clamp(26px, 2.8vw, 38px)`, peso 550, altura 1.24 y espaciado -.025em. El cierre usa `clamp(29px, 3.4vw, 44px)`, peso 550, altura 1.2 y espaciado -.025em. El título del índice usa 17px/600/1.4; sus nombres, 17px/550/1.45 y espaciado -.015em. Los h4 de destacados y amenidades usan 14px, peso 600, altura 1.5 y espaciado normal. Los títulos de pasos mantienen 16px/550.

Las fuentes variables normales 400–700 se autoalojan en `public/fonts/portfolio/`, con `font-display: swap` y `unicode-range` para latin y latin-ext. El alias evita cambiar otras superficies. La procedencia Google Fonts y la licencia SIL OFL 1.1 están registradas en `README.md` y `OFL.txt` de esa carpeta. No se depende de una petición externa de fuente en runtime.

En móvil, el nombre usa `clamp(42px, 11vw, 68px)` con altura 1.08. La descripción de portada tiene altura 1.75 y se limita a 48ch y a 35ch en móvil. El mensaje personal posterior usa 17px, altura 1.85 y hasta 62ch; en móvil pasa a 16px y altura 1.8. Las descripciones de propiedades llegan a 68ch. Los precios y números de índice usan cifras tabulares.

## Layout

El contenedor alcanza 1280px y usa margen interior horizontal `clamp(22px, 5vw, 72px)`. La portada ocupa una altura mínima de `min(900px, 100svh)` y distribuye cabecera, nombre y cierre verticalmente; el área central tiene margen vertical `clamp(72px, 10vw, 144px)`.

Después, la bienvenida combina carta personal e índice en proporción 1.2:1. Las fichas distribuyen resumen y detalle en .9:1.2; el cierre utiliza 1.2:1. A 760px o menos estas composiciones pasan a una columna, el pie de portada permite envolver y se reducen separaciones. `overflow-wrap: anywhere` permite acomodar nombres extensos. En móvil, la altura mínima de portada es `min(820px, 100svh)` y el área central utiliza 48px de margen interior vertical. El pie de portada y el footer respetan `safe-area-inset-bottom`, con mínimos de 24px y 40px respectivamente.

La tabla mantiene un ancho mínimo de 820px dentro de una región desplazable horizontalmente y enfocable mediante teclado. El desplazamiento pertenece a la comparación, no a toda la página; una indicación de desplazamiento aparece hasta 760px.

## Elevation & Depth

El dossier no utiliza sombras. La profundidad proviene de las superficies negras, degradados azules discretos y bordes finos. La portada combina un degradado lineal con una capa radial independiente que no captura eventos; el resumen de ficha y el cierre usan degradados lineales estáticos. Las sombras y desenfoques del panel de compartir pertenecen a la interfaz del asesor, fuera de este sistema local.

## Shapes

Los botones usan esquinas suaves, las fichas una curva algo mayor y el favorito un círculo. El índice y la tabla se organizan mediante líneas. Se preserva la lectura de documento continuo sin convertir cada dato en una tarjeta independiente.

## Components

### Buttons

Acciones de altura mínima 46px, con icono y texto. La variante secundaria es transparente con borde; el enlace contextual conserva subrayado y altura mínima 44px. Los cambios de fondo y color duran .18s; el foco visible usa contorno de 3px con separación de 4px. La preferencia de movimiento reducido elimina transiciones y desplazamiento suave.

El botón de portada se expande al 100% con altura mínima 52px en móvil. Al presionarlo se comprime a escala .985; solo en dispositivos con hover y puntero fino, la flecha se desplaza 2px. Estas transformaciones duran .18s con `cubic-bezier(.16,1,.3,1)` y se anulan con movimiento reducido. Los botones de materiales y contacto móvil tienen altura mínima 48px y pueden ocupar filas completas.

### Cover and personal letter

La portada muestra agencia, «Portafolio personalizado», «Exclusivo para» y el nombre completo. «Descubrir mi portafolio» lleva al mensaje personal; un enlace adicional permite hablar por WhatsApp con el asesor; el contador del pie lleva a la selección. La luz radial aparece una sola vez en 800ms, de opacidad .35 a 1, con `cubic-bezier(.16,1,.3,1)`; no hay bucle ni desplazamiento continuo. Con movimiento reducido la capa queda estática y sin animación. La carta utiliza el mensaje recibido o una introducción personalizada de respaldo y muestra la firma del asesor cuando existe.

### Navigation

Después del mensaje personal, el índice enumera todas las propiedades con ubicación y precio de referencia, y permite ir a la ficha. Al usarlo, se desactiva el filtro de favoritas. Los saltos trasladan el foco al destino y lo desplazan a la vista. La tabla también enlaza a cada ficha.

### Comparison

Solo aparece cuando la selección original tiene más de una propiedad y existen filas visibles. Compara nombre, precio de referencia, tipología, entrega y un detalle de la ficha. Este último toma el primer destacado o, en su ausencia, la primera amenidad; si faltan ambos invita a consultar al asesor. Incluye caption y encabezados semánticos; los valores ausentes se indican explícitamente.

### Property

El resumen contiene tipo de propiedad (o «Selección personal»), favorito, nombre, ubicación y precio. Su acción principal es «Consultar por WhatsApp», con nombre accesible que identifica la propiedad; ocupa todo el ancho y al menos 50px de altura. Un texto explica que el asesor confirma disponibilidad, precio y formas de pago. «Ver imágenes y detalles» y «Ver ubicación» son acciones secundarias. El detalle contiene únicamente los datos presentes: descripción, hechos (con Tipo y Tipología como campos separados cuando están disponibles), destacados, amenidades y rendimiento informado con su aclaración. Sin material, se invita a solicitarlo al asesor.

### Favorites

El botón circular expone su estado mediante `aria-pressed` y nombre accesible. El filtro muestra todas o solo favoritas; un estado vacío ofrece regresar a todas. Una región de estado anuncia la selección. La lista afecta al contacto general y al resumen final. Su duración está limitada al componente montado.

### Property accents and direct contact

Se conserva el acento recibido en `property.accent` si es hexadecimal de tres o seis dígitos; el respaldo es `#7BA8E0`. Para texto se mezcla cada canal con blanco: 40% del canal original y 60% de 255, redondeado. El color original define el borde (28% sobre la línea), el inicio del degradado de resumen (16% sobre `#0b1019`, terminando en `#0c1017` al 75%) y el fondo del favorito seleccionado (20% sobre `#141923`). La variante aclarada identifica título, tipo, número del índice, iconos y fondo del CTA; este último usa texto negro y hover blanco.

La ficha muestra descripción, hechos, «Lo que te ofrece esta propiedad» y amenidades cuando existen. La comparación rotula su último campo «Lo que destaca». No hay textarea, notas personales ni bloque de preguntas genéricas en el entregable. La consulta individual usa únicamente esa propiedad como contexto; portada y cierre utilizan favoritas o toda la selección. El contacto de portada tiene altura mínima 44px, texto de 14px y 13px en móvil, y subrayado al hover.

### Next steps

El cierre reúne consulta por WhatsApp cuando el teléfono del asesor es válido; no ofrece calendario. Si falta contacto válido, indica responder al mensaje original. Los tres pasos orientan a elegir, hablar por WhatsApp y conocer la propiedad.

## Do's and Don'ts

### Do:
- **Do** conservar el negro original, el nombre completo y la prosa en Inter, y Montserrat en la jerarquía secundaria.
- **Do** conservar los datos del catálogo y los contactos recibidos.
- **Do** mantener foco visible, controles táctiles y desplazamiento contenido en la comparación.
- **Do** usar este documento como autoridad local del dossier Create.

### Don't:
- **Don't** sustituir la identidad negra y azul por verde, dorado o serif; sí conservar los acentos recibidos de cada propiedad.
- **Don't** inventar fotografías, disponibilidad, precios o predicciones de mercado.
- **Don't** prometer persistencia de favoritas fuera del componente montado.
- **Don't** aplicar los tokens de Rails por una comparación automática con DESIGN.md de la raíz.

Los avisos del detector que comparen estos tokens locales con Rails necesitan clasificación por alcance; no prueban una inconsistencia del dossier. La revisión de esta variante tuvo disposición `ship` sobre el diff y cuatro capturas en `.impeccable/review/create-blue/`. La comprobación en navegador cubrió 320, 390, 768 y 1440px sin desbordamiento de página. Runtime y build locales pasaron; la suite reportó 252 pruebas aprobadas y una omitida por falta del artefacto guest. No se midió rendimiento ni se probó un teléfono físico. Esta evidencia no acredita prueba autenticada, revisión integral ni despliegue.

La revisión tipográfica local comprobó 320, 390, 768 y 1440px sin desbordamiento de página y confirmó `fonts.loaded: true`. El subconjunto latin pesa aproximadamente 35.5 KB; este dato de archivo no es una medición de rendimiento. No se declara publicación en producción.

La iteración de información y contacto directo se documenta desde el código de `codex/create-property-value`. Los resultados de pruebas anteriores descritos arriba no certifican automáticamente esta nueva iteración ni su publicación.
