---
name: Stratos Rails — Mi día y Proceso
description: Registro acotado de la interfaz construida dentro del Stratos existente.
colors:
  rails-accent-dark: "#6ee7c2"
  rails-accent-light: "#087252"
  process-accent-light: "#067A5E"
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
- Proceso ocupa el ancho del módulo, con ajustes y reglas separados y guardado persistente.

Las capturas `desktop.png`, `mobile.png`, `mobile-form.png`, `settings-desktop.png` y `settings-mobile.png` bajo `.impeccable/review/` son viewports de demo local, algunos desplazados; no documentan páginas completas. Muestran estados concretos, incluyendo un bloque configurado a seis. El predeterminado contractual es siete. La revisión [rails-review.md](output/rails-review.md) limita su disposición `ship` a recuperación, contador personal y persistencia del contrato. Este documento no amplía esa validación a producción, todo el contenido o el tema claro integrado.

## Colors

La superficie mantiene el verde de Stratos sobre neutros azulados, con texto secundario menos prominente y rojo reservado para errores.

### Primary

- **Verde menta:** acento oscuro de Mi día y del proceso predeterminado; distingue el siguiente paso, acciones primarias y confirmaciones.
- **Verde profundo:** variante local clara de Mi día, con tinta blanca en el botón primario.
- **Verde de Proceso claro:** usa `T.accentDark` o `LP.accentDark` para texto y botones con contraste sobre blanco. Oscuro conserva `T.accent`.

### Neutral

- **Superficie azul oscura y campo profundo:** separan la tarjeta de su formulario sin sombra añadida.
- **Blanco y tinta oscura:** pareja de superficie y texto en Mi día claro.
- **Texto secundario:** Mi día emplea sus variables locales; Proceso usa `T.txt2` y evita atenuar filas apagadas completas. Su estado se expresa con texto e interruptor.
- **Bordes translúcidos:** proceden del tema, delimitan tarjetas, controles y separadores.

**The Theme Scope Rule.** Las variables `--rails-*` pertenecen a Mi día. No extender sus sustituciones de color al resto de Stratos ni confundirlas con toda la paleta `P` o `LP`.

## Typography

Inter es la familia existente. Mi día la hereda del contenedor; Proceso usa `font` y `fontDisp`, que actualmente comparten la misma familia. No hay una tipografía de exhibición nueva ni contenido monoespaciado propio de esta superficie.

- **Encabezado de vista:** el mayor escalón, compacto en tracking.
- **Nombre del cliente:** segundo escalón; pasa a (22 px) en el breakpoint pequeño de Mi día.
- **Razón e instrucción:** mismo cuerpo legible; la instrucción añade acento y peso (500).
- **Contexto y acciones:** escala secundaria, con botones de peso normal y primario (600).
- **Formulario de gestión:** campos de tamaño mayor que sus etiquetas; las etiquetas son visibles y están asociadas a cada control.
- **Proceso:** título 30 px (26 px móvil), secciones 17 px, reglas 15 px, cuerpo 14 px, contexto 13 px y anotaciones 12 px. Campos 16 px. Son escalones locales deliberados; los números del contador son tabulares.

## Layout

Mi día forma una columna centrada de ancho máximo (720 px), con tarjetas consecutivas y acciones que envuelven a nuevas líneas mediante flex. Cada tarjeta usa separación vertical (16 px) y relleno (22 px). Al llegar a (480 px) o menos, el relleno baja a (16 px), el nombre del cliente se reduce y el primario del formulario ocupa todo el ancho.

El formulario queda dentro de la tarjeta, separado por un borde superior, margen (18 px) y relleno superior (20 px). No es un diálogo. Las separaciones recurrentes toman pasos de la escala existente, aunque los estilos locales también contienen medidas ópticas intermedias; no se impone una retícula estricta que el código no sigue.

Proceso ocupa el ancho disponible, sin el límite anterior de 880 px ni un panel exterior. Comparte `T.bg` con el lienzo del módulo. En escritorio distribuye ajustes generales y reglas en columnas de proporción 0.85:2, separadas 48 px. Hasta 1100 px reduce el espacio y hasta 800 px coloca las reglas debajo. Los ajustes permanecen lado a lado en tableta y se apilan hasta 540 px. La lista de reglas usa una superficie agrupada con separadores, sin tarjetas anidadas.

La barra de guardado permanece al pie visible del área de contenido, con estado, descarte y guardado. Una extensión del mismo fondo cubre el espacio bajo ella; la navegación global conserva su posición. La envolvente no se encoge dentro del flex del shell: el contenido completo determina la altura desplazable.

## Elevation & Depth

Las tarjetas de Mi día se separan por tono y borde, sin sombra propia. Proceso usa superficies sólidas del tema (`T.bg2` oscuro y `T.surface` claro), con borde `T.borderH`. No añade vidrio ni sombras decorativas. La barra de guardado usa el mismo lienzo; no requiere desenfoque.

Los interruptores y chevrones de Proceso transicionan su transform en 180 ms, sin rebote. El feedback de presión es inmediato y no bloquea entradas. `prefers-reduced-motion` elimina transiciones y desplazamientos; `prefers-contrast: more` eleva el contraste de texto secundario y bordes. Las superficies sólidas no dependen de transparencia.

## Shapes

Mi día conserva su escala. Proceso usa contenedores agrupados de 14 px, controles y campos de 10 px, foco interior de 6–9 px y riel de interruptor completamente redondeado (26 px). Estas diferencias locales responden a la anatomía de cada control. Todos los botones, expansores y enlaces de Proceso tienen objetivos de al menos 44 px.

## Components

### Buttons

Mi día emplea un primario verde y acciones secundarias transparentes con borde. En hover el borde adopta el acento; los controles deshabilitados reducen opacidad. El foco visible usa contorno de (2 px) y separación exterior de (3 px). Proceso importa su propia hoja de estilo y usa su acento del tema para el foco, sin depender de que Mi día haya cargado.

### Cards / Containers

La tarjeta de cliente ordena: posición/canal/momento, nombre, razón, instrucción, contexto y acciones. El formulario sustituye la fila de acciones mientras se registra el resultado. Los enlaces al CRM y al expediente conservan el acceso a las superficies existentes; su navegación exterior no se redefine aquí.

### Inputs / Fields

Los campos de gestión usan fondo sólido y borde sutil, texto visible, cursor de acento y esquema nativo claro u oscuro. Los textarea se pueden ampliar verticalmente. El foco inicial entra en el detalle de la gestión. Cancelar devuelve el foco a Registrar contacto; una gestión confirmada lo lleva al encabezado de Mi día.

### Confirmación y recuperación

El error de gestión es un bloque delineado con `role="alert"`; el éxito usa el acento y `role="status"`. El rechazo definido conserva datos editables. Un resultado incierto bloquea los campos y ofrece reintentar el mismo envío. La tarjeta y los contadores se actualizan tras confirmar el guardado; los contadores personales no atribuyen cierres de otros asesores.

**The Confirmed State Rule.** Presentar el estado pendiente, el error y la confirmación como estados distintos; conservar la recuperación que corresponde al resultado del envío.

### Proceso

El interruptor principal tiene nombre accesible y estado `aria-checked`; cambiarlo edita un borrador. Textos explícitos distinguen estado, personalización y reglas fijas. Las filas editables usan `aria-expanded` y `aria-controls`. El panel se reinicia al cambiar de organización. Guardar y descartar son acciones explícitas; la confirmación de demo se identifica como actualización de sesión. El contador deshabilita los límites y anuncia el valor. Los campos tienen etiquetas y ayuda enlazadas. Errores y falta de conexión mantienen recuperación visible.

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

## Refinamiento de Proceso — septiembre 2026

Capturas actualizadas en `.impeccable/review/proceso/`: escritorio y móvil en ambos temas, más el editor y el tamaño intermedio. Sustituyen solo la evidencia anterior de Proceso. Se aplicaron los principios de claridad, consistencia espacial, feedback y accesibilidad de la skill Apple; se conserva Inter y la identidad Stratos. La revisión es de demo local, no de una activación productiva. Detalle de pruebas en [la entrega visual](output/refinamiento-proceso-2026-09-12.md).
