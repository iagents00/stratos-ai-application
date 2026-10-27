---
name: Stratos AI · Create · espacio del asesor
description: Flujo de preparación, selección y revisión integrado en el tema de Operate.
colors:
  background: "var(--cw-bg)"
  panel: "var(--cw-panel)"
  text: "var(--cw-text)"
  muted: "var(--cw-muted)"
  line: "var(--cw-line)"
  accent: "var(--cw-accent)"
  on-accent: "var(--cw-on)"
typography:
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "15px"
    lineHeight: 1.5
  heading:
    fontSize: "26px"
    fontWeight: 600
    letterSpacing: "-.03em"
  section:
    fontSize: "23px"
    fontWeight: 550
    lineHeight: 1.25
    letterSpacing: "-.025em"
  field:
    fontSize: "16px"
    lineHeight: 1.5
rounded:
  control: "8px"
  review: "10px"
  panel: "12px"
spacing:
  action-gap: "8px"
  layout-gap: "40px"
components:
  primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  selection:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "22px"
---

# Design System: Create · espacio del asesor

## Overview

**Creative North Star: "Una selección lista para compartir"**

Una superficie de trabajo legible organiza cliente, propiedades y revisión en tres pasos. El resumen de selección permanece a mano y muestra el orden real del entregable. La jerarquía se apoya en tipografía, espacio, bordes y estados discretos.

El alcance es el creador dentro de Operate. Hereda los temas claros y oscuros de la aplicación mediante `T`; no adopta la portada editorial del dossier ni redefine Rails. La vista previa muestra el dossier con su sistema local propio.

**Key Characteristics:**
- Tres pasos con progreso visible y acciones claras.
- Catálogo en filas y selección ordenable al lado.
- Tema de la aplicación y estados accesibles.
- Revisión antes de generar el enlace.

## Colors

Los colores normativos son variables enlazadas al tema recibido: fondo a `T.bg`, panel a `T.surface`, texto a `T.txt`, secundario a `T.txt2`, línea a `T.borderH || T.border`, acento a `T.accent` y texto sobre acento a `T.onAccent`.

El hover secundario mezcla 7% del texto con transparente; el paso activo usa 6%. Las filas elegidas usan 7% del acento. Los valores no fijan una paleta distinta para claro y oscuro. La barra de vista previa utiliza azul negro y blanco azulado, coherentes con el dossier.

## Typography

Inter y sus respaldos de sistema organizan toda la superficie. Los campos usan 16px y las ayudas 12px; las descripciones utilizan 14px y hasta 64ch. Los precios usan cifras tabulares. En móvil, el título de página baja a 23px y el de sección a 21px.

## Layout

Contenedor máximo de 1320px. El área principal comparte una cuadrícula con un resumen lateral de 290px, separación de 40px y posición sticky a 20px. A 900px o menos el resumen pasa a 240px y la separación a 22px; el precio de cada fila ocupa otra línea.

A 650px o menos la composición pasa a una columna y el resumen deja de ser sticky. Los contactos se apilan, los pasos reducen tamaño y las acciones pueden envolver. La barra inferior de acciones permanece sticky, con fondo del tema. El catálogo carga visualmente bloques de 24 filas adicionales, sin alterar la selección al buscar.

## Elevation & Depth

La superficie no necesita sombras: bordes y diferencias tonales separan controles, revisión y selección. La vista previa es un diálogo fijo por encima de la aplicación, con barra superior sticky y el dossier de fondo claro.

## Shapes

Controles con radio suave, panel de selección y éxito con radio mayor y números de paso circulares. Las filas de catálogo se separan con líneas, conservando densidad de lectura.

## Components

### Actions and navigation

Botones de altura mínima 44px; campos de al menos 46px. El paso activo usa `aria-current=step`; los pasos siguientes se habilitan según nombre y selección. Cambiar de paso enfoca el encabezado. El estado deshabilitado reduce opacidad y bloquea la interacción. El foco usa contorno de acento de 2px separado 3px. Las transiciones duran .15s y se anulan con movimiento reducido.

### Fields and catalog

Etiquetas visibles, ayuda y límites explícitos para cliente y mensaje. La búsqueda dispone de limpieza; los resultados y la cantidad seleccionada se anuncian como estado. Las filas incluyen checkbox, nombre, ubicación/tipología y precio. Al llegar a 12 se bloquean nuevas selecciones, conservando la opción de quitar. Los estados de carga, error, reintento y ausencia de resultados son explícitos. Un bloque expandible de presupuesto opcional presenta dos campos numéricos, Desde y Hasta en USD, en una cuadrícula de dos columnas con 16px de separación. Incluye aviso de rango inválido y acción para quitar el filtro; filtrar no elimina selecciones.

### Selection

Lista ordenada con subir, bajar y quitar mediante botones de 44px y nombres accesibles. Las posiciones extremas bloquean la dirección imposible. El panel recuerda que se usa el catálogo y los contactos de la empresa.

### Review and preview

Resumen del cliente, empresa y asesor; controles expandibles para nombre del enlace y materiales. El preview conserva el formulario, mueve el foco a cerrar, contiene la navegación Tab, permite Escape y devuelve el foco al botón de apertura. Verlo no genera enlaces.

### Success

El éxito muestra enlace seleccionable y acciones para copiar, abrir, WhatsApp y crear otro. La edición posterior elimina este estado activo; las versiones anteriores no se revocan. Los errores mantienen el contexto del formulario.

## Do's and Don'ts

### Do:
- **Do** heredar el tema de Operate y conservar el alcance de empresa.
- **Do** mantener orden, selección y datos al revisar o buscar.
- **Do** distinguir vista previa y generación final.

### Don't:
- **Don't** prometer persistencia nueva de borradores.
- **Don't** presentar publicación simulada como prueba autenticada.
- **Don't** imponer los tokens del dossier o de Rails a este creador.

Documentación local del código; no acredita despliegue ni una revisión integral de toda la aplicación.

## Ajuste verificado de la vista previa

La barra de la vista previa adopta fondo azul negro `#0b1523`, texto `#f6f8fb`, separador `#2b3748` y botón `#e8f0fb` con texto `#06070a`, en consonancia con el dossier. El contenedor utiliza `#06070a`, `color-scheme: dark` y `scroll-padding-top: 84px` para reservar espacio bajo la barra fija al navegar entre secciones.
