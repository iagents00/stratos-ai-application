# Create · portafolios de propiedades

Documento local de la superficie de portafolios de Stratos AI. No sustituye PRODUCT.md de la raíz ni define Rails, el CRM o el resto de Create.

**Preferencia persistente explícita:** el usuario exige el negro original e Inter para este dossier y rechazó verde con serif. La petición posterior añade un degradado azul suave sobre negro, prioridad móvil y movimiento sutil. La nueva petición tipográfica incorpora Montserrat en subtítulos y jerarquía secundaria; Inter conserva el nombre completo protagonista y la prosa. Esta asignación actualiza la preferencia anterior de Inter en todo el dossier sin cambiar el negro ni la luz azul suave.

El asesor prepara una selección del catálogo para un cliente. El cliente necesita explorarla desde el móvil, comparar datos disponibles, identificar favoritas y consultar con su asesor sin perder el contexto de las propiedades elegidas.

La entrega es un dossier personal con portada negra y nombre completo del cliente en gran formato bajo «Exclusivo para», identificación «Portafolio personalizado», mensaje personal después de la portada, índice con precios, comparación cuando hay más de una propiedad, fichas y próximos pasos. La comparación incorpora un detalle real del catálogo para hacer más clara la diferencia entre opciones. La vista previa del asesor conserva sus controles de compartir; el modo público presenta el dossier sin esa barra.

- Los nombres, descripciones, amenidades, superficies y demás datos proceden del catálogo recibido. Los datos ausentes no se inventan.
- Las imágenes y los materiales se consultan mediante enlaces externos disponibles. No se generan fotografías ni se simula una galería.
- Las favoritas viven en el estado del componente mientras permanece montado. No hay persistencia, sincronización ni guardado en la cuenta.
- WhatsApp contextual incluye las favoritas, o toda la selección si no hay favoritas; cada ficha permite consultar esa propiedad. El dossier no ofrece calendario: WhatsApp del asesor es el canal de consulta. La portada ofrece contacto directo junto a la exploración, cada ficha destaca su consulta y el cierre reúne la selección contextual.
- Los importes se presentan como referencia en USD. El asesor confirma precio actualizado, disponibilidad y condiciones. Si el catálogo incluye rendimiento, se reproduce con advertencia sobre supuestos y ausencia de garantía; no se calculan predicciones de mercado.
- Se conserva la identidad de Stratos, la agencia recibida y el contacto del asesor correspondiente.

Fuente de comportamiento: `src/app/views/LandingPages/PortfolioDocument.jsx`, `portfolio-presentation.js` y `LandingPagePreview.jsx`. Fuente visual: `PortfolioDocument.css`.

Esta documentación describe la implementación local. La revisión fresca `black_cover_reviewer` dio disposición `ship` al código y cinco capturas de `.impeccable/review/create-black/`. La comprobación responsive cubrió 320, 390, 768 y 1440px y nombres largos sin desbordamiento de página en preview demo; no acredita una prueba autenticada ni publicación en producción.
## Refinamiento azul y movimiento

La portada abre con una luz azul tenue que se asienta una sola vez en 800 ms; el contenido permanece visible e interactivo desde el inicio. No hay animación continua ni efectos ligados al scroll. Los saltos conservan el foco accesible y la preferencia de movimiento reducido elimina la entrada y el desplazamiento animado. En móvil, el botón de portada ocupa el ancho disponible y las acciones de propiedades se adaptan al tacto; la comparación conserva sus columnas y explica cómo desplazarlas.

## Jerarquía tipográfica refinada

Montserrat autoalojada (`Stratos Montserrat`) identifica subtítulos, propiedades, índice, etiquetas, pasos y «Exclusivo para». Inter mantiene el h1 del cliente y la lectura extensa. La fuente variable normal 400–700 usa subconjuntos latin y latin-ext, `font-display: swap` y `unicode-range`; procedencia y licencia SIL OFL 1.1 constan en `public/fonts/portfolio/README.md` y `OFL.txt`.

La comprobación visual local a 320, 390, 768 y 1440px no mostró desbordamiento de página. Se confirmó la carga de fuentes (`fonts.loaded: true`); el archivo latin pesa aproximadamente 35.5 KB. Esto no acredita un despliegue en producción.

## Información y contacto directo

La versión actual elimina el campo de notas y las preguntas genéricas del entregable. Cada ficha prioriza su descripción, características, destacados y amenidades reales, con «Lo que te ofrece esta propiedad» y «Lo que destaca» en la comparación. No añade beneficios o conclusiones no presentes en el catálogo. Los colores propios del catálogo se conservan como acentos por propiedad, aclarados para texto sobre el fondo oscuro.

El botón principal de cada ficha abre WhatsApp del asesor con el nombre de esa propiedad; los materiales y el mapa quedan como acciones secundarias. Portada y cierre consultan las favoritas, o toda la selección si no hay favoritas. Abrir el enlace prepara el mensaje; no lo envía automáticamente. Si falta WhatsApp válido, se omiten esos enlaces y el cierre remite al mensaje original. Esta actualización documental describe el código local y no certifica publicación ni nuevas pruebas de producción.
