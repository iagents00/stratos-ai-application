# Create · espacio del asesor

Alcance local: creador de portafolios dentro de Stratos AI, modo Operate. El dossier del cliente está documentado un nivel arriba. No sustituye el producto global, Rails ni los contactos o el aislamiento de cada empresa.

El asesor prepara una selección y comprueba su presentación antes de generar un enlace compartible. El flujo tiene tres pasos:

1. **Cliente:** nombre obligatorio (80 caracteres), mensaje opcional (600) y contacto tomado de la cuenta. La edición avanzada del contacto está disponible para administradores.
2. **Propiedades:** búsqueda por palabras sin distinguir acentos o mayúsculas sobre nombre, ubicación, zona, tipo, tipología y ticket; filtro de seleccionadas, presupuesto opcional en USD y catálogo mostrado en bloques de 24. El presupuesto compara el solapamiento del rango numérico registrado con los límites elegidos, incluye propiedades sin precio numérico disponible y conserva la selección previa. Los límites vacíos no restringen; un máximo menor al mínimo muestra aviso y no devuelve resultados. Se seleccionan entre 1 y 12 propiedades, se ordenan con subir/bajar y se pueden quitar. El orden de selección se conserva en el entregable. Se mantienen las vías existentes de agregar propiedad y consultar/reintentar el catálogo.
3. **Revisar y compartir:** resumen, vista previa, nombre opcional del enlace y materiales por propiedad. La vista previa no publica; permite cerrar y continuar editando sin perder los datos. La generación final usa la RPC existente `create_portfolio_link`; cualquier persona que tenga el enlace podrá ver el portafolio.

Al generar se presentan copiar, abrir, compartir por WhatsApp y crear otro portafolio. WhatsApp abre un mensaje preparado; no lo envía automáticamente. Si la generación falla se mantienen los datos y se muestra un error. Editar contenido, selección, orden o materiales elimina el enlace activo de la interfaz para generar una nueva versión; no revoca enlaces previamente creados.

Volver a «Mis portafolios» conserva los datos del formulario en el estado del componente padre; «Continuar portafolio» permite retomarlos mientras el módulo siga montado. No se incorpora persistencia nueva de borradores. La fase, la búsqueda y otros controles locales pueden reiniciarse al remontar el creador. Las propiedades personalizadas y materiales conservan sus mecanismos locales existentes y su alcance de organización.

Fuentes: `CreateWorkspace.jsx`, `CreateWorkspace.css`, `create-workflow.js` e integración en `index.jsx`, dentro de `src/app/views/LandingPages/`.

La evidencia visual del harness usa datos y publicación simulados; no acredita una prueba autenticada ni publicación real. Las pruebas locales de runtime y build y los resultados de CI deben comprobarse en sus respectivas ejecuciones. Este documento describe la implementación, sin certificar despliegue.
