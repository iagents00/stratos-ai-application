# Hero, marca y sliders

Solicitud explícita: fondo de la primera pantalla inspirado en una red de conocimiento, sutil y minimalista para móvil y PC; header con solo Stratos AI; sliders fluidos sin controles de inicio o pausa.

- SVG geométrico decorativo: desktop 28nodos, 46conexiones, 4 rutas; móvil 16nodos, 22conexiones, 2 rutas. Fondo blanco, centro despejado y paleta azul grisácea. Sin Canvas, filtros, blur, dependencias ni estado React por frame.
- Viajes de 6 s ×3 con demora máxima 2.4 s, acotados a 20.4 s en PC / 18.8 s en móvil. Pausa ambiental por documento oculto, viewport y movimiento reducido. Los flujos inferiores conservan dos ciclos finitos y geometría y202 sin controles manuales.
- Titular: siete frases superpuestas con altura común y transición de 240 ms. Galería: seis módulos, selección tinta/blanco, intervalo 2800 ms que se reinicia tras selección, pausas independientes de interacción/ambiente y altura compartida. Los paneles inactivos no deben recibir foco ni aparecer en AX.
- Se retiran todos los controles visibles de reproducción por petición explícita. Se conservan preferencias de movimiento y navegación por teclado. Capturas reales, precios, contactos, login, permisos y organizaciones mantienen sus fuentes existentes.

## Fuente

196 pruebas Node, lint dirigido y runtime aprobados (335 avisos adicionales preexistentes). Builds web/app aprobados; guard de rendimiento móvil intacto. Identidad, contexto, lenguaje, mapas y referencias documentales aprobados. El paquete nativo no incluye smk-hero-flow ni las tarjetas de marketing.

Detector ejecutado una vez por los ocho archivos UI: cero errores, dos warnings de fuentes comparadas con el DESIGN global de Rails. Switzer/Inter están declaradas en el boundary de marketing; radios y escalas siguen el brief fijado.

Las capturas y QA funcional se registran en este directorio. La revisión independiente posterior corresponde a REVIEW.md y no se sustituye por esta validación. La comprobación de publicación se conserva por separado al desplegar.
