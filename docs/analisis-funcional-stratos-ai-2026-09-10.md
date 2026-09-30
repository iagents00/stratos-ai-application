# Análisis funcional de Stratos AI

Fecha: 10 de septiembre de 2026. Fuente principal: código del repositorio local, configuraciones de clientes, migraciones SQL y workflows n8n versionados.

**Dictamen:** Stratos AI tiene un núcleo de CRM comercial con asistencia conversacional, agenda de trabajo, comunicaciones, captación de prospectos y control directivo. También incorpora caja y una adaptación para gestionar obras y licitaciones. La descripción más defendible es **plataforma de gestión comercial y operativa con Copilot, adaptable como ERP ligero por sector**. El código revisado no acredita un ERP contable integral ni que todos los módulos anunciados sean operativos.

Este documento es un inventario funcional, no una certificación de producción. “Conectado” significa que existe una implementación que consulta o escribe datos, no que se haya comprobado su despliegue, permisos, credenciales y funcionamiento extremo a extremo. No se enviaron mensajes, ejecutaron llamadas ni modificaron registros. Hay cambios locales sin confirmar en Git; producción puede diferir. El README contiene información antigua, por lo que se priorizó la implementación.

## Cómo leer el estado

| Estado | Interpretación |
|---|---|
| Conectado | Hay lógica de aplicación y consultas/escrituras a datos o un servicio. |
| Integración condicionada | Hay rutas, herramientas o workflows, pero su ejecución depende de servicios y configuración externos. |
| Local | Funciona en el navegador o con un catálogo incluido; no supone persistencia centralizada. |
| Demostración | Datos fijos, respuestas predefinidas o interacción simulada. |
| Por desarrollar | No encontré un flujo operativo completo que respalde esa capacidad. |

## 1. Copilot: asistente para operar el negocio

Hay tres superficies distintas que no deben confundirse:

- **Copilot web:** chat conectado a funciones de Supabase y un webhook n8n. Requiere que el perfil tenga Telegram vinculado.
- **Bot de Telegram:** entrada de texto, audio e imágenes, memoria de conversación y herramientas de CRM. El workflow versionado incluye transcripción y análisis de imagen.
- **Chat lateral antiguo:** utiliza `getResp()` y respuestas por patrones; la voz simula un mensaje de ejemplo. No equivale al Copilot conectado.

El Copilot web intenta resolver primero comandos mediante funciones de base de datos. Para texto libre recurre a n8n; si no obtiene respuesta directa, consulta el historial. La agenda tiene además una ruta directa para interpretar determinados recordatorios y guardarlos en `team_actions`.

### Consultas y lectura

| Función | Ejemplo de intención | Alcance |
|---|---|---|
| Menú y ayuda | “Qué puedes hacer” | Comandos y orientación operativa. |
| Cartera del asesor | “Mis clientes” | Consulta de registros visibles para el usuario. |
| Agenda | “Qué tengo hoy” | Próximas acciones y pendientes; extensiones para agenda personal/profesional. |
| Indicadores | “Cómo voy”, “kpis” | Métricas personales. |
| Pipeline | “Cuántos tengo por etapa” | Resumen del embudo. |
| Búsqueda | “Busca a María” | Resolución por nombre; existen mejoras de similitud, acentos y teléfono. |
| Ficha del cliente | “Ficha de [teléfono]” | Datos, etapa y contexto del lead. |
| Historial | “Qué pasó con [cliente]” | Actividad cronológica. |
| Expediente | “Notas de [cliente]” | Información registrada en su expediente. |
| Tareas | “Tareas de [cliente]” | Pendientes asociados al registro. |
| Catálogo inmobiliario | “Top 3 en Tulum de dos recámaras” | Búsqueda por texto, zona, presupuesto, tipología y cercanía/vista al mar, según los datos cargados. |
| Material comercial | “Mándame el desarrollo [nombre]” | Enlaces de Drive y Maps cuando existen. |

### Actualización del CRM

El catálogo de herramientas del workflow expone estas operaciones. Varias dependen de funciones originales del dispatcher que las migraciones locales envuelven o modifican, por lo que no se verificó aquí toda su implementación base.

| Función | Qué registra o cambia |
|---|---|
| Crear cliente | Nombre, teléfono y datos opcionales de interés, presupuesto, origen y seguimiento. |
| Editar cliente | Nombre, correo, biografía, proyecto, campaña y presupuesto. |
| Cambiar etapa | Movimiento del registro en el proceso comercial. |
| Calificación | Score y marca de cliente caliente. |
| Asignación | Cambio de asesor/responsable, sujeto a permisos del backend. |
| Próxima acción | Actividad y fecha de seguimiento. |
| Seguimiento ocurrido | Registro de llamada, WhatsApp, correo, visita o nota. |
| Comunicación con duración | Registro de Zoom, llamada o reunión con tiempo y resumen. |
| Nota de expediente | Contexto libre del cliente. |
| Tarea | Pendiente con descripción y fecha. |
| Cierre | Operación de venta con importe y moneda. No equivale a cobrar ni facturar. |
| Papelera | Borrado lógico, no destrucción definitiva. |
| Prioridad | Fijar o quitar prioridad a un lead. |
| Agente IA | Asignar o retirar la clave de un agente. Esto no prueba que exista una ejecución autónoma posterior. |
| Confirmaciones | Confirmar/cancelar la acción pendiente o todas las pendientes. |
| Varias acciones | El workflow permite emitir varias llamadas de herramienta a partir de una instrucción. |

### Agenda y seguimiento proactivo

Las migraciones incorporan creación de recordatorios en lenguaje natural, interpretación de fechas relativas y horas, clasificación personal/profesional, búsqueda de tareas para posponerlas, marcarlas hechas o cancelarlas, responsable, notas y estados de cumplimiento.

Ejemplo: “Recuérdame mañana a las 10 enviar la propuesta”. El flujo web puede crear directamente el recordatorio; **no todas las escrituras del Copilot pasan por la misma confirmación**.

El motor proactivo tiene lógica para avisos previos —por defecto 60 y 10 minutos en una configuración—, seguimiento después del vencimiento y respuestas “hecha”, “en proceso” o “no hecha”. Incluye colas y deduplicación. La entrega efectiva depende de que la configuración de la organización y los procesos externos de envío estén activos.

### Voz, imágenes y límites del Copilot

- Telegram incluye nodos de transcripción de audio y análisis de imagen. Que el nodo exista no demuestra extracción correcta de cualquier documento o ticket.
- El Copilot web graba audio y usa reconocimiento de voz del navegador en español. En la ruta revisada envía **texto**, no el archivo de audio. Sin transcripción usa un mensaje genérico de asistencia: todavía no es un flujo robusto de transcripción de audio en servidor.
- La interfaz web recupera historial y permite vincular/desvincular Telegram. El acceso al módulo depende del cliente y del rol.
- No encontré sincronización operativa con Google Calendar u Outlook dentro de estas herramientas. Agendar en Stratos no equivale a crear un evento externo ni un enlace de Zoom.
- Registrar “le envié WhatsApp” documenta una interacción; no ejecuta un envío al cliente. Los envíos reales pertenecen a la integración de comunicaciones.
- El prompt del workflow conserva un pipeline antiguo de diez etapas, mientras el CRM base tiene catorce. Conviene unificar ese contrato antes de garantizar cambios de etapa por voz para todos los clientes.
- La recuperación por historial no correlaciona estrictamente la respuesta con el mensaje recién enviado. Hay riesgo de recuperar una respuesta anterior si falla la ruta principal.

Fuentes: [Copilot web](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/views/Copilot.jsx), [envío y vinculación](/Users/ivanrodriguezruelas/stratos-ai-application/src/lib/telegram.js), [workflow Telegram](/Users/ivanrodriguezruelas/stratos-ai-application/n8n/workflows/stratos-telegram-bot-v4.json), [agenda natural](/Users/ivanrodriguezruelas/stratos-ai-application/supabase/migrations/094_bot_personal_agenda_natural_language.sql), [agenda web](/Users/ivanrodriguezruelas/stratos-ai-application/supabase/migrations/098_copilot_agenda_web_natural_language.sql), [seguimiento proactivo](/Users/ivanrodriguezruelas/stratos-ai-application/supabase/migrations/090_team_agenda_personal_professional_followup.sql).

## 2. CRM comercial

| Área | Funciones identificadas | Estado y precisión |
|---|---|---|
| Base de clientes | Alta, edición, búsqueda, presupuesto, proyecto, campaña, responsable, contacto y perfil. | Conectado a `leads`. |
| Pipeline | Vista de lista y Kanban, arrastre entre etapas y proceso configurable por cliente. | Conectado. |
| Filtros y orden | Búsqueda, etapa, asesor, fechas y controles de orden/prioridad. | Implementado. |
| Calificación | Score editable, cálculo por reglas y marca caliente. | No todo score es resultado de un modelo predictivo. |
| Distribución | Reasignación individual, masiva y recuperación/asignación de registros mediante RPC. | Permisos y comportamiento dependen del rol/configuración. |
| Expediente | Notas, datos del cliente, cronología y próxima acción. | Conectado; ciertas recomendaciones de coaching son fijas. |
| Seguimiento | Registro de interacciones, tareas, fechas y cumplimiento. | Conectado. |
| IA para notas | Convierte texto libre en campos, propone etapa/score y solicita aclaraciones cuando corresponde. | Parser local y funciones con Gemini/Anthropic según configuración. |
| IA para acciones | Sugiere siguientes pasos, técnica, motivo, prioridad y fecha; permite convertir sugerencias en tareas. | Integración con función de IA. |
| Discovery | Muestra datos estructurados recibidos de automatizaciones. | Conectado a información del lead. |
| Llamadas IA | Historial, grabación, duración, resumen y transcripción. | Datos de `voice_call_logs`, dependientes de Retell/ingestión. |
| WhatsApp | Consulta de mensajes y respuesta desde el expediente cuando está habilitado. | Integración condicionada. |
| Auditoría | Historial de cambios y trazabilidad. | Código y migraciones presentes. |
| Papelera | Borrado lógico, recuperación y eliminación definitiva donde se permita. | Conectado. |
| Resiliencia | Borradores, guardado local, colas de reintento y reconciliación para leads. | No constituye soporte offline universal para todos los módulos. |
| Respaldo | Exportaciones JSON y herramientas de comparación entre datos locales y nube. | Implementado; alcance sujeto a permisos y estrategia de exportación. |

El pipeline base actual es: **Contáctame Ya → Segundo Intento → Tercer Intento → Rotación → Remarketing IA → Zoom Agendado → Reactivar Zoom → Zoom Concretado → Seguimiento → Largo Plazo → Apartó → Visita Agendada → Cierre → Postventa**. Las columnas son estados disponibles; no implican que todos los clientes recorran cada una en ese orden.

Hay una limitación documental concreta: el adjuntador del expediente revisado crea metadatos del archivo, pero no contiene una subida de su binario. No debe equipararse con un gestor documental completo. En cambio, WhatsApp sí tiene una ruta de subida a almacenamiento, y Caja permite consultar comprobantes guardados.

Fuentes: [CRM](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/views/CRM/index.jsx), [expediente y componentes](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/views/CRM/components.jsx), [pipeline base](/Users/ivanrodriguezruelas/stratos-ai-application/src/design-system/tokens.js:160), [organizador de notas](/Users/ivanrodriguezruelas/stratos-ai-application/src/lib/organize-notes.js), [sugerencias de acciones](/Users/ivanrodriguezruelas/stratos-ai-application/src/lib/suggest-actions.js).

## 3. Comunicaciones y captación

**WhatsApp:** bandeja de conversaciones, búsqueda, fijación, no leídos, vínculo con leads, mensajes entrantes y salientes, texto y multimedia, estados de envío, reintentos y deduplicación. Utiliza tablas de mensajes/cola, almacenamiento y n8n/Chatwoot; también hay código para rutas específicas de Meta y puentes locales. La implementación aplica una ventana de conversación de 24 horas. Es una regla codificada que no se revalidó aquí contra políticas externas.

La bandeja general está restringida actualmente a `super_admin`, aunque el cliente tenga activado el módulo. El chat dentro del expediente tiene su propia habilitación. No corresponde prometer que todos los asesores ya tienen la bandeja disponible.

**Telefonía y asistencia:** existe una acción para disparar llamadas vía webhook/Retell y otra para marcar “requiere humano”. Su acceso está limitado a cuentas `crmOnly`. Enviar plantilla y descartar desde IA tienen funciones cliente preparadas, pero no un botón expuesto en esa capa. El panel iAgents con cifras, actividad y conmutadores usa datos fijos: no es prueba de cuatro agentes funcionando permanentemente.

**Meta Lead Ads y campañas:** receptor de eventos, recuperación de información del formulario, alta/actualización del lead, deduplicación, reparto rotativo entre asesores y cola para notificarles por WhatsApp. Las migraciones permiten pools y rutas específicas; Duke tiene además una landing de captación que devuelve el asesor asignado y su enlace de WhatsApp. Esto cubre captación y distribución, no demuestra compra o gestión automática de anuncios.

**Diagnóstico de Stratos:** cuestionario y reporte comercial para prospectos de la propia plataforma, con envío a n8n y alta en la organización de ventas. Es un embudo distinto al CRM inmobiliario.

Fuentes: [WhatsApp](/Users/ivanrodriguezruelas/stratos-ai-application/src/lib/whatsapp-chat.js), [acciones IA](/Users/ivanrodriguezruelas/stratos-ai-application/src/lib/iagents-actions.js), [Meta Lead Ads](/Users/ivanrodriguezruelas/stratos-ai-application/supabase/functions/meta-lead-ads/index.ts), [distribución](/Users/ivanrodriguezruelas/stratos-ai-application/supabase/migrations/101_meta_ads_round_robin.sql), [router Duke](/Users/ivanrodriguezruelas/stratos-ai-application/supabase/functions/duke-lead-router/index.ts), [diagnóstico](/Users/ivanrodriguezruelas/stratos-ai-application/src/landing/Diagnostico.jsx).

## 4. Dirección, agenda y organización

- **Comando Directivo:** indicadores comerciales, evolución por periodo, embudo, comparación por asesor y exportación de reportes PDF/CSV. Se calcula sobre datos del CRM y eventos de Zoom.
- **Control de Zooms:** agenda/listado, registro y edición, responsables comerciales, estatus, filtros, gráficas, resumen y exportación CSV. Tiene sincronización con hitos del CRM. Gestiona reuniones registradas; no se observó creación de reuniones mediante la API de Zoom.
- **Productividad:** acciones por persona, pendientes, completadas, en proceso, no realizadas, notas y porcentaje de cumplimiento sobre `team_actions`.
- **Agenda individual/equipo:** tareas con o sin fecha, responsables, categorías personal/profesional, edición y cumplimiento. Incluye una adaptación para usuarios de marketing. La ruta de acceso varía: no todos tienen una entrada independiente “Agenda” en el menú.
- **Plan, metas y protocolo:** configuración de trabajo por organización, con persistencia en `organizations.meta_config` y valores predeterminados cuando falta configuración.
- **Documentos del equipo:** biblioteca de enlaces guardados por organización; no es edición directa de los archivos de Drive/Docs.
- **Notificaciones:** alertas derivadas del CRM, bandejas de Copilot/WhatsApp y código de Web Push. La presencia del código no garantiza entrega con la aplicación cerrada.

Los indicadores de Comando y Productividad conectados deben distinguirse del componente `Team`, cuyas cifras de rendimiento son fijas. Una auditoría de producción del 7 de septiembre ya documentó discrepancias en algunas métricas; no se revalidó hoy su estado en producción.

Fuentes: [Comando](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/views/ComandoDirectivo.jsx), [Zooms](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/views/ZoomControl/index.jsx), [Productividad](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/views/ProductividadTab.jsx), [agenda/plan](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/features/MetaPanel/index.jsx), [auditoría previa](/Users/ivanrodriguezruelas/stratos-ai-application/output/auditoria-stratos-produccion-2026-09-07.md).

## 5. Catálogo de proyectos y Create

La pantalla `ERP.jsx`, presentada como **Proyectos**, consulta un catálogo incluido en la aplicación. Ofrece búsqueda por desarrollo/contacto, filtros de ubicación y presupuesto, tarjetas/tabla, tipologías, clasificación, contactos y enlaces de Drive/Maps. Solo expone determinadas secciones y registros con carpeta disponible.

Es un **catálogo comercial**: no encontré reservas transaccionales por unidad, bloqueo de disponibilidad, almacenes, compras ni control físico de avance. La conversión aproximada de precios para filtros usa un factor fijo; no es un servicio de divisas en tiempo real.

**Create/Marketing** permite seleccionar propiedades, introducir cliente/presupuesto/mensaje/asesor, añadir propiedades locales, editar enlaces, generar una presentación pública y compartirla por enlace o WhatsApp. La presentación viaja codificada en la URL y se puede abrir sin login.

El módulo mezcla catálogo, propiedades añadidas localmente y ejemplos. Varias preferencias y altas se guardan en `localStorage`; el listado de presentaciones generadas se mantiene en estado de interfaz. No hay evidencia en esa ruta de un CMS centralizado, seguimiento completo de visitas/conversiones o colaboración sincronizada de todas las presentaciones.

Fuentes: [Proyectos](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/views/ERP.jsx), [Create](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/views/LandingPages/index.jsx), [presentación pública](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/views/LandingPages/PublicLanding.jsx).

## 6. Finanzas y Caja

Funciones conectadas a `team_expenses`:

- Registrar ingresos y egresos con importe, cuenta, categoría, fecha, descripción y proyecto/obra.
- Identificar quién registró el movimiento y su origen web/Telegram.
- Consultar comprobantes existentes mediante enlaces firmados de almacenamiento.
- Buscar movimientos y filtrar ingresos/egresos.
- Consultar ingresos, egresos, diferencia y saldo del histórico cargado.
- Ver series mensuales, categorías de gasto, flujo anual y exportación CSV.

El mismo modelo permite mostrar movimientos incorporados por flujos de campo/Telegram. La extracción automática de tickets y la entrega de evidencias dependen de esos flujos externos, no solo de la pantalla de Caja.

**Límites importantes para considerarlo ERP financiero:**

1. El alta web de Caja fija `currency: "ARS"`. Debe parametrizarse por cliente para un uso multimoneda real.
2. Los totales suman importes y Finanzas muestra la moneda predominante; no hay conversión ni separación contable por moneda. Mezclar monedas puede producir totales engañosos.
3. Caja consulta hasta 400 movimientos y Finanzas hasta 1,000. El saldo mostrado corresponde al conjunto cargado, no necesariamente a toda la historia.
4. Ingresos menos egresos registrados es una diferencia de caja; no demuestra utilidad contable.
5. La cuenta es una etiqueta de movimiento, no evidencia de conciliación bancaria.
6. No encontré contabilidad de doble partida, cuentas por cobrar/pagar completas, facturación fiscal operativa, conciliación, nómina ni presupuestos con compromiso/ejecución.

Fuente: [Caja](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/views/Caja.jsx), [Finanzas](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/views/FinanzasAdmin.jsx).

## 7. Recursos Humanos, usuarios y plataforma

**Stratos RH/People** presenta vacantes, candidatos, pipeline de selección, empleados y evaluación de CV. Los datos son fijos y `simulateAIScan()` genera un resultado predefinido. El portal de candidatos captura datos/archivo en estado local y simula el procesamiento; no encontré envío persistente de la candidatura en ese flujo. El tab de rendimiento usa el componente `Team` también basado en datos fijos. Son superficies de demostración, no un ATS o módulo de nómina operativo.

**Usuarios y acceso:** autenticación Supabase, perfil, cambio de contraseña, recuperación, vinculación Telegram, zona horaria, roles, edición de usuarios y desactivación lógica. Las funciones de crear usuario y resetear contraseña desde el panel administrativo devuelven instrucciones para hacerlo en Supabase, aunque existen registro de usuario y scripts por otras rutas.

**Multiempresa:** configuraciones Duke, Grupo 28, TGenius, Vega y Stratos Sales; personalización de marca/dominio, vocabulario, etapas y módulos. Hay organización en los datos y políticas RLS. No todos los clientes reciben todos los módulos. Algunos filtros de visibilidad son solo de interfaz: la combinación completa de autorización requiere comprobar políticas del backend.

**Móvil y soporte:** web adaptable, modo claro/oscuro, PWA, código de notificaciones y shell Capacitor. El shell carga la aplicación web; su existencia no prueba publicación actual en tiendas. Hay manuales, centro de entrega y páginas de soporte/legal.

**Planes y pagos:** la pantalla contiene precios y checkout, pero `handlePay()` pasa a “success” mediante un temporizador. No encontré en esa ruta cobro real ni gestión de suscripciones con pasarela.

Fuentes: [RH](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/views/RRHHModule.jsx), [portal de candidatos](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/features/Portal/index.jsx), [usuarios](/Users/ivanrodriguezruelas/stratos-ai-application/src/lib/auth.js:527), [permisos](/Users/ivanrodriguezruelas/stratos-ai-application/src/app/constants/navigation.js), [clientes](/Users/ivanrodriguezruelas/stratos-ai-application/src/clients/_shared/defaults.js), [pagos simulados](/Users/ivanrodriguezruelas/stratos-ai-application/src/landing/PricingScreen.jsx:288).

## 8. Cómo puede funcionar como ERP

La adaptación más concreta ya está en **Constructora Vega**. Cada registro de `leads` representa una obra o licitación, el menú CRM se llama ERP y `projectMode` cambia el expediente y oculta campos propios de un prospecto.

Su pipeline es: **Detectada → En Análisis → Presentada → Adjudicada → En Ejecución → Finalizada**, con **Descartada** como salida alternativa.

| Elemento existente | Función en un ERP operativo |
|---|---|
| Registro/expediente | Obra, licitación o trabajo que debe ejecutarse. |
| Etapa | Estado del proceso. |
| Asesor/responsable | Persona a cargo. |
| Notas e historial | Bitácora y acuerdos. |
| Agenda/tareas | Compromisos, responsables y vencimientos. |
| Telegram y evidencias | Entrada de actividad de campo cuando el flujo está conectado. |
| Caja con `project_id` | Movimientos vinculados a la obra. |
| Comando/Productividad | Visibilidad de carga y cumplimiento. |

Eso permite un escenario útil: registrar una licitación, asignar responsable, documentar análisis, programar entrega de propuesta, moverla a adjudicada, registrar actividades/gastos durante la ejecución y revisar pendientes y caja. **El código no demuestra que cada transición dispare automáticamente todos los pasos siguientes.**

Vega tiene Caja habilitada incluso para empleados/asesores, pero sus módulos internos de catálogo ERP, Finanzas e iAgents están apagados y Copilot web no está activado por defecto. Su bot propio y sus flujos externos deben validarse por separado; no es correcto trasladarle sin más todas las funciones del Copilot de Duke.

Fuente: [configuración Vega](/Users/ivanrodriguezruelas/stratos-ai-application/src/clients/vega/config.js).

### Lo necesario para un ERP más completo

| Capa | Desarrollo pendiente o ampliación necesaria |
|---|---|
| Modelo de negocio | Entidades propias para proyectos, contratos, clientes, proveedores y unidades; evitar que todo dependa de campos de lead. |
| Presupuestos y costos | Presupuesto por proyecto/partida, comprometido, ejecutado, desviaciones y aprobaciones. |
| Compras | Solicitud, cotización, orden, recepción y autorización. |
| Inventario | Existencias, movimientos, ubicación, reservas y trazabilidad por unidad/material. |
| Cobranza y pagos | Vencimientos, parcialidades, estados, saldos por cliente/proveedor y conciliación. |
| Contabilidad | Plan de cuentas, asientos, periodos, cierre y reportes contables. |
| Fiscal | Integración con el sistema fiscal/facturador que corresponda al cliente. |
| Personal | Expediente laboral persistente, incidencias, asistencia y nómina si entra en alcance. |
| Documentos | Subida real en todos los flujos, permisos, versiones, relación con contratos/proyectos y firmas cuando se requieran. |
| Copilot ampliado | Herramientas explícitas de consulta y operación sobre esas entidades, con resultados verificables y autorizaciones por acción. |

La evolución más coherente es consolidar primero CRM/Copilot/agenda, después cerrar el control operativo por proyecto y Caja, y luego integrar compras, cobranza y contabilidad. Para una empresa que ya usa un sistema contable, Stratos puede actuar como su capa comercial y de coordinación mediante una integración; esa integración todavía debe construirse y comprobarse.

## 9. Qué puede afirmarse y qué debe matizarse

**Respaldado por el código:** CRM configurable, asistencia conversacional para operaciones definidas, agenda y seguimiento, indicadores comerciales, integración de comunicaciones, presentaciones de propiedades y registro de caja, según las habilitaciones de cada cliente.

**Requiere validación de despliegue:** cada acción del dispatcher, entrega de recordatorios/push, llamadas y WhatsApp, flujos de campo, carga del catálogo, políticas de acceso y exactitud de reportes en producción.

**No debe presentarse como terminado:** ERP contable integral, reclutamiento IA real, nómina, cuatro agentes autónomos acreditados por el panel, pagos de suscripción, calendario externo sincronizado o disponibilidad transaccional del inventario.

La oportunidad del producto está en compartir información entre ventas, operación y dirección y permitir que el equipo la capture mediante conversación. Su siguiente salto depende de cerrar los circuitos completos: **solicitud → registro verificado → responsable → ejecución → evidencia → resultado medible**.
