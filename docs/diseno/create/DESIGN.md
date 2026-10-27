---
name: Stratos AI · Create · dossier de propiedades
description: Dossier personal de lectura tranquila, comparación y consulta contextual.
colors:
  paper: "#f6f4ee"
  ink: "#213d34"
  muted: "#5b665e"
  line: "#d6dbd1"
  accent: "#235c46"
  summary: "#e9edE3"
  next: "#e5ebdf"
  white: "#fff"
  primary-hover: "#305747"
  secondary-hover: "#e6eade"
  favorite-selected: "#d6e3cf"
typography:
  display:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(36px, 4.3vw, 62px)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-.035em"
  property-title:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(29px, 3vw, 42px)"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-.025em"
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "15px"
    lineHeight: 1.6
  section:
    fontSize: "clamp(26px, 3vw, 36px)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-.03em"
rounded:
  button: "8px"
  property: "12px"
  favorite: "50%"
spacing:
  action-gap: "10px"
  property-gap: "40px"
  property-gap-mobile: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
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

Papel claro y verde profundo sostienen una lectura tranquila y una jerarquía editorial. La tipografía serif distingue al cliente y a cada propiedad; la sans serif organiza datos y acciones. La comparación y los próximos pasos tienen prioridad sobre el ornamento.

El alcance es exclusivamente el dossier implementado en PortfolioDocument. Los documentos de diseño y producto de la raíz corresponden a Rails y no son la autoridad visual de esta superficie. La barra y el panel de compartir del asesor conservan su sistema existente en LandingPagePreview; no se redefinen aquí.

**Key Characteristics:**
- Papel claro, texto verde profundo y separadores discretos.
- Índice numerado y datos comparables antes de las fichas completas.
- Fichas con resumen tonal y detalle legible.
- Acciones contextualizadas y navegación accesible.

## Colors

La paleta local combina un fondo de papel cálido con verdes de baja saturación.

### Primary

`ink` identifica texto principal, encabezados y botones de acción. `accent` distingue corazones, enlaces contextuales e iconos de detalles. El botón principal adopta `primary-hover` al pasar el puntero.

### Neutral

`paper` cubre el dossier; `summary` distingue el resumen de cada ficha y `next` el cierre. `muted` acompaña datos secundarios y descripciones; `line` separa bloques sin introducir sombras. `white` da contraste al botón principal.

## Typography

Inter y su pila de sistema resuelven lectura, controles y datos. Georgia con respaldo Times New Roman aporta carácter a nombres de propiedades y al énfasis del título personal. El énfasis del título utiliza peso 400 y altura 1.15.

La introducción limita el mensaje a 56ch y las descripciones a 68ch. Los precios y números de índice usan cifras tabulares. El encabezado principal se adapta en móvil a `clamp(34px, 8vw, 48px)`; el mensaje pasa de 17px a 16px.

## Layout

El contenedor alcanza 1280px y usa margen interior horizontal `clamp(22px, 5vw, 72px)`. La portada distribuye introducción e índice en proporción 1.2:1; las fichas, resumen y detalle en .9:1.2. El cierre utiliza dos columnas 1.2:1.

A 760px o menos estas tres composiciones pasan a una columna. El encabezado de selección apila su filtro, y las fichas reducen su separación. La tabla mantiene un ancho mínimo de 650px dentro de una región desplazable horizontalmente y enfocable mediante teclado. No se comprimen artificialmente sus columnas.

## Elevation & Depth

El dossier no utiliza sombras. La profundidad proviene del papel, los fondos tonales y los bordes finos. Las sombras y desenfoques del panel de compartir pertenecen a la interfaz del asesor, fuera de este sistema local.

## Shapes

Los botones usan esquinas suaves, las fichas una curva algo mayor y el favorito un círculo. El índice y la tabla se organizan mediante líneas. Se preserva la lectura de documento continuo sin convertir cada dato en una tarjeta independiente.

## Components

### Buttons

Acciones de altura mínima 46px, con icono y texto. La variante secundaria es transparente con borde; el enlace contextual conserva subrayado y altura mínima 44px. Los cambios de fondo y color duran .18s; el foco visible usa contorno de 3px con separación de 4px. La preferencia de movimiento reducido elimina transiciones y desplazamiento suave.

### Navigation

El índice enumera todas las propiedades y permite ir a la ficha. Al usarlo, se desactiva el filtro de favoritas. Los saltos trasladan el foco al destino y lo desplazan a la vista. La tabla también enlaza a cada ficha.

### Comparison

Solo aparece cuando la selección original tiene más de una propiedad y existen filas visibles. Compara nombre, precio de referencia, tipología y entrega. Incluye caption y encabezados semánticos; los valores ausentes se indican explícitamente.

### Property

El resumen contiene favorito, nombre, ubicación, precio y enlaces disponibles a material y mapa. No repite un rótulo de opción encima del nombre. El detalle contiene únicamente los datos presentes: descripción, hechos (con Tipo y Tipología como campos separados cuando están disponibles), destacados, amenidades y rendimiento informado con su aclaración. Sin material, se invita a solicitarlo al asesor.

### Favorites

El botón circular expone su estado mediante `aria-pressed` y nombre accesible. El filtro muestra todas o solo favoritas; un estado vacío ofrece regresar a todas. Una región de estado anuncia la selección. La lista afecta al contacto general y al resumen final. Su duración está limitada al componente montado.

### Next steps

El cierre reúne consulta por WhatsApp y agenda cuando hay datos válidos. Si no existe ninguna opción de contacto, indica responder al mensaje original. Los tres pasos orientan a elegir, confirmar detalles y conocer la propiedad.

## Do's and Don'ts

### Do:
- **Do** conservar los datos del catálogo y los contactos recibidos.
- **Do** mantener foco visible, controles táctiles y desplazamiento contenido en la comparación.
- **Do** usar este documento como autoridad local del dossier Create.

### Don't:
- **Don't** inventar fotografías, disponibilidad, precios o predicciones de mercado.
- **Don't** prometer persistencia de favoritas fuera del componente montado.
- **Don't** aplicar los tokens de Rails por una comparación automática con DESIGN.md de la raíz.

Los avisos del detector que comparen estos tokens locales con Rails necesitan clasificación por alcance; no prueban una inconsistencia del dossier. Las capturas de revisión pertenecen a `.impeccable/review/create/` en la raíz. Este documento no declara revisión integral ni publicación.
