# Create · portafolios de propiedades

Documento local de la superficie de portafolios de Stratos AI. No sustituye PRODUCT.md de la raíz ni define Rails, el CRM o el resto de Create.

El asesor prepara una selección del catálogo para un cliente. El cliente necesita explorarla desde el móvil, comparar datos disponibles, identificar favoritas y consultar con su asesor sin perder el contexto de las propiedades elegidas.

La entrega es un dossier personal con introducción, índice navegable, comparación cuando hay más de una propiedad, fichas y próximos pasos. La vista previa del asesor conserva sus controles de compartir; el modo público presenta el dossier sin esa barra.

- Los nombres, descripciones, amenidades, superficies y demás datos proceden del catálogo recibido. Los datos ausentes no se inventan.
- Las imágenes y los materiales se consultan mediante enlaces externos disponibles. No se generan fotografías ni se simula una galería.
- Las favoritas viven en el estado del componente mientras permanece montado. No hay persistencia, sincronización ni guardado en la cuenta.
- WhatsApp contextual incluye las favoritas, o toda la selección si no hay favoritas; cada ficha permite consultar esa propiedad. La agenda aparece cuando existe una URL válida.
- Los importes se presentan como referencia en USD. El asesor confirma precio actualizado, disponibilidad y condiciones. Si el catálogo incluye rendimiento, se reproduce con advertencia sobre supuestos y ausencia de garantía; no se calculan predicciones de mercado.
- Se conserva la identidad de Stratos, la agencia recibida y el contacto del asesor correspondiente.

Fuente de comportamiento: `src/app/views/LandingPages/PortfolioDocument.jsx`, `portfolio-presentation.js` y `LandingPagePreview.jsx`. Fuente visual: `PortfolioDocument.css`.

Esta documentación describe la implementación local. Las capturas de revisión se reúnen en `.impeccable/review/create/` en la raíz del repositorio; su existencia no certifica por sí sola una revisión integral ni publicación en producción.
