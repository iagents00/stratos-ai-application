# Capturas reales con marco de cristal

Seis imágenes de 1440 × 1020 píxeles sobre fondo blanco. Cada una incorpora la captura PNG original de Stratos a escala 1:1, dentro de un marco redondeado translúcido de 15 px, con borde fino y sombra suave. No se redibujó la interfaz ni se generaron pantallas con IA.

## Procedencia

Los PNG originales están en la carpeta local de evidencias `output/playwright/marketing-source/`. La procedencia de los componentes, los datos de demostración y el límite de iAgents se conservan en [el registro original](../README.md). El marco se compone con HTML/CSS desde `scripts/marketing-screenshot-frame.html`, se captura con Playwright/Chromium a 1440 × 1020 y se codifica como WebP sin pérdida. No se aplica perspectiva, desenfoque ni filtro a la interfaz.

El manifiesto incluye hashes de los PNG originales y los WebP finales, dimensiones y posición exacta de cada captura. Las cinco vistas de 1368 × 948 se sitúan en (36, 36); Métricas, de 1324 × 836, en (58, 92). Se comparó el interior de cada imagen, excluyendo 16 px de sus bordes redondeados: los valores RGB coinciden exactamente con el PNG original.

## Reproducción

Con los originales locales disponibles, abrir el HTML mediante Vite usando `?module=crm&source=original` y un viewport de 1440 × 1020; sustituir `crm` por cualquiera de los seis IDs del manifiesto. Capturar sin reescalar y codificar como WebP lossless. Sin `source=original`, la receta usa las capturas WebP públicas para previsualizar el marco.

Los PNG compuestos de alta resolución y la hoja de contacto permanecen fuera de los recursos publicados, en `output/playwright/glass-source/`. La landing consume únicamente estos seis WebP; se conserva su rótulo de datos de demostración.
