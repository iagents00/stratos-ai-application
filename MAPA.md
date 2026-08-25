# MAPA — dónde está cada cosa

> **Generado automáticamente. No lo edites a mano.**
> Lo produce `scripts/generar-mapa.mjs` leyendo el código, así que no puede
> quedar desactualizado. Si moviste algo, corré `npm run mapa`.
>
> ¿Buscás un botón o un texto y no está acá? `npm run buscar "texto"`

**174 archivos · 74.732 líneas**

---

## 1. Pantallas de la app

Lo que ves en el menú lateral, y el archivo que lo dibuja.

| En el menú dice | Archivo | Líneas |
|---|---|---|
| **CRM** | `src\app\views\CRM\index.jsx` | 6656 |
| **Mi Espacio** | _sin vista propia (redirige a otra)_ | — |
| **Plan Semanal** | `src\app\views\PlanSemanal.jsx` | 500 |
| **Copilot** | _sin vista propia (redirige a otra)_ | — |
| **Marketing** | `src\app\views\Marketing.jsx` | 3075 |
| **Actividades** | `src\app\views\Marketing.jsx` | 3075 |
| **Equipo** | `src\app\views\Marketing.jsx` | 3075 |
| **Mi Día** | `src\app\views\Marketing.jsx` | 3075 |
| **Marcas** | `src\app\views\Marketing.jsx` | 3075 |
| **Propiedades** | `src\app\views\Marketing.jsx` | 3075 |
| **Solicitudes** | `src\app\views\Marketing.jsx` | 3075 |
| **Mi Drive** | `src\app\views\MiDrive.jsx` | 171 |
| **WhatsApp** | `src\app\views\WhatsApp.jsx` | 667 |
| **Create** | `src\app\views\LandingPages\index.jsx` | 2022 |
| **Comando** | `src\app\views\ComandoOps.jsx`<br>`src\app\views\ComandoDirectivo.jsx` | 327<br>1277 |
| **Caja** | `src\app\views\Caja.jsx` | 580 |
| **Chat** | `src\app\views\ChatEquipo.jsx` | 569 |
| **Proyectos** | `src\app\views\ERP.jsx` | 698 |
| **iAgents** | `src\app\views\IACRM.jsx` | 622 |
| **Finanzas** | `src\app\views\FinanzasAdmin.jsx` | 458 |
| **Stratos RH** | `src\app\views\RRHHModule.jsx` | 839 |
| **Papelera** | `src\app\views\Trash.jsx` | 285 |
| **Planes** | _sin vista propia (redirige a otra)_ | — |
| **Perfil** | `src\app\views\Profile.jsx` | 1129 |
| **Usuarios** | `src\app\features\Admin\AdminPanel.jsx` | 543 |
| **Proceso** | `src\app\features\Admin\RailsSettings.jsx` | 377 |

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

### `src\app\App.css/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\App.css` | 321 | _sin describir_ |

### `src\app\App.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\App.jsx` | 3033 | Shell principal de Stratos AI |

### `src\app\SharedComponents.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\SharedComponents.jsx` | 343 | Shared primitive components used by all views. |

### `src\app\components\Chat.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\components\Chat.jsx` | 182 | _sin describir_ |

### `src\app\components\CopilotMark.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\components\CopilotMark.jsx` | 113 | _sin describir_ |

### `src\app\components\DynIsland.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\components\DynIsland.jsx` | 488 | Centro de Inteligencia — Dynamic Island con soporte de tema y animaciones. |

### `src\app\components\DynamicIsland.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\components\DynamicIsland.jsx` | 153 | _sin describir_ |

### `src\app\components\HistoryDrawer.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\components\HistoryDrawer.jsx` | 291 | Modal de historial de cambios para cualquier entidad. |

### `src\app\components\IAOSIsland.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\components\IAOSIsland.jsx` | 91 | Indicador IAOS en el header — muestra métricas animadas del pipeline. |

### `src\app\components\Logo.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\components\Logo.jsx` | 87 | Logos SVG de Stratos AI. |

### `src\app\components\PermissionGate.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\components\PermissionGate.jsx` | 52 | Pantalla de acceso restringido por rol. |

### `src\app\components\ProFeatureGate.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\components\ProFeatureGate.jsx` | 208 | pantalla elegante para funciones que requieren |

### `src\app\components\SuggestActionsModal.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\components\SuggestActionsModal.jsx` | 422 | Co-pilot IA que sugiere próximas acciones. |

### `src\app\constants\agents.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\constants\agents.js` | 60 | Registro de agentes IA y sus íconos. |

### `src\app\constants\areas.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\constants\areas.js` | 97 | _sin describir_ |

### `src\app\constants\crm.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\constants\crm.js` | 41 | Constantes del CRM: colores de etapas, fuentes, asesores. |

### `src\app\constants\intelFeatures.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\constants\intelFeatures.js` | 211 | _sin describir_ |

### `src\app\constants\intelMkt.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\constants\intelMkt.js` | 61 | _sin describir_ |

### `src\app\constants\intelNotifs.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\constants\intelNotifs.js` | 86 | Construye las notificaciones REALES del Centro de Inteligencia a partir de los |

### `src\app\constants\labels.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\constants\labels.js` | 62 | Diccionario de ETIQUETAS del CRM, resuelto por cliente. |

### `src\app\constants\navigation.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\constants\navigation.js` | 384 | Configuración de navegación y permisos por módulo. |

### `src\app\constants\pipeline.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\constants\pipeline.js` | 93 | _sin describir_ |

### `src\app\data\asesores.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\data\asesores.js` | 20 | _sin describir_ |

### `src\app\data\catalogoProyectos.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\data\catalogoProyectos.js` | 611 | _sin describir_ |

### `src\app\data\chat.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\data\chat.js` | 249 | _sin describir_ |

### `src\app\data\dashboard.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\data\dashboard.js` | 12 | _sin describir_ |

### `src\app\data\leads.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\data\leads.js` | 348 | _sin describir_ |

### `src\app\data\rivieraProperties.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\data\rivieraProperties.js` | 119 | _sin describir_ |

### `src\app\data\team.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\data\team.js` | 11 | _sin describir_ |

### `src\app\features\Admin\AdminPanel.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\features\Admin\AdminPanel.jsx` | 543 | Panel de gestión de usuarios (Super Admin y Admin). |

### `src\app\features\Admin\RailsSettings.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\features\Admin\RailsSettings.jsx` | 377 | _sin describir_ |

### `src\app\features\Admin\RoleBadge.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\features\Admin\RoleBadge.jsx` | 29 | Badge de rol de usuario con colores según nivel. |

### `src\app\features\ChatPanel\index.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\features\ChatPanel\index.jsx` | 487 | Panel de chat con Agente Stratos AI. |

### `src\app\features\MetaPanel\DocsStratos.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\features\MetaPanel\DocsStratos.jsx` | 262 | _sin describir_ |

### `src\app\features\MetaPanel\index.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\features\MetaPanel\index.jsx` | 2158 | Modal de cuatro pestañas: Lista de Acción · Documentos · Plan Estratégico · Protocolo de Ventas |

### `src\app\features\Portal\index.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\features\Portal\index.jsx` | 453 | Portal de Candidatos — Stratos People |

### `src\app\icons\ios-icons.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\icons\ios-icons.jsx` | 121 | Set de íconos estilo iOS para la experiencia MÓVIL. |

### `src\app\views\CRM\AdvisorMetrics.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\AdvisorMetrics.jsx` | 302 | Tabla de indicadores por asesor (Comando Directivo dentro del CRM). |

### `src\app\views\CRM\CallActionButton.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\CallActionButton.jsx` | 183 | _sin describir_ |

### `src\app\views\CRM\DateRangeControl.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\DateRangeControl.jsx` | 176 | Control ÚNICO de período del Comando / CRM. Presets rápidos (Hoy, Semana, Mes, |

### `src\app\views\CRM\LeadChatHistory.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\LeadChatHistory.jsx` | 152 | _sin describir_ |

### `src\app\views\CRM\LeadDiscoveryPanel.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\LeadDiscoveryPanel.jsx` | 158 | Render del perfilamiento extraído por la IA de voz (Retell) en la tabla |

### `src\app\views\CRM\LeadNotesTimeline.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\LeadNotesTimeline.jsx` | 438 | cronograma de notas individuales para un lead. |

### `src\app\views\CRM\LeadRelatedContacts.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\LeadRelatedContacts.jsx` | 250 | "Familiares o Socios" del expediente — personas ALLEGADAS al contacto |

### `src\app\views\CRM\LeadVoiceCalls.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\LeadVoiceCalls.jsx` | 201 | Sección con las llamadas de voz hechas por Retell AI a este lead. |

### `src\app\views\CRM\LeadWhatsAppChat.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\LeadWhatsAppChat.jsx` | 942 | _sin describir_ |

### `src\app\views\CRM\RangeCalendar.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\RangeCalendar.jsx` | 258 | Calendario de selección de RANGO por clicks. Se usa dentro de DateRangeControl |

### `src\app\views\CRM\RequiresHumanButton.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\RequiresHumanButton.jsx` | 177 | _sin describir_ |

### `src\app\views\CRM\ScheduledCallBadge.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\ScheduledCallBadge.jsx` | 144 | _sin describir_ |

### `src\app\views\CRM\ZoomBoard.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\ZoomBoard.jsx` | 351 | Espacio "Control de Zooms" del Comando Directivo. Tablero enfocado SOLO en |

### `src\app\views\CRM\components.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\components.jsx` | 5872 | Todos los sub-componentes del módulo CRM |

### `src\app\views\CRM\date-range.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\date-range.js` | 86 | _sin describir_ |

### `src\app\views\CRM\index.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\index.jsx` | 6656 | Orquestador principal del módulo CRM |

### `src\app\views\CRM\zoom-metrics.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CRM\zoom-metrics.js` | 207 | _sin describir_ |

### `src\app\views\Caja.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\Caja.jsx` | 580 | _sin describir_ |

### `src\app\views\ChatEquipo.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\ChatEquipo.jsx` | 569 | _sin describir_ |

### `src\app\views\ComandoDirectivo.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\ComandoDirectivo.jsx` | 1277 | _sin describir_ |

### `src\app\views\ComandoDirectivo.pdf.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\ComandoDirectivo.pdf.js` | 514 | _sin describir_ |

### `src\app\views\ComandoOps.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\ComandoOps.jsx` | 327 | _sin describir_ |

### `src\app\views\ConectarWhatsApp.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\ConectarWhatsApp.jsx` | 156 | Conectar WhatsApp Business en tres clics |

### `src\app\views\Copilot.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\Copilot.jsx` | 1804 | v2 (15-jul) |

### `src\app\views\CuentasCobro.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\CuentasCobro.jsx` | 463 | _sin describir_ |

### `src\app\views\Dash.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\Dash.jsx` | 344 | _sin describir_ |

### `src\app\views\ERP.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\ERP.jsx` | 698 | _sin describir_ |

### `src\app\views\FinanzasAdmin.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\FinanzasAdmin.jsx` | 458 | _sin describir_ |

### `src\app\views\IACRM.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\IACRM.jsx` | 622 | iAgents · Equipo de Agentes IA |

### `src\app\views\IACRMPlanes.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\IACRMPlanes.jsx` | 119 | _sin describir_ |

### `src\app\views\InformeAvances.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\InformeAvances.jsx` | 747 | _sin describir_ |

### `src\app\views\LandingPages\LandingPagePreview.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\LandingPages\LandingPagePreview.jsx` | 476 | Pantalla de preview completa — landing pública para el cliente |

### `src\app\views\LandingPages\PublicLanding.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\LandingPages\PublicLanding.jsx` | 95 | La landing personalizada que abre el CLIENTE FINAL |

### `src\app\views\LandingPages\catalogAdapter.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\LandingPages\catalogAdapter.js` | 197 | Puente entre el catálogo maestro y el generador de landings |

### `src\app\views\LandingPages\index.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\LandingPages\index.jsx` | 2022 | Generador de landing pages inmobiliarias |

### `src\app\views\Marketing.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\Marketing.jsx` | 3075 | _sin describir_ |

### `src\app\views\MiDia.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\MiDia.jsx` | 363 | _sin describir_ |

### `src\app\views\MiDrive.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\MiDrive.jsx` | 171 | _sin describir_ |

### `src\app\views\Nomina.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\Nomina.jsx` | 238 | _sin describir_ |

### `src\app\views\PlanSemanal.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\PlanSemanal.jsx` | 500 | _sin describir_ |

### `src\app\views\ProductividadTab.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\ProductividadTab.jsx` | 218 | _sin describir_ |

### `src\app\views\Profile.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\Profile.jsx` | 1129 | vista de perfil del asesor. |

### `src\app\views\RRHHModule.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\RRHHModule.jsx` | 839 | _sin describir_ |

### `src\app\views\Team.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\Team.jsx` | 194 | vista "Asesores" |

### `src\app\views\Trash.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\Trash.jsx` | 285 | Papelera del CRM |

### `src\app\views\WhatsApp.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\WhatsApp.jsx` | 667 | _sin describir_ |

### `src\app\views\ZoomControl\Graficas.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\ZoomControl\Graficas.jsx` | 290 | _sin describir_ |

### `src\app\views\ZoomControl\Resumen.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\ZoomControl\Resumen.jsx` | 480 | _sin describir_ |

### `src\app\views\ZoomControl\ZoomLista.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\ZoomControl\ZoomLista.jsx` | 107 | Lista compacta y clickeable de Zooms — la usan los apartados "Calentitos" y |

### `src\app\views\ZoomControl\constants.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\ZoomControl\constants.js` | 116 | _sin describir_ |

### `src\app\views\ZoomControl\dates.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\ZoomControl\dates.js` | 76 | Helpers de fecha del Control de Zooms, compartidos entre el panel CRUD |

### `src\app\views\ZoomControl\index.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\ZoomControl\index.jsx` | 1205 | Panel "Control de Zooms" — pestaña dentro de Comando Directivo (Duke). |

### `src\app\views\plan-semanal.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\app\views\plan-semanal.js` | 91 | la lógica pura del Plan Semanal. |

### `src\clients\_shared\client-value.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\_shared\client-value.js` | 37 | _sin describir_ |

### `src\clients\_shared\defaults.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\_shared\defaults.js` | 292 | Config base que TODOS los clientes heredan. |

### `src\clients\brasa-y-piedra\config.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\brasa-y-piedra\config.js` | 140 | _sin describir_ |

### `src\clients\clinica-dental\config.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\clinica-dental\config.js` | 309 | _sin describir_ |

### `src\clients\duke\config.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\duke\config.js` | 99 | Configuración del cliente DUKE (cliente original de Stratos AI, en producción). |

### `src\clients\gasil\config.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\gasil\config.js` | 422 | _sin describir_ |

### `src\clients\grupo28\config.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\grupo28\config.js` | 100 | _sin describir_ |

### `src\clients\index.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\index.js` | 216 | Resolver del cliente activo según la URL. |

### `src\clients\legacy-design\config.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\legacy-design\config.js` | 192 | Configuración del tenant LEGACY DESIGN (corporativo Duke — arquitectura y |

### `src\clients\muebleria\config.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\muebleria\config.js` | 182 | _sin describir_ |

### `src\clients\nsg\config.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\nsg\config.js` | 270 | _sin describir_ |

### `src\clients\stratos-sales\config.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\stratos-sales\config.js` | 77 | Configuracion del cliente STRATOS SALES. |

### `src\clients\tgenius\config.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\tgenius\config.js` | 90 | _sin describir_ |

### `src\clients\vega\config.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\clients\vega\config.js` | 196 | _sin describir_ |

### `src\components\ErrorBoundary.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\components\ErrorBoundary.jsx` | 98 | React Error Boundary — captura errores de render y los muestra limpiamente |

### `src\components\UpdatePill.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\components\UpdatePill.jsx` | 157 | _sin describir_ |

### `src\contexts\AuthContext.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\contexts\AuthContext.jsx` | 376 | Estado global de autenticación — conectado a Supabase Auth. |

### `src\contexts\ClientContext.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\contexts\ClientContext.jsx` | 55 | _sin describir_ |

### `src\contexts\ClientOrgGuard.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\contexts\ClientOrgGuard.jsx` | 71 | _sin describir_ |

### `src\data\constants.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\data\constants.js` | 18 | Re-exporta STAGES y STAGE_COLORS desde el design system. |

### `src\design-system\primitives.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\design-system\primitives.jsx` | 159 | Componentes UI atómicos compartidos entre landing y app. |

### `src\design-system\tokens.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\design-system\tokens.js` | 237 | FUENTE ÚNICA DE VERDAD para colores, tipografías y espaciado de Stratos AI. |

### `src\hooks\useAuth.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\hooks\useAuth.js` | 30 | Hook para consumir AuthContext desde cualquier componente. |

### `src\hooks\useClient.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\hooks\useClient.js` | 27 | Hook para consumir el contexto del cliente activo. |

### `src\hooks\useCopilotInbox.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\hooks\useCopilotInbox.js` | 125 | Bandeja/Notificaciones del módulo Copilot: monitorea la tabla tg_bot_activity |

### `src\hooks\useProperties.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\hooks\useProperties.js` | 45 | _sin describir_ |

### `src\hooks\useRailsConfig.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\hooks\useRailsConfig.js` | 112 | _sin describir_ |

### `src\hooks\useScheduledCalls.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\hooks\useScheduledCalls.js` | 73 | Devuelve un Map<phoneDigits, { id, phone_e164, scheduled_at }> con las |

### `src\hooks\useTeam.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\hooks\useTeam.js` | 74 | _sin describir_ |

### `src\hooks\useViewport.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\hooks\useViewport.js` | 92 | Hook único para detectar tamaño de pantalla. Lo usan los componentes del |

### `src\hooks\useWhatsAppInbox.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\hooks\useWhatsAppInbox.js` | 178 | _sin describir_ |

### `src\hooks\useZoomAgendados.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\hooks\useZoomAgendados.js` | 204 | _sin describir_ |

### `src\index.css/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\index.css` | 250 | _sin describir_ |

### `src\landing\DataDeletion.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\DataDeletion.jsx` | 553 | _sin describir_ |

### `src\landing\DeliveryHubCRM.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\DeliveryHubCRM.jsx` | 880 | Hub de Entrega del CRM Stratos AI v1.0 |

### `src\landing\Diagnostico.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\Diagnostico.jsx` | 974 | _sin describir_ |

### `src\landing\DukeLeadRouter.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\DukeLeadRouter.jsx` | 343 | _sin describir_ |

### `src\landing\LandingMarketing.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\LandingMarketing.jsx` | 1593 | _sin describir_ |

### `src\landing\LoginScreen.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\LoginScreen.jsx` | 709 | Pantalla de autenticación completa para la app |

### `src\landing\ManualBrasa.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\ManualBrasa.jsx` | 234 | Manual de uso de Stratos IA para BRASA Y PIEDRA |

### `src\landing\ManualCRM.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\ManualCRM.jsx` | 789 | Manual del CRM Stratos AI para asesores |

### `src\landing\ManualGasil.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\ManualGasil.jsx` | 284 | Manual de uso de Stratos IA para GASIL RADIODIAGNÓSTICO DEL VALLE |

### `src\landing\ManualLegacy.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\ManualLegacy.jsx` | 245 | Manual de uso de Stratos IA para LEGACY DESIGN |

### `src\landing\ManualMarketing.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\ManualMarketing.jsx` | 1025 | Manual de usuario del equipo de MARKETING de Duke |

### `src\landing\ManualMuebleria.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\ManualMuebleria.jsx` | 223 | Manual de uso de Stratos IA para la MUEBLERÍA |

### `src\landing\ManualNSG.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\ManualNSG.jsx` | 284 | Manual de uso de Stratos IA para NSG |

### `src\landing\PricingScreen.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\PricingScreen.jsx` | 554 | Planes y pagos para Stratos AI |

### `src\landing\PrivacyPolicy.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\PrivacyPolicy.jsx` | 1221 | _sin describir_ |

### `src\landing\manual-content.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\manual-content.js` | 1004 | _sin describir_ |

### `src\landing\manual-telegram-content.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\landing\manual-telegram-content.js` | 714 | Manual del COPILOT / Asistente IA (Duke del Caribe) |

### `src\lib\agenda.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\agenda.js` | 91 | _sin describir_ |

### `src\lib\audit.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\audit.js` | 151 | Cliente del sistema de auditoría |

### `src\lib\auth.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\auth.js` | 677 | _sin describir_ |

### `src\lib\backup.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\backup.js` | 116 | Respaldo manual de la base de datos |

### `src\lib\chunk-recovery.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\chunk-recovery.js` | 103 | _sin describir_ |

### `src\lib\docx.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\docx.js` | 203 | _sin describir_ |

### `src\lib\iagents-actions.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\iagents-actions.js` | 126 | _sin describir_ |

### `src\lib\informe-doc.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\informe-doc.js` | 175 | _sin describir_ |

### `src\lib\lead-backup.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\lead-backup.js` | 197 | _sin describir_ |

### `src\lib\lead-draft.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\lead-draft.js` | 85 | Autosave del borrador del modal "Registrar cliente" |

### `src\lib\lead-save.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\lead-save.js` | 288 | _sin describir_ |

### `src\lib\lead-storage.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\lead-storage.js` | 343 | _sin describir_ |

### `src\lib\manual-stratos-doc.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\manual-stratos-doc.js` | 230 | _sin describir_ |

### `src\lib\markdown.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\markdown.jsx` | 129 | Mini renderer Markdown → React. Pensado para las notas privadas que la IA |

### `src\lib\native.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\native.js` | 149 | _sin describir_ |

### `src\lib\next-action-engine.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\next-action-engine.js` | 341 | _sin describir_ |

### `src\lib\offline-mode.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\offline-mode.js` | 351 | _sin describir_ |

### `src\lib\organize-notes.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\organize-notes.js` | 220 | _sin describir_ |

### `src\lib\push-native.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\push-native.js` | 172 | _sin describir_ |

### `src\lib\push.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\push.js` | 416 | Sistema de suscripción a notificaciones Web Push |

### `src\lib\rails-config.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\rails-config.js` | 107 | _sin describir_ |

### `src\lib\recovery.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\recovery.js` | 58 | Recuperación de contraseña por CÓDIGO al correo de recuperación. |

### `src\lib\ringer.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\ringer.js` | 72 | _sin describir_ |

### `src\lib\suggest-actions.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\suggest-actions.js` | 58 | Cliente del agente IA "co-pilot" que sugiere próximas acciones |

### `src\lib\supabase.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\supabase.js` | 67 | _sin describir_ |

### `src\lib\telefono.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\telefono.js` | 61 | _sin describir_ |

### `src\lib\telegram.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\telegram.js` | 839 | Pareo del bot de Telegram con el perfil del asesor. |

### `src\lib\utils.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\utils.js` | 308 | Utilidades compartidas entre todas las vistas. |

### `src\lib\webhook-diagnostico-stratos.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\webhook-diagnostico-stratos.js` | 112 | Envía los resultados del diagnóstico Stratos AI al webhook n8n del funnel. |

### `src\lib\whatsapp-chat.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\whatsapp-chat.js` | 326 | _sin describir_ |

### `src\lib\whatsapp-signup.js/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\lib\whatsapp-signup.js` | 196 | _sin describir_ |

### `src\main.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\main.jsx` | 421 | Entry point de Stratos AI |

### `src\mobile-perf.css/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\mobile-perf.css` | 121 | _sin describir_ |

### `src\pagina-solo-web.jsx/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `src\pagina-solo-web.jsx` | 47 | _sin describir_ |

---

## 4. ¿Dónde está el texto "..."?

Textos visibles de la app y el archivo donde viven. Útil cuando alguien te
dice "cambiá el botón que dice X" y no sabés por dónde empezar.

| Texto | Archivo |
|---|---|
| ¡Listo! | `src\landing\LoginScreen.jsx:319` |
| ¿A qué cliente se le cobra? (ej: Duke) | `src\app\views\CuentasCobro.jsx:321` |
| ¿Cómo funciona el Escáner IA? | `src\app\views\RRHHModule.jsx:813` |
| ¿Cuánto te llevó? (opcional) | `src\app\views\Marketing.jsx:2462` |
| ¿Cuánto? | `src\app\views\Copilot.jsx:1068` |
| ¿De qué empresa es? | `src\app\views\Marketing.jsx:1591` |
| ¿De qué empresa? | `src\app\views\Marketing.jsx:1735` |
| ¿De qué es? (opcional) | `src\app\views\Copilot.jsx:1081` |
| ¿De qué se habla acá? (opcional) | `src\app\views\ChatEquipo.jsx:529` |
| ¿Eliminar usuario? | `src\app\features\Admin\AdminPanel.jsx:410` |
| ¿En qué empresa? (opcional) | `src\app\views\Marketing.jsx:2453` |
| ¿Listo para dar el siguiente paso? | `src\app\views\LandingPages\LandingPagePreview.jsx:456` |
| ¿Olvidaste tu contraseña? | `src\landing\LoginScreen.jsx:597` |
| ¿Por qué la Riviera Maya? | `src\app\views\LandingPages\LandingPagePreview.jsx:401` |
| ¿Qué necesitas? (ej. Flyer promo…) * | `src\app\views\Marketing.jsx:2183` |
| A consultar | `src\app\views\LandingPages\index.jsx:1846` |
| A medida | `src\landing\PricingScreen.jsx:185` |
| Abriendo comprobante… | `src\app\views\Caja.jsx:542` |
| Abriendo documento… | `src\app\views\CRM\components.jsx:4322` |
| Abriendo… | `src\app\views\ChatEquipo.jsx:555` |
| Abrir | `src\app\views\Marketing.jsx:1338` |
| Abrir carpeta de Drive | `src\app\views\LandingPages\index.jsx:1422` |
| Abrir carpeta en Drive | `src\app\views\Marketing.jsx:683` |
| Abrir Discovery | `src\app\views\CRM\index.jsx:5310` |
| Abrir el expediente completo | `src\app\views\WhatsApp.jsx:475` |
| Abrir el expediente completo del cliente | `src\app\views\WhatsApp.jsx:456` |
| Abrir evidencia | `src\app\views\Marketing.jsx:2340` |
| Abrir la ficha completa | `src\app\views\Marketing.jsx:1564` |
| Abrir la ficha completa — acá se edita todo | `src\app\views\Marketing.jsx:1373` |
| Abrir la ficha de la propiedad | `src\app\views\Marketing.jsx:2008` |
| Abrir perfil | `src\app\views\CRM\index.jsx:5308` |
| Abrirlo en Drive | `src\app\features\MetaPanel\DocsStratos.jsx:174` |
| Acceso: | `src\landing\PrivacyPolicy.jsx:405` |
| Access: | `src\landing\PrivacyPolicy.jsx:864` |
| Acciones | `src\app\views\CRM\index.jsx:4328` |
| Acciones acumuladas · Asesores vs. iAgents | `src\app\views\Dash.jsx:85` |
| Acciones de cierre IA | `src\app\views\CRM\components.jsx:5614` |
| Activa tu Copilot AI | `src\app\views\Copilot.jsx:1762` |
| Actividad del equipo IA — hoy | `src\app\views\IACRM.jsx:299` |
| Actividad reciente | `src\app\views\CRM\index.jsx:5893` |
| ACTIVO | `src\app\views\CRM\components.jsx:5501` |
| Activos post-Zoom | `src\app\views\ComandoDirectivo.jsx:694` |
| Activos post-Zoom: | `src\app\views\CRM\ZoomBoard.jsx:169` |
| Actual: | `src\app\views\Profile.jsx:409` |
| Actualización del sistema | `src\app\components\DynIsland.jsx:408` |
| Actualización Importante | `src\app\components\DynamicIsland.jsx:132` |
| Actualizar | `src\app\views\Caja.jsx:303` |
| Adjuntar | `src\app\views\ChatEquipo.jsx:481` |
| Adjuntar imagen, audio o archivo | `src\app\views\CRM\LeadWhatsAppChat.jsx:843` |
| Adjuntar PDF, documento o audio | `src\app\views\CRM\components.jsx:1830` |
| Agencia / Empresa | `src\landing\Diagnostico.jsx:719` |
| Agenda (opcional) | `src\app\views\LandingPages\index.jsx:1606` |
| Agenda una llamada con | `src\app\views\LandingPages\LandingPagePreview.jsx:458` |
| Agenda, lista de acción, documentos y plan | `src\app\App.jsx:2884` |
| Agendar fecha | `src\app\views\CRM\index.jsx:4648` |
| Agendar llamada | `src\app\views\LandingPages\LandingPagePreview.jsx:164` |
| Agendar mi asesoría sin costo | `src\landing\Diagnostico.jsx:783` |
| Agendar sin costo | `src\landing\Diagnostico.jsx:784` |
| Agente Ejecutivo | `src\app\components\Chat.jsx:74` |
| Agente IA | `src\landing\LandingMarketing.jsx:1168` |
| Agente Stratos | `src\app\components\Chat.jsx:60` |
| Agrega algún detalle (opcional)… | `src\landing\Diagnostico.jsx:676` |
| Agrega un teléfono…  +1 555 … | `src\app\views\CRM\components.jsx:1305` |
| Agregar | `src\app\features\MetaPanel\index.jsx:1234` |
| Agregar link | `src\app\views\LandingPages\index.jsx:1936` |
| Agregar otro | `src\app\views\Marketing.jsx:2514` |
| Agregar propiedad | `src\app\views\Marketing.jsx:1448` |
| Agregar tarea de prioridad… | `src\app\views\PlanSemanal.jsx:470` |
| Agregar una columna propia a la hoja | `src\app\views\Marketing.jsx:1459` |
| Ahora no | `src\app\views\Copilot.jsx:1707` |
| AI Call Center | `src\landing\LandingMarketing.jsx:1247` |
| AI-Assisted Business Messaging Guidelines | `src\landing\PrivacyPolicy.jsx:242` |
| Ajusta el rango en el paso anterior | `src\app\views\LandingPages\index.jsx:1951` |
| ALDEA ZAMA · TULUM | `src\app\views\LandingPages\index.jsx:305` |
| Alta intención | `src\app\views\ZoomControl\index.jsx:583` |
| Alta intención — señal de cierre en el Zoom | `src\app\views\ZoomControl\index.jsx:696` |
| Alternate email: | `src\landing\PrivacyPolicy.jsx:877` |
| Amenidades (separadas por coma) | `src\app\views\LandingPages\index.jsx:760` |
| Análisis IA | `src\app\views\CRM\components.jsx:5376` |
| Analizar | `src\app\views\CRM\index.jsx:5305` |
| Analizar con IA → | `src\app\views\Dash.jsx:241` |
| Analytics cookies: | `src\landing\PrivacyPolicy.jsx:908` |
| Anterior | `src\app\views\CRM\index.jsx:3155` |
| Añade tareas concretas para este cliente | `src\app\views\CRM\components.jsx:2162` |
| Añadir | `src\app\views\CRM\components.jsx:5768` |
| Aparecerán al inicio de su pipeline en | `src\app\views\CRM\index.jsx:6170` |
| API de Marketing de Meta | `src\landing\PrivacyPolicy.jsx:124` |
| API de WhatsApp Business Cloud | `src\landing\PrivacyPolicy.jsx:124` |
| Aplicaciones | `src\app\App.jsx:2947` |
| Apps | `src\app\App.jsx:2122` |
| Áreas de atención | `src\app\views\RRHHModule.jsx:786` |
| Arquitectura Calculada | `src\landing\Diagnostico.jsx:704` |
| Arrastra el CV aquí o haz clic para subir | `src\app\views\RRHHModule.jsx:709` |
| Arrastra para cambiar la prioridad | `src\app\views\Marketing.jsx:2236` |
| Asesor | `src\app\views\ComandoDirectivo.jsx:771` |
| Asignar a un asesor | `src\app\features\MetaPanel\index.jsx:871` |
| Asignar a… | `src\app\views\Marketing.jsx:863` |
| Asignar responsable | `src\app\features\MetaPanel\index.jsx:860` |
| Asistió (sem.) | `src\app\views\ZoomControl\Resumen.jsx:411` |
| Asunto sugerido: | `src\landing\DataDeletion.jsx:92` |
| Atención Inmediata | `src\app\views\Dash.jsx:235` |
| Atención instantánea | `src\landing\LandingMarketing.jsx:1269` |
| Auditoría Estructural | `src\landing\Diagnostico.jsx:610` |
| Aún no configuras un correo de recuperación. | `src\app\views\Profile.jsx:410` |
| Aún no hay documentos | `src\app\features\MetaPanel\index.jsx:1646` |
| Aviso de privacidad | `src\landing\DukeLeadRouter.jsx:333` |
| Badge | `src\app\views\LandingPages\index.jsx:662` |
| BAJA | `src\landing\DataDeletion.jsx:108` |
| Bajo · Medio · Alto | `src\app\views\CRM\components.jsx:3431` |
| Biometric data. | `src\landing\PrivacyPolicy.jsx:628` |
| Bloqueo directo | `src\landing\DataDeletion.jsx:124` |
| Browsing on our website | `src\landing\PrivacyPolicy.jsx:642` |
| Buscar (⌘K) | `src\app\App.jsx:2209` |
| Buscar asesor… | `src\app\views\CRM\components.jsx:3188` |
| Buscar candidato... | `src\app\views\RRHHModule.jsx:409` |
| Buscar cliente o teléfono… | `src\app\views\WhatsApp.jsx:212` |
| Buscar cliente, proyecto, liner… | `src\app\views\ZoomControl\index.jsx:498` |
| Buscar desarrollo o zona… | `src\app\views\LandingPages\index.jsx:1398` |
| Buscar en el manual... | `src\landing\ManualCRM.jsx:593` |
| Buscar en el manual… | `src\landing\ManualBrasa.jsx:188` |
| Buscar en las actividades… | `src\app\views\Marketing.jsx:1782` |
| Buscar en papelera… | `src\app\views\Trash.jsx:99` |
| Buscar nombre o email… | `src\app\features\Admin\AdminPanel.jsx:270` |
| Buscar por categoría, obra, persona… | `src\app\views\Caja.jsx:447` |
| Buscar por nombre, masterbroker o contacto… | `src\app\views\ERP.jsx:415` |
| Buscar propiedad, ubicación, estatus, año… | `src\app\views\Marketing.jsx:1430` |
| Buscar solicitudes… | `src\app\views\Marketing.jsx:2171` |
| By email (recommended) | `src\landing\DataDeletion.jsx:243` |
| By WhatsApp (instant) | `src\landing\DataDeletion.jsx:260` |
| Caja | `src\app\views\Caja.jsx:295` |
| CALCULADORA DE RETORNO | `src\app\views\LandingPages\index.jsx:881` |
| Calificación BANT | `src\app\views\CRM\components.jsx:5527` |
| Cambiar | `src\app\views\LandingPages\index.jsx:1936` |
| Cambiar cuánto gana | `src\app\views\Nomina.jsx:180` |
| Cambiar el estatus | `src\app\views\Marketing.jsx:1575` |
| Cambiar etapa | `src\app\views\CRM\components.jsx:277` |
| Cambiar fecha | `src\app\features\MetaPanel\index.jsx:1113` |
| Cambiar la etapa del lead | `src\app\views\WhatsApp.jsx:503` |
| Cambiar orden de las tarjetas de prioridad | `src\app\views\CRM\index.jsx:2639` |
| Cambiar posición de prioridad | `src\app\views\CRM\index.jsx:2800` |
| Cambiar prioridad | `src\app\features\MetaPanel\index.jsx:1319` |
| Campañas Recientes | `src\app\views\LandingPages\index.jsx:1255` |
| Campo requerido | `src\app\views\LandingPages\index.jsx:641` |
| Canales | `src\app\views\ChatEquipo.jsx:303` |
| CANCEL | `src\landing\DataDeletion.jsx:268` |
| Cancelación: | `src\landing\PrivacyPolicy.jsx:407` |
| Cancelar | `src\app\features\Admin\AdminPanel.jsx:415` |
| Cancelar comentario | `src\app\views\Copilot.jsx:1049` |
| Cancellation: | `src\landing\PrivacyPolicy.jsx:866` |
| CANDIDATO IDENTIFICADO | `src\app\views\RRHHModule.jsx:740` |
| Característica | `src\landing\LandingMarketing.jsx:635` |
| Características | `src\app\views\LandingPages\index.jsx:704` |
| Cargando actividad… | `src\app\views\Profile.jsx:978` |
| Cargando conversación… | `src\app\views\Copilot.jsx:980` |
| Cargando conversaciones… | `src\app\views\WhatsApp.jsx:263` |
| Cargando el plan… | `src\app\views\PlanSemanal.jsx:353` |
| Cargando el tablero… | `src\app\views\ComandoOps.jsx:127` |
| Cargando equipo… | `src\app\App.jsx:2237` |
| Cargando movimientos… | `src\app\views\Caja.jsx:454` |
| Cargando Zooms… | `src\app\views\ZoomControl\index.jsx:515` |
| Cargando… | `src\app\views\FinanzasAdmin.jsx:320` |
| Cargo / Departamento | `src\app\views\RRHHModule.jsx:602` |
| Carpeta de crudos | `src\app\views\Marketing.jsx:2032` |
| Carpeta de Drive | `src\app\views\ERP.jsx:662` |
| Catálogo de Propiedades | `src\app\views\LandingPages\index.jsx:1300` |
| Catálogo de Proyectos | `src\app\views\ERP.jsx:310` |
| Centro de Agentes IA | `src\app\views\CRM\index.jsx:5474` |
| Centro de Inteligencia | `src\app\components\DynamicIsland.jsx:81` |
| Centro de Inteligencia — Activo | `src\app\components\DynamicIsland.jsx:102` |
| Cerrar | `src\app\App.jsx:2800` |
| Cerrar (Esc) | `src\app\views\ZoomControl\index.jsx:797` |
| Cerrar detalle | `src\app\views\ZoomControl\Resumen.jsx:299` |
| Cerrar Mi Espacio | `src\app\features\MetaPanel\index.jsx:664` |
| Cerrar sesión | `src\app\App.jsx:2570` |
| Cerrar vista previa | `src\app\views\LandingPages\LandingPagePreview.jsx:202` |
| Chats | `src\app\views\WhatsApp.jsx:633` |
| Chatwoot | `src\landing\PrivacyPolicy.jsx:125` |
| Chatwoot (autohospedado) | `src\landing\PrivacyPolicy.jsx:294` |
| Chatwoot (self-hosted) | `src\landing\PrivacyPolicy.jsx:753` |
| Cierres | `src\app\views\Team.jsx:116` |
| Clic en anuncios de Meta | `src\landing\PrivacyPolicy.jsx:180` |
| Click on Meta ads | `src\landing\PrivacyPolicy.jsx:639` |
| Click para agendar fecha/hora de la cita | `src\app\views\CRM\index.jsx:4625` |
| Click para editar | `src\app\features\MetaPanel\index.jsx:333` |
| Click para escribir el número directamente | `src\app\views\CRM\components.jsx:695` |
| Cliente | `src\app\views\Copilot.jsx:1078` |
| Coaching IA · Análisis | `src\app\views\CRM\components.jsx:4998` |
| Color de acento para la tarjeta | `src\app\views\LandingPages\index.jsx:802` |
| Color personalizado | `src\app\views\LandingPages\index.jsx:815` |
| Columna nueva | `src\app\views\Marketing.jsx:1463` |
| Columnas del equipo | `src\app\views\Marketing.jsx:3035` |
| Comando Directivo | `src\app\views\ComandoDirectivo.jsx:662` |
| Cómo lo calculamos | `src\landing\Diagnostico.jsx:832` |
| Cómo se usa | `src\app\components\DynIsland.jsx:467` |
| Cómo terminaron los Zooms del mes | `src\app\views\ZoomControl\Graficas.jsx:202` |
| Cómo trabaja el equipo IA | `src\app\views\IACRM.jsx:576` |
| Cómo trabajarías con Stratos | `src\landing\Diagnostico.jsx:870` |
| Cómo trabajas hoy | `src\landing\Diagnostico.jsx:866` |
| Cómo verá el cliente | `src\app\views\LandingPages\index.jsx:131` |
| Comparación de planes | `src\landing\PricingScreen.jsx:452` |
| Comparativa | `src\landing\LandingMarketing.jsx:1488` |
| Complejidad: | `src\app\views\Marketing.jsx:2190` |
| Comunicaciones por correo electrónico | `src\landing\PrivacyPolicy.jsx:182` |
| Conectado | `src\app\views\Profile.jsx:731` |
| Conectando… | `src\app\views\ConectarWhatsApp.jsx:122` |
| Conectar mi WhatsApp | `src\app\views\ConectarWhatsApp.jsx:123` |
| Configuración | `src\app\App.jsx:2983` |
| Confirmados | `src\app\views\ZoomControl\Resumen.jsx:440` |
| Confirmar contraseña | `src\app\views\Profile.jsx:313` |
| Confirmas y listo | `src\app\views\ConectarWhatsApp.jsx:107` |
| Consent: | `src\landing\PrivacyPolicy.jsx:691` |
| Consentimiento: | `src\landing\PrivacyPolicy.jsx:232` |
| Consultas empresariales | `src\landing\PricingScreen.jsx:512` |
| Contáctame Ya | `src\app\views\CRM\index.jsx:6170` |
| Contarlo ahora | `src\app\views\Marketing.jsx:708` |
| Contenido | `src\landing\ManualMarketing.jsx:821` |
| Continuar sin CV | `src\app\features\Portal\index.jsx:425` |
| Contractual framework: | `src\landing\PrivacyPolicy.jsx:748` |
| Contraseñas de cuentas de terceros. | `src\landing\PrivacyPolicy.jsx:167` |
| Contratar | `src\landing\PricingScreen.jsx:298` |
| Conversaciones iniciadas por usted | `src\landing\PrivacyPolicy.jsx:179` |
| Conversations initiated by you | `src\landing\PrivacyPolicy.jsx:638` |
| Conversión | `src\app\views\Team.jsx:116` |
| Conversión a Zoom | `src\app\views\ComandoDirectivo.jsx:713` |
| Cookies de análisis: | `src\landing\PrivacyPolicy.jsx:450` |
| Cookies de marketing (Meta Pixel): | `src\landing\PrivacyPolicy.jsx:451` |
| Cookies estrictamente necesarias: | `src\landing\PrivacyPolicy.jsx:449` |
| Copiado | `src\app\views\LandingPages\LandingPagePreview.jsx:119` |
| Copiar | `src\app\views\InformeAvances.jsx:633` |
| Copiar el discovery al portapapeles | `src\app\views\ZoomControl\index.jsx:825` |
| Copiar resumen para Telegram | `src\app\views\CRM\components.jsx:4560` |
| Copilot AI | `src\app\views\Copilot.jsx:930` |
| Corregir lo que escribiste | `src\app\views\Marketing.jsx:1853` |
| Correo alterno: | `src\landing\PrivacyPolicy.jsx:418` |
| Correo de privacidad: | `src\landing\PrivacyPolicy.jsx:102` |
| Correo de recuperación | `src\app\views\Profile.jsx:377` |
| Correo electrónico | `src\landing\DeliveryHubCRM.jsx:755` |
| Correo electrónico. | `src\landing\PrivacyPolicy.jsx:148` |
| Correo principal: | `src\landing\PrivacyPolicy.jsx:417` |
| Correo Profesional | `src\landing\Diagnostico.jsx:725` |
| Crear | `src\app\views\Marketing.jsx:915` |
| Crear con voz | `src\app\views\Marketing.jsx:2873` |
| Crear con voz — díctale al Copilot | `src\app\views\Marketing.jsx:2868` |
| Crear landing | `src\app\views\LandingPages\index.jsx:1429` |
| Crear Landing Page | `src\app\views\LandingPages\index.jsx:1542` |
| Crear Usuario | `src\app\features\Admin\AdminPanel.jsx:533` |
| CRM Stratos AI | `src\landing\DeliveryHubCRM.jsx:451` |
| Cuándo se registró | `src\app\views\Marketing.jsx:1823` |
| Cuánto se le cobra | `src\app\views\CuentasCobro.jsx:323` |
| Cuenta (Caja, Banco…) | `src\app\views\Caja.jsx:380` |


_(671 textos más — usá `npm run buscar "texto"`)_

---

## 5. Archivos grandes sin describir

Estos no tienen comentario de cabecera, así que el mapa no puede explicar qué
hacen. Agregarles un bloque `/** ... */` arriba los hace aparecer solos acá.

- `src\app\views\Marketing.jsx` (3075 líneas)
- `src\landing\LandingMarketing.jsx` (1593 líneas)
- `src\app\views\ComandoDirectivo.jsx` (1277 líneas)
- `src\landing\PrivacyPolicy.jsx` (1221 líneas)
- `src\landing\manual-content.js` (1004 líneas)
- `src\landing\Diagnostico.jsx` (974 líneas)
- `src\app\views\CRM\LeadWhatsAppChat.jsx` (942 líneas)
- `src\app\views\RRHHModule.jsx` (839 líneas)
- `src\app\views\InformeAvances.jsx` (747 líneas)
- `src\app\views\ERP.jsx` (698 líneas)
- `src\lib\auth.js` (677 líneas)
- `src\app\views\WhatsApp.jsx` (667 líneas)
- `src\app\data\catalogoProyectos.js` (611 líneas)
- `src\app\views\Caja.jsx` (580 líneas)
- `src\app\views\ChatEquipo.jsx` (569 líneas)
- `src\landing\DataDeletion.jsx` (553 líneas)
- `src\app\views\ComandoDirectivo.pdf.js` (514 líneas)
- `src\app\views\PlanSemanal.jsx` (500 líneas)
- `src\app\views\ZoomControl\Resumen.jsx` (480 líneas)
- `src\app\views\CuentasCobro.jsx` (463 líneas)
- `src\app\views\FinanzasAdmin.jsx` (458 líneas)
- `src\clients\gasil\config.js` (422 líneas)
- `src\app\features\Admin\RailsSettings.jsx` (377 líneas)
- `src\app\views\MiDia.jsx` (363 líneas)
- `src\lib\offline-mode.js` (351 líneas)
- `src\app\data\leads.js` (348 líneas)
- `src\app\views\Dash.jsx` (344 líneas)
- `src\landing\DukeLeadRouter.jsx` (343 líneas)
- `src\lib\lead-storage.js` (343 líneas)
- `src\lib\next-action-engine.js` (341 líneas)
- `src\app\views\ComandoOps.jsx` (327 líneas)
- `src\lib\whatsapp-chat.js` (326 líneas)
- `src\app\App.css` (321 líneas)
- `src\clients\clinica-dental\config.js` (309 líneas)
- `src\app\views\ZoomControl\Graficas.jsx` (290 líneas)
- `src\lib\lead-save.js` (288 líneas)
- `src\clients\nsg\config.js` (270 líneas)
- `src\app\features\MetaPanel\DocsStratos.jsx` (262 líneas)
- `src\index.css` (250 líneas)
- `src\app\data\chat.js` (249 líneas)
- `src\app\views\Nomina.jsx` (238 líneas)
- `src\lib\manual-stratos-doc.js` (230 líneas)
- `src\lib\organize-notes.js` (220 líneas)
- `src\app\views\ProductividadTab.jsx` (218 líneas)
- `src\app\constants\intelFeatures.js` (211 líneas)
- `src\app\views\CRM\zoom-metrics.js` (207 líneas)
- `src\hooks\useZoomAgendados.js` (204 líneas)
- `src\lib\docx.js` (203 líneas)
- `src\lib\lead-backup.js` (197 líneas)
- `src\clients\vega\config.js` (196 líneas)
- `src\lib\whatsapp-signup.js` (196 líneas)
- `src\app\views\CRM\CallActionButton.jsx` (183 líneas)
- `src\app\components\Chat.jsx` (182 líneas)
- `src\clients\muebleria\config.js` (182 líneas)
- `src\hooks\useWhatsAppInbox.js` (178 líneas)
- `src\app\views\CRM\RequiresHumanButton.jsx` (177 líneas)
- `src\lib\informe-doc.js` (175 líneas)
- `src\lib\push-native.js` (172 líneas)
- `src\app\views\MiDrive.jsx` (171 líneas)
- `src\components\UpdatePill.jsx` (157 líneas)
- `src\app\components\DynamicIsland.jsx` (153 líneas)
- `src\app\views\CRM\LeadChatHistory.jsx` (152 líneas)
- `src\lib\native.js` (149 líneas)
- `src\app\views\CRM\ScheduledCallBadge.jsx` (144 líneas)
- `src\clients\brasa-y-piedra\config.js` (140 líneas)
- `src\lib\iagents-actions.js` (126 líneas)
- `src\mobile-perf.css` (121 líneas)
- `src\app\data\rivieraProperties.js` (119 líneas)
- `src\app\views\IACRMPlanes.jsx` (119 líneas)
- `src\app\views\ZoomControl\constants.js` (116 líneas)
- `src\app\components\CopilotMark.jsx` (113 líneas)
- `src\hooks\useRailsConfig.js` (112 líneas)
- `src\lib\rails-config.js` (107 líneas)
- `src\lib\chunk-recovery.js` (103 líneas)
- `src\clients\grupo28\config.js` (100 líneas)
- `src\app\constants\areas.js` (97 líneas)
- `src\app\constants\pipeline.js` (93 líneas)
- `src\lib\agenda.js` (91 líneas)
- `src\clients\tgenius\config.js` (90 líneas)
- `src\app\views\CRM\date-range.js` (86 líneas)
- `src\hooks\useTeam.js` (74 líneas)
- `src\lib\ringer.js` (72 líneas)
- `src\contexts\ClientOrgGuard.jsx` (71 líneas)
- `src\lib\supabase.js` (67 líneas)
- `src\app\constants\intelMkt.js` (61 líneas)
- `src\lib\telefono.js` (61 líneas)
