/** Manual público de Stratos. Contenido revisado el 23 de noviembre de 2026.
 * Mantener los ids: Copilot y enlaces compartidos los usan como anclas.
 * Las fichas del asistente conservan su catálogo; el índice incluye toda la plataforma.
 */
import { INTEL_FEATURES } from '../app/constants/intelFeatures.js';
export const MANUAL_VERSION = '3.0';
export const MANUAL_REVIEWED_AT = '2026-11-23';
export const CATEGORIES = [
  {
    "id": "empezar",
    "label": "Primeros pasos",
    "icon": "Home"
  },
  {
    "id": "funciones",
    "label": "Mapa de funciones",
    "icon": "LayoutGrid"
  },
  {
    "id": "clientes",
    "label": "CRM y clientes",
    "icon": "Users"
  },
  {
    "id": "pipeline",
    "label": "Pipelines y etapas",
    "icon": "Layers"
  },
  {
    "id": "seguimiento",
    "label": "Notas y seguimiento",
    "icon": "NotebookPen"
  },
  {
    "id": "agenda",
    "label": "Agenda y recordatorios",
    "icon": "CalendarDays"
  },
  {
    "id": "equipo",
    "label": "Equipos y usuarios",
    "icon": "UsersRound"
  },
  {
    "id": "copilot",
    "label": "Copilot y voz",
    "icon": "Bot"
  },
  {
    "id": "espacio",
    "label": "Space y documentos",
    "icon": "FolderOpen"
  },
  {
    "id": "plan",
    "label": "Plan Semanal",
    "icon": "CalendarRange"
  },
  {
    "id": "whatsapp",
    "label": "WhatsApp y llamadas",
    "icon": "MessageCircle"
  },
  {
    "id": "chat",
    "label": "Chat del equipo",
    "icon": "MessagesSquare"
  },
  {
    "id": "proyectos",
    "label": "Catálogo de proyectos",
    "icon": "Building2"
  },
  {
    "id": "create",
    "label": "Create y portafolios",
    "icon": "Hexagon"
  },
  {
    "id": "caja",
    "label": "Finanzas y Caja",
    "icon": "Wallet"
  },
  {
    "id": "comando",
    "label": "Comando y reportes",
    "icon": "BarChart3"
  },
  {
    "id": "marketing",
    "label": "Marketing y actividades",
    "icon": "Megaphone"
  },
  {
    "id": "drive",
    "label": "Mi Drive",
    "icon": "HardDrive"
  },
  {
    "id": "telegram",
    "label": "Telegram",
    "icon": "Send"
  },
  {
    "id": "ajustes",
    "label": "Configuración e integraciones",
    "icon": "Settings"
  },
  {
    "id": "soporte",
    "label": "Ayuda y solución de problemas",
    "icon": "LifeBuoy"
  }
];
const GUIDES = [
  {
    "id": "guia-inicio",
    "category": "empezar",
    "title": "Tu guía para trabajar con Stratos",
    "summary": "Encuentra cada módulo, aprende sus pasos y comprueba el resultado de lo que haces.",
    "where": "En la web o en la app",
    "access": "Todos los usuarios",
    "tags": [],
    "content": [
      {
        "type": "p",
        "text": "Stratos reúne clientes, agenda, equipo y herramientas de trabajo en una misma cuenta. Este manual explica el uso cotidiano de la plataforma. Los nombres y situaciones de los ejemplos son ficticios. Los módulos y sus nombres pueden variar según tu empresa y tu rol."
      },
      {
        "type": "steps",
        "items": [
          "Entra con tu cuenta y comprueba el nombre de tu empresa.",
          "Consulta Agenda para ver tus pendientes. Si trabajas en ventas, abre el CRM y revisa los clientes que necesitan atención.",
          "Registra lo ocurrido y deja una próxima acción con responsable y fecha.",
          "Comprueba el mensaje de guardado o la ficha actualizada antes de dar una solicitud por terminada."
        ]
      },
      {
        "type": "links",
        "ids": [
          "primer-acceso",
          "mapa-modulos",
          "agenda-crear",
          "equipos-usuarios",
          "copilot-registrar"
        ]
      },
      {
        "type": "tip",
        "text": "Puedes leer el manual sin iniciar sesión. No introduzcas aquí contraseñas ni datos de clientes: el buscador solo consulta estas guías."
      }
    ]
  },
  {
    "id": "primer-acceso",
    "category": "empezar",
    "title": "¿Cómo iniciar sesión por primera vez?",
    "summary": "Accede con tu cuenta y reconoce la empresa en la que vas a trabajar.",
    "where": "Pantalla de inicio de sesión",
    "access": "Todos los usuarios",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre app.stratoscapitalgroup.com o la app oficial de Stratos AI.",
          "Escribe el correo y la contraseña de tu cuenta. Si aún no tienes acceso, pídeselo al administrador de tu empresa.",
          "Pulsa Iniciar sesión y espera a que cargue tu espacio.",
          "Revisa tu nombre y tu organización antes de capturar información."
        ]
      },
      {
        "type": "tip",
        "text": "Si tarda o aparece un error, conserva el texto del aviso. Un acceso fallido no significa que se hayan borrado tus datos."
      },
      {
        "type": "links",
        "ids": [
          "cambiar-contrasena",
          "instalar-app-celular",
          "sesion-se-cierra"
        ]
      }
    ]
  },
  {
    "id": "instalar-app-celular",
    "category": "empezar",
    "title": "Instalar Stratos en iPhone, Android o como app web",
    "summary": "Elige la aplicación oficial o agrega la web a tu pantalla de inicio.",
    "where": "Descargas oficiales y navegador",
    "access": "Todos los usuarios",
    "tags": [
      "descargar",
      "ios",
      "móvil",
      "apk",
      "PWA"
    ],
    "content": [
      {
        "type": "heading",
        "text": "iPhone"
      },
      {
        "type": "steps",
        "items": [
          "Abre la sección de descargas del sitio de Stratos o la ficha oficial de Stratos AI en App Store.",
          "Instala la aplicación y entra con tu cuenta habitual.",
          "Para actualizarla, abre App Store y busca actualizaciones de Stratos AI."
        ]
      },
      {
        "type": "heading",
        "text": "Android"
      },
      {
        "type": "steps",
        "items": [
          "En Android, utiliza la versión web oficial en app.stratoscapitalgroup.com.",
          "Abre Stratos en Chrome. Puedes usarla desde el navegador o instalar la versión web desde el menú → Instalar aplicación o Agregar a pantalla de inicio.",
          "Inicia sesión con tu cuenta de la empresa. Cuando aparezca una actualización web, conserva los borradores y recarga."
        ]
      },
      {
        "type": "heading",
        "text": "Alternativa: app web"
      },
      {
        "type": "p",
        "text": "Abre app.stratoscapitalgroup.com. En iPhone, usa Safari → Compartir → Agregar a inicio. En Android, usa el menú de Chrome → Instalar aplicación o Agregar a pantalla de inicio, según lo que muestre el navegador."
      },
      {
        "type": "link",
        "text": "Abrir Stratos AI en App Store",
        "url": "https://apps.apple.com/app/stratos-ai/id6804826565"
      },
      {
        "type": "warn",
        "text": "Una actualización de la web y una actualización de la app de la tienda son entregas distintas. Usa siempre los enlaces oficiales; no necesitas otra cuenta ni registrar de nuevo tus clientes."
      },
      {
        "type": "links",
        "ids": [
          "notificaciones-telefono",
          "actualizar-app"
        ]
      }
    ]
  },
  {
    "id": "cambiar-contrasena",
    "category": "empezar",
    "title": "Cambiar o recuperar tu contraseña",
    "summary": "Recupera el acceso por correo o cambia la contraseña desde tu perfil.",
    "where": "Inicio de sesión o Perfil → Contraseña",
    "access": "Titular de la cuenta",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Si puedes entrar, abre Perfil → Contraseña y completa los campos que solicita el formulario.",
          "Si no puedes entrar, pulsa ¿Olvidaste tu contraseña? en el inicio de sesión.",
          "Escribe el correo de tu cuenta y solicita el enlace.",
          "Revisa la bandeja de entrada y spam. Abre el enlace más reciente y elige tu nueva contraseña."
        ]
      },
      {
        "type": "warn",
        "text": "No compartas contraseñas, códigos ni enlaces de recuperación. Si el enlace venció, solicita otro; el aviso del correo indica su vigencia."
      },
      {
        "type": "links",
        "ids": [
          "perfil-zona-horaria"
        ]
      }
    ]
  },
  {
    "id": "mapa-modulos",
    "category": "empezar",
    "title": "El mapa del sistema: qué es cada módulo",
    "summary": "Un índice completo por área, con acceso directo a las instrucciones.",
    "where": "Menú lateral; en móvil, barra inferior y Más",
    "access": "Según los módulos y permisos de tu cuenta",
    "tags": [],
    "content": [
      {
        "type": "p",
        "text": "Usa el menú para cambiar de área. En celular, Más reúne las opciones que no caben en la barra inferior. Que una función aparezca en este manual no activa su acceso en tu organización."
      },
      {
        "type": "links",
        "ids": [
          "fn-indice",
          "agenda-crear",
          "agregar-cliente-manual",
          "mi-espacio-que-es",
          "plan-semanal",
          "equipos-usuarios",
          "copilot-que-es",
          "whatsapp-bandeja",
          "chat-equipo",
          "proyectos-catalogo",
          "create-landings",
          "caja-que-es",
          "comando-indicadores",
          "marketing-actividades",
          "mi-drive",
          "iagents-canales",
          "rrhh-planes",
          "perfil-zona-horaria"
        ]
      },
      {
        "type": "tip",
        "text": "Proyectos puede ser el catálogo inmobiliario o un tablero de trabajo, según la configuración de tu empresa. Consulta la guía correspondiente al nombre y a las pestañas que ves."
      }
    ]
  },
  {
    "id": "conocer-interfaz",
    "category": "empezar",
    "title": "Conocer la interfaz y moverte desde el celular",
    "summary": "Menú, búsqueda, notificaciones, perfil y acceso a Space.",
    "where": "Barra superior y navegación principal",
    "access": "Todos los usuarios",
    "tags": [],
    "content": [
      {
        "type": "list",
        "items": [
          "Menú: abre los módulos habilitados; en el celular utiliza Más para ver los restantes.",
          "Barra superior: identifica tu sesión y muestra la búsqueda y los accesos disponibles.",
          "Centro de Inteligencia: consulta las novedades y funciones del asistente.",
          "Campana: revisa notificaciones y avisos.",
          "Space: abre Agenda, Documentos y Strategy, según tu configuración.",
          "Perfil: cambia tus preferencias personales y administra conexiones disponibles."
        ]
      },
      {
        "type": "tip",
        "text": "Para leer este manual en el celular, pulsa Temas. El buscador encuentra palabras dentro de las instrucciones, aunque no estén en el título."
      },
      {
        "type": "links",
        "ids": [
          "centro-inteligencia",
          "mi-espacio-que-es"
        ]
      }
    ]
  },
  {
    "id": "centro-inteligencia",
    "category": "empezar",
    "title": "Usar el Centro de Inteligencia",
    "summary": "Consulta novedades y abre el detalle de las funciones del asistente.",
    "where": "Barra superior → Centro de Inteligencia",
    "access": "Cuentas con este panel habilitado",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Toca el Centro de Inteligencia en la barra superior.",
          "Revisa las novedades de tu cartera y los pendientes mostrados.",
          "Usa Ver en el CRM para abrir el cliente indicado.",
          "Explora las fichas de funciones para ver cómo pedir una acción al asistente."
        ]
      },
      {
        "type": "p",
        "text": "El catálogo de este panel corresponde al asistente. El mapa de funciones de este manual también incluye equipos, agenda, documentos y los demás módulos."
      },
      {
        "type": "links",
        "ids": [
          "fn-indice",
          "ver-dashboard"
        ]
      }
    ]
  },
  {
    "id": "notificaciones-telefono",
    "category": "empezar",
    "title": "Activar y comprobar las notificaciones",
    "summary": "Recibe avisos en tu teléfono y revisa qué hacer si no llegan.",
    "where": "Copilot y ajustes de notificaciones del teléfono",
    "access": "Con avisos habilitados en tu organización",
    "tags": [
      "push",
      "avisos",
      "alertas"
    ],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Stratos en el dispositivo donde quieres recibir avisos e inicia sesión.",
          "En Copilot, utiliza Activar notificaciones o el control de avisos disponible.",
          "Acepta el permiso del sistema cuando lo solicite.",
          "Comprueba en Ajustes del teléfono que Stratos puede mostrar notificaciones y sonidos.",
          "Si aparece una opción de prueba o diagnóstico, úsala para verificar la recepción."
        ]
      },
      {
        "type": "p",
        "text": "En iPhone, la app de App Store usa el permiso de notificaciones de la aplicación. Si usas la versión web, agrégala a inicio y habilita los avisos desde esa instalación."
      },
      {
        "type": "tip",
        "text": "El modo Concentración, No molestar y las restricciones del teléfono pueden silenciar un aviso aunque siga visible en Copilot. Telegram es un canal adicional opcional."
      },
      {
        "type": "links",
        "ids": [
          "agenda-recordatorios",
          "avisos-configurar",
          "soporte-audio-conexion"
        ]
      }
    ]
  },
  {
    "id": "agregar-cliente-manual",
    "category": "clientes",
    "title": "Agregar un cliente nuevo al CRM",
    "summary": "Captura datos, responsable, negocio y etapa sin perder el contexto.",
    "where": "CRM → Agregar Cliente o Nuevo cliente",
    "access": "Usuarios con permiso sobre el CRM",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre CRM y, si hay varias líneas de negocio o pipelines, elige el que corresponde.",
          "Pulsa Agregar Cliente o Nuevo cliente.",
          "Escribe el nombre y los datos de contacto disponibles. Revisa el prefijo del país del teléfono.",
          "Completa presupuesto y moneda, proyecto o interés, etapa y asesor cuando estén disponibles.",
          "Indica la próxima acción si ya sabes qué sigue.",
          "Pulsa Guardar, espera la confirmación y abre la ficha para comprobar los datos."
        ]
      },
      {
        "type": "tip",
        "text": "La etapa inicial y los campos requeridos dependen de tu empresa. Si detecta un contacto existente, revisa su ficha antes de crear otro."
      },
      {
        "type": "links",
        "ids": [
          "clientes-varios-negocios",
          "copilot-registrar"
        ]
      }
    ]
  },
  {
    "id": "buscar-cliente",
    "category": "clientes",
    "title": "Buscar y filtrar clientes",
    "summary": "Encuentra un registro por nombre, teléfono y los filtros disponibles.",
    "where": "CRM → búsqueda y filtros",
    "access": "Tu cartera o el alcance permitido por tu rol",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre CRM y escribe parte del nombre, teléfono o correo en la búsqueda.",
          "Revisa los filtros de etapa, asesor, fechas y línea de negocio que tengas disponibles.",
          "Abre la tarjeta correcta y comprueba el nombre y teléfono.",
          "Si no aparece, limpia los filtros y verifica que estás en el pipeline y la organización correctos."
        ]
      },
      {
        "type": "tip",
        "text": "Puede haber personas con el mismo nombre o varios registros de un contacto en negocios distintos. Usa el teléfono y la línea de negocio para diferenciarlos."
      },
      {
        "type": "links",
        "ids": [
          "ver-expediente-cliente",
          "clientes-varios-negocios"
        ]
      }
    ]
  },
  {
    "id": "ver-expediente-cliente",
    "category": "clientes",
    "title": "Leer y editar el expediente de un cliente",
    "summary": "Datos, próxima acción, notas, actividad y archivos en una misma ficha.",
    "where": "CRM → tarjeta del cliente",
    "access": "Según tu cartera y permisos",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre la tarjeta del cliente.",
          "Revisa nombre, contacto, etapa, asesor, presupuesto y moneda.",
          "Consulta las pestañas disponibles: expediente, notas, WhatsApp, llamadas, documentos o perfilamiento.",
          "Edita el campo necesario y usa Guardar si el formulario lo solicita. Algunos campos confirman el cambio al salir de la edición.",
          "Comprueba el valor actualizado y el historial antes de cerrar."
        ]
      },
      {
        "type": "warn",
        "text": "Ver una ficha no significa que todos los cambios se guarden solos. Sigue el control de guardado de cada sección y conserva el borrador si aparece un error."
      },
      {
        "type": "links",
        "ids": [
          "agregar-nota-cliente",
          "asignar-tarea",
          "clientes-documentos",
          "historial-cambios"
        ]
      },
      {
        "type": "heading",
        "text": "Completar el perfilamiento o Discovery"
      },
      {
        "type": "steps",
        "items": [
          "Abre Discovery o Perfilamiento cuando tu ficha lo incluya.",
          "Registra lo que sabes del presupuesto y moneda, necesidad, zona, plazo y las demás preguntas de tu proceso.",
          "Distingue un dato confirmado de uno que aún está pendiente.",
          "Guarda los cambios y comprueba su resultado antes de pedir recomendaciones o preparar una cita."
        ]
      }
    ]
  },
  {
    "id": "clientes-varios-negocios",
    "category": "clientes",
    "title": "El mismo contacto en varios negocios o pipelines",
    "summary": "Distingue un contacto repetido de una oportunidad en otra línea de negocio.",
    "where": "CRM → selector de negocio o pipeline",
    "access": "Empresas con varias líneas configuradas",
    "tags": [
      "duplicados",
      "dos crm",
      "multinegocio",
      "moneda"
    ],
    "content": [
      {
        "type": "p",
        "text": "Una persona puede tener necesidades distintas, por ejemplo asesoría de servicios y compra de una vivienda. Antes de crear o mover una ficha, identifica el negocio y la etapa de destino."
      },
      {
        "type": "steps",
        "items": [
          "Busca a la persona y revisa en qué negocio está su ficha actual.",
          "Si quieres conservarla y crear otra oportunidad, dilo expresamente: mantener el registro original y agregar otro en el negocio de destino.",
          "Reutiliza el teléfono correcto y diferencia las fichas con el nombre que necesitas.",
          "Indica etapa, presupuesto con moneda y próxima acción para la nueva oportunidad.",
          "Verifica ambos registros en sus pipelines respectivos."
        ]
      },
      {
        "type": "ex",
        "items": [
          "Mantén a Lucía Montes en el pipeline de servicios, etapa Contactado. Crea además a Lucía Inversión en bienes raíces con el mismo teléfono, también en Contactado. Presupuesto: 18,500 pesos mexicanos."
        ]
      },
      {
        "type": "warn",
        "text": "Mover una ficha de etapa y crear una segunda ficha son acciones diferentes. Si no se ofrece un selector de negocio, consulta al administrador; no cambies el nombre para intentar obtener permisos."
      },
      {
        "type": "links",
        "ids": [
          "copilot-contexto",
          "etapas-pipeline-significado"
        ]
      }
    ]
  },
  {
    "id": "clientes-documentos",
    "category": "clientes",
    "title": "Adjuntar documentos y registrar contactos relacionados",
    "summary": "Organiza el material y los datos adicionales de una persona.",
    "where": "Expediente → Documentos o Contactos relacionados",
    "access": "Usuarios con acceso a la ficha",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre el cliente y selecciona la pestaña correspondiente.",
          "En Documentos, usa el control para subir un archivo y completa los datos que solicite.",
          "En Contactos relacionados, registra un contacto adicional o relación cuando la opción esté habilitada.",
          "Espera el resultado de la carga y vuelve a abrir el archivo o dato para comprobarlo."
        ]
      },
      {
        "type": "tip",
        "text": "Los documentos de un cliente y los Documentos del Equipo tienen destinos distintos. No subas información sensible a un enlace público del manual."
      },
      {
        "type": "links",
        "ids": [
          "documentos-equipo"
        ]
      }
    ]
  },
  {
    "id": "llamar-cliente",
    "category": "clientes",
    "title": "Llamar a un cliente y documentar el resultado",
    "summary": "Distingue abrir el marcador de una llamada integrada en el sistema.",
    "where": "Ficha del cliente → teléfono o llamada",
    "access": "Según el servicio de llamadas habilitado",
    "tags": [],
    "content": [
      {
        "type": "p",
        "text": "La acción disponible depende de tu cuenta: puede abrir el marcador del teléfono o iniciar una llamada mediante la integración de tu empresa. Abrir el marcador no prueba que la llamada se haya realizado."
      },
      {
        "type": "steps",
        "items": [
          "Abre la ficha y revisa el número con su prefijo.",
          "Toca el botón de llamada y sigue las indicaciones que aparezcan.",
          "Al terminar, revisa el registro disponible y agrega una nota con el resultado.",
          "Deja la próxima acción con fecha y hora."
        ]
      },
      {
        "type": "warn",
        "text": "La grabación, transcripción y llamada por IA solo están disponibles cuando el servicio está configurado y autorizado para tu empresa. Consulta sus condiciones antes de usarlo."
      },
      {
        "type": "links",
        "ids": [
          "asignar-tarea",
          "iagents-canales"
        ]
      }
    ]
  },
  {
    "id": "papelera-restaurar",
    "category": "clientes",
    "title": "Recuperar un cliente desde Papelera",
    "summary": "Restaura una ficha eliminada si tu rol lo permite.",
    "where": "Menú → Papelera; en celular, Más",
    "access": "Usuarios autorizados",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Papelera.",
          "Busca el cliente por sus datos y revisa que sea la ficha correcta.",
          "Pulsa Restaurar y espera la confirmación.",
          "Vuelve al CRM y busca el cliente; limpia filtros si hace falta."
        ]
      },
      {
        "type": "warn",
        "text": "Eliminar definitivamente es irreversible. No lo uses para resolver un duplicado sin revisar antes el historial, los archivos y la política de tu empresa."
      }
    ]
  },
  {
    "id": "mover-etapa-pipeline",
    "category": "pipeline",
    "title": "Cambiar la etapa de un cliente",
    "summary": "Mueve la tarjeta o usa la ficha o Copilot y comprueba el cambio.",
    "where": "CRM → tablero o ficha",
    "access": "Usuarios con permiso para editar el cliente",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Confirma el negocio o pipeline y abre el cliente correcto.",
          "Desde la ficha, elige la etapa de destino en el selector. En el tablero también puedes arrastrar la tarjeta si esa vista lo permite.",
          "Si la etapa requiere una cita u otro dato, complétalo.",
          "Espera la confirmación y revisa que la nueva etapa aparece en la ficha."
        ]
      },
      {
        "type": "ex",
        "items": [
          "Pasa a Elena a Contactado en bienes raíces."
        ]
      },
      {
        "type": "tip",
        "text": "Si acabas de hablar de una persona con Copilot, puedes referirte a ella; ante homónimos, elige la ficha que corresponda. Si solo recibes un acuse de atención, todavía falta el resultado de la operación."
      },
      {
        "type": "links",
        "ids": [
          "copilot-confirmaciones",
          "historial-cambios"
        ]
      }
    ]
  },
  {
    "id": "etapas-pipeline-significado",
    "category": "pipeline",
    "title": "Entender pipelines, negocios y etapas",
    "summary": "Cada empresa define su proceso; el manual no impone un embudo único.",
    "where": "CRM y Space → Strategy → Protocolo",
    "access": "Según la configuración de tu organización",
    "tags": [],
    "content": [
      {
        "type": "p",
        "text": "Un pipeline ordena oportunidades por etapas. Sus nombres, colores y criterios dependen de tu empresa y, si corresponde, de la línea de negocio. Usa el protocolo de tu organización para saber cuándo avanzar."
      },
      {
        "type": "list",
        "items": [
          "Primer contacto o Nuevo: oportunidad pendiente de atender.",
          "Contactado: ya hubo comunicación según el criterio de tu equipo.",
          "Cita o Visita agendada: registra también fecha y hora. Cambiar el nombre de etapa por sí solo no define una cita.",
          "Seguimiento: hay un siguiente paso concreto con responsable.",
          "Ganado o Cierre: se cumple el criterio comercial de tu empresa.",
          "Perdido o Descartado: registra el motivo cuando el formulario lo permita."
        ]
      },
      {
        "type": "tip",
        "text": "Estos nombres son ejemplos. Una etapa de servicios y una inmobiliaria pueden llamarse Contactado y pertenecer a procesos distintos."
      },
      {
        "type": "links",
        "ids": [
          "pipelines-configurar",
          "protocolo-ventas"
        ]
      }
    ]
  },
  {
    "id": "pipelines-configurar",
    "category": "pipeline",
    "title": "Configurar etapas y publicar un pipeline",
    "summary": "Edita nombres, colores, orden y etapas de cita desde la administración.",
    "where": "Menú → Pipelines, cuando está disponible",
    "access": "Administradores autorizados de la empresa",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Pipelines y revisa el pipeline de tu empresa.",
          "Elige una plantilla solo si quieres usarla como base; revisa la vista previa.",
          "Agrega, renombra o reordena etapas con los controles disponibles.",
          "Selecciona las etapas que representan una cita y revisa sus avisos.",
          "Pulsa Guardar y publicar.",
          "Recarga el CRM y comprueba el orden, los nombres y los clientes existentes."
        ]
      },
      {
        "type": "warn",
        "text": "Las etapas con clientes no se eliminan directamente. Mueve primero sus clientes a una etapa válida. Renombrar una etapa actualiza su nombre en las fichas que la usan."
      },
      {
        "type": "tip",
        "text": "Algunas empresas tienen pipelines preconfigurados y no muestran este editor. Pide al administrador el cambio correspondiente; no todas las cuentas gestionan el mismo embudo."
      }
    ]
  },
  {
    "id": "agregar-nota-cliente",
    "category": "seguimiento",
    "title": "Agregar una nota al expediente",
    "summary": "Guarda lo hablado y deja contexto útil para el siguiente contacto.",
    "where": "Ficha del cliente → Expediente o Notas",
    "access": "Usuarios autorizados sobre la ficha",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Busca y abre al cliente.",
          "Localiza Notas o el campo de notas del expediente.",
          "Escribe el acuerdo, interés, objeción o información recibida.",
          "Usa el control de guardado o confirma la edición según la pantalla.",
          "Revisa que la nota aparece en el historial del cliente correcto."
        ]
      },
      {
        "type": "ex",
        "items": [
          "Anota en Daniel Robles que la propietaria Clara está coordinando la visita y falta confirmar quién lo recibirá."
        ]
      },
      {
        "type": "tip",
        "text": "Una nota de contexto no sustituye una tarea con vencimiento. Para que algo aparezca como pendiente, registra también la próxima acción."
      },
      {
        "type": "links",
        "ids": [
          "asignar-tarea",
          "historial-cambios"
        ]
      }
    ]
  },
  {
    "id": "asignar-tarea",
    "category": "seguimiento",
    "title": "Definir la próxima acción de un cliente",
    "summary": "Deja qué sigue, quién lo hará y cuándo.",
    "where": "Ficha → Próxima acción",
    "access": "Usuarios autorizados sobre la ficha",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre el cliente y escribe una acción concreta, por ejemplo llamar para confirmar la visita.",
          "Selecciona la fecha y la hora disponibles en el formulario.",
          "Revisa el asesor o responsable del cliente.",
          "Guarda y comprueba la próxima acción en la ficha y en la vista de pendientes disponible."
        ]
      },
      {
        "type": "p",
        "text": "Las acciones del cliente se relacionan con su expediente. Agenda permite además pendientes personales y actividades de equipo que no pertenecen a un cliente."
      },
      {
        "type": "links",
        "ids": [
          "agenda-crear",
          "agenda-recordatorios",
          "copilot-agendar"
        ]
      }
    ]
  },
  {
    "id": "historial-cambios",
    "category": "seguimiento",
    "title": "Consultar el historial y comprobar un cambio",
    "summary": "Revisa notas y movimientos con fecha y autor cuando estén disponibles.",
    "where": "Ficha → Expediente o Historial",
    "access": "Usuarios con acceso al cliente",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre el expediente del cliente.",
          "Busca Historial de acciones, actividad o la línea de tiempo de notas.",
          "Localiza el movimiento por su hora y su descripción.",
          "Contrasta la entrada con los campos actuales: etapa, responsable o próxima acción."
        ]
      },
      {
        "type": "tip",
        "text": "Para reportar un cambio que falta, indica cliente, negocio, hora aproximada y operación solicitada. Evita repetir un alta mientras se verifica una solicitud que pudo haberse guardado."
      }
    ]
  },
  {
    "id": "agenda-crear",
    "category": "agenda",
    "title": "Crear una actividad en tu agenda",
    "summary": "Registra un pendiente personal o profesional con prioridad, fecha y hora.",
    "where": "Menú → Agenda o Space → Agenda",
    "access": "Cada usuario en su propia agenda",
    "tags": [
      "calendario",
      "pendientes",
      "personal",
      "profesional",
      "crear tarea"
    ],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Agenda. Si eres administrador, selecciona Mi agenda para crear el pendiente para ti.",
          "Escribe el título en Escribe la siguiente acción. Agrega descripción solo si hace falta contexto.",
          "Elige Personal o Profesional y la prioridad disponible.",
          "Selecciona el día en el calendario y después la hora. Revisa ambos antes de confirmar.",
          "Pulsa el control para registrar la actividad y espera la confirmación.",
          "Comprueba que aparece con tu nombre, categoría y vencimiento correctos."
        ]
      },
      {
        "type": "tip",
        "text": "Registrar sin fecha guarda un pendiente sin vencimiento. Si necesitas un aviso a una hora concreta, asígnale fecha y hora."
      },
      {
        "type": "ex",
        "items": [
          "Recuérdame revisar la respuesta de Clara en dos horas. Es para mí."
        ]
      },
      {
        "type": "links",
        "ids": [
          "agenda-editar",
          "agenda-equipo",
          "agenda-recordatorios"
        ]
      }
    ]
  },
  {
    "id": "agenda-editar",
    "category": "agenda",
    "title": "Editar, ordenar y completar pendientes",
    "summary": "Actualiza una actividad y consulta las que ya terminaste.",
    "where": "Agenda → fila de la actividad",
    "access": "Propietario o responsable autorizado",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Localiza el pendiente y revisa su título y responsable.",
          "Usa la edición del texto, descripción, fecha o prioridad que necesites.",
          "Para cambiar el vencimiento, vuelve a seleccionar día y hora y confirma el cambio.",
          "Marca como completada cuando la actividad se haya realizado.",
          "Abre el bloque de completadas para consultar el resultado o devolverla a pendiente si te equivocaste."
        ]
      },
      {
        "type": "p",
        "text": "En las vistas que ofrecen arrastre puedes cambiar el orden de las actividades. La prioridad y la fecha siguen siendo datos independientes del orden visual."
      },
      {
        "type": "warn",
        "text": "Eliminar un pendiente y completarlo tienen efectos distintos. Para conservar la constancia del trabajo, usa completada cuando esté hecho."
      },
      {
        "type": "links",
        "ids": [
          "agenda-recordatorios"
        ]
      }
    ]
  },
  {
    "id": "agenda-equipo",
    "category": "agenda",
    "title": "Ver y asignar la agenda del equipo",
    "summary": "Pasa de tus pendientes a las actividades de las personas de tu empresa.",
    "where": "Agenda → Equipo completo",
    "access": "Administración y responsables con permiso",
    "tags": [
      "delegar",
      "todos",
      "encargado",
      "equipo completo"
    ],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Agenda y selecciona Equipo completo.",
          "Revisa las actividades por su responsable.",
          "Para crear una actividad, escribe la acción y elige a una persona en Asignar responsable.",
          "Si es una actividad profesional para todo el equipo, usa Todos cuando esa opción esté disponible.",
          "Selecciona prioridad, fecha y hora y registra.",
          "Comprueba el responsable de la actividad guardada. Vuelve a Mi agenda para tus propios pendientes."
        ]
      },
      {
        "type": "tip",
        "text": "Mi agenda asigna el pendiente a tu usuario. Equipo completo permite elegir responsable. Personal no ofrece la asignación a Todos."
      },
      {
        "type": "warn",
        "text": "Una etiqueta Personal clasifica la actividad. La visibilidad efectiva depende de los permisos de agenda de tu organización; no la uses como una caja privada para guardar información sensible."
      },
      {
        "type": "links",
        "ids": [
          "equipos-usuarios",
          "equipos-acciones",
          "roles-permisos"
        ]
      }
    ]
  },
  {
    "id": "agenda-recordatorios",
    "category": "agenda",
    "title": "Responder recordatorios y detener seguimientos",
    "summary": "Conoce qué hace cada botón y cómo reprogramar una actividad.",
    "where": "Copilot, Telegram o notificaciones habilitadas",
    "access": "Destinatario de la actividad",
    "tags": [
      "spam",
      "3 minutos",
      "30 minutos",
      "60 minutos",
      "una hora",
      "posponer"
    ],
    "content": [
      {
        "type": "list",
        "items": [
          "Hecho: úsalo cuando terminaste la actividad.",
          "En proceso: informa que sigues trabajando; no equivale a completarla.",
          "No la hice: registra que no se realizó, según el tipo de aviso.",
          "Lo voy a hacer: confirma que atenderás la actividad; no registra el trabajo como terminado.",
          "No voy a poder: detiene los avisos de ese seguimiento; la actividad puede seguir pendiente.",
          "Reprogramar: indica una nueva fecha y hora y verifica la confirmación."
        ]
      },
      {
        "type": "p",
        "text": "La frecuencia depende del tipo de aviso y de la configuración de tu empresa. En los seguimientos con la pauta de tres avisos, se envían a los 3, 30 y 60 minutos desde su inicio; después termina esa secuencia. No son avisos cada tres minutos indefinidamente."
      },
      {
        "type": "warn",
        "text": "El aviso inicial o anticipado de una cita puede ser distinto del seguimiento posterior. Que deje de llegar un aviso no significa que la actividad esté hecha. Revisa su estado en Agenda."
      },
      {
        "type": "links",
        "ids": [
          "avisos-configurar",
          "agenda-editar"
        ]
      }
    ]
  },
  {
    "id": "equipos-usuarios",
    "category": "equipo",
    "title": "Agregar personas a tu equipo",
    "summary": "Crea una cuenta de acceso para alguien de tu organización.",
    "where": "Menú → Usuarios; en celular, Más",
    "access": "Administradores autorizados",
    "tags": [
      "equipos",
      "invitar",
      "colaborador",
      "nuevo usuario",
      "crear equipo"
    ],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Usuarios y confirma que estás en la empresa correcta.",
          "Pulsa Nuevo Usuario.",
          "Completa nombre, correo, rol y los datos que solicite el formulario.",
          "Revisa el rol: determina qué puede consultar o modificar la persona.",
          "Pulsa Crear Usuario y espera el resultado.",
          "Busca a la persona en la lista y entrégale el acceso por el canal seguro de tu empresa."
        ]
      },
      {
        "type": "p",
        "text": "Usuarios crea cuentas del equipo. Un cliente se registra en CRM: no necesita una cuenta interna para aparecer en el pipeline."
      },
      {
        "type": "warn",
        "text": "No crees una cuenta de usuario para dar de alta a un prospecto. No compartas una misma cuenta entre asesores."
      },
      {
        "type": "links",
        "ids": [
          "roles-permisos",
          "equipos-administrar",
          "agenda-equipo"
        ]
      }
    ]
  },
  {
    "id": "equipos-administrar",
    "category": "equipo",
    "title": "Editar usuarios y mantener el equipo al día",
    "summary": "Revisa roles, acceso y recuperación de cuentas con los controles de administración.",
    "where": "Usuarios → persona",
    "access": "Administradores autorizados",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Busca la persona por nombre o correo en Usuarios.",
          "Abre Editar y modifica únicamente los campos necesarios.",
          "Comprueba el rol y estado de acceso antes de guardar.",
          "Para recuperar el acceso, usa Restablecer contraseña cuando tu rol ofrezca esa acción, o la recuperación por correo.",
          "Antes de desactivar una cuenta, revisa con tu empresa quién atenderá sus clientes y pendientes."
        ]
      },
      {
        "type": "tip",
        "text": "Un cambio de usuario no equivale automáticamente a reasignar su cartera. Revisa clientes, próximas acciones y actividades del equipo por separado."
      },
      {
        "type": "links",
        "ids": [
          "asignar-cliente-otro-asesor",
          "equipos-acciones"
        ]
      }
    ]
  },
  {
    "id": "roles-permisos",
    "category": "equipo",
    "title": "Entender roles, alcance y separación entre empresas",
    "summary": "Distingue permisos de ventas, dirección, marketing y colaboración.",
    "where": "Usuarios, menú y pantallas del sistema",
    "access": "Según el rol asignado",
    "tags": [],
    "content": [
      {
        "type": "list",
        "items": [
          "Asesor: trabaja su cartera y las herramientas habilitadas para su puesto.",
          "Director: supervisa el alcance de equipo que tiene autorizado.",
          "Admin: administra usuarios y configuración de su organización según su alcance.",
          "CEO y dirección: consultan indicadores y herramientas directivas habilitadas.",
          "Marketing: usa sus actividades, marcas, solicitudes y funciones de su área; no implica acceso al CRM de ventas.",
          "Colaborador: trabaja planes, agenda y herramientas de su área según la configuración.",
          "Super admin: funciones de administración de plataforma expresamente autorizadas. El rol no convierte el Copilot de una empresa en el de otra."
        ]
      },
      {
        "type": "p",
        "text": "Los permisos de servidor y la pertenencia a la organización determinan el acceso. El menú también se adapta a los módulos habilitados. Si necesitas acceso, pide al administrador que revise tu cuenta."
      },
      {
        "type": "warn",
        "text": "Si ves información que parece de otra empresa, no la edites ni la compartas. Reporta la pantalla y hora al soporte para verificar el alcance."
      },
      {
        "type": "links",
        "ids": [
          "pedir-ayuda"
        ]
      }
    ]
  },
  {
    "id": "equipos-acciones",
    "category": "equipo",
    "title": "Delegar actividades y revisar su avance",
    "summary": "Asigna una acción con un responsable y conserva el resultado.",
    "where": "Agenda → Equipo completo o Copilot",
    "access": "Personas con permiso para delegar",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Define qué se debe entregar y a quién corresponde.",
          "Desde Equipo completo crea la actividad con responsable, fecha y prioridad; o dicta el encargo al Copilot.",
          "Si Copilot presenta un plan, revisa nombres, acciones y horarios y confírmalo.",
          "Consulta los pendientes y las completadas para comprobar el avance.",
          "Pide contexto o evidencia de la entrega cuando tu proceso lo requiera."
        ]
      },
      {
        "type": "ex",
        "items": [
          "Crea una actividad para Ana: revisar la propuesta del proyecto, mañana a las 10 de la mañana."
        ]
      },
      {
        "type": "warn",
        "text": "El responsable debe ser una persona del equipo. El cliente relacionado con la actividad no es el destinatario del recordatorio."
      },
      {
        "type": "links",
        "ids": [
          "agenda-equipo",
          "copilot-plan",
          "comando-indicadores"
        ]
      }
    ]
  },
  {
    "id": "asignar-cliente-otro-asesor",
    "category": "equipo",
    "title": "Pasar un cliente a otro asesor",
    "summary": "Cambia el responsable de la ficha conservando su contexto.",
    "where": "Ficha del cliente → Asesor",
    "access": "Roles autorizados para reasignar",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre al cliente y revisa su negocio y teléfono.",
          "Selecciona al asesor de destino en el campo de responsable.",
          "Guarda y espera la confirmación.",
          "Comprueba el nombre del nuevo asesor y revisa la próxima acción.",
          "Comunica el contexto del caso por el canal de tu equipo, si hace falta."
        ]
      },
      {
        "type": "ex",
        "items": [
          "Asigna a Mariana López a Ana y conserva su etapa y próxima acción."
        ]
      },
      {
        "type": "tip",
        "text": "Consulta también las actividades de equipo vinculadas al caso: cambiar el asesor del cliente no sustituye revisar encargos asignados por separado."
      },
      {
        "type": "links",
        "ids": [
          "historial-cambios"
        ]
      }
    ]
  },
  {
    "id": "copilot-que-es",
    "category": "copilot",
    "title": "Qué es Copilot y desde dónde usarlo",
    "summary": "El asistente de tu cuenta para consultar y operar las funciones habilitadas.",
    "where": "Menú → Copilot",
    "access": "Usuarios con Copilot habilitado",
    "tags": [],
    "content": [
      {
        "type": "p",
        "text": "Copilot permite escribir o dictar solicitudes con tus palabras. Usa la identidad de tu sesión y los permisos de tu organización. No necesitas conectar Telegram para usar el chat del CRM."
      },
      {
        "type": "list",
        "items": [
          "Ventas: altas, notas, etapas, próximas acciones, consultas y catálogo disponible.",
          "Trabajo del equipo: planes y actividades según el rol y el motor habilitado.",
          "Consultas: datos a los que tienes acceso y el contexto registrado.",
          "Historial: mensajes y resultados visibles de tus solicitudes."
        ]
      },
      {
        "type": "tip",
        "text": "Las capacidades de ventas, marketing y proyectos pueden ser diferentes. Una respuesta redactada por IA no prueba que haya enviado un mensaje a un tercero o ejecutado una acción externa."
      },
      {
        "type": "links",
        "ids": [
          "copilot-confirmaciones",
          "copilot-como-hablarle",
          "copilot-audios"
        ]
      }
    ]
  },
  {
    "id": "copilot-como-hablarle",
    "category": "copilot",
    "title": "Pedir una acción con tus propias palabras",
    "summary": "Di qué necesitas y aporta el contexto que ayuda a identificar el destino.",
    "where": "Copilot → cuadro de mensaje",
    "access": "Usuarios con Copilot habilitado",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Escribe o dicta tu solicitud con el nombre del cliente o responsable.",
          "Indica el negocio o pipeline si hay varios, y la etapa o fecha cuando aplique.",
          "Si pide un dato concreto, responde a esa pregunta; puedes corregir el borrador con tus palabras.",
          "Revisa el resultado que confirma lo guardado."
        ]
      },
      {
        "type": "ex",
        "items": [
          "Da de alta a Daniel Robles como prospecto en bienes raíces. Está interesado en un departamento de inversión en la zona centro. Falta revisar las condiciones de entrega.",
          "El segundo apellido es Montes. Déjalo en Contactado.",
          "El presupuesto es de 18,500 pesos mexicanos al mes, para renta."
        ]
      },
      {
        "type": "tip",
        "text": "No necesitas hablar perfecto ni usar comandos. Si una cifra o un nombre quedó distinto, corrígelo antes de confirmar."
      },
      {
        "type": "links",
        "ids": [
          "copilot-contexto",
          "copilot-confirmaciones"
        ]
      }
    ]
  },
  {
    "id": "copilot-registrar",
    "category": "copilot",
    "title": "Registrar y actualizar clientes desde Copilot",
    "summary": "Prepara el alta, corrige los datos y confirma el guardado.",
    "where": "Copilot → mensaje de texto o audio",
    "access": "Usuarios con permiso sobre el CRM",
    "tags": [
      "varios clientes",
      "lista",
      "lote"
    ],
    "content": [
      {
        "type": "steps",
        "items": [
          "Indica el nombre, contacto disponible, negocio, etapa y contexto del cliente.",
          "Revisa el borrador que te muestra: nombre, teléfono, moneda y etapa.",
          "Aporta o corrige datos en el mismo chat. Los campos opcionales pueden completarse después si el borrador permite continuar.",
          "Pulsa Sí, confirmar o responde sí, registrar cuando el alta esté pendiente de confirmación.",
          "Espera el resultado final y abre Ver ficha para comprobarlo."
        ]
      },
      {
        "type": "p",
        "text": "Para una actualización, menciona al cliente y el cambio: agregar nota, corregir nombre, actualizar presupuesto o mover etapa. Si hay varias fichas coincidentes, identifica la correcta."
      },
      {
        "type": "warn",
        "text": "Un resumen que dice Voy a registrar es un borrador. El alta termina cuando aparece un resultado de guardado y la ficha existe en el CRM."
      },
      {
        "type": "links",
        "ids": [
          "copilot-confirmaciones",
          "clientes-varios-negocios",
          "mover-etapa-pipeline"
        ]
      },
      {
        "type": "heading",
        "text": "Registrar varios clientes de una vez"
      },
      {
        "type": "p",
        "text": "Puedes pegar una lista con una persona por línea e indicar su nombre y teléfono, más los datos de negocio o contexto disponibles. Revisa el resumen y el resultado de cada registro. Si detecta un contacto existente, comprueba la ficha y el negocio antes de crear o reasignar otra oportunidad."
      }
    ]
  },
  {
    "id": "copilot-confirmaciones",
    "category": "copilot",
    "title": "Distinguir borrador, solicitud en curso y resultado",
    "summary": "Comprueba si el asistente terminó la acción o necesita una respuesta.",
    "where": "Copilot → mensajes de la solicitud",
    "access": "Todos los usuarios del asistente",
    "tags": [
      "si",
      "confirmar",
      "acuse",
      "no responde",
      "registrar"
    ],
    "content": [
      {
        "type": "list",
        "items": [
          "Voy a registrar / ¿Confirmas?: revisa el borrador; aún falta tu confirmación.",
          "Estoy atendiendo tu solicitud: es un acuse de recepción, todavía no es el resultado.",
          "Registré / Actualicé / Listo, con los datos de la operación: revisa el resultado y usa Ver ficha o Agenda para comprobarlo.",
          "Mensaje de error o conexión: conserva tu solicitud y sigue las indicaciones del aviso. No asumas que se guardó ni que se perdió."
        ]
      },
      {
        "type": "steps",
        "items": [
          "Si te pregunta por un dato, responde ese dato. Un sí no sustituye un número de teléfono o una fecha que falta.",
          "Si pide confirmar un borrador correcto, pulsa el botón o responde sí.",
          "Si el resultado tarda, consulta el estado disponible o la ficha antes de repetir una operación de alta.",
          "Si solo queda el acuse o no hay respuesta, reporta la hora y la solicitud al soporte."
        ]
      },
      {
        "type": "links",
        "ids": [
          "soporte-audio-conexion",
          "historial-cambios"
        ]
      }
    ]
  },
  {
    "id": "copilot-contexto",
    "category": "copilot",
    "title": "Corregir nombres, monedas y referencias en la conversación",
    "summary": "Mantén claro a quién se refiere una corrección y qué dato cambia.",
    "where": "Copilot → conversación actual",
    "access": "Usuarios del asistente",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Identifica al cliente cuando cambias de tema o retomas una conversación antigua.",
          "Para una corrección, di el dato completo: el apellido correcto es…, el presupuesto es… pesos mexicanos.",
          "Distingue cliente y responsable: Lucía es la cliente; el recordatorio es para mí.",
          "Si quieres dos fichas en dos negocios, pide conservar la original y crear la otra.",
          "Revisa el resumen y la ficha final, especialmente cifras, teléfono, moneda y etapa."
        ]
      },
      {
        "type": "ex",
        "items": [
          "Para Daniel Robles: el segundo apellido es Montes. Cambia solo ese dato.",
          "Lucía es una cliente, no una integrante del equipo. La actividad es para mí.",
          "Mantén el registro de servicios y crea además la oportunidad de bienes raíces."
        ]
      },
      {
        "type": "tip",
        "text": "Un mensaje largo puede contener contexto y más de una acción. Comprueba que el resultado enumera las acciones solicitadas; si falta una, indícala con el cliente y destino."
      }
    ]
  },
  {
    "id": "copilot-audios",
    "category": "copilot",
    "title": "Grabar y enviar un audio",
    "summary": "Dicta la solicitud y revisa que el envío y la transcripción terminaron.",
    "where": "Copilot → micrófono",
    "access": "Micrófono permitido y transcripción disponible",
    "tags": [
      "voz",
      "nota de voz",
      "microfono",
      "transcripción"
    ],
    "content": [
      {
        "type": "steps",
        "items": [
          "Toca el micrófono y permite el acceso cuando quieras grabar.",
          "Habla a un ritmo cómodo y di nombres, cantidades y fechas con claridad.",
          "Detén la grabación y envía según los controles de la pantalla.",
          "Espera la transcripción o el resultado. Revisa nombres propios, teléfonos y moneda.",
          "Si detectas un error de transcripción, corrige el texto en el chat antes de confirmar la acción."
        ]
      },
      {
        "type": "warn",
        "text": "Un audio grabado no es una acción guardada. Si aparece error de carga o transcripción, conserva el mensaje y comprueba el estado antes de reintentar. Usa el teléfono solo cuando estés detenido y sea seguro."
      },
      {
        "type": "links",
        "ids": [
          "soporte-audio-conexion",
          "copilot-confirmaciones"
        ]
      }
    ]
  },
  {
    "id": "copilot-consultar",
    "category": "copilot",
    "title": "Consultar cartera, agenda y números",
    "summary": "Haz preguntas concretas sobre los datos disponibles de tu cuenta.",
    "where": "Copilot",
    "access": "Tu alcance de cartera o equipo",
    "tags": [],
    "content": [
      {
        "type": "ex",
        "items": [
          "Muéstrame mis clientes y su próxima acción.",
          "¿Qué tengo hoy en mi agenda?",
          "Busca la ficha de Elena.",
          "¿Cuántos clientes tengo por etapa?",
          "Muéstrame los pendientes de Ana."
        ]
      },
      {
        "type": "p",
        "text": "Las consultas de otras personas requieren permisos de supervisión. Un nombre de cliente no se interpreta como un integrante del equipo: si hay dudas, aclara qué tipo de registro buscas."
      },
      {
        "type": "tip",
        "text": "Revisa el período y el alcance de la respuesta. Un total de tu cartera y uno de toda la empresa pueden ser diferentes."
      },
      {
        "type": "links",
        "ids": [
          "buscar-cliente",
          "ver-dashboard"
        ]
      }
    ]
  },
  {
    "id": "copilot-agendar",
    "category": "copilot",
    "title": "Agendar citas, visitas y recordatorios",
    "summary": "Indica acción, destinatario, día y hora; verifica la fecha final.",
    "where": "Copilot",
    "access": "Usuarios autorizados para crear la actividad",
    "tags": [],
    "content": [
      {
        "type": "ex",
        "items": [
          "Agenda la cita con Elena el viernes a las 11 de la mañana.",
          "Recuérdame revisar con Clara la visita de Daniel en dos horas. Es para mí.",
          "Cambia esa actividad al martes 17 de noviembre a las 9 de la mañana."
        ]
      },
      {
        "type": "steps",
        "items": [
          "Di qué se debe hacer y con qué cliente se relaciona, si aplica.",
          "Indica cuándo y para quién es el aviso.",
          "Si corrige o pregunta una fecha, revisa el día, el mes, el año y la hora que muestra.",
          "Confirma el borrador cuando lo solicite.",
          "Comprueba la actividad guardada en Agenda o la próxima acción en la ficha."
        ]
      },
      {
        "type": "warn",
        "text": "Una cita registrada en el CRM no implica que se haya creado un enlace de videollamada, invitación externa o mensaje de WhatsApp. Esas acciones necesitan la integración correspondiente y su confirmación."
      },
      {
        "type": "links",
        "ids": [
          "perfil-zona-horaria",
          "agenda-recordatorios"
        ]
      }
    ]
  },
  {
    "id": "copilot-plan",
    "category": "copilot",
    "title": "Dictar un plan con varias actividades",
    "summary": "Revisa cada acción, responsable y fecha antes de registrar el lote.",
    "where": "Copilot → plan de actividades",
    "access": "Según los permisos de asignación",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Dicta las actividades separando qué debe hacer cada persona y para cuándo.",
          "Revisa la lista propuesta por Copilot: una acción debe tener su responsable y vencimiento correctos.",
          "Corrige cualquier nombre, título, prioridad o fecha que falte.",
          "Confirma cuando el plan esté correcto.",
          "Revisa el resultado y las actividades registradas en la agenda correspondiente."
        ]
      },
      {
        "type": "ex",
        "items": [
          "Para mañana: yo reviso el contrato a las 9; Ana prepara el portafolio a las 11. Muéstrame el plan antes de registrarlo."
        ]
      },
      {
        "type": "tip",
        "text": "No confundas un plan dictado de actividades con la hoja del módulo Plan Semanal. Consulta ese módulo para sus bloques de horario."
      },
      {
        "type": "links",
        "ids": [
          "plan-semanal",
          "equipos-acciones"
        ]
      }
    ]
  },
  {
    "id": "copilot-catalogo",
    "category": "copilot",
    "title": "Buscar catálogo, material y recomendaciones",
    "summary": "Consulta las propiedades cargadas por tu empresa y sus enlaces disponibles.",
    "where": "Copilot → catálogo y recomendaciones",
    "access": "Con catálogo inmobiliario habilitado",
    "tags": [],
    "content": [
      {
        "type": "ex",
        "items": [
          "Muéstrame propiedades en Cancún por menos de 200 mil dólares.",
          "Dame la carpeta de material del proyecto que acabamos de revisar.",
          "¿Qué opciones encajan con el presupuesto y la zona de Mariana?"
        ]
      },
      {
        "type": "p",
        "text": "Indica moneda, zona y criterios relevantes. La recomendación se apoya en los datos registrados del cliente y en el catálogo disponible. Verifica precios, disponibilidad y condiciones con el responsable antes de ofrecer una propiedad."
      },
      {
        "type": "links",
        "ids": [
          "proyectos-catalogo",
          "create-landings"
        ]
      }
    ]
  },
  {
    "id": "copilot-avisos",
    "category": "copilot",
    "title": "Entender avisos automáticos del asistente",
    "summary": "Preparación de citas, pendientes y señales para revisar tu cartera.",
    "where": "Copilot y canales de notificación habilitados",
    "access": "Según la configuración de tu empresa",
    "tags": [],
    "content": [
      {
        "type": "list",
        "items": [
          "Preparación de reuniones: contexto del cliente y recordatorios de la cita.",
          "Próximas acciones y actividades: avisos para atender o reportar el resultado.",
          "Cartera sin movimiento: señales para retomar el contacto.",
          "Seguimientos: preguntas sobre una actividad pendiente, con los controles disponibles para responder."
        ]
      },
      {
        "type": "p",
        "text": "Cada organización define qué avisos utiliza y sus horarios. Una sugerencia de mensaje no se envía al cliente solo por mostrarse en Copilot."
      },
      {
        "type": "links",
        "ids": [
          "agenda-recordatorios",
          "avisos-configurar",
          "notificaciones-telefono"
        ]
      }
    ]
  },
  {
    "id": "copilot-admin",
    "category": "copilot",
    "title": "Usar Copilot para supervisar el equipo",
    "summary": "Consulta el alcance autorizado y delega con responsables claros.",
    "where": "Copilot",
    "access": "Administración o dirección según permisos",
    "tags": [],
    "content": [
      {
        "type": "ex",
        "items": [
          "Muéstrame la cartera de Ana.",
          "¿Qué pendientes tiene el equipo para hoy?",
          "Asigna este cliente a Ana.",
          "Crea una actividad para Ana: confirmar la visita mañana a las 10."
        ]
      },
      {
        "type": "steps",
        "items": [
          "Identifica el nombre del asesor o responsable.",
          "Revisa el alcance y período de la respuesta.",
          "Para una acción de escritura, comprueba persona, cliente y fecha en el borrador.",
          "Confirma y verifica el resultado en CRM o Agenda."
        ]
      },
      {
        "type": "warn",
        "text": "Los permisos del Copilot corresponden a tu cuenta y empresa. Si no puedes consultar un registro, solicita revisión al administrador en vez de compartir credenciales."
      },
      {
        "type": "links",
        "ids": [
          "roles-permisos",
          "equipos-acciones"
        ]
      }
    ]
  },
  {
    "id": "mi-espacio-que-es",
    "category": "espacio",
    "title": "Usar Space: agenda, documentos y estrategia",
    "summary": "Encuentra tu trabajo y las referencias de la organización.",
    "where": "Menú → Space o acceso a Mi Espacio",
    "access": "Según tu cuenta y configuración",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Space. En algunas cuentas el acceso conserva el nombre Mi Espacio.",
          "En Agenda, consulta pendientes personales y profesionales.",
          "En Documentos, abre los enlaces de referencia de tu equipo.",
          "En Strategy, consulta el Plan estratégico y el Protocolo, cuando esas pestañas estén disponibles."
        ]
      },
      {
        "type": "p",
        "text": "Agenda tiene también una entrada propia en el menú. Es otra puerta a las actividades, no una cuenta distinta."
      },
      {
        "type": "links",
        "ids": [
          "agenda-crear",
          "documentos-equipo",
          "espacio-estrategia",
          "protocolo-ventas"
        ]
      }
    ]
  },
  {
    "id": "documentos-equipo",
    "category": "espacio",
    "title": "Abrir y agregar Documentos del Equipo",
    "summary": "Centraliza enlaces y abre el material desde Space.",
    "where": "Space → Documentos",
    "access": "Lectura para el equipo autorizado; edición según rol",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Space → Documentos.",
          "Selecciona el documento para abrir su enlace. Puede ser un archivo de Drive u otra herramienta.",
          "Si tienes permiso para agregar, pega el enlace, escribe un nombre si hace falta y usa el control de registro.",
          "Abre el enlace guardado y comprueba que el equipo puede acceder con su cuenta."
        ]
      },
      {
        "type": "warn",
        "text": "Guardar un enlace en Stratos no concede permisos en Google Drive u otro servicio. Revisa quién puede abrirlo y evita publicar documentos privados."
      },
      {
        "type": "tip",
        "text": "Actualiza la referencia cuando cambie la versión. La creación y el archivado automático de informes dependen del flujo utilizado; comprueba que el documento aparece antes de darlo por archivado."
      },
      {
        "type": "links",
        "ids": [
          "mi-drive",
          "clientes-documentos"
        ]
      }
    ]
  },
  {
    "id": "espacio-estrategia",
    "category": "espacio",
    "title": "Consultar y editar el Plan estratégico",
    "summary": "Revisa objetivos y prioridades sin confundirlos con las tareas diarias.",
    "where": "Space → Strategy → Plan estratégico",
    "access": "Consulta y edición según rol",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Strategy y selecciona Plan estratégico.",
          "Consulta los objetivos, metas y prioridades que haya definido tu organización.",
          "Si tu rol puede editar, usa los campos de edición disponibles.",
          "Espera la confirmación de guardado de la configuración.",
          "Convierte los compromisos operativos en actividades con responsable y fecha en Agenda."
        ]
      },
      {
        "type": "tip",
        "text": "Una meta escrita en Strategy no crea por sí sola todas las actividades para cumplirla. Usa Agenda o el módulo de proyectos para el trabajo concreto."
      },
      {
        "type": "links",
        "ids": [
          "agenda-equipo",
          "plan-semanal"
        ]
      }
    ]
  },
  {
    "id": "protocolo-ventas",
    "category": "espacio",
    "title": "Consultar el Protocolo de Ventas",
    "summary": "Usa los criterios de tu empresa para avanzar clientes y registrar información.",
    "where": "Space → Strategy → Protocolo",
    "access": "Usuarios con acceso a Space",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Strategy y después Protocolo.",
          "Busca la etapa o situación del cliente.",
          "Revisa los criterios de avance, información requerida y tiempos establecidos por tu empresa.",
          "Completa el expediente y deja la siguiente acción conforme a ese proceso."
        ]
      },
      {
        "type": "p",
        "text": "Los procesos pueden incluir presupuesto, necesidad, decisión, plazo y financiamiento. Las etapas y tiempos específicos de una empresa no se aplican automáticamente a otra."
      },
      {
        "type": "links",
        "ids": [
          "etapas-pipeline-significado",
          "proceso-guiado"
        ]
      }
    ]
  },
  {
    "id": "plan-semanal",
    "category": "plan",
    "title": "Completar tu Plan Semanal",
    "summary": "Organiza la semana por bloques, notas y prioridades.",
    "where": "Menú → Plan Semanal",
    "access": "Roles y empresas con este módulo habilitado",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Plan Semanal y selecciona la semana con las flechas de navegación.",
          "Completa las actividades en los bloques del día y horario correspondiente.",
          "Agrega notas para el contexto de la semana.",
          "Añade las tareas prioritarias y marca las terminadas cuando corresponda.",
          "Espera el estado de guardado; si hay un error, conserva el contenido y usa Reintentar."
        ]
      },
      {
        "type": "tip",
        "text": "La hoja semanal organiza el plan. Para recibir avisos de una actividad de un bloque, usa su botón Mandar a mi agenda cuando esté disponible."
      },
      {
        "type": "links",
        "ids": [
          "plan-semanal-agenda",
          "agenda-crear"
        ]
      }
    ]
  },
  {
    "id": "plan-semanal-agenda",
    "category": "plan",
    "title": "Llevar un bloque a Agenda y revisar planes del equipo",
    "summary": "Convierte una actividad del plan en pendiente con recordatorios.",
    "where": "Plan Semanal → control del bloque",
    "access": "Titular del plan; revisión de equipo según rol",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Escribe una actividad concreta en un bloque de tu plan.",
          "Pulsa Mandar a mi agenda junto a ese bloque.",
          "Comprueba la actividad y su horario en Agenda. El control indica cuando ya está agendada.",
          "Si supervisas al equipo, utiliza Revisar el plan de para elegir a la persona disponible.",
          "Comprueba si estás en tu plan o en una vista de revisión antes de editar."
        ]
      },
      {
        "type": "warn",
        "text": "Escribir o completar un bloque y actualizar una actividad de Agenda son acciones distintas. Revisa ambos lugares si cambias el plan después de enviarlo."
      },
      {
        "type": "links",
        "ids": [
          "agenda-editar"
        ]
      }
    ]
  },
  {
    "id": "whatsapp-bandeja",
    "category": "whatsapp",
    "title": "Leer y responder WhatsApp desde el CRM",
    "summary": "Consulta la bandeja y verifica el estado de cada envío.",
    "where": "Menú → WhatsApp o ficha → chat",
    "access": "Con número e integración habilitados y acceso a la conversación",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre WhatsApp y revisa la lista de conversaciones.",
          "Usa los filtros o la búsqueda disponibles para encontrar el chat.",
          "Comprueba el teléfono y cliente antes de escribir.",
          "Envía el mensaje y espera el estado que muestra la conversación.",
          "Si aparece un error, revisa la causa antes de volver a enviarlo."
        ]
      },
      {
        "type": "p",
        "text": "La bandeja presenta las conversaciones autorizadas para tu cuenta. Los mensajes disponibles dependen de la conexión del número de empresa; no importa automáticamente todos los chats privados de tu teléfono."
      },
      {
        "type": "links",
        "ids": [
          "whatsapp-multimedia",
          "whatsapp-conectar",
          "whatsapp-plantillas"
        ]
      }
    ]
  },
  {
    "id": "whatsapp-multimedia",
    "category": "whatsapp",
    "title": "Enviar y abrir archivos, imágenes y audios",
    "summary": "Usa los adjuntos disponibles y comprueba la carga antes del envío.",
    "where": "WhatsApp → conversación",
    "access": "Con multimedia habilitada en el canal",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre el chat correcto.",
          "Usa Adjuntar para elegir el archivo o el control de micrófono si está disponible.",
          "Revisa la vista previa y envía.",
          "Espera el estado del mensaje y abre el adjunto para verificarlo cuando haga falta."
        ]
      },
      {
        "type": "tip",
        "text": "Los tipos y tamaños permitidos dependen del canal. Si un audio o archivo no carga, guarda el original y reporta el error; no asumas que el destinatario lo recibió."
      },
      {
        "type": "links",
        "ids": [
          "soporte-audio-conexion"
        ]
      }
    ]
  },
  {
    "id": "whatsapp-plantillas",
    "category": "whatsapp",
    "title": "Entender la ventana de atención y las plantillas",
    "summary": "Sigue las opciones que ofrece tu canal para iniciar o retomar un contacto.",
    "where": "WhatsApp → conversación",
    "access": "Según el proveedor conectado y los permisos",
    "tags": [],
    "content": [
      {
        "type": "p",
        "text": "En integraciones de WhatsApp Business puede requerirse una plantilla aprobada para iniciar una conversación o escribir fuera de la ventana de atención. El canal y su estado determinan qué opciones están disponibles."
      },
      {
        "type": "steps",
        "items": [
          "Abre la conversación y revisa si permite texto libre.",
          "Si solicita plantilla, selecciona una disponible y completa sus variables.",
          "Revisa destinatario y contenido antes de enviar.",
          "Comprueba el estado del mensaje. Si el canal rechaza el envío, conserva el motivo para soporte."
        ]
      },
      {
        "type": "warn",
        "text": "Un botón que abre WhatsApp para compartir un enlace prepara el mensaje; el envío se completa en WhatsApp. No es el mismo flujo que la bandeja integrada."
      },
      {
        "type": "links",
        "ids": [
          "whatsapp-conectar"
        ]
      }
    ]
  },
  {
    "id": "whatsapp-conectar",
    "category": "whatsapp",
    "title": "Conectar el número de WhatsApp de tu empresa",
    "summary": "Revisa la configuración del canal antes de operar conversaciones.",
    "where": "Conectar WhatsApp o administración de canales",
    "access": "Administradores autorizados",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre la configuración de WhatsApp disponible para tu empresa.",
          "Revisa el estado del número y del proveedor.",
          "Si está habilitada la conexión por Meta, utiliza Conectar y sigue el flujo con la cuenta empresarial autorizada.",
          "Si no está disponible o tu empresa usa otro proveedor, solicita la configuración al administrador o soporte.",
          "Antes de usarlo con clientes, comprueba una conversación de prueba autorizada de entrada y salida."
        ]
      },
      {
        "type": "warn",
        "text": "Conectar un número puede requerir permisos y condiciones del proveedor. No desconectes el número ni cambies credenciales para resolver un fallo de envío sin revisar el impacto con tu administrador."
      }
    ]
  },
  {
    "id": "chat-equipo",
    "category": "chat",
    "title": "Conversar con el equipo dentro de Stratos",
    "summary": "Usa canales, respuestas y adjuntos en el chat interno.",
    "where": "Menú → Chat",
    "access": "Organizaciones con chat del equipo habilitado",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Chat y elige un canal de tu organización.",
          "Escribe el mensaje y envíalo.",
          "Usa Responder sobre un mensaje para mantener el contexto.",
          "Adjunta archivos con el control disponible y espera la carga.",
          "Para crear un canal, usa Nuevo canal si aparece, escribe nombre y descripción y confirma."
        ]
      },
      {
        "type": "p",
        "text": "Chat es la conversación interna del equipo. WhatsApp es el canal de atención a clientes; Copilot es el asistente que consulta u opera acciones."
      },
      {
        "type": "tip",
        "text": "Un mensaje al equipo no se convierte automáticamente en tarea. Registra el encargo en Agenda cuando necesite responsable, vencimiento y seguimiento."
      },
      {
        "type": "links",
        "ids": [
          "equipos-acciones",
          "whatsapp-bandeja"
        ]
      }
    ]
  },
  {
    "id": "proyectos-catalogo",
    "category": "proyectos",
    "title": "Buscar proyectos y abrir su material",
    "summary": "Consulta el catálogo inmobiliario, filtra opciones y revisa los enlaces.",
    "where": "Menú → Proyectos, cuando muestra el catálogo",
    "access": "Usuarios con catálogo habilitado",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Proyectos y busca por nombre o ubicación.",
          "Aplica los filtros de zona y rango de precio disponibles.",
          "Cambia entre Tarjetas y Tabla según prefieras.",
          "Abre la ficha y revisa descripción, ubicación, precio y moneda.",
          "Usa los enlaces de Drive o Maps cuando estén disponibles."
        ]
      },
      {
        "type": "tip",
        "text": "El material pertenece al catálogo de tu organización. Confirma vigencia, disponibilidad y condiciones antes de compartir una oferta."
      },
      {
        "type": "links",
        "ids": [
          "proyectos-administrar",
          "copilot-catalogo",
          "create-landings"
        ]
      }
    ]
  },
  {
    "id": "proyectos-administrar",
    "category": "proyectos",
    "title": "Mantener el catálogo y distinguir los tableros de trabajo",
    "summary": "Reconoce qué módulo de proyectos tiene tu organización.",
    "where": "Proyectos o configuración de catálogo",
    "access": "Según módulo y rol",
    "tags": [],
    "content": [
      {
        "type": "p",
        "text": "Proyectos puede presentar un catálogo inmobiliario o un sistema de proyectos y tareas. Usa el título y los controles de tu pantalla para reconocerlo."
      },
      {
        "type": "list",
        "items": [
          "Catálogo inmobiliario: consulta fichas, precios, ubicación y material. Si tienes edición de catálogo, revisa sus campos y publica los cambios con el control disponible.",
          "Proyectos de trabajo: organiza tareas, responsables y entregas mediante el módulo habilitado para tu empresa.",
          "Tablero Kanban de I Space: ofrece proyectos, tareas y revisión semanal en las cuentas configuradas para ese tablero."
        ]
      },
      {
        "type": "links",
        "ids": [
          "proyectos-tablero",
          "marketing-actividades"
        ]
      },
      {
        "type": "warn",
        "text": "El manual explica las variantes disponibles; no activa el tablero de otra organización ni comparte sus proyectos."
      }
    ]
  },
  {
    "id": "proyectos-tablero",
    "category": "proyectos",
    "title": "Trabajar en proyectos, tareas y Kanban",
    "summary": "Organiza responsables, fechas, checklist, evidencia y bloqueos.",
    "where": "Proyectos → Kanban, donde está habilitado",
    "access": "Miembros autorizados del tablero",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Crea o abre un proyecto y define su resultado y fecha objetivo.",
          "Agrega una tarea con título, responsable, proyecto y fecha.",
          "Completa checklist, notas y enlace de evidencia cuando sean necesarios.",
          "Cambia el estado con el selector o arrastra la tarjeta.",
          "Registra bloqueos o dependencias; resuélvelos antes de avanzar cuando el tablero lo exija.",
          "Marca hecha al cumplir el checklist y comprobar la entrega."
        ]
      },
      {
        "type": "p",
        "text": "La revisión semanal permite repasar resultados, evidencia, bloqueos y próximo foco. Preparar revisión crea un borrador que debes guardar. Un aviso de capacidad orienta la carga de trabajo."
      },
      {
        "type": "tip",
        "text": "Si el tablero avisa que otra persona modificó la tarea, conserva tu borrador, actualiza y vuelve a abrirla. No sobrescribas sin revisar el cambio."
      },
      {
        "type": "warn",
        "text": "Preparar o copiar un prompt para una herramienta externa no ejecuta el trabajo ni completa la tarjeta."
      },
      {
        "type": "links",
        "ids": [
          "equipos-acciones"
        ]
      }
    ]
  },
  {
    "id": "create-landings",
    "category": "create",
    "title": "Create: preparar un portafolio para un cliente",
    "summary": "Selecciona propiedades y genera una presentación con enlace para compartir.",
    "where": "Menú → Create",
    "access": "Usuarios con Create y catálogo habilitados",
    "tags": [
      "landing",
      "presentación",
      "portafolio"
    ],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Create y elige crear un portafolio.",
          "Indica para quién lo preparas y revisa tus datos de contacto.",
          "Busca y selecciona propiedades del catálogo. El resumen permite ordenar o quitar elementos de la selección.",
          "Revisa la presentación y genera el enlace con el control disponible.",
          "Espera Enlace listo o el resultado de generación.",
          "Copia el enlace o abre el portafolio para comprobarlo antes de compartir."
        ]
      },
      {
        "type": "tip",
        "text": "La selección admite hasta 12 propiedades en este flujo. Si editas el contenido después de generar, crea y revisa el enlace de la nueva versión."
      },
      {
        "type": "warn",
        "text": "Un portafolio publicado se comparte mediante su enlace. Revisa el contenido y evita incluir datos personales o comerciales que no deban quedar en esa presentación."
      },
      {
        "type": "links",
        "ids": [
          "create-compartir",
          "proyectos-catalogo"
        ]
      }
    ]
  },
  {
    "id": "create-compartir",
    "category": "create",
    "title": "Abrir y compartir un portafolio",
    "summary": "Comprueba el entregable y envía el enlace correcto al cliente.",
    "where": "Create → portafolio generado",
    "access": "Autor o usuario autorizado",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre el portafolio desde Create o con el enlace generado.",
          "Revisa las propiedades, el orden y los datos de contacto de la presentación.",
          "Usa Copiar enlace para enviarlo por el canal que elijas.",
          "Si usas Compartir por WhatsApp, revisa y envía el mensaje en la ventana de WhatsApp.",
          "Para otro cliente, utiliza Crear otro portafolio y revisa sus datos."
        ]
      },
      {
        "type": "tip",
        "text": "Compartir una presentación no concede acceso al CRM. El cliente consulta el contenido del enlace, no tu cartera ni tus notas internas."
      }
    ]
  },
  {
    "id": "caja-que-es",
    "category": "caja",
    "title": "Registrar ingresos y egresos en Caja",
    "summary": "Captura movimientos con cuenta, categoría, fecha, moneda y comprobante.",
    "where": "Finanzas → Caja o módulo Caja independiente",
    "access": "Según los permisos financieros de tu empresa",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Finanzas → Caja. En cuentas sin Finanzas, Caja puede aparecer directamente en el menú.",
          "Agrega un movimiento y selecciona ingreso o egreso.",
          "Completa monto, moneda, fecha, cuenta y categoría; indica proyecto u obra si corresponde.",
          "Adjunta el comprobante cuando el formulario lo permita.",
          "Guarda, espera el resultado y busca el movimiento registrado."
        ]
      },
      {
        "type": "warn",
        "text": "Revisa la moneda y el alcance antes de guardar. Los permisos financieros pueden permitir ver o cargar movimientos de formas diferentes; consulta la configuración de tu cuenta."
      },
      {
        "type": "links",
        "ids": [
          "finanzas-resumen",
          "caja-informe"
        ]
      }
    ]
  },
  {
    "id": "finanzas-resumen",
    "category": "caja",
    "title": "Consultar Finanzas, flujo de caja y exportaciones",
    "summary": "Revisa cifras por moneda y descarga los movimientos disponibles.",
    "where": "Finanzas → Resumen, Caja o Flujo de Caja",
    "access": "Personas con acceso financiero autorizado",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Finanzas y selecciona la moneda que quieres analizar.",
          "En Resumen revisa ingresos, egresos y movimientos recientes.",
          "En Caja consulta el detalle y registra movimientos si tienes permiso.",
          "En Flujo de Caja revisa la evolución mensual y su tabla de detalle.",
          "Usa Actualizar para recargar y Exportar CSV cuando haya movimientos disponibles."
        ]
      },
      {
        "type": "warn",
        "text": "No sumes importes de monedas distintas como si fueran equivalentes. Los indicadores corresponden a los movimientos registrados y no sustituyen la contabilidad o conciliación bancaria de tu empresa."
      }
    ]
  },
  {
    "id": "caja-informe",
    "category": "caja",
    "title": "Generar informes de avances y cuentas de cobro",
    "summary": "Prepara documentos a partir del período y datos del flujo habilitado.",
    "where": "Herramientas financieras disponibles en tu cuenta",
    "access": "Solo organizaciones y roles con generación habilitada",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre la herramienta de Informe de avances o Cuenta de cobro disponible.",
          "Selecciona el período y completa los datos solicitados.",
          "Revisa el borrador y las cifras antes de generar el documento.",
          "Descarga el formato ofrecido y comprueba su contenido.",
          "Verifica su referencia en Documentos del Equipo si el flujo incluye archivado."
        ]
      },
      {
        "type": "tip",
        "text": "Estas herramientas no están habilitadas de forma universal. El acceso, formato y archivado dependen de la implementación de tu organización."
      },
      {
        "type": "links",
        "ids": [
          "documentos-equipo"
        ]
      }
    ]
  },
  {
    "id": "comando-indicadores",
    "category": "comando",
    "title": "Consultar Comando y el rendimiento del equipo",
    "summary": "Analiza indicadores con el mismo período y alcance.",
    "where": "Menú → Comando",
    "access": "Dirección y administración autorizadas",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Comando y selecciona la vista disponible para tu empresa.",
          "Elige período y filtros de fecha.",
          "Revisa indicadores de clientes, citas y productividad, según las pestañas habilitadas.",
          "Consulta el detalle por asesor cuando esté disponible.",
          "Descarga el reporte con los controles ofrecidos y revisa el período del archivo."
        ]
      },
      {
        "type": "tip",
        "text": "Una cifra filtrada no siempre coincide con el total de la cartera. Compara el mismo período, criterio y equipo antes de interpretar diferencias."
      },
      {
        "type": "links",
        "ids": [
          "ver-dashboard",
          "historial-cambios"
        ]
      }
    ]
  },
  {
    "id": "ver-dashboard",
    "category": "comando",
    "title": "Leer el resumen del CRM y tus indicadores",
    "summary": "Usa los datos de cartera y prioridades para decidir qué atender.",
    "where": "CRM → indicadores y prioridades",
    "access": "Tu alcance de cartera o equipo",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre CRM y revisa los indicadores de la parte superior.",
          "Comprueba los filtros activos y el alcance del usuario.",
          "Consulta clientes prioritarios y próximas acciones.",
          "Abre la ficha para revisar contexto antes de actuar.",
          "Si necesitas comparar un período o asesor, utiliza los controles de indicadores disponibles."
        ]
      },
      {
        "type": "p",
        "text": "El score es una señal para priorizar clientes con los datos registrados; no garantiza una venta. El valor del pipeline tampoco equivale a ingresos cobrados."
      },
      {
        "type": "links",
        "ids": [
          "copilot-consultar",
          "comando-indicadores"
        ]
      },
      {
        "type": "heading",
        "text": "Organizar clientes en Prioridad"
      },
      {
        "type": "p",
        "text": "El carrusel de Prioridad reúne los clientes destacados para trabajar. Usa el control de posición, el orden disponible o el arrastre cuando se ofrezca. La lista completa del CRM conserva los demás clientes."
      },
      {
        "type": "steps",
        "items": [
          "Abre el cliente de una tarjeta antes de decidir su siguiente acción.",
          "Ajusta su posición de prioridad con el control disponible.",
          "Para sacarlo del carrusel, usa Quitar de prioridad. Esto no elimina su ficha.",
          "Usa la lista y sus filtros para localizar clientes que no aparecen en las tarjetas prioritarias."
        ]
      }
    ]
  },
  {
    "id": "marketing-actividades",
    "category": "marketing",
    "title": "Registrar actividades y trabajo de Marketing",
    "summary": "Reporta avances y opera las secciones habilitadas para tu área.",
    "where": "Marketing o entradas de Actividades, Marcas y Solicitudes",
    "access": "Equipo de marketing y responsables autorizados",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Actividades o el módulo Marketing de tu cuenta.",
          "Registra el trabajo realizado con una descripción concreta.",
          "Asocia marca, propiedad o proyecto cuando el formulario lo solicite.",
          "Consulta solicitudes y actualiza su avance mediante los estados disponibles.",
          "Si supervisas el área, usa la vista Equipo para revisar el avance autorizado."
        ]
      },
      {
        "type": "list",
        "items": [
          "Marcas: referencias y trabajo organizado por marca.",
          "Propiedades: registro de propiedades o producción del área, según la configuración.",
          "Solicitudes: pedidos de trabajo y seguimiento.",
          "Plan Semanal: distribución de la semana para los roles habilitados."
        ]
      },
      {
        "type": "tip",
        "text": "Algunas empresas llaman Proyectos o Actividades al mismo módulo. Sus pantallas y su Copilot son específicos del área; no todas las acciones son las del asistente de ventas."
      },
      {
        "type": "link",
        "text": "Abrir el manual de Marketing",
        "url": "/manual-marketing"
      },
      {
        "type": "links",
        "ids": [
          "plan-semanal",
          "equipos-acciones"
        ]
      }
    ]
  },
  {
    "id": "mi-drive",
    "category": "drive",
    "title": "Abrir Mi Drive y el material de tu área",
    "summary": "Accede a las carpetas enlazadas sin perder de vista sus permisos.",
    "where": "Menú → Mi Drive",
    "access": "Usuarios y áreas con este módulo habilitado",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Mi Drive.",
          "Consulta la carpeta de tu área o la selección de carpetas que permita tu rol.",
          "Si el contenido no se puede mostrar dentro de Stratos, utiliza el enlace para abrirlo en Drive.",
          "Entra a Google con la cuenta que tenga acceso al material."
        ]
      },
      {
        "type": "warn",
        "text": "El acceso al módulo no cambia los permisos del archivo en Drive. Solicita acceso al propietario si el servicio externo lo rechaza; no publiques la carpeta para intentar resolverlo."
      },
      {
        "type": "links",
        "ids": [
          "documentos-equipo",
          "proyectos-catalogo"
        ]
      }
    ]
  },
  {
    "id": "telegram-que-es",
    "category": "telegram",
    "title": "Usar el asistente desde Telegram",
    "summary": "Opera el canal opcional vinculado a tu cuenta de Stratos.",
    "where": "Telegram → bot autorizado por tu empresa",
    "access": "Cuenta vinculada y canal habilitado",
    "tags": [],
    "content": [
      {
        "type": "p",
        "text": "Telegram permite conversar con el asistente desde un chat adicional. El asistente de ventas comparte el núcleo de funciones con Copilot, y conserva los permisos de la cuenta vinculada. Los controles y la disponibilidad pueden variar entre canales."
      },
      {
        "type": "tip",
        "text": "No necesitas conectar Telegram para usar Copilot en Stratos. Usa el bot que indique tu empresa, especialmente si dispone de uno propio."
      },
      {
        "type": "links",
        "ids": [
          "telegram-conectar",
          "telegram-manual-completo"
        ]
      }
    ]
  },
  {
    "id": "telegram-conectar",
    "category": "telegram",
    "title": "Vincular Telegram con tu usuario",
    "summary": "Genera un código en tu perfil y úsalo en el bot correcto.",
    "where": "Perfil → Conectar Telegram",
    "access": "Titular de la cuenta",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Perfil y busca Conectar Telegram.",
          "Consulta el enlace al bot indicado para tu organización y ábrelo en Telegram.",
          "Inicia el bot si lo solicita.",
          "Genera el código de vinculación en Stratos y envíalo al bot.",
          "Espera la confirmación y comprueba que reconoce tu nombre."
        ]
      },
      {
        "type": "warn",
        "text": "El código caduca y es personal. No lo compartas ni lo envíes a otro bot. Si tu cuenta no muestra esta conexión, consulta al administrador."
      },
      {
        "type": "links",
        "ids": [
          "telegram-manual-completo"
        ]
      }
    ]
  },
  {
    "id": "telegram-manual-completo",
    "category": "telegram",
    "title": "Consultar el manual de Telegram",
    "summary": "Amplía los ejemplos y controles del canal de ventas.",
    "where": "Manual público de Telegram",
    "access": "Lectura abierta",
    "tags": [],
    "content": [
      {
        "type": "p",
        "text": "El manual específico de Telegram ofrece ejemplos y explicaciones de sus controles. Comprueba siempre el bot, los módulos y los permisos habilitados para tu empresa."
      },
      {
        "type": "link",
        "text": "Abrir el manual del asistente de Telegram",
        "url": "/manual-asistente-telegram"
      },
      {
        "type": "links",
        "ids": [
          "copilot-como-hablarle",
          "agenda-recordatorios"
        ]
      }
    ]
  },
  {
    "id": "perfil-zona-horaria",
    "category": "ajustes",
    "title": "Configurar Perfil, zona horaria y recuperación",
    "summary": "Revisa los datos personales que usa tu cuenta para operar y recibir avisos.",
    "where": "Menú → Perfil",
    "access": "Titular de la cuenta",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Perfil y revisa tus datos de usuario.",
          "En Zona horaria, selecciona la ciudad o región que corresponda y confirma el cambio.",
          "Revisa los apartados de Contraseña y Correo de recuperación disponibles.",
          "Comprueba las conexiones personales, como Telegram, si están habilitadas."
        ]
      },
      {
        "type": "warn",
        "text": "Una hora de una actividad se interpreta con la zona configurada. Si viajas o agendas para otra ciudad, comprueba la fecha y la hora que confirma Copilot."
      },
      {
        "type": "links",
        "ids": [
          "cambiar-contrasena",
          "notificaciones-telefono"
        ]
      },
      {
        "type": "heading",
        "text": "Eliminar tu cuenta personal"
      },
      {
        "type": "p",
        "text": "Perfil también ofrece Eliminar mi cuenta. Esta acción elimina tu acceso, perfil y notificaciones; los clientes, seguimientos y registros de la empresa permanecen con el equipo."
      },
      {
        "type": "warn",
        "text": "La eliminación personal es permanente. Antes de continuar, coordina la continuidad de tus clientes y tareas. El formulario pide escribir tu correo y confirmar; puedes cancelar antes de la confirmación final. No está disponible en demo o sin conexión."
      }
    ]
  },
  {
    "id": "avisos-configurar",
    "category": "ajustes",
    "title": "Revisar ajustes y canales de recordatorios",
    "summary": "Comprueba cuándo y dónde recibirás los avisos.",
    "where": "Copilot → campana o ajustes de recordatorios",
    "access": "Según el tipo de ajuste y rol",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre los ajustes de avisos o la campana del Copilot cuando estén disponibles.",
          "Revisa canales, horarios y preferencias que tu cuenta permita modificar.",
          "Guarda y comprueba el resultado del ajuste.",
          "Para una política de frecuencia de toda la empresa, solicita al administrador o soporte revisar la configuración de la organización."
        ]
      },
      {
        "type": "p",
        "text": "Los permisos del teléfono, los avisos de Copilot y los de Telegram son controles relacionados pero distintos. Silenciar una notificación del teléfono no completa una tarea."
      },
      {
        "type": "links",
        "ids": [
          "agenda-recordatorios",
          "notificaciones-telefono"
        ]
      }
    ]
  },
  {
    "id": "proceso-guiado",
    "category": "ajustes",
    "title": "Configurar Proceso y trabajar con las acciones sugeridas",
    "summary": "Define el proceso guiado solo si tu organización lo utiliza.",
    "where": "Menú → Proceso",
    "access": "Ajustes para administradores autorizados",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre Proceso cuando esté disponible.",
          "Revisa la configuración actual y prepara los cambios con los controles del editor.",
          "Comprueba las reglas y la vista previa que se ofrece antes de guardar.",
          "Guarda y verifica que la experiencia del equipo corresponde al proceso definido."
        ]
      },
      {
        "type": "p",
        "text": "Para el usuario operativo, las sugerencias del proceso orientan las próximas acciones y prioridades. Registra el resultado real de la interacción antes de avanzar."
      },
      {
        "type": "warn",
        "text": "Cambiar Proceso afecta al modo de trabajo del equipo de tu organización. Revisa el alcance con sus responsables; no es necesario activarlo para usar este manual."
      },
      {
        "type": "links",
        "ids": [
          "protocolo-ventas",
          "pipelines-configurar"
        ]
      }
    ]
  },
  {
    "id": "iagents-canales",
    "category": "ajustes",
    "title": "Revisar iAgents, canales y atención por IA",
    "summary": "Reconoce qué servicios están configurados y cuándo interviene una persona.",
    "where": "Menú → iAgents, si está habilitado",
    "access": "Administración y responsables autorizados",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Abre iAgents y revisa las pestañas Mis Agentes y Canales disponibles.",
          "Comprueba el estado y el alcance del agente antes de utilizarlo con clientes.",
          "Para cambios de comportamiento, revisa la configuración con el responsable de tu empresa.",
          "Realiza una prueba autorizada del canal de entrada y salida antes de darlo por operativo."
        ]
      },
      {
        "type": "warn",
        "text": "La presencia de una ficha de agente no acredita que el servicio esté conectado. Telefonía, WhatsApp, transcripción y otros proveedores necesitan configuración y disponibilidad propias. Un servicio no configurado debe revisarse con soporte."
      }
    ]
  },
  {
    "id": "rrhh-planes",
    "category": "ajustes",
    "title": "Funciones especializadas: RH, nómina y planes",
    "summary": "Identifica las herramientas adicionales que pueda tener tu organización.",
    "where": "Menú de módulos habilitados",
    "access": "Solo roles autorizados",
    "tags": [],
    "content": [
      {
        "type": "list",
        "items": [
          "Stratos RH: según la implementación, ofrece panel, rendimiento, candidatos, vacantes y directorio.",
          "Nómina o herramientas financieras especializadas: disponibles solo en los espacios y roles configurados.",
          "Planes: información de servicios y opciones disponibles en la superficie web habilitada."
        ]
      },
      {
        "type": "steps",
        "items": [
          "Comprueba que el módulo está habilitado para tu empresa.",
          "Revisa la pantalla y el alcance de tu rol antes de cargar información.",
          "Completa los campos requeridos por la herramienta y verifica el resultado.",
          "Para decisiones de acceso, contratación o pagos, sigue el procedimiento de tu empresa y revisa los datos antes de confirmar."
        ]
      },
      {
        "type": "tip",
        "text": "Estas herramientas requieren una implementación específica. Solicita al administrador la guía de tu organización si necesitas sus procedimientos detallados."
      }
    ]
  },
  {
    "id": "actualizar-app",
    "category": "soporte",
    "title": "Actualizar Stratos sin repetir operaciones",
    "summary": "Renueva la página o la app y comprueba qué quedó guardado.",
    "where": "Navegador o tienda de aplicaciones",
    "access": "Todos los usuarios",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Conserva cualquier texto o borrador pendiente antes de actualizar.",
          "En la web, usa el aviso de actualización disponible o recarga la página.",
          "En iPhone o Android, revisa además la actualización oficial de la aplicación.",
          "Vuelve a abrir el módulo y comprueba la ficha o actividad antes de reenviar un alta."
        ]
      },
      {
        "type": "warn",
        "text": "Un aviso de actualización no confirma que una solicitud anterior haya terminado. Si indica que el intento no registró cambios, conserva el mensaje y verifica el estado antes de volver a enviarlo."
      },
      {
        "type": "links",
        "ids": [
          "copilot-confirmaciones",
          "soporte-audio-conexion"
        ]
      }
    ]
  },
  {
    "id": "soporte-audio-conexion",
    "category": "soporte",
    "title": "Si falla un audio, un envío o Copilot no responde",
    "summary": "Conserva la solicitud y comprueba el resultado antes de repetirla.",
    "where": "Copilot, WhatsApp o formulario afectado",
    "access": "Todos los usuarios",
    "tags": [
      "no responde",
      "tokens",
      "saldo",
      "sin conexión",
      "audio",
      "enviando"
    ],
    "content": [
      {
        "type": "steps",
        "items": [
          "Copia el texto o conserva el audio original y anota la hora aproximada.",
          "Lee el aviso: error de conexión, carga, transcripción o solicitud en curso no significan lo mismo.",
          "Comprueba tu conexión. Si es posible, prueba una consulta de lectura sencilla.",
          "Antes de repetir una escritura, busca el cliente o actividad para ver si ya existe.",
          "Si no aparece resultado final, envía al soporte la captura y los datos mínimos para localizar la solicitud."
        ]
      },
      {
        "type": "warn",
        "text": "No borres datos del navegador ni desinstales como primer paso: podrías perder borradores locales. Sin confirmación de guardado, no asumas que el sistema sincronizará automáticamente cualquier operación cuando vuelva internet."
      },
      {
        "type": "tip",
        "text": "Si el servicio está limitado o no disponible, repórtalo. Recargar saldo de un proveedor corresponde al administrador; el usuario no debe compartir claves ni contratar otro servicio para intentar corregirlo."
      },
      {
        "type": "links",
        "ids": [
          "pedir-ayuda",
          "copilot-confirmaciones"
        ]
      }
    ]
  },
  {
    "id": "que-hacer-si-no-funciona",
    "category": "soporte",
    "title": "Si el sistema no carga o no guarda un cambio",
    "summary": "Descarta problemas de conexión y conserva los datos pendientes.",
    "where": "Pantalla o módulo afectado",
    "access": "Todos los usuarios",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Conserva el texto pendiente y una captura del error.",
          "Comprueba la conexión del dispositivo.",
          "Recarga la página o cierra y abre la app después de guardar el borrador.",
          "Comprueba si otros módulos abren y si estás en la empresa correcta.",
          "Si persiste, reporta hora, dispositivo y pasos para reproducirlo."
        ]
      },
      {
        "type": "warn",
        "text": "No todos los módulos permiten trabajar sin conexión. Un dato visible en pantalla puede ser un borrador o una copia local; confirma su guardado antes de contar con él."
      },
      {
        "type": "links",
        "ids": [
          "soporte-audio-conexion",
          "actualizar-app",
          "pedir-ayuda"
        ]
      }
    ]
  },
  {
    "id": "sesion-se-cierra",
    "category": "soporte",
    "title": "Si Stratos te pide iniciar sesión repetidamente",
    "summary": "Comprueba dónde está guardada tu sesión y reporta el patrón.",
    "where": "Inicio de sesión y app",
    "access": "Titular de la cuenta",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Utiliza la misma app o navegador de confianza para tus accesos habituales.",
          "Evita incógnito si quieres conservar la sesión al cerrar.",
          "Comprueba que el navegador no borra automáticamente los datos del sitio.",
          "Si aparece la pantalla de acceso, entra con tu cuenta y revisa si se repite.",
          "Reporta hora y dispositivo si se cierra mientras trabajas."
        ]
      },
      {
        "type": "tip",
        "text": "No es necesario compartir tu contraseña con soporte. Una actualización normal no justifica perder cambios sin aviso."
      },
      {
        "type": "links",
        "ids": [
          "cambiar-contrasena",
          "pedir-ayuda"
        ]
      }
    ]
  },
  {
    "id": "pedir-ayuda",
    "category": "soporte",
    "title": "Pedir ayuda con información útil",
    "summary": "Reporta el caso sin exponer contraseñas ni información innecesaria.",
    "where": "Administrador de tu empresa o soporte de Stratos",
    "access": "Todos los usuarios",
    "tags": [],
    "content": [
      {
        "type": "steps",
        "items": [
          "Explica qué querías hacer y qué ocurrió.",
          "Indica módulo, empresa, fecha, hora aproximada y dispositivo.",
          "Adjunta la captura del aviso y la solicitud original cuando corresponda.",
          "Aclara si la ficha o actividad ya existe, para evitar duplicados.",
          "Oculta contraseñas, códigos y datos personales que no sean necesarios para revisar el caso."
        ]
      },
      {
        "type": "link",
        "text": "Contactar soporte por correo",
        "url": "mailto:info@stratoscapitalgroup.com"
      },
      {
        "type": "tip",
        "text": "También puedes usar el contacto de soporte al final de este manual o el apartado Soporte directo de Perfil."
      }
    ]
  }
];
const FEATURE_GUIDES = {
  "registrar-voz": "copilot-registrar",
  "actualizar-expediente": "agregar-nota-cliente",
  "recomendar": "copilot-catalogo",
  "catalogo": "proyectos-catalogo",
  "agendar-zoom": "copilot-agendar",
  "agendar-visita": "copilot-agendar",
  "mover-etapa": "mover-etapa-pipeline",
  "reasignar": "asignar-cliente-otro-asesor",
  "buscar-ficha": "buscar-cliente",
  "kpis": "ver-dashboard",
  "cartera-asesor": "copilot-admin",
  "recordatorio": "agenda-recordatorios",
  "avisos-telefono": "notificaciones-telefono",
  "briefing": "copilot-avisos",
  "reactivador": "copilot-avisos",
  "score": "ver-dashboard",
  "coach": "agenda-recordatorios"
};
const FEATURE_SECTIONS = INTEL_FEATURES.map(feature => ({
  id: 'fn-' + feature.id,
  category: 'funciones',
  icon: feature.icon,
  title: feature.label,
  summary: feature.id === 'coach' ? 'Revisa actividades pendientes y responde a los avisos de seguimiento.' : feature.tagline,
  tags: [feature.label, 'asistente', 'función'],
  where: feature.kind === 'pedis' ? 'Copilot y canales habilitados' : 'CRM y avisos habilitados',
  access: 'Según los permisos y la configuración de tu organización',
  content: [
    { type: 'p', text: feature.kind === 'pedis'
      ? 'Consulta la guía de esta función para conocer los pasos, ejemplos y cómo verificar el resultado.'
      : 'Esta función utiliza los datos y reglas habilitados para tu empresa. Los avisos requieren sus canales configurados y, en el teléfono, el permiso de notificaciones.' },
    { type: 'links', ids: [FEATURE_GUIDES[feature.id]] },
  ],
}));
const FUNCTION_INDEX = {
  id: 'fn-indice', category: 'funciones', icon: 'LayoutGrid',
  title: 'Todas las funciones, organizadas por módulo',
  summary: 'CRM, Agenda, Equipos, Copilot, Space y las herramientas de trabajo: elige un área y sigue sus guías.',
  where: 'Menú principal de Stratos', access: 'La disponibilidad depende de tu empresa y rol',
  tags: ['funciones', 'todo', 'índice', 'mapa', 'equipos', 'agenda', 'módulos'],
  content: [
    { type: 'p', text: 'Este índice abarca la plataforma completa. Las fichas del Centro de Inteligencia describen las funciones del asistente y son una parte del sistema, no el total de sus herramientas.' },
    { type: 'directory' },
    { type: 'tip', text: 'Si no ves un módulo en tu cuenta, revisa tu rol y la configuración con el administrador. Algunas empresas utilizan nombres o variantes distintos.' },
  ],
};
export const MANUAL_SECTIONS = [...GUIDES.slice(0,8), FUNCTION_INDEX, ...GUIDES.slice(8), ...FEATURE_SECTIONS];
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function contentText(block) {
  return [block.text, block.url, ...(block.items || []).map(item => typeof item === 'string' ? item : [item.title, item.text].join(' '))].filter(Boolean).join(' ');
}
/** Search includes full instructions and ignores accents. Every query word must match. */
export function searchManual(query) {
  const phrase = normalize(query).trim();
  const stopWords = new Set(['como','que','para','con','un','una','el','la','los','las','de','del','en','al','me','mi']);
  const tokens = [...new Set(phrase.split(/\s+/).filter(token => token && !stopWords.has(token)))];
  if (!tokens.length) return MANUAL_SECTIONS;
  return MANUAL_SECTIONS.map(section => {
    const title = normalize(section.title);
    const tags = normalize((section.tags || []).join(' '));
    const haystack = normalize([section.title, section.summary, section.category, CATEGORIES.find(category => category.id === section.category)?.label, section.where, section.access, tags, ...section.content.map(contentText)].join(' '));
    if (!tokens.every(token => haystack.includes(token))) return {section, score: 0};
    const score = (haystack.includes(phrase) ? 20 : 0) + tokens.reduce((sum, token) => sum + 1 + (title.includes(token) ? 6 : 0) + (tags.includes(token) ? 3 : 0), 0);
    return {section, score};
  }).filter(result => result.score > 0).sort((a,b) => b.score - a.score).map(result => result.section);
}
export function exposeManualToWindow(sections = MANUAL_SECTIONS, categories = CATEGORIES, search = searchManual) {
  if (typeof window !== 'undefined') window.__STRATOS_MANUAL__ = {
    version: MANUAL_VERSION, reviewedAt: MANUAL_REVIEWED_AT, categories, sections, search,
  };
}
