---
name: Stratos Rails — Mi día y Proceso
description: Registro acotado de la interfaz construida dentro del Stratos existente.
colors:
  rails-accent-dark: "#6ee7c2"
  rails-accent-light: "#087252"
  process-accent-light: "#0D9A76"
  rails-text-dark: "#E2E8F0"
  rails-text-light: "#0B1220"
  rails-secondary-dark: "#aebaca"
  rails-secondary-light: "#4b5563"
  rails-surface-dark: "#141c28"
  rails-surface-light: "#fff"
  rails-field-dark: "#0d1420"
  rails-border-dark: "rgba(255,255,255,0.07)"
  rails-border-light: "rgba(15,23,42,0.07)"
  rails-primary-ink-dark: "#08251b"
  rails-error-dark: "#fca5a5"
  rails-error-light: "#a32121"
typography:
  headline:
    fontSize: "30px"
    letterSpacing: "-.03em"
  title:
    fontSize: "24px"
    letterSpacing: "-.025em"
  body:
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    fontSize: "15px"
    lineHeight: 1.55
  context:
    fontSize: "13px"
  field:
    fontSize: "16px"
  label:
    fontSize: "14px"
    fontWeight: 500
rounded:
  field: "8px"
  control: "10px"
  rule: "12px"
  action-card: "14px"
spacing:
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
components:
  button-primary-dark:
    backgroundColor: "{colors.rails-accent-dark}"
    textColor: "{colors.rails-primary-ink-dark}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-secondary-dark:
    backgroundColor: "transparent"
    textColor: "{colors.rails-text-dark}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  field-dark:
    backgroundColor: "{colors.rails-field-dark}"
    textColor: "{colors.rails-text-dark}"
    rounded: "{rounded.field}"
    padding: "10px"
  action-card-dark:
    backgroundColor: "{colors.rails-surface-dark}"
    textColor: "{colors.rails-text-dark}"
    rounded: "{rounded.action-card}"
    padding: "22px"
---

# Design System: Stratos Rails — Mi día y Proceso

## Overview

Este registro describe exclusivamente **Mi día y los ajustes de Proceso**. Conserva la identidad de Stratos: Inter, fondos oscuros azulados o superficies claras, acento verde, bordes discretos y contenedores redondeados. No establece una identidad nueva ni reglas globales para otras áreas de la aplicación.

La evidencia principal es `src/app/views/MiDia.jsx`, `MiDia.css`, `src/app/features/Admin/RailsSettings.jsx` y `src/design-system/tokens.js`. El contrato operativo permanece en [PRODUCT.md](PRODUCT.md). Los valores de la cabecera documentan las asignaciones construidas; el código y los tokens incumbentes siguen siendo la fuente de implementación. Un tema recibido por propiedades puede sustituir los valores de texto y borde de los temas predeterminados.

**Key Characteristics:**

- Jerarquía legible entre cliente, razón, instrucción concreta y contexto.
- Gestión desplegada dentro de la tarjeta y confirmación visible del resultado.
- Temas claro y oscuro heredados, con ajustes locales de contraste en Mi día.
- Ajustes compactos con borrador y guardado explícito.

Las capturas `desktop.png`, `mobile.png`, `mobile-form.png`, `settings-desktop.png` y `settings-mobile.png` bajo `.impeccable/review/` son viewports de demo local, algunos desplazados; no documentan páginas completas. Muestran estados concretos, incluyendo un bloque configurado a seis. El predeterminado contractual es siete. La revisión [rails-review.md](output/rails-review.md) limita su disposición `ship` a recuperación, contador personal y persistencia del contrato. Este documento no amplía esa validación a producción, todo el contenido o el tema claro integrado.

## Colors

La superficie mantiene el verde de Stratos sobre neutros azulados, con texto secundario menos prominente y rojo reservado para errores.

### Primary

- **Verde menta:** acento oscuro de Mi día y del proceso predeterminado; distingue el siguiente paso, acciones primarias y confirmaciones.
- **Verde profundo:** variante local clara de Mi día, con tinta blanca en el botón primario.
- **Verde de Proceso claro:** viene de `LP.accent`; no es el mismo valor que el ajuste local de Mi día.

### Neutral

- **Superficie azul oscura y campo profundo:** separan la tarjeta de su formulario sin sombra añadida.
- **Blanco y tinta oscura:** pareja de superficie y texto en Mi día claro.
- **Texto secundario:** Mi día emplea sus variables locales; Proceso mantiene `T.txt2` y `T.txt3` incumbentes.
- **Bordes translúcidos:** proceden del tema, delimitan tarjetas, controles y separadores.

**The Theme Scope Rule.** Las variables `--rails-*` pertenecen a Mi día. No extender sus sustituciones de color al resto de Stratos ni confundirlas con toda la paleta `P` o `LP`.

## Typography

Inter es la familia existente. Mi día la hereda del contenedor; Proceso usa `font` y `fontDisp`, que actualmente comparten la misma familia. No hay una tipografía de exhibición nueva ni contenido monoespaciado propio de esta superficie.

- **Encabezado de vista:** el mayor escalón, compacto en tracking.
- **Nombre del cliente:** segundo escalón; pasa a (22 px) en el breakpoint pequeño de Mi día.
- **Razón e instrucción:** mismo cuerpo legible; la instrucción añade acento y peso (500).
- **Contexto y acciones:** escala secundaria, con botones de peso normal y primario (600).
- **Formulario de gestión:** campos de tamaño mayor que sus etiquetas; las etiquetas son visibles y están asociadas a cada control.
- **Proceso:** título (20 px; 18 px en móvil), nombres de reglas (13 px) y cuerpo introductorio (12–12.5 px). Sus ayudas y pastillas más pequeñas se registran como densidad existente, no como escala recomendada para nuevas superficies.

## Layout

Mi día forma una columna centrada de ancho máximo (720 px), con tarjetas consecutivas y acciones que envuelven a nuevas líneas mediante flex. Cada tarjeta usa separación vertical (16 px) y relleno (22 px). Al llegar a (480 px) o menos, el relleno baja a (16 px), el nombre del cliente se reduce y el primario del formulario ocupa todo el ancho.

El formulario queda dentro de la tarjeta, separado por un borde superior, margen (18 px) y relleno superior (20 px). No es un diálogo. Las separaciones recurrentes toman pasos de la escala existente, aunque los estilos locales también contienen medidas ópticas intermedias; no se impone una retícula estricta que el código no sigue.

Proceso tiene ancho máximo (880 px). Su envolvente cambia de relleno (28 px 28 px 40 px) a (10 px 0 40 px), y el contenedor interior cambia de (24 px) a (16 px). Usa `useIsMobile`: ancho de viewport de (768 px) o menos, o detección de teléfono táctil con lado corto de pantalla de (500 px) o menos. El título y el interruptor principal comparten fila; la descripción ocupa la siguiente. Las reglas son filas apiladas, con una sección editable abierta a la vez.

## Elevation & Depth

Las tarjetas de Mi día se separan por tono y borde, sin sombra propia. Proceso reutiliza `G`: vidrio translúcido con desenfoque y saturación, sin sombra en oscuro y con sombra ambiental en capas en claro. Los interruptores conservan una sombra breve en el pomo. Estas decisiones conviven; no se prescribe un sistema global sin sombras.

Los detalles de vidrio, sombras, foco y transiciones se registran en [.impeccable/design.json](.impeccable/design.json). Las transiciones observadas en reglas e interruptores duran (0.2 s); `G` conserva su transición existente (0.3 s). No se añade ni se certifica un sistema nuevo de movimiento reducido.

## Shapes

Mi día usa esquinas suaves: tarjeta más amplia, controles intermedios y campos más contenidos. Proceso mantiene filas de regla, campos y pastillas con sus radios incumbentes; las pastillas y rieles del interruptor son redondos. No se normalizan a un único radio los componentes compartidos.

Los botones y enlaces de Mi día tienen altura mínima (44 px); sus campos también. En Proceso, interruptores y botones del contador cuentan con cajas de (44 px), aunque el riel visual es menor. El guardado, descarte y recuperación explícitos también tienen altura mínima (44 px). Esto describe esos controles; no certifica que cada enlace o expansor heredado de Proceso alcance ese tamaño.

## Components

### Buttons

Mi día emplea un primario verde y acciones secundarias transparentes con borde. En hover el borde adopta el acento; los controles deshabilitados reducen opacidad. El foco visible usa contorno de (2 px) y separación exterior de (3 px). La regla compartida alcanza Proceso cuando `MiDia.css` está cargado y recurre a un verde fijo si no existe `--rails-accent`.

### Cards / Containers

La tarjeta de cliente ordena: posición/canal/momento, nombre, razón, instrucción, contexto y acciones. El formulario sustituye la fila de acciones mientras se registra el resultado. Los enlaces al CRM y al expediente conservan el acceso a las superficies existentes; su navegación exterior no se redefine aquí.

### Inputs / Fields

Los campos de gestión usan fondo sólido y borde sutil, texto visible, cursor de acento y esquema nativo claro u oscuro. Los textarea se pueden ampliar verticalmente. El foco inicial entra en el detalle de la gestión. Cancelar devuelve el foco a Registrar contacto; una gestión confirmada lo lleva al encabezado de Mi día.

### Confirmación y recuperación

El error de gestión es un bloque delineado con `role="alert"`; el éxito usa el acento y `role="status"`. El rechazo definido conserva datos editables. Un resultado incierto bloquea los campos y ofrece reintentar el mismo envío. La tarjeta y los contadores se actualizan tras confirmar el guardado; los contadores personales no atribuyen cierres de otros asesores.

**The Confirmed State Rule.** Presentar el estado pendiente, el error y la confirmación como estados distintos; conservar la recuperación que corresponde al resultado del envío.

### Proceso

El interruptor principal tiene nombre accesible y estado `aria-checked`; cambiarlo edita un borrador. Las pastillas distinguen cambios sin guardar, estado y personalización. Las filas editables usan `aria-expanded` y `aria-controls`. Guardar y descartar son acciones explícitas; la confirmación de demo se identifica como actualización de sesión. El contador y las prioridades mantienen etiquetas accesibles propias.

## Do's and Don'ts

### Do:

- **Do** conservar la identidad y los temas incumbentes dentro de esta superficie.
- **Do** mantener cliente, razón e instrucción en su jerarquía actual.
- **Do** conservar etiquetas, foco visible y recuperación de errores al ampliar estos componentes.
- **Do** distinguir borrador, envío pendiente y confirmación en texto además del color.

### Don't:

- **Don't** convertir los overrides locales de Rails en una paleta global de Stratos.
- **Don't** extraer las ayudas pequeñas, el bajo énfasis de las pastillas o los glifos del contador como nuevas reglas visuales generales.
- **Don't** tratar una captura de demo, un viewport recortado o una revisión de tres fixes como validación de todo el producto.
