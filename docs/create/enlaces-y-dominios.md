# Enlaces de Create y dominios de inmobiliarias

Create permite elegir «Nombre del enlace» al preparar una presentación. Se sugiere el nombre de la organización autenticada, se normalizan espacios y acentos y se añade un identificador aleatorio. Ejemplo ilustrativo: `https://stratoscapitalgroup.com/p/adoquin-inmobiliaria-<código>`. No requiere comprar dominio ni configurar DNS. La marca visible sigue siendo la empresa de la cuenta, independientemente del nombre elegido para la URL.

El enlace contiene una selección pública para el cliente. Quien lo recibe puede reenviarlo. El código aleatorio evita nombres secuenciales y colisiones; no sustituye la autenticación si se necesita compartir documentos confidenciales. Los datos internos de contacto y masterbroker no entran en el payload. La base deriva la organización del usuario autenticado y exige cuenta y organización activas, rol permitido y Create habilitado. No permite listar la tabla a usuarios o visitantes.

El historial del navegador conserva la URL corta definitiva. La presentación publicada se almacena en el servidor y abre sin sesión en cualquier dispositivo. Los borradores y el historial todavía son locales al navegador; las propiedades de Proyectos sí están sincronizadas. El límite visible es de 12 propiedades por presentación. Una falla al publicar conserva el formulario y permite reintentar.

## Dominio propio: proceso propuesto, pendiente de implementación y verificación

Recomendación: usar un subdominio específico (`propiedades.tuinmobiliaria.com`) y conservar el dominio principal y el correo actuales. No basta escribir otro dominio en un campo: se necesita demostrar control DNS y asociarlo a una sola organización en el servidor.

1. El administrador solicita el subdominio exacto. Se comprueba que no pertenece a otro tenant ni coincide con un dominio operativo de Stratos.
2. El operador registra una asociación pendiente entre host y organización; añade únicamente ese host al proyecto oficial de Vercel. Las credenciales Vercel permanecen en servidor.
3. Se muestra el CNAME exacto que devuelva Vercel y, cuando corresponda, el TXT de verificación. El dueño los agrega en su proveedor DNS. No cambiar MX, dominio raíz ni nameservers.
4. El servidor comprueba propiedad, destino DNS y certificado HTTPS. Solo entonces activa la asociación. Los enlaces siguen usando Stratos mientras está pendiente o falla.
5. El resolver público recibe el host verificado y limita los códigos a la organización asociada. La raíz del subdominio no debe abrir una cuenta de otra empresa. El acceso a la plataforma sigue en sus dominios oficiales.
6. Se prueba desde móvil y escritorio sin sesión, se prueba rechazo de enlaces de otra empresa y se verifica renovación/cancelación. Al desconectar, se retira la asociación y el dominio de Vercel para evitar reutilización accidental. Los enlaces originales de Stratos siguen disponibles.

No se conectó un dominio externo en esta entrega: falta elegirlo y acreditar control DNS. Este procedimiento describe la siguiente fase, no una configuración ya activa. Para escalar, conviene una pantalla con estados pendiente/verificando/activo/error y una operación de servidor idempotente usando la API de dominios de Vercel.

Fuentes oficiales consultadas: [Añadir y configurar dominios](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [Configurar dominio y SSL](https://vercel.com/docs/domains/set-up-custom-domain), [Verificar dominio por API](https://vercel.com/docs/rest-api/reference/endpoints/projects/verify-project-domain).

## Publicación

Aplicar solamente la migración 270 después de que el frontend que acepta códigos de hasta 64 caracteres esté desplegado. No ejecutar todo el historial SQL. Conserva los códigos existentes (incluidos nombres cortos y los de 40 caracteres que antes fallaban), no reescribe presentaciones ni activa Rails.

## Tarjeta al compartir

La sugerencia automática empieza con el nombre del cliente y reserva espacio para la agencia. Sigue siendo editable. La URL final agrega un código aleatorio, sin necesitar un dominio por cliente. La tarjeta Open Graph muestra «Portafolio para [cliente] · [agencia]», una descripción de la selección y la nueva portada. Se resuelve por código con la RPC pública; no usa credenciales administrativas. Se escapan los nombres antes de incluirlos en HTML. Los enlaces legacy con fragmento conservan la tarjeta genérica porque los fragmentos no llegan al servidor.

La portada está en `public/og-portafolio-stratos-v2.png` (1730 × 909). Creada con la herramienta integrada ImageGen; texto «Portafolio personalizado», marca Stratos, fondo casi negro, letras blancas y acentos azul cielo. Prompt final: portada Open Graph horizontal minimalista y profesional; fondo #05080D, azul #7DD3FC, tipografía blanca; «Stratos» pequeño arriba, título en dos líneas «Portafolio» / «personalizado», línea inferior «Una selección de propiedades para ti», márgenes generosos y una regla azul fina; sin fotografías, edificios, objetos 3D, gradientes, tarjetas decorativas ni marcas de agua.

La imagen es común a las presentaciones; el cliente y la agencia se personalizan en los metadatos de cada enlace. WhatsApp y otras plataformas deciden cuándo mostrar o refrescar la tarjeta y pueden mantener caché de enlaces antiguos. La prueba técnica comprueba HTML y PNG públicos con agente de rastreador; no envía mensajes a contactos.
