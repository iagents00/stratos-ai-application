# MAPA — dónde está cada cosa

> **Generado automáticamente. No lo edites a mano.**
> Lo produce `scripts/generar-mapa.mjs` leyendo el código, así que no puede
> quedar desactualizado. Si moviste algo, corré `npm run mapa`.
>
> ¿Buscás un botón o un texto y no está acá? `npm run buscar "texto"`

**161 archivos · 72.282 líneas**

---

## 1. Pantallas de la app

Lo que ves en el menú lateral, y el archivo que lo dibuja.

| En el menú dice | Archivo | Líneas |
|---|---|---|
| **CRM** | `src/app/views/CRM/index.jsx` | 6564 |
| **Mi Espacio** | _sin vista propia (redirige a otra)_ | — |
| **Plan Semanal** | `src/app/views/PlanSemanal.jsx` | 500 |
| **Copilot** | `src/app/views/Copilot.jsx` | 1789 |
| **Marketing** | `src/app/views/Marketing.jsx` | 3075 |
| **Actividades** | `src/app/views/Marketing.jsx` | 3075 |
| **Equipo** | `src/app/views/Marketing.jsx` | 3075 |
| **Mi Día** | `src/app/views/Marketing.jsx` | 3075 |
| **Marcas** | `src/app/views/Marketing.jsx` | 3075 |
| **Propiedades** | `src/app/views/Marketing.jsx` | 3075 |
| **Solicitudes** | `src/app/views/Marketing.jsx` | 3075 |
| **Mi Drive** | `src/app/views/MiDrive.jsx` | 171 |
| **WhatsApp** | `src/app/views/WhatsApp.jsx` | 667 |
| **Create** | `src/app/views/LandingPages/index.jsx` | 2022 |
| **Comando** | `src/app/views/ComandoOps.jsx`<br>`src/app/views/ComandoDirectivo.jsx` | 327<br>1277 |
| **Caja** | `src/app/views/Caja.jsx` | 580 |
| **Chat** | `src/app/views/ChatEquipo.jsx` | 569 |
| **Proyectos** | `src/app/views/ERP.jsx` | 698 |
| **iAgents** | `src/app/views/IACRM.jsx` | 690 |
| **Finanzas** | `src/app/views/FinanzasAdmin.jsx` | 458 |
| **Stratos RH** | `src/app/views/RRHHModule.jsx` | 839 |
| **Papelera** | `src/app/views/Trash.jsx` | 285 |
| **Planes** | _sin vista propia (redirige a otra)_ | — |
| **Perfil** | `src/app/views/Profile.jsx` | 1021 |
| **Usuarios** | `src/app/features/Admin/AdminPanel.jsx` | 543 |

---

## 2. Páginas públicas (sin login)

| URL | Componente |
|---|---|
| `/politica-de-privacidad` · `/privacy-policy` | PrivacyPolicy |
| `/eliminar-mis-datos` · `/data-deletion` | DataDeletion |
| `/entrega-crm` · `/entrega` | DeliveryHubCRM |
| `/manual` · `/manual-crm` | ManualNSG |
| `/manual-asistente-telegram` · `/manual_asistente_telegram` · `/manual-telegram` | — |
| `/manual-marketing` · `/manual-mkt` | — |
| `/manual-nsg` · `/manual-stratos-nsg` | — |
| `/manual-legacy` · `/manual-legacy-design` | — |
| `/manual-brasa` · `/manual-brasa-y-piedra` | — |
| `/manual-gasil` · `/manual-gasil-radiodiagnostico` | — |
| `/manual-muebleria` · `/manual-mueblaria` | — |
| `/diagnostico` | Diagnostico |
| `/duke/desarrollos-97k` · `/duke-100k` · `/desarrollos-97k` · `/duke-97k` | — |

---

## 3. Todos los archivos, por carpeta

### `src/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `main.jsx` | 415 | Entry point de Stratos AI |
| `index.css` | 250 | _sin describir_ |
| `mobile-perf.css` | 121 | _sin describir_ |

### `src/app/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `App.jsx` | 3002 | Shell principal de Stratos AI |
| `SharedComponents.jsx` | 343 | Shared primitive components used by all views. |
| `App.css` | 321 | _sin describir_ |

### `src/app/components/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `DynIsland.jsx` | 488 | Centro de Inteligencia — Dynamic Island con soporte de tema y animaciones. |
| `SuggestActionsModal.jsx` | 422 | Co-pilot IA que sugiere próximas acciones. |
| `HistoryDrawer.jsx` | 291 | Modal de historial de cambios para cualquier entidad. |
| `ProFeatureGate.jsx` | 208 | pantalla elegante para funciones que requieren |
| `Chat.jsx` | 182 | _sin describir_ |
| `DynamicIsland.jsx` | 153 | _sin describir_ |
| `CopilotMark.jsx` | 113 | _sin describir_ |
| `IAOSIsland.jsx` | 91 | Indicador IAOS en el header — muestra métricas animadas del pipeline. |
| `Logo.jsx` | 87 | Logos SVG de Stratos AI. |
| `PermissionGate.jsx` | 52 | Pantalla de acceso restringido por rol. |

### `src/app/constants/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `navigation.js` | 362 | Configuración de navegación y permisos por módulo. |
| `intelFeatures.js` | 211 | _sin describir_ |
| `areas.js` | 97 | _sin describir_ |
| `pipeline.js` | 93 | _sin describir_ |
| `intelNotifs.js` | 86 | Construye las notificaciones REALES del Centro de Inteligencia a partir de los |
| `labels.js` | 62 | Diccionario de ETIQUETAS del CRM, resuelto por cliente. |
| `intelMkt.js` | 61 | Centro de Inteligencia de MARKETING. |
| `agents.js` | 60 | Registro de agentes IA y sus íconos. |
| `crm.js` | 41 | Constantes del CRM: colores de etapas, fuentes, asesores. |

### `src/app/data/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `catalogoProyectos.js` | 611 | _sin describir_ |
| `leads.js` | 348 | _sin describir_ |
| `chat.js` | 249 | _sin describir_ |
| `rivieraProperties.js` | 119 | _sin describir_ |
| `asesores.js` | 20 | _sin describir_ |
| `dashboard.js` | 12 | _sin describir_ |
| `team.js` | 11 | _sin describir_ |

### `src/app/features/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `index.jsx` | 2158 | Modal de cuatro pestañas: Lista de Acción · Documentos · Plan Estratégico · Protocolo de Ventas |
| `AdminPanel.jsx` | 543 | Panel de gestión de usuarios (Super Admin y Admin). |
| `index.jsx` | 487 | Panel de chat con Agente Stratos AI. |
| `index.jsx` | 453 | Portal de Candidatos — Stratos People |
| `DocsStratos.jsx` | 262 | _sin describir_ |
| `RoleBadge.jsx` | 29 | Badge de rol de usuario con colores según nivel. |

### `src/app/icons/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `ios-icons.jsx` | 121 | Set de íconos estilo iOS para la experiencia MÓVIL. |

### `src/app/views/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `index.jsx` | 6564 | Orquestador principal del módulo CRM |
| `components.jsx` | 5885 | Todos los sub-componentes del módulo CRM |
| `Marketing.jsx` | 3075 | _sin describir_ |
| `index.jsx` | 2022 | Generador de landing pages inmobiliarias |
| `Copilot.jsx` | 1789 | v2 (15-jul) |
| `ComandoDirectivo.jsx` | 1277 | _sin describir_ |
| `index.jsx` | 1205 | Panel "Control de Zooms" — pestaña dentro de Comando Directivo (Duke). |
| `Profile.jsx` | 1021 | vista de perfil del asesor. |
| `LeadWhatsAppChat.jsx` | 942 | _sin describir_ |
| `RRHHModule.jsx` | 839 | _sin describir_ |
| `InformeAvances.jsx` | 747 | _sin describir_ |
| `ERP.jsx` | 698 | _sin describir_ |
| `IACRM.jsx` | 690 | iAgents · Equipo de Agentes IA |
| `WhatsApp.jsx` | 667 | _sin describir_ |
| `Caja.jsx` | 580 | _sin describir_ |
| `ChatEquipo.jsx` | 569 | _sin describir_ |
| `ComandoDirectivo.pdf.js` | 514 | _sin describir_ |
| `PlanSemanal.jsx` | 500 | _sin describir_ |
| `Resumen.jsx` | 480 | _sin describir_ |
| `LandingPagePreview.jsx` | 476 | Pantalla de preview completa — landing pública para el cliente |
| `CuentasCobro.jsx` | 463 | _sin describir_ |
| `FinanzasAdmin.jsx` | 458 | _sin describir_ |
| `LeadNotesTimeline.jsx` | 438 | cronograma de notas individuales para un lead. |
| `ZoomBoard.jsx` | 351 | Espacio "Control de Zooms" del Comando Directivo. Tablero enfocado SOLO en |
| `Dash.jsx` | 344 | _sin describir_ |
| `ComandoOps.jsx` | 327 | _sin describir_ |
| `AdvisorMetrics.jsx` | 302 | Tabla de indicadores por asesor (Comando Directivo dentro del CRM). |
| `Graficas.jsx` | 290 | _sin describir_ |
| `Trash.jsx` | 285 | Papelera del CRM |
| `RangeCalendar.jsx` | 258 | Calendario de selección de RANGO por clicks. Se usa dentro de DateRangeControl |
| `LeadRelatedContacts.jsx` | 250 | "Familiares o Socios" del expediente — personas ALLEGADAS al contacto |
| `Nomina.jsx` | 238 | _sin describir_ |
| `ProductividadTab.jsx` | 218 | _sin describir_ |
| `zoom-metrics.js` | 207 | _sin describir_ |
| `LeadVoiceCalls.jsx` | 201 | Sección con las llamadas de voz hechas por Retell AI a este lead. |
| `catalogAdapter.js` | 197 | Puente entre el catálogo maestro y el generador de landings |
| `Team.jsx` | 194 | vista "Asesores" |
| `CallActionButton.jsx` | 183 | _sin describir_ |
| `RequiresHumanButton.jsx` | 177 | _sin describir_ |
| `DateRangeControl.jsx` | 176 | Control ÚNICO de período del Comando / CRM. Presets rápidos (Hoy, Semana, Mes, |
| `MiDrive.jsx` | 171 | _sin describir_ |
| `LeadDiscoveryPanel.jsx` | 158 | Render del perfilamiento extraído por la IA de voz (Retell) en la tabla |
| `LeadChatHistory.jsx` | 152 | _sin describir_ |
| `ScheduledCallBadge.jsx` | 144 | _sin describir_ |
| `constants.js` | 116 | _sin describir_ |
| `ZoomLista.jsx` | 107 | Lista compacta y clickeable de Zooms — la usan los apartados "Calentitos" y |
| `PublicLanding.jsx` | 95 | La landing personalizada que abre el CLIENTE FINAL |
| `plan-semanal.js` | 91 | la lógica pura del Plan Semanal. |
| `date-range.js` | 86 | _sin describir_ |
| `dates.js` | 76 | Helpers de fecha del Control de Zooms, compartidos entre el panel CRUD |

### `src/clients/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `index.js` | 216 | Resolver del cliente activo según la URL. |

### `src/clients/_shared/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `defaults.js` | 265 | Config base que TODOS los clientes heredan. |

### `src/clients/brasa-y-piedra/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 140 | _sin describir_ |

### `src/clients/clinica-dental/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 309 | _sin describir_ |

### `src/clients/duke/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 99 | Configuración del cliente DUKE (cliente original de Stratos AI, en producción). |

### `src/clients/gasil/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 422 | _sin describir_ |

### `src/clients/grupo28/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 100 | _sin describir_ |

### `src/clients/legacy-design/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 192 | Configuración del tenant LEGACY DESIGN (corporativo Duke — arquitectura y |

### `src/clients/muebleria/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 182 | _sin describir_ |

### `src/clients/nsg/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 270 | _sin describir_ |

### `src/clients/stratos-sales/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 77 | Configuracion del cliente STRATOS SALES. |

### `src/clients/tgenius/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 90 | _sin describir_ |

### `src/clients/vega/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 196 | _sin describir_ |

### `src/components/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `UpdatePill.jsx` | 157 | _sin describir_ |
| `ErrorBoundary.jsx` | 98 | React Error Boundary — captura errores de render y los muestra limpiamente |

### `src/contexts/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `AuthContext.jsx` | 376 | Estado global de autenticación — conectado a Supabase Auth. |
| `ClientOrgGuard.jsx` | 59 | _sin describir_ |
| `ClientContext.jsx` | 46 | Provee la configuración del cliente activo (Duke, Grupo 28, etc.) a toda la app. |

### `src/data/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `constants.js` | 18 | Re-exporta STAGES y STAGE_COLORS desde el design system. |

### `src/design-system/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `tokens.js` | 237 | FUENTE ÚNICA DE VERDAD para colores, tipografías y espaciado de Stratos AI. |
| `primitives.jsx` | 159 | Componentes UI atómicos compartidos entre landing y app. |

### `src/hooks/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `useZoomAgendados.js` | 204 | _sin describir_ |
| `useWhatsAppInbox.js` | 178 | _sin describir_ |
| `useCopilotInbox.js` | 125 | Bandeja/Notificaciones del módulo Copilot: monitorea la tabla tg_bot_activity |
| `useViewport.js` | 92 | Hook único para detectar tamaño de pantalla. Lo usan los componentes del |
| `useTeam.js` | 74 | _sin describir_ |
| `useScheduledCalls.js` | 73 | Devuelve un Map<phoneDigits, { id, phone_e164, scheduled_at }> con las |
| `useProperties.js` | 45 | _sin describir_ |
| `useAuth.js` | 30 | Hook para consumir AuthContext desde cualquier componente. |
| `useClient.js` | 26 | Hook para consumir el contexto del cliente activo. |

### `src/landing/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `LandingMarketing.jsx` | 1593 | _sin describir_ |
| `PrivacyPolicy.jsx` | 1221 | _sin describir_ |
| `ManualMarketing.jsx` | 1025 | Manual de usuario del equipo de MARKETING de Duke |
| `manual-content.js` | 1004 | _sin describir_ |
| `Diagnostico.jsx` | 974 | _sin describir_ |
| `DeliveryHubCRM.jsx` | 880 | Hub de Entrega del CRM Stratos AI v1.0 |
| `ManualCRM.jsx` | 789 | Manual del CRM Stratos AI para asesores |
| `manual-telegram-content.js` | 714 | Manual del COPILOT / Asistente IA (Duke del Caribe) |
| `LoginScreen.jsx` | 684 | Pantalla de autenticación completa para la app |
| `PricingScreen.jsx` | 611 | Planes y pagos para Stratos AI |
| `DataDeletion.jsx` | 553 | _sin describir_ |
| `DukeLeadRouter.jsx` | 343 | _sin describir_ |
| `ManualGasil.jsx` | 284 | Manual de uso de Stratos IA para GASIL RADIODIAGNÓSTICO DEL VALLE |
| `ManualNSG.jsx` | 284 | Manual de uso de Stratos IA para NSG |
| `ManualLegacy.jsx` | 245 | Manual de uso de Stratos IA para LEGACY DESIGN |
| `ManualBrasa.jsx` | 234 | Manual de uso de Stratos IA para BRASA Y PIEDRA |
| `ManualMuebleria.jsx` | 223 | Manual de uso de Stratos IA para la MUEBLERÍA |

### `src/lib/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `telegram.js` | 827 | Pareo del bot de Telegram con el perfil del asesor. |
| `auth.js` | 633 | _sin describir_ |
| `push.js` | 416 | Sistema de suscripción a notificaciones Web Push |
| `offline-mode.js` | 351 | _sin describir_ |
| `lead-storage.js` | 343 | _sin describir_ |
| `whatsapp-chat.js` | 326 | _sin describir_ |
| `utils.js` | 308 | Utilidades compartidas entre todas las vistas. |
| `lead-save.js` | 288 | _sin describir_ |
| `manual-stratos-doc.js` | 230 | _sin describir_ |
| `organize-notes.js` | 220 | _sin describir_ |
| `docx.js` | 203 | _sin describir_ |
| `lead-backup.js` | 197 | _sin describir_ |
| `informe-doc.js` | 175 | _sin describir_ |
| `audit.js` | 151 | Cliente del sistema de auditoría |
| `native.js` | 144 | Puente con la app nativa (Capacitor) |
| `markdown.jsx` | 129 | Mini renderer Markdown → React. Pensado para las notas privadas que la IA |
| `iagents-actions.js` | 126 | _sin describir_ |
| `backup.js` | 116 | Respaldo manual de la base de datos |
| `webhook-diagnostico-stratos.js` | 112 | Envía los resultados del diagnóstico Stratos AI al webhook n8n del funnel. |
| `chunk-recovery.js` | 103 | _sin describir_ |
| `lead-draft.js` | 85 | Autosave del borrador del modal "Registrar cliente" |
| `ringer.js` | 72 | _sin describir_ |
| `supabase.js` | 67 | _sin describir_ |
| `recovery.js` | 58 | Recuperación de contraseña por CÓDIGO al correo de recuperación. |
| `suggest-actions.js` | 58 | Cliente del agente IA "co-pilot" que sugiere próximas acciones |

---

## 4. ¿Dónde está el texto "..."?

Textos visibles de la app y el archivo donde viven. Útil cuando alguien te
dice "cambiá el botón que dice X" y no sabés por dónde empezar.

| Texto | Archivo |
|---|---|
| ¿A qué cliente se le cobra? (ej: Duke) | `src/app/views/CuentasCobro.jsx:321` |
| ¿Cómo funciona el Escáner IA? | `src/app/views/RRHHModule.jsx:813` |
| ¿Cuánto te llevó? (opcional) | `src/app/views/Marketing.jsx:2462` |
| ¿Cuánto? | `src/app/views/Copilot.jsx:1053` |
| ¿De qué empresa es? | `src/app/views/Marketing.jsx:1591` |
| ¿De qué empresa? | `src/app/views/Marketing.jsx:1735` |
| ¿De qué es? (opcional) | `src/app/views/Copilot.jsx:1066` |
| ¿De qué se habla acá? (opcional) | `src/app/views/ChatEquipo.jsx:529` |
| ¿Eliminar usuario? | `src/app/features/Admin/AdminPanel.jsx:410` |
| ¿En qué empresa? (opcional) | `src/app/views/Marketing.jsx:2453` |
| ¿Listo para dar el siguiente paso? | `src/app/views/LandingPages/LandingPagePreview.jsx:456` |
| ¿Por qué la Riviera Maya? | `src/app/views/LandingPages/LandingPagePreview.jsx:401` |
| ¿Qué necesitas? (ej. Flyer promo…) * | `src/app/views/Marketing.jsx:2183` |
| A consultar | `src/app/views/LandingPages/index.jsx:1846` |
| Abriendo comprobante… | `src/app/views/Caja.jsx:542` |
| Abriendo documento… | `src/app/views/CRM/components.jsx:4331` |
| Abriendo… | `src/app/views/ChatEquipo.jsx:555` |
| Abrir | `src/app/views/Marketing.jsx:1338` |
| Abrir carpeta de Drive | `src/app/views/LandingPages/index.jsx:1422` |
| Abrir carpeta en Drive | `src/app/views/Marketing.jsx:683` |
| Abrir Discovery | `src/app/views/CRM/index.jsx:5218` |
| Abrir el expediente completo | `src/app/views/WhatsApp.jsx:475` |
| Abrir el expediente completo del cliente | `src/app/views/WhatsApp.jsx:456` |
| Abrir evidencia | `src/app/views/Marketing.jsx:2340` |
| Abrir la ficha completa | `src/app/views/Marketing.jsx:1564` |
| Abrir la ficha completa — acá se edita todo | `src/app/views/Marketing.jsx:1373` |
| Abrir la ficha de la propiedad | `src/app/views/Marketing.jsx:2008` |
| Abrir perfil | `src/app/views/CRM/index.jsx:5216` |
| Abrirlo en Drive | `src/app/features/MetaPanel/DocsStratos.jsx:174` |
| Acciones | `src/app/views/CRM/index.jsx:4236` |
| Acciones acumuladas · Asesores vs. iAgents | `src/app/views/Dash.jsx:85` |
| Acciones de cierre IA | `src/app/views/CRM/components.jsx:5627` |
| Activa tu Copilot AI | `src/app/views/Copilot.jsx:1747` |
| Actividad del equipo IA — hoy | `src/app/views/IACRM.jsx:291` |
| Actividad reciente | `src/app/views/CRM/index.jsx:5801` |
| ACTIVO | `src/app/views/CRM/components.jsx:5514` |
| Activos post-Zoom | `src/app/views/ComandoDirectivo.jsx:694` |
| Activos post-Zoom: | `src/app/views/CRM/ZoomBoard.jsx:169` |
| Actual: | `src/app/views/Profile.jsx:301` |
| Actualización del sistema | `src/app/components/DynIsland.jsx:408` |
| Actualización Importante | `src/app/components/DynamicIsland.jsx:132` |
| Actualizar | `src/app/views/Caja.jsx:303` |
| Adjuntar | `src/app/views/ChatEquipo.jsx:481` |
| Adjuntar imagen, audio o archivo | `src/app/views/CRM/LeadWhatsAppChat.jsx:843` |
| Adjuntar PDF, documento o audio | `src/app/views/CRM/components.jsx:1839` |
| Agenda (opcional) | `src/app/views/LandingPages/index.jsx:1606` |
| Agenda una llamada con | `src/app/views/LandingPages/LandingPagePreview.jsx:458` |
| Agenda, lista de acción, documentos y plan | `src/app/App.jsx:2853` |
| Agendar fecha | `src/app/views/CRM/index.jsx:4556` |
| Agendar llamada | `src/app/views/LandingPages/LandingPagePreview.jsx:164` |
| Agente Ejecutivo | `src/app/components/Chat.jsx:74` |
| Agente Stratos | `src/app/components/Chat.jsx:60` |
| Agrega un teléfono…  +1 555 … | `src/app/views/CRM/components.jsx:1314` |
| Agregar | `src/app/features/MetaPanel/index.jsx:1234` |
| Agregar link | `src/app/views/LandingPages/index.jsx:1936` |
| Agregar otro | `src/app/views/Marketing.jsx:2514` |
| Agregar propiedad | `src/app/views/Marketing.jsx:1448` |
| Agregar tarea de prioridad… | `src/app/views/PlanSemanal.jsx:470` |
| Agregar una columna propia a la hoja | `src/app/views/Marketing.jsx:1459` |
| Ahora no | `src/app/views/Copilot.jsx:1692` |
| Ajusta el rango en el paso anterior | `src/app/views/LandingPages/index.jsx:1951` |
| ALDEA ZAMA · TULUM | `src/app/views/LandingPages/index.jsx:305` |
| Alta intención | `src/app/views/ZoomControl/index.jsx:583` |
| Alta intención — señal de cierre en el Zoom | `src/app/views/ZoomControl/index.jsx:696` |
| Amenidades (separadas por coma) | `src/app/views/LandingPages/index.jsx:760` |
| Análisis IA | `src/app/views/CRM/components.jsx:5389` |
| Analizar | `src/app/views/CRM/index.jsx:5213` |
| Analizar con IA → | `src/app/views/Dash.jsx:241` |
| Anterior | `src/app/views/CRM/index.jsx:3065` |
| Añade tareas concretas para este cliente | `src/app/views/CRM/components.jsx:2171` |
| Añadir | `src/app/views/CRM/components.jsx:5781` |
| Aparecerán al inicio de su pipeline en | `src/app/views/CRM/index.jsx:6078` |
| Aplicaciones | `src/app/App.jsx:2916` |
| Apps | `src/app/App.jsx:2092` |
| Áreas de atención | `src/app/views/RRHHModule.jsx:786` |
| Arrastra el CV aquí o haz clic para subir | `src/app/views/RRHHModule.jsx:709` |
| Arrastra para cambiar la prioridad | `src/app/views/Marketing.jsx:2236` |
| Asesor | `src/app/views/CRM/AdvisorMetrics.jsx:226` |
| Asignar a un asesor | `src/app/features/MetaPanel/index.jsx:871` |
| Asignar a… | `src/app/views/Marketing.jsx:863` |
| Asignar responsable | `src/app/features/MetaPanel/index.jsx:860` |
| Asistió (sem.) | `src/app/views/ZoomControl/Resumen.jsx:411` |
| Atención Inmediata | `src/app/views/Dash.jsx:235` |
| Aún no configuras un correo de recuperación. | `src/app/views/Profile.jsx:302` |
| Aún no hay documentos | `src/app/features/MetaPanel/index.jsx:1646` |
| Badge | `src/app/views/LandingPages/index.jsx:662` |
| Bajo · Medio · Alto | `src/app/views/CRM/components.jsx:3440` |
| Buscar (⌘K) | `src/app/App.jsx:2179` |
| Buscar asesor… | `src/app/views/CRM/components.jsx:3197` |
| Buscar candidato... | `src/app/views/RRHHModule.jsx:409` |
| Buscar cliente o teléfono… | `src/app/views/WhatsApp.jsx:212` |
| Buscar cliente, proyecto, liner… | `src/app/views/ZoomControl/index.jsx:498` |
| Buscar desarrollo o zona… | `src/app/views/LandingPages/index.jsx:1398` |
| Buscar en las actividades… | `src/app/views/Marketing.jsx:1782` |
| Buscar en papelera… | `src/app/views/Trash.jsx:99` |
| Buscar nombre o email… | `src/app/features/Admin/AdminPanel.jsx:270` |
| Buscar por categoría, obra, persona… | `src/app/views/Caja.jsx:447` |
| Buscar por nombre, masterbroker o contacto… | `src/app/views/ERP.jsx:415` |
| Buscar propiedad, ubicación, estatus, año… | `src/app/views/Marketing.jsx:1430` |
| Buscar solicitudes… | `src/app/views/Marketing.jsx:2171` |
| Caja | `src/app/views/Caja.jsx:295` |
| CALCULADORA DE RETORNO | `src/app/views/LandingPages/index.jsx:881` |
| Calificación BANT | `src/app/views/CRM/components.jsx:5540` |
| Cambiar | `src/app/views/LandingPages/index.jsx:1936` |
| Cambiar cuánto gana | `src/app/views/Nomina.jsx:180` |
| Cambiar el estatus | `src/app/views/Marketing.jsx:1575` |
| Cambiar etapa | `src/app/views/CRM/components.jsx:276` |
| Cambiar fecha | `src/app/features/MetaPanel/index.jsx:1113` |
| Cambiar la etapa del lead | `src/app/views/WhatsApp.jsx:503` |
| Cambiar orden de las tarjetas de prioridad | `src/app/views/CRM/index.jsx:2549` |
| Cambiar posición de prioridad | `src/app/views/CRM/index.jsx:2710` |
| Cambiar prioridad | `src/app/features/MetaPanel/index.jsx:1319` |
| Campañas Recientes | `src/app/views/LandingPages/index.jsx:1255` |
| Campo requerido | `src/app/views/LandingPages/index.jsx:641` |
| Canales | `src/app/views/ChatEquipo.jsx:303` |
| Cancelar | `src/app/features/Admin/AdminPanel.jsx:415` |
| Cancelar comentario | `src/app/views/Copilot.jsx:1034` |
| CANDIDATO IDENTIFICADO | `src/app/views/RRHHModule.jsx:740` |
| Características | `src/app/views/LandingPages/index.jsx:704` |
| Cargando actividad… | `src/app/views/Profile.jsx:870` |
| Cargando conversación… | `src/app/views/Copilot.jsx:965` |
| Cargando conversaciones… | `src/app/views/WhatsApp.jsx:263` |
| Cargando el plan… | `src/app/views/PlanSemanal.jsx:353` |
| Cargando el tablero… | `src/app/views/ComandoOps.jsx:127` |
| Cargando equipo… | `src/app/App.jsx:2207` |
| Cargando movimientos… | `src/app/views/Caja.jsx:454` |
| Cargando Zooms… | `src/app/views/ZoomControl/index.jsx:515` |
| Cargando… | `src/app/views/FinanzasAdmin.jsx:320` |
| Cargo / Departamento | `src/app/views/RRHHModule.jsx:602` |
| Carpeta de crudos | `src/app/views/Marketing.jsx:2032` |
| Carpeta de Drive | `src/app/views/ERP.jsx:662` |
| Catálogo de Propiedades | `src/app/views/LandingPages/index.jsx:1300` |
| Catálogo de Proyectos | `src/app/views/ERP.jsx:310` |
| Centro de Agentes IA | `src/app/views/CRM/index.jsx:5382` |
| Centro de Inteligencia | `src/app/components/DynamicIsland.jsx:81` |
| Centro de Inteligencia — Activo | `src/app/components/DynamicIsland.jsx:102` |
| Cerrar | `src/app/App.jsx:2769` |
| Cerrar (Esc) | `src/app/views/ZoomControl/index.jsx:797` |
| Cerrar detalle | `src/app/views/ZoomControl/Resumen.jsx:299` |
| Cerrar Mi Espacio | `src/app/features/MetaPanel/index.jsx:664` |
| Cerrar sesión | `src/app/App.jsx:2540` |
| Cerrar vista previa | `src/app/views/LandingPages/LandingPagePreview.jsx:202` |
| Chats | `src/app/views/WhatsApp.jsx:633` |
| Cierres | `src/app/views/Team.jsx:116` |
| Click para agendar fecha/hora de la cita | `src/app/views/CRM/index.jsx:4533` |
| Click para editar | `src/app/features/MetaPanel/index.jsx:333` |
| Click para escribir el número directamente | `src/app/views/CRM/components.jsx:694` |
| Cliente | `src/app/views/CRM/ZoomBoard.jsx:290` |
| Coaching IA · Análisis | `src/app/views/CRM/components.jsx:5011` |
| Color de acento para la tarjeta | `src/app/views/LandingPages/index.jsx:802` |
| Color personalizado | `src/app/views/LandingPages/index.jsx:815` |
| Columna nueva | `src/app/views/Marketing.jsx:1463` |
| Columnas del equipo | `src/app/views/Marketing.jsx:3035` |
| Comando Directivo | `src/app/views/ComandoDirectivo.jsx:662` |
| Cómo se usa | `src/app/components/DynIsland.jsx:467` |
| Cómo terminaron los Zooms del mes | `src/app/views/ZoomControl/Graficas.jsx:202` |
| Cómo trabaja el equipo IA | `src/app/views/IACRM.jsx:568` |
| Cómo verá el cliente | `src/app/views/LandingPages/index.jsx:131` |
| Complejidad: | `src/app/views/Marketing.jsx:2190` |
| Conectado | `src/app/views/Profile.jsx:623` |
| Configuración | `src/app/App.jsx:2952` |
| Confirmados | `src/app/views/ZoomControl/Resumen.jsx:440` |
| Confirmar contraseña | `src/app/views/Profile.jsx:205` |
| Contáctame Ya | `src/app/views/CRM/index.jsx:6078` |
| Contarlo ahora | `src/app/views/Marketing.jsx:708` |
| Continuar sin CV | `src/app/features/Portal/index.jsx:425` |
| Conversión | `src/app/views/Team.jsx:116` |
| Conversión a Zoom | `src/app/views/ComandoDirectivo.jsx:713` |
| Copiado | `src/app/views/LandingPages/LandingPagePreview.jsx:119` |
| Copiar | `src/app/views/InformeAvances.jsx:633` |
| Copiar el discovery al portapapeles | `src/app/views/ZoomControl/index.jsx:825` |
| Copiar resumen para Telegram | `src/app/views/CRM/components.jsx:4569` |
| Copilot AI | `src/app/views/Copilot.jsx:923` |
| Corregir lo que escribiste | `src/app/views/Marketing.jsx:1853` |
| Correo de recuperación | `src/app/views/Profile.jsx:269` |
| Crear | `src/app/views/Marketing.jsx:915` |
| Crear con voz | `src/app/views/Marketing.jsx:2873` |
| Crear con voz — díctale al Copilot | `src/app/views/Marketing.jsx:2868` |
| Crear landing | `src/app/views/LandingPages/index.jsx:1429` |
| Crear Landing Page | `src/app/views/LandingPages/index.jsx:1542` |
| Crear Usuario | `src/app/features/Admin/AdminPanel.jsx:533` |
| Cuándo se registró | `src/app/views/Marketing.jsx:1823` |
| Cuánto se le cobra | `src/app/views/CuentasCobro.jsx:323` |
| Cuenta (Caja, Banco…) | `src/app/views/Caja.jsx:380` |
| Cuentas de cobro | `src/app/views/CuentasCobro.jsx:267` |
| Datos del Cliente | `src/app/views/LandingPages/index.jsx:1554` |
| Delegar al equipo IA | `src/app/views/CRM/components.jsx:5478` |
| Desbloqueada | `src/app/views/Marketing.jsx:666` |
| Descarga el reporte ejecutivo como PDF | `src/app/views/ComandoDirectivo.jsx:910` |
| Descargar el manual en Word | `src/app/features/MetaPanel/DocsStratos.jsx:169` |
| Descargar en Word | `src/app/features/MetaPanel/DocsStratos.jsx:213` |
| Descargar en Word para firmarla | `src/app/views/CuentasCobro.jsx:419` |
| Descartar | `src/app/App.jsx:2464` |
| Descartar audio | `src/app/views/Copilot.jsx:1560` |
| Descartar grabación | `src/app/views/CRM/LeadWhatsAppChat.jsx:808` |
| Describe la tarea... | `src/app/views/CRM/components.jsx:2118` |
| Descripción | `src/app/views/IACRM.jsx:433` |
| Descripción / detalle (opcional) | `src/app/views/Caja.jsx:393` |
| Descripción del desarrollo | `src/app/views/LandingPages/index.jsx:739` |
| Descripción y detalles | `src/app/views/LandingPages/index.jsx:737` |
| Desde | `src/app/views/CuentasCobro.jsx:337` |
| Desglose por asesor | `src/app/views/ComandoDirectivo.jsx:765` |
| Detalle mensual | `src/app/views/FinanzasAdmin.jsx:426` |
| Detalle: estilo, textos, medidas… | `src/app/views/Marketing.jsx:2210` |
| Detectada por tu navegador: | `src/app/views/Profile.jsx:444` |
| Días anteriores | `src/app/views/Marketing.jsx:2745` |
| Distribución actual de candidatos por etapa | `src/app/views/RRHHModule.jsx:325` |
| Documentos del Equipo | `src/app/features/MetaPanel/index.jsx:1575` |
| Dónde | `src/app/components/DynIsland.jsx:462` |
| Drive | `src/app/views/Marketing.jsx:2035` |
| Editar | `src/app/views/CRM/LeadRelatedContacts.jsx:237` |
| Editar acción | `src/app/views/CRM/components.jsx:2501` |
| Editar nota | `src/app/views/CRM/LeadNotesTimeline.jsx:380` |
| Editar usuario | `src/app/features/Admin/AdminPanel.jsx:316` |
| Egresos | `src/app/views/FinanzasAdmin.jsx:429` |
| Egresos por categoría | `src/app/views/FinanzasAdmin.jsx:355` |
| Ej: Aldea Zama, frente al mar | `src/app/views/LandingPages/index.jsx:658` |
| Ej: Almara Residences | `src/app/views/LandingPages/index.jsx:639` |
| Ej: by Four Seasons | `src/app/views/LandingPages/index.jsx:645` |
| Ej: Familia Rodríguez, James Mitchell... | `src/app/views/LandingPages/index.jsx:1560` |
| Ej. decide junto con el titular | `src/app/views/CRM/LeadRelatedContacts.jsx:158` |
| Ej. Grupo 28 | `src/app/views/ZoomControl/index.jsx:1047` |
| Ej. María González | `src/app/features/Admin/AdminPanel.jsx:449` |
| Ej. María Pérez | `src/app/views/CRM/LeadRelatedContacts.jsx:136` |
| Ej. Rafael García López | `src/app/views/CRM/index.jsx:3207` |
| Ej. Ramírez Torres | `src/app/features/Portal/index.jsx:333` |
| Ej. Sofía | `src/app/features/Portal/index.jsx:332` |
| El bot pidió que un humano tome control | `src/app/views/CRM/components.jsx:5435` |
| El comprobante es un PDF | `src/app/views/Caja.jsx:551` |
| El documento es un PDF | `src/app/views/CRM/components.jsx:4338` |
| El mercado | `src/app/views/LandingPages/LandingPagePreview.jsx:400` |
| Elegir qué columnas ver | `src/app/views/Marketing.jsx:1453` |
| Eliminar | `src/app/features/Admin/AdminPanel.jsx:416` |
| Eliminar acción | `src/app/features/MetaPanel/index.jsx:1404` |
| Eliminar cliente | `src/app/views/CRM/components.jsx:3868` |
| Eliminar definitivamente | `src/app/views/Trash.jsx:197` |
| Eliminar documento | `src/app/features/MetaPanel/index.jsx:1689` |
| Eliminar usuario | `src/app/features/Admin/AdminPanel.jsx:325` |
| Email | `src/app/features/Admin/AdminPanel.jsx:455` |
| Empleado | `src/app/views/RRHHModule.jsx:602` |
| Empresa | `src/app/views/Marketing.jsx:2976` |
| En Seguimiento | `src/app/views/CRM/index.jsx:2583` |
| Enlace | `src/app/views/Marketing.jsx:1511` |
| Enlace de la landing page | `src/app/views/LandingPages/LandingPagePreview.jsx:109` |
| Enlaces | `src/app/views/CRM/components.jsx:4138` |
| Enter | `src/app/views/Marketing.jsx:1676` |
| Entrevistas | `src/app/views/RRHHModule.jsx:566` |
| Envía a | `src/app/views/Copilot.jsx:1770` |
| Enviando… | `src/app/views/CRM/LeadWhatsAppChat.jsx:914` |
| Enviar (Enter) | `src/app/views/CRM/LeadWhatsAppChat.jsx:894` |


_(431 textos más — usá `npm run buscar "texto"`)_

---

## 5. Archivos grandes sin describir

Estos no tienen comentario de cabecera, así que el mapa no puede explicar qué
hacen. Agregarles un bloque `/** ... */` arriba los hace aparecer solos acá.

- `src/app/views/Marketing.jsx` (3075 líneas)
- `src/landing/LandingMarketing.jsx` (1593 líneas)
- `src/app/views/ComandoDirectivo.jsx` (1277 líneas)
- `src/landing/PrivacyPolicy.jsx` (1221 líneas)
- `src/landing/manual-content.js` (1004 líneas)
- `src/landing/Diagnostico.jsx` (974 líneas)
- `src/app/views/CRM/LeadWhatsAppChat.jsx` (942 líneas)
- `src/app/views/RRHHModule.jsx` (839 líneas)
- `src/app/views/InformeAvances.jsx` (747 líneas)
- `src/app/views/ERP.jsx` (698 líneas)
- `src/app/views/WhatsApp.jsx` (667 líneas)
- `src/lib/auth.js` (633 líneas)
- `src/app/data/catalogoProyectos.js` (611 líneas)
- `src/app/views/Caja.jsx` (580 líneas)
- `src/app/views/ChatEquipo.jsx` (569 líneas)
- `src/landing/DataDeletion.jsx` (553 líneas)
- `src/app/views/ComandoDirectivo.pdf.js` (514 líneas)
- `src/app/views/PlanSemanal.jsx` (500 líneas)
- `src/app/views/ZoomControl/Resumen.jsx` (480 líneas)
- `src/app/views/CuentasCobro.jsx` (463 líneas)
- `src/app/views/FinanzasAdmin.jsx` (458 líneas)
- `src/clients/gasil/config.js` (422 líneas)
- `src/lib/offline-mode.js` (351 líneas)
- `src/app/data/leads.js` (348 líneas)
- `src/app/views/Dash.jsx` (344 líneas)
- `src/landing/DukeLeadRouter.jsx` (343 líneas)
- `src/lib/lead-storage.js` (343 líneas)
- `src/app/views/ComandoOps.jsx` (327 líneas)
- `src/lib/whatsapp-chat.js` (326 líneas)
- `src/app/App.css` (321 líneas)
- `src/clients/clinica-dental/config.js` (309 líneas)
- `src/app/views/ZoomControl/Graficas.jsx` (290 líneas)
- `src/lib/lead-save.js` (288 líneas)
- `src/clients/nsg/config.js` (270 líneas)
- `src/app/features/MetaPanel/DocsStratos.jsx` (262 líneas)
- `src/index.css` (250 líneas)
- `src/app/data/chat.js` (249 líneas)
- `src/app/views/Nomina.jsx` (238 líneas)
- `src/lib/manual-stratos-doc.js` (230 líneas)
- `src/lib/organize-notes.js` (220 líneas)
- `src/app/views/ProductividadTab.jsx` (218 líneas)
- `src/app/constants/intelFeatures.js` (211 líneas)
- `src/app/views/CRM/zoom-metrics.js` (207 líneas)
- `src/hooks/useZoomAgendados.js` (204 líneas)
- `src/lib/docx.js` (203 líneas)
- `src/lib/lead-backup.js` (197 líneas)
- `src/clients/vega/config.js` (196 líneas)
- `src/app/views/CRM/CallActionButton.jsx` (183 líneas)
- `src/app/components/Chat.jsx` (182 líneas)
- `src/clients/muebleria/config.js` (182 líneas)
- `src/hooks/useWhatsAppInbox.js` (178 líneas)
- `src/app/views/CRM/RequiresHumanButton.jsx` (177 líneas)
- `src/lib/informe-doc.js` (175 líneas)
- `src/app/views/MiDrive.jsx` (171 líneas)
- `src/components/UpdatePill.jsx` (157 líneas)
- `src/app/components/DynamicIsland.jsx` (153 líneas)
- `src/app/views/CRM/LeadChatHistory.jsx` (152 líneas)
- `src/app/views/CRM/ScheduledCallBadge.jsx` (144 líneas)
- `src/clients/brasa-y-piedra/config.js` (140 líneas)
- `src/lib/iagents-actions.js` (126 líneas)
- `src/mobile-perf.css` (121 líneas)
- `src/app/data/rivieraProperties.js` (119 líneas)
- `src/app/views/ZoomControl/constants.js` (116 líneas)
- `src/app/components/CopilotMark.jsx` (113 líneas)
- `src/lib/chunk-recovery.js` (103 líneas)
- `src/clients/grupo28/config.js` (100 líneas)
- `src/app/constants/areas.js` (97 líneas)
- `src/app/constants/pipeline.js` (93 líneas)
- `src/clients/tgenius/config.js` (90 líneas)
- `src/app/views/CRM/date-range.js` (86 líneas)
- `src/hooks/useTeam.js` (74 líneas)
- `src/lib/ringer.js` (72 líneas)
- `src/lib/supabase.js` (67 líneas)
