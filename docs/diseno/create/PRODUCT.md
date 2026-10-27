# Create · portafolios de propiedades

Documento local de la superficie de portafolios de Stratos AI. No sustituye PRODUCT.md de la raíz ni define Rails, el CRM o el resto de Create.

**Preferencia persistente explícita:** el usuario exige el negro original e Inter para este dossier y rechazó verde con serif. La petición posterior añade un degradado azul suave sobre negro, prioridad móvil y movimiento sutil. La nueva petición tipográfica incorpora Montserrat en subtítulos y jerarquía secundaria; Inter conserva el nombre completo protagonista y la prosa. Esta asignación actualiza la preferencia anterior de Inter en todo el dossier sin cambiar el negro ni la luz azul suave.

El asesor prepara una selección del catálogo para un cliente. El cliente necesita explorarla desde el móvil, comparar datos disponibles, identificar favoritas, anotar prioridades y consultar con su asesor sin perder el contexto de las propiedades elegidas.

La entrega es un dossier personal con portada negra y nombre completo del cliente en gran formato bajo «Exclusivo para», identificación «Portafolio personalizado», mensaje personal después de la portada, índice con precios, comparación cuando hay más de una propiedad, fichas y próximos pasos. La comparación incorpora un detalle real del catálogo para hacer más clara la diferencia entre opciones. La vista previa del asesor conserva sus controles de compartir; el modo público presenta el dossier sin esa barra.

- Los nombres, descripciones, amenidades, superficies y demás datos proceden del catálogo recibido. Los datos ausentes no se inventan.
- Las imágenes y los materiales se consultan mediante enlaces externos disponibles. No se generan fotografías ni se simula una galería.
- Cada ficha ofrece preguntas expandibles sobre presupuesto, espacio y entrega. Son orientación para la conversación, sin inferir idoneidad ni rendimientos.
- Las notas de cada propiedad admiten hasta 600 caracteres y conservan las prioridades o dudas mientras el componente está montado. No persisten al cerrar o recargar. Se incorporan al texto preparado por el enlace de WhatsApp de esa propiedad; el contacto general reúne las notas de las favoritas, o de todas si no hay favoritas. Escribir notas no envía mensajes.
- Las favoritas viven en el estado del componente mientras permanece montado. No hay persistencia, sincronización ni guardado en la cuenta.
- WhatsApp contextual incluye las favoritas, o toda la selección si no hay favoritas; cada ficha permite consultar esa propiedad. La agenda aparece cuando existe una URL válida.
- Los importes se presentan como referencia en USD. El asesor confirma precio actualizado, disponibilidad y condiciones. Si el catálogo incluye rendimiento, se reproduce con advertencia sobre supuestos y ausencia de garantía; no se calculan predicciones de mercado.
- Se conserva la identidad de Stratos, la agencia recibida y el contacto del asesor correspondiente.

Fuente de comportamiento: `src/app/views/LandingPages/PortfolioDocument.jsx`, `portfolio-presentation.js` y `LandingPagePreview.jsx`. Fuente visual: `PortfolioDocument.css`.

Esta documentación describe la implementación local. La revisión fresca `black_cover_reviewer` dio disposición `ship` al código y cinco capturas de `.impeccable/review/create-black/`. La comprobación responsive cubrió 320, 390, 768 y 1440px y nombres largos sin desbordamiento de página en preview demo; no acredita una prueba autenticada ni publicación en producción.
## Refinamiento azul y movimiento

La portada abre con una luz azul tenue que se asienta una sola vez en 800 ms; el contenido permanece visible e interactivo desde el inicio. No hay animación continua ni efectos ligados al scroll. Los saltos conservan el foco accesible y la preferencia de movimiento reducido elimina la entrada y el desplazamiento animado. En móvil, el botón de portada ocupa el ancho disponible y las acciones de propiedades se adaptan al tacto; la comparación conserva sus columnas y explica cómo desplazarlas.

## Jerarquía tipográfica refinada

Montserrat autoalojada (`Stratos Montserrat`) identifica subtítulos, propiedades, índice, etiquetas, pasos y «Exclusivo para». Inter mantiene el h1 del cliente y la lectura extensa. La fuente variable normal 400–700 usa subconjuntos latin y latin-ext, `font-display: swap` y `unicode-range`; procedencia y licencia SIL OFL 1.1 constan en `public/fonts/portfolio/README.md` y `OFL.txt`.

La comprobación visual local a 320, 390, 768 y 1440px no mostró desbordamiento de página. Se confirmó la carga de fuentes (`fonts.loaded: true`); el archivo latin pesa aproximadamente 35.5 KB. Esto no acredita un despliegue en producción.
