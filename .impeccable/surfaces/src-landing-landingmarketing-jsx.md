---
version: 1
slug: "src-landing-landingmarketing-jsx"
primary_target: "src/landing/LandingMarketing.jsx"
related_targets: ["src/landing/LandingMarketing.css","src/landing/ModuleShowcase.jsx","src/landing/ModuleShowcase.css","src/landing/FeatureMotion.jsx","src/landing/FeatureMotion.css"]
---

# Sitio oficial de Stratos AI

Modo: Persuade. Rediseño visual autorizado por el usuario el 16 de octubre de 2026. Referencias fijadas: Savio, claridad editorial de OpenAI y acabado sobrio de Apple. Conservar la identidad Stratos, precios, contactos, rutas y slider inicial. Imágenes: capturas reales de la aplicación, interfaz intacta con datos demo. El usuario descartó las maquetas generadas.

## Direction contract

THESIS: Mostrar el sistema funcionando mediante capturas reales y exploración de sus módulos.

Tesis del refinamiento motion: consulta → contexto y actividad registrada → visibilidad. Dos diagramas explicativos conectan una entrada, Copilot o Comando y tres salidas de lectura; no representan envíos, guardados ni acciones autónomas sin confirmación.

OWN-WORLD: Blanco dominante, tinta #0A1B2E, cian #00D1FF, azul #112B4A. Switzer ligera e Inter; controles 10px y paneles 24px. Fondos claros discretos, sin imágenes decorativas detrás de la interfaz.

Refinamiento solicitado: las capturas se presentan como imágenes de 1440 × 1020 sobre blanco, con un marco redondeado de cristal translúcido y sombra suave. La interfaz se conserva a escala 1:1; el marco se compone fuera de ella. Se mantiene la galería y su comportamiento.

Refinamiento construido: tarjetas gris muy claro (#F6F7F8) con radio 24px, siguiendo la referencia fijada. Conexiones SVG con dos recorridos limitados de 5.6s (11.44s incluida la demora final), luego estado quieto y «Repetir animación». Pausa/reanudación conserva avance; fuera de pantalla, documento oculto o movimiento reducido detienen el movimiento. No se incorpora GIF pesado ni bucle infinito, respetando el guard móvil de Safari. La galería da aproximadamente dos tercios a la captura en escritorio y muestra seis cápsulas en 3×2 hasta 700px, con selección tinta #0A1B2E y texto blanco. Hasta 480px, la frase del hero reserva 2.2em para evitar saltos.

STORY: Entender qué organiza Stratos, explorar sus módulos, consultar planes y solicitar acceso o diagnóstico.

FIRST VIEWPORT: Header blanco compacto con logo S, título centrado con siete frases rotatorias, dos acciones y pestañas del demostrador. La imagen real domina su panel.

FORM: Galería de producto y lectura editorial, posición 5, semilla 580ee6e8. La referencia visual elegida por el usuario fija la dirección.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Sistema documentado

La implementación de marketing tiene su propio [DESIGN.md](../../docs/diseno/marketing/DESIGN.md) y [sidecar](../../docs/diseno/marketing/.impeccable/design.json). Ese boundary conserva los documentos de Rails en la raíz. Las capturas y reportes de revisión están en [marketing-2026-10-16](../review/marketing-2026-10-16/); el documento de diseño no sustituye el veredicto independiente.

La revisión independiente del refinamiento y el veredicto **ship** de la única corrección constan en [motion-2026-10-16/REVIEW.md](../review/motion-2026-10-16/REVIEW.md). Las ramas móviles comienzan debajo de los rótulos, sin atravesarlos; la confirmación conserva la composición en 1440, 834, 390 y 320 px. [QA.json](../review/motion-2026-10-16/QA.json) registra 24 comprobaciones y distingue la prueba sintética de visibilidad del límite real de Chromium.
