# MAPA — dónde está cada cosa

> **Generado automáticamente. No lo edites a mano.**
> Lo produce `scripts/generar-mapa.mjs` leyendo el código, así que no puede
> quedar desactualizado. Si moviste algo, corré `npm run mapa`.
>
> ¿Buscás un botón o un texto y no está acá? `npm run buscar "texto"`

**237 archivos · 80.595 líneas**

---

## 1. Pantallas de la app

Lo que ves en el menú lateral, y el archivo que lo dibuja.

| En el menú dice | Archivo | Líneas |
|---|---|---|
| **Agenda** | `src/dental-demo/TenantHuliWorkspace.jsx` | 11 |
| **CRM** | `src/dental-demo/TenantHuliWorkspace.jsx`<br>`src/app/views/CRM/index.jsx` | 11<br>6665 |
| **Mi Espacio** | _sin vista propia (redirige a otra)_ | — |
| **Plan Semanal** | `src/app/views/PlanSemanal.jsx` | 515 |
| **Copilot** | `src/dental-demo/TenantHuliWorkspace.jsx`<br>`src/app/views/Copilot.jsx` | 11<br>2019 |
| **Marketing** | `src/app/views/ISpaceBoard.jsx`<br>`src/app/views/Marketing.jsx` | 148<br>3075 |
| **Actividades** | `src/app/views/ISpaceBoard.jsx`<br>`src/app/views/Marketing.jsx` | 148<br>3075 |
| **Equipo** | `src/app/views/ISpaceBoard.jsx`<br>`src/app/views/Marketing.jsx` | 148<br>3075 |
| **Mi Día** | `src/app/views/ISpaceBoard.jsx`<br>`src/app/views/Marketing.jsx` | 148<br>3075 |
| **Marcas** | `src/app/views/ISpaceBoard.jsx`<br>`src/app/views/Marketing.jsx` | 148<br>3075 |
| **Propiedades** | `src/app/views/ISpaceBoard.jsx`<br>`src/app/views/Marketing.jsx` | 148<br>3075 |
| **Solicitudes** | `src/app/views/ISpaceBoard.jsx`<br>`src/app/views/Marketing.jsx` | 148<br>3075 |
| **Mi Drive** | `src/app/views/MiDrive.jsx` | 171 |
| **WhatsApp** | _sin vista propia (redirige a otra)_ | — |
| **Create** | `src/app/views/LandingPages/index.jsx` | 2022 |
| **Comando** | `src/app/views/ComandoOps.jsx`<br>`src/app/views/ComandoDirectivo.jsx` | 327<br>961 |
| **Caja** | `src/app/views/Caja.jsx` | 593 |
| **Chat** | `src/app/views/ChatEquipo.jsx` | 569 |
| **Proyectos** | `src/app/views/ERP.jsx` | 719 |
| **iAgents** | `src/app/views/IACRM.jsx` | 622 |
| **Finanzas** | `src/app/views/FinanzasAdmin.jsx` | 443 |
| **Stratos RH** | `src/app/views/RRHHModule.jsx` | 846 |
| **Papelera** | `src/app/views/Trash.jsx` | 285 |
| **Planes** | _sin vista propia (redirige a otra)_ | — |
| **Perfil** | `src/dental-demo/TenantHuliWorkspace.jsx`<br>`src/app/views/Profile.jsx` | 11<br>1149 |
| **Usuarios** | `src/app/features/Admin/AdminPanel.jsx` | 644 |
| **Proceso** | `src/app/features/Admin/RailsSettings.jsx` | 141 |

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
| `/onboarding-call-center` · `/call-center` · `/ai-call-center` | — |

---

## 3. Todos los archivos, por carpeta

### `src/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `main.jsx` | 432 | Entry point de Stratos AI |
| `index.css` | 256 | _sin describir_ |
| `mobile-perf.css` | 121 | _sin describir_ |
| `pagina-solo-web.jsx` | 47 | _sin describir_ |

### `src/app/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `App.jsx` | 3191 | _sin describir_ |
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
| `EstadoAvisos.jsx` | 158 | _sin describir_ |
| `DynamicIsland.jsx` | 153 | _sin describir_ |
| `CopilotCapabilities.jsx` | 131 | _sin describir_ |
| `CopilotMark.jsx` | 113 | _sin describir_ |
| `IAOSIsland.jsx` | 90 | Indicador IAOS en el header — muestra métricas animadas del pipeline. |
| `Logo.jsx` | 87 | Logos SVG de Stratos AI. |
| `MobileHeaderMenu.jsx` | 65 | _sin describir_ |
| `PermissionGate.jsx` | 52 | Pantalla de acceso restringido por rol. |
| `MobileHeaderMenu.css` | 24 | _sin describir_ |

### `src/app/constants/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `navigation.js` | 402 | Configuración de navegación y permisos por módulo. |
| `intelFeatures.js` | 211 | _sin describir_ |
| `pipeline.js` | 129 | _sin describir_ |
| `areas.js` | 97 | _sin describir_ |
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
| `index.jsx` | 2390 | Modal de cuatro pestañas: Lista de Acción · Documentos · Plan Estratégico · Protocolo de Ventas |
| `Rails.css` | 832 | _sin describir_ |
| `AdminPanel.jsx` | 644 | Panel de gestión de usuarios (Super Admin y Admin). |
| `index.jsx` | 487 | Panel de chat con Agente Stratos AI. |
| `index.jsx` | 453 | Portal de Candidatos — Stratos People |
| `PipelineConfiguratorAdmin.jsx` | 312 | _sin describir_ |
| `DocsStratos.jsx` | 262 | _sin describir_ |
| `WhatsAppOnboardingAdmin.jsx` | 237 | _sin describir_ |
| `PlatformAdminConsole.jsx` | 223 | _sin describir_ |
| `CatalogConfiguratorAdmin.jsx` | 158 | _sin describir_ |
| `CajaPermissionsAdmin.jsx` | 154 | _sin describir_ |
| `RailsSettings.jsx` | 141 | Configuración de Stratos Rails. Los controles editan un borrador por organización. |
| `RailsSettings.css` | 86 | _sin describir_ |
| `CompanySetupAdmin.jsx` | 80 | _sin describir_ |
| `useBoard.js` | 48 | _sin describir_ |
| `rails-theme.js` | 31 | _sin describir_ |
| `RoleBadge.jsx` | 29 | Badge de rol de usuario con colores según nivel. |

### `src/app/icons/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `ios-icons.jsx` | 130 | Set de íconos estilo iOS para la experiencia MÓVIL. |

### `src/app/views/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `index.jsx` | 6665 | _sin describir_ |
| `components.jsx` | 5874 | Todos los sub-componentes del módulo CRM |
| `Marketing.jsx` | 3075 | _sin describir_ |
| `index.jsx` | 2022 | Generador de landing pages inmobiliarias |
| `Copilot.jsx` | 2019 | v2 (15-jul) |
| `index.jsx` | 1223 | Panel "Control de Zooms" — pestaña dentro de Comando Directivo (Duke). |
| `Profile.jsx` | 1149 | vista de perfil del asesor. |
| `ComandoDirectivo.jsx` | 961 | _sin describir_ |
| `LeadWhatsAppChat.jsx` | 942 | _sin describir_ |
| `RRHHModule.jsx` | 846 | _sin describir_ |
| `InformeAvances.jsx` | 747 | _sin describir_ |
| `ERP.jsx` | 719 | _sin describir_ |
| `WhatsApp.jsx` | 667 | _sin describir_ |
| `IACRM.jsx` | 622 | iAgents · Equipo de Agentes IA |
| `Caja.jsx` | 593 | _sin describir_ |
| `ChatEquipo.jsx` | 569 | _sin describir_ |
| `PlanSemanal.jsx` | 515 | _sin describir_ |
| `ComandoDirectivo.pdf.js` | 514 | _sin describir_ |
| `Resumen.jsx` | 490 | _sin describir_ |
| `LandingPagePreview.jsx` | 476 | Pantalla de preview completa — landing pública para el cliente |
| `CuentasCobro.jsx` | 463 | _sin describir_ |
| `FinanzasAdmin.jsx` | 443 | _sin describir_ |
| `LeadNotesTimeline.jsx` | 438 | cronograma de notas individuales para un lead. |
| `ZoomBoard.jsx` | 360 | Espacio "Control de Zooms" del Comando Directivo. Tablero enfocado SOLO en |
| `Dash.jsx` | 344 | _sin describir_ |
| `ComandoOps.jsx` | 327 | _sin describir_ |
| `Trash.jsx` | 285 | Papelera del CRM |
| `Graficas.jsx` | 284 | _sin describir_ |
| `RangeCalendar.jsx` | 259 | Calendario de selección de RANGO por clicks. Se usa dentro de DateRangeControl |
| `LeadRelatedContacts.jsx` | 250 | "Familiares o Socios" del expediente — personas ALLEGADAS al contacto |
| `Nomina.jsx` | 238 | _sin describir_ |
| `ProductividadTab.jsx` | 225 | _sin describir_ |
| `zoom-metrics.js` | 210 | _sin describir_ |
| `LeadVoiceCalls.jsx` | 201 | Sección con las llamadas de voz hechas por Retell AI a este lead. |
| `catalogAdapter.js` | 199 | Puente entre el catálogo maestro y el generador de landings |
| `Team.jsx` | 194 | vista "Asesores" |
| `CallActionButton.jsx` | 184 | _sin describir_ |
| `DateRangeControl.jsx` | 179 | Control ÚNICO de período del Comando / CRM. Presets rápidos (Hoy, Semana, Mes, |
| `RequiresHumanButton.jsx` | 177 | _sin describir_ |
| `MiDrive.jsx` | 171 | _sin describir_ |
| `LeadDiscoveryPanel.jsx` | 158 | Render del perfilamiento extraído por la IA de voz (Retell) en la tabla |
| `ConectarWhatsApp.jsx` | 156 | Conectar WhatsApp Business en tres clics |
| `MiDia.jsx` | 155 | _sin describir_ |
| `AdvisorMetrics.jsx` | 152 | Tabla de indicadores por asesor (Comando Directivo dentro del CRM). |
| `LeadChatHistory.jsx` | 152 | _sin describir_ |
| `ISpaceBoard.jsx` | 148 | _sin describir_ |
| `ScheduledCallBadge.jsx` | 144 | _sin describir_ |
| `IACRMPlanes.jsx` | 119 | _sin describir_ |
| `constants.js` | 116 | _sin describir_ |
| `ZoomLista.jsx` | 107 | Lista compacta y clickeable de Zooms — la usan los apartados "Calentitos" y |
| `command-metrics.js` | 101 | _sin describir_ |
| `date-range.js` | 97 | _sin describir_ |
| `PublicLanding.jsx` | 95 | La landing personalizada que abre el CLIENTE FINAL |
| `plan-semanal.js` | 91 | la lógica pura del Plan Semanal. |
| `dates.js` | 76 | Helpers de fecha del Control de Zooms, compartidos entre el panel CRUD |
| `command-report.js` | 63 | _sin describir_ |
| `MiDia.css` | 31 | _sin describir_ |
| `productivity-metrics.js` | 20 | _sin describir_ |
| `indicators.js` | 6 | _sin describir_ |
| `ISpaceBoard.css` | 5 | _sin describir_ |

### `src/clients/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `index.js` | 231 | Resolver del cliente activo según la URL. |

### `src/clients/_shared/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `defaults.js` | 296 | Config base que TODOS los clientes heredan. |
| `client-value.js` | 40 | _sin describir_ |

### `src/clients/brasa-y-piedra/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 140 | _sin describir_ |

### `src/clients/clinica-dental/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 311 | _sin describir_ |

### `src/clients/clinica-dental-demo/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 15 | _sin describir_ |

### `src/clients/demo/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 113 | _sin describir_ |

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

### `src/clients/i-space/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 80 | _sin describir_ |

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

### `src/clients/tenant/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `config.js` | 93 | Entrada neutral para organizaciones creadas desde la consola de plataforma. |
| `managed-features.js` | 16 | _sin describir_ |

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
| `ClientOrgGuard.jsx` | 79 | _sin describir_ |
| `ClientContext.jsx` | 63 | _sin describir_ |
| `TenantConfigGate.jsx` | 55 | _sin describir_ |

### `src/data/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `constants.js` | 18 | Re-exporta STAGES y STAGE_COLORS desde el design system. |

### `src/dental-demo/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `DentalDemo.jsx` | 63 | _sin describir_ |
| `HuliWorkspace.jsx` | 43 | _sin describir_ |
| `ClinicalProfile.jsx` | 16 | _sin describir_ |
| `model.js` | 16 | _sin describir_ |
| `HuliContext.jsx` | 14 | _sin describir_ |
| `DentalProfile.jsx` | 13 | _sin describir_ |
| `TenantHuliWorkspace.jsx` | 11 | _sin describir_ |
| `profile-data.js` | 10 | _sin describir_ |
| `DentalIdentity.jsx` | 5 | _sin describir_ |
| `DentalProfileRouter.jsx` | 4 | _sin describir_ |
| `dental-demo.css` | 4 | _sin describir_ |
| `huli-workspace.css` | 4 | _sin describir_ |

### `src/design-system/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `tokens.js` | 237 | FUENTE ÚNICA DE VERDAD para colores, tipografías y espaciado de Stratos AI. |
| `primitives.jsx` | 159 | Componentes UI atómicos compartidos entre landing y app. |

### `src/hooks/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `useZoomAgendados.js` | 202 | _sin describir_ |
| `useWhatsAppInbox.js` | 178 | _sin describir_ |
| `useCopilotInbox.js` | 125 | Bandeja/Notificaciones del módulo Copilot: monitorea la tabla tg_bot_activity |
| `useViewport.js` | 92 | Hook único para detectar tamaño de pantalla. Lo usan los componentes del |
| `useTeam.js` | 74 | _sin describir_ |
| `useScheduledCalls.js` | 73 | Devuelve un Map<phoneDigits, { id, phone_e164, scheduled_at }> con las |
| `useProperties.js` | 45 | _sin describir_ |
| `useDialogFocus.js` | 44 | _sin describir_ |
| `useRailsConfig.js` | 43 | _sin describir_ |
| `useAuth.js` | 30 | Hook para consumir AuthContext desde cualquier componente. |
| `useClient.js` | 27 | Hook para consumir el contexto del cliente activo. |

### `src/landing/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `LandingMarketing.jsx` | 1576 | _sin describir_ |
| `PrivacyPolicy.jsx` | 1222 | _sin describir_ |
| `ManualMarketing.jsx` | 1026 | _sin describir_ |
| `manual-content.js` | 1004 | _sin describir_ |
| `Diagnostico.jsx` | 974 | _sin describir_ |
| `DeliveryHubCRM.jsx` | 881 | _sin describir_ |
| `ManualCRM.jsx` | 790 | _sin describir_ |
| `manual-telegram-content.js` | 714 | Manual del COPILOT / Asistente IA (Duke del Caribe) |
| `LoginScreen.jsx` | 701 | Pantalla de autenticación completa para la app |
| `OnboardingCallCenter.jsx` | 687 | _sin describir_ |
| `DataDeletion.jsx` | 554 | _sin describir_ |
| `PricingScreen.jsx` | 552 | _sin describir_ |
| `DukeLeadRouter.jsx` | 343 | _sin describir_ |
| `ManualGasil.jsx` | 285 | _sin describir_ |
| `ManualNSG.jsx` | 285 | _sin describir_ |
| `ManualLegacy.jsx` | 246 | _sin describir_ |
| `ManualBrasa.jsx` | 235 | _sin describir_ |
| `ManualMuebleria.jsx` | 224 | _sin describir_ |
| `LoginScreenNative.jsx` | 176 | _sin describir_ |

### `src/lib/`

| Archivo | Líneas | Qué hace |
|---|---|---|
| `telegram.js` | 810 | Pareo del bot de Telegram con el perfil del asesor. |
| `auth.js` | 725 | _sin describir_ |
| `push.js` | 416 | Sistema de suscripción a notificaciones Web Push |
| `next-action-engine.js` | 371 | _sin describir_ |
| `offline-mode.js` | 351 | _sin describir_ |
| `lead-storage.js` | 343 | _sin describir_ |
| `whatsapp-chat.js` | 326 | _sin describir_ |
| `utils.js` | 308 | Utilidades compartidas entre todas las vistas. |
| `lead-save.js` | 288 | _sin describir_ |
| `native.js` | 282 | _sin describir_ |
| `push-native.js` | 265 | _sin describir_ |
| `manual-stratos-doc.js` | 230 | _sin describir_ |
| `organize-notes.js` | 220 | _sin describir_ |
| `docx.js` | 201 | _sin describir_ |
| `whatsapp-signup.js` | 196 | _sin describir_ |
| `lead-backup.js` | 192 | _sin describir_ |
| `speech-native.js` | 189 | _sin describir_ |
| `recordatorios-locales.js` | 179 | _sin describir_ |
| `informe-doc.js` | 175 | _sin describir_ |
| `audit.js` | 151 | Cliente del sistema de auditoría |
| `rails-store-legacy.js` | 143 | Store scoped to one authenticated person and organization. Never publishes an unconfirmed write. |
| `markdown.jsx` | 129 | Mini renderer Markdown → React. Pensado para las notas privadas que la IA |
| `iagents-actions.js` | 126 | _sin describir_ |
| `webhook-diagnostico-stratos.js` | 112 | Envía los resultados del diagnóstico Stratos AI al webhook n8n del funnel. |
| `rails-config.js` | 107 | _sin describir_ |
| `chunk-recovery.js` | 103 | _sin describir_ |
| `llamadas.js` | 93 | Consultas y estado local de los avisos de llamada del equipo. |
| `whatsapp-admin.js` | 91 | _sin describir_ |
| `backup.js` | 85 | _sin describir_ |
| `lead-draft.js` | 85 | Autosave del borrador del modal "Registrar cliente" |
| `whatsapp-sales.js` | 85 | Contacto comercial de Stratos AI para las experiencias públicas de venta. |
| `avisos-nativos.js` | 79 | _sin describir_ |
| `transcribir.js` | 77 | _sin describir_ |
| `ringer.js` | 72 | _sin describir_ |
| `agenda.js` | 71 | _sin describir_ |
| `form-submit.js` | 71 | Envía un formulario público (sin sesión) a la edge function `form-submit`. |
| `supabase.js` | 70 | _sin describir_ |
| `telefono.js` | 61 | _sin describir_ |
| `recovery.js` | 58 | Recuperación de contraseña por CÓDIGO al correo de recuperación. |
| `suggest-actions.js` | 58 | Cliente del agente IA "co-pilot" que sugiere próximas acciones |
| `rails-store.js` | 51 | _sin describir_ |
| `financial-data.js` | 41 | _sin describir_ |
| `app-review-access.native.js` | 32 | _sin describir_ |
| `service-errors.js` | 32 | _sin describir_ |
| `copilot-profile.js` | 29 | A failed profile lookup is not evidence that Copilot is disabled. |
| `rails-gestion.js` | 24 | Valida el borrador una vez; un envío incierto se reintenta sin alterar su payload. |
| `project-copilot.js` | 18 | _sin describir_ |
| `read-all-rows.js` | 18 | _sin describir_ |
| `app-review-access.js` | 12 | Implementación web: App Review no existe fuera del binario móvil. |
| `huli.js` | 10 | _sin describir_ |
| `copilot-demo.js` | 8 | Demo messages are local examples; they never claim to write to a real account. |
| `rails-preview.js` | 8 | La vista previa conserva la ruta y el cliente; nunca arrastra el hash de autenticación. |

---

## 4. ¿Dónde está el texto "..."?

Textos visibles de la app y el archivo donde viven. Útil cuando alguien te
dice "cambiá el botón que dice X" y no sabés por dónde empezar.

| Texto | Archivo |
|---|---|
| ¿A qué cliente se le cobra? (ej: Duke) | `src/app/views/CuentasCobro.jsx:321` |
| ¿Cómo funciona el Escáner IA? | `src/app/views/RRHHModule.jsx:820` |
| ¿Cuánto te llevó? (opcional) | `src/app/views/Marketing.jsx:2462` |
| ¿Cuánto? | `src/app/views/Copilot.jsx:1283` |
| ¿De qué empresa es? | `src/app/views/Marketing.jsx:1591` |
| ¿De qué empresa? | `src/app/views/Marketing.jsx:1735` |
| ¿De qué es? (opcional) | `src/app/views/Copilot.jsx:1296` |
| ¿De qué se habla acá? (opcional) | `src/app/views/ChatEquipo.jsx:529` |
| ¿Eliminar usuario? | `src/app/features/Admin/AdminPanel.jsx:511` |
| ¿En qué empresa? (opcional) | `src/app/views/Marketing.jsx:2453` |
| ¿Listo para dar el siguiente paso? | `src/app/views/LandingPages/LandingPagePreview.jsx:456` |
| ¿Por qué la Riviera Maya? | `src/app/views/LandingPages/LandingPagePreview.jsx:401` |
| ¿Qué necesitas? (ej. Flyer promo…) * | `src/app/views/Marketing.jsx:2183` |
| A consultar | `src/app/views/LandingPages/index.jsx:1846` |
| Abriendo centro de soporte… | `src/app/App.jsx:1944` |
| Abriendo comprobante… | `src/app/views/Caja.jsx:555` |
| Abriendo documento… | `src/app/views/CRM/components.jsx:4322` |
| Abriendo tu espacio clínico… | `src/dental-demo/ClinicalProfile.jsx:14` |
| Abriendo… | `src/app/views/ChatEquipo.jsx:555` |
| Abrir | `src/app/features/Admin/CatalogConfiguratorAdmin.jsx:150` |
| Abrir carpeta de Drive | `src/app/views/LandingPages/index.jsx:1422` |
| Abrir carpeta en Drive | `src/app/views/Marketing.jsx:683` |
| Abrir Discovery | `src/app/views/CRM/index.jsx:5317` |
| Abrir el expediente completo | `src/app/views/WhatsApp.jsx:475` |
| Abrir el expediente completo del cliente | `src/app/views/WhatsApp.jsx:456` |
| Abrir evidencia | `src/app/views/Marketing.jsx:2340` |
| Abrir Huli para completar la configuración | `src/dental-demo/HuliWorkspace.jsx:30` |
| Abrir la ficha completa | `src/app/views/Marketing.jsx:1564` |
| Abrir la ficha completa — acá se edita todo | `src/app/views/Marketing.jsx:1373` |
| Abrir la ficha de la propiedad | `src/app/views/Marketing.jsx:2008` |
| Abrir perfil | `src/app/views/CRM/index.jsx:5315` |
| Abrir sección | `src/app/features/Admin/PlatformAdminConsole.jsx:207` |
| Abrirlo en Drive | `src/app/features/MetaPanel/DocsStratos.jsx:174` |
| Acceso temporal | `src/app/features/Admin/AdminPanel.jsx:491` |
| Acceso temporal — cópialo ahora | `src/app/features/Admin/PlatformAdminConsole.jsx:77` |
| Accesos temporales | `src/app/features/Admin/PlatformAdminConsole.jsx:128` |
| Acciones | `src/app/views/CRM/index.jsx:4335` |
| Acciones acumuladas · Asesores vs. iAgents | `src/app/views/Dash.jsx:85` |
| Acciones de cierre IA | `src/app/views/CRM/components.jsx:5616` |
| Acciones por bloque | `src/app/features/Admin/RailsSettings.jsx:79` |
| Activa tu Copilot AI | `src/app/views/Copilot.jsx:1977` |
| Activar canal | `src/app/features/Admin/WhatsAppOnboardingAdmin.jsx:233` |
| Activar para el equipo | `src/app/features/Admin/RailsSettings.jsx:72` |
| Actividad del equipo IA — hoy | `src/app/views/IACRM.jsx:299` |
| Actividad reciente | `src/app/views/CRM/index.jsx:5900` |
| Actividad y alertas | `src/app/features/Admin/PlatformAdminConsole.jsx:108` |
| ACTIVO | `src/app/views/CRM/components.jsx:5503` |
| Activos post-Zoom | `src/app/views/ComandoDirectivo.jsx:458` |
| Activos post-Zoom: | `src/app/views/CRM/ZoomBoard.jsx:170` |
| Actual: | `src/app/views/Profile.jsx:429` |
| Actualización del sistema | `src/app/components/DynIsland.jsx:408` |
| Actualización Importante | `src/app/components/DynamicIsland.jsx:132` |
| Actualizando tu tablero… | `src/app/views/ISpaceBoard.jsx:129` |
| Actualizar | `src/app/features/Admin/CatalogConfiguratorAdmin.jsx:117` |
| Actualizar tablero | `src/app/views/ISpaceBoard.jsx:102` |
| Adjuntar | `src/app/views/ChatEquipo.jsx:481` |
| Adjuntar imagen, audio o archivo | `src/app/views/CRM/LeadWhatsAppChat.jsx:843` |
| Adjuntar PDF, documento o audio | `src/app/views/CRM/components.jsx:1830` |
| Administrador | `src/app/features/Admin/WhatsAppOnboardingAdmin.jsx:199` |
| Administrador de demostración | `src/dental-demo/DentalIdentity.jsx:3` |
| Agenda (opcional) | `src/app/views/LandingPages/index.jsx:1606` |
| Agenda dental | `src/dental-demo/DentalDemo.jsx:47` |
| Agenda una llamada con | `src/app/views/LandingPages/LandingPagePreview.jsx:458` |
| Agenda, lista de acción, documentos y plan | `src/app/App.jsx:3042` |
| Agendar en Huli | `src/dental-demo/HuliWorkspace.jsx:38` |
| Agendar fecha | `src/app/views/CRM/index.jsx:4655` |
| Agendar llamada | `src/app/views/LandingPages/LandingPagePreview.jsx:164` |
| Agente Ejecutivo | `src/app/components/Chat.jsx:74` |
| Agente Stratos | `src/app/components/Chat.jsx:60` |
| Agrega un teléfono…  +1 555 … | `src/app/views/CRM/components.jsx:1305` |
| Agregar | `src/app/features/MetaPanel/index.jsx:1378` |
| Agregar etapa | `src/app/features/Admin/PipelineConfiguratorAdmin.jsx:274` |
| Agregar link | `src/app/views/LandingPages/index.jsx:1936` |
| Agregar otro | `src/app/views/Marketing.jsx:2514` |
| Agregar propiedad | `src/app/views/Marketing.jsx:1448` |
| Agregar tarea de prioridad… | `src/app/views/PlanSemanal.jsx:485` |
| Agregar una columna propia a la hoja | `src/app/views/Marketing.jsx:1459` |
| Ahora no | `src/app/views/Copilot.jsx:1922` |
| Ajusta el rango en el paso anterior | `src/app/views/LandingPages/index.jsx:1951` |
| ALDEA ZAMA · TULUM | `src/app/views/LandingPages/index.jsx:305` |
| Alta de empresas y WhatsApp | `src/app/features/Admin/WhatsAppOnboardingAdmin.jsx:168` |
| Alta intención | `src/app/views/ZoomControl/index.jsx:597` |
| Alta intención — señal de cierre en el Zoom | `src/app/views/ZoomControl/index.jsx:710` |
| Amenidades (separadas por coma) | `src/app/views/LandingPages/index.jsx:760` |
| Análisis IA | `src/app/views/CRM/components.jsx:5378` |
| Analizar | `src/app/views/CRM/index.jsx:5312` |
| Analizar con IA → | `src/app/views/Dash.jsx:241` |
| Anterior | `src/app/views/CRM/index.jsx:3155` |
| Añade tareas concretas para este cliente | `src/app/views/CRM/components.jsx:2162` |
| Añadir | `src/app/views/CRM/components.jsx:5770` |
| Añadir criterio | `src/app/views/ISpaceBoard.jsx:122` |
| Añadir tarea | `src/app/views/ISpaceBoard.jsx:138` |
| Aparecerán al inicio de su pipeline en | `src/app/views/CRM/index.jsx:6179` |
| Aplicaciones | `src/app/App.jsx:3105` |
| Apps | `src/app/App.jsx:2277` |
| Áreas de atención | `src/app/views/RRHHModule.jsx:793` |
| Arrastra el CV aquí o haz clic para subir | `src/app/views/RRHHModule.jsx:716` |
| Arrastra para cambiar la prioridad | `src/app/views/Marketing.jsx:2236` |
| Asesor | `src/app/features/Admin/WhatsAppOnboardingAdmin.jsx:199` |
| Así te ayuda a operar | `src/app/components/CopilotCapabilities.jsx:117` |
| Asignar a | `src/app/features/Admin/WhatsAppOnboardingAdmin.jsx:207` |
| Asignar a un asesor | `src/app/features/MetaPanel/index.jsx:1014` |
| Asignar a… | `src/app/views/Marketing.jsx:863` |
| Asignar responsable | `src/app/features/MetaPanel/index.jsx:1003` |
| Asistió (sem.) | `src/app/views/ZoomControl/Resumen.jsx:421` |
| Atención Inmediata | `src/app/views/Dash.jsx:235` |
| Aún no configuras un correo de recuperación. | `src/app/views/Profile.jsx:430` |
| Aún no hay documentos | `src/app/features/MetaPanel/index.jsx:1878` |
| Aún no hay usuarios activos. | `src/app/features/Admin/CajaPermissionsAdmin.jsx:127` |
| Autor del hito | `src/app/views/CRM/ZoomBoard.jsx:244` |
| Badge | `src/app/views/LandingPages/index.jsx:662` |
| Bajar | `src/app/features/Admin/PipelineConfiguratorAdmin.jsx:288` |
| Bajo · Medio · Alto | `src/app/views/CRM/components.jsx:3431` |
| Buscar (⌘K) | `src/app/App.jsx:2366` |
| Buscar asesor… | `src/app/views/CRM/components.jsx:3188` |
| Buscar candidato... | `src/app/views/RRHHModule.jsx:416` |
| Buscar cliente o teléfono… | `src/app/views/WhatsApp.jsx:212` |
| Buscar cliente, proyecto, liner… | `src/app/views/ZoomControl/index.jsx:512` |
| Buscar desarrollo o zona… | `src/app/views/LandingPages/index.jsx:1398` |
| Buscar empresa… | `src/app/features/Admin/CatalogConfiguratorAdmin.jsx:125` |
| Buscar en las actividades… | `src/app/views/Marketing.jsx:1782` |
| Buscar en papelera… | `src/app/views/Trash.jsx:99` |
| Buscar nombre o email… | `src/app/features/Admin/AdminPanel.jsx:350` |
| Buscar paciente en Huli | `src/dental-demo/HuliWorkspace.jsx:31` |
| Buscar por categoría, obra, persona… | `src/app/views/Caja.jsx:460` |
| Buscar por nombre, masterbroker o contacto… | `src/app/views/ERP.jsx:436` |
| Buscar por nombre… | `src/dental-demo/HuliWorkspace.jsx:31` |
| Buscar propiedad, ubicación, estatus, año… | `src/app/views/Marketing.jsx:1430` |
| Buscar solicitudes… | `src/app/views/Marketing.jsx:2171` |
| Buscar tareas | `src/app/views/ISpaceBoard.jsx:131` |
| Buscar una tarea… | `src/app/views/ISpaceBoard.jsx:131` |
| Cada día: | `src/app/views/ISpaceBoard.jsx:145` |
| Cada semana: | `src/app/views/ISpaceBoard.jsx:145` |
| Cada trimestre: | `src/app/views/ISpaceBoard.jsx:145` |
| Caja | `src/app/views/Caja.jsx:298` |
| Caja: contrato y permisos | `src/app/features/Admin/CajaPermissionsAdmin.jsx:98` |
| CALCULADORA DE RETORNO | `src/app/views/LandingPages/index.jsx:881` |
| Calificación BANT | `src/app/views/CRM/components.jsx:5529` |
| Cambiar | `src/app/views/LandingPages/index.jsx:1936` |
| Cambiar cuánto gana | `src/app/views/Nomina.jsx:180` |
| Cambiar el estatus | `src/app/views/Marketing.jsx:1575` |
| Cambiar etapa | `src/app/views/CRM/components.jsx:277` |
| Cambiar fecha | `src/app/features/MetaPanel/index.jsx:1257` |
| Cambiar la etapa del lead | `src/app/views/WhatsApp.jsx:503` |
| Cambiar orden de las tarjetas de prioridad | `src/app/views/CRM/index.jsx:2639` |
| Cambiar posición de prioridad | `src/app/views/CRM/index.jsx:2800` |
| Cambiar prioridad | `src/app/features/MetaPanel/index.jsx:1548` |
| Cambios sin guardar | `src/app/features/Admin/PipelineConfiguratorAdmin.jsx:260` |
| Campañas Recientes | `src/app/views/LandingPages/index.jsx:1255` |
| Campo requerido | `src/app/views/LandingPages/index.jsx:641` |
| Canal de la gestión | `src/app/views/MiDia.jsx:44` |
| Canales | `src/app/views/ChatEquipo.jsx:303` |
| Cancelar | `src/app/features/Admin/AdminPanel.jsx:516` |
| Cancelar comentario | `src/app/views/Copilot.jsx:1264` |
| CANDIDATO IDENTIFICADO | `src/app/views/RRHHModule.jsx:747` |
| Características | `src/app/views/LandingPages/index.jsx:704` |
| Cargando accesos… | `src/app/features/Admin/PlatformAdminConsole.jsx:134` |
| Cargando actividad… | `src/app/views/Profile.jsx:998` |
| Cargando conversación… | `src/app/views/Copilot.jsx:1183` |
| Cargando conversaciones… | `src/app/views/WhatsApp.jsx:263` |
| Cargando demo dental… | `src/main.jsx:315` |
| Cargando el plan… | `src/app/views/PlanSemanal.jsx:368` |
| Cargando el tablero… | `src/app/views/ComandoOps.jsx:127` |
| Cargando empresas… | `src/app/features/Admin/PipelineConfiguratorAdmin.jsx:242` |
| Cargando equipo… | `src/app/App.jsx:2394` |
| Cargando movimientos… | `src/app/views/Caja.jsx:467` |
| Cargando perfil dental… | `src/dental-demo/DentalProfile.jsx:11` |
| Cargando permisos… | `src/app/features/Admin/CajaPermissionsAdmin.jsx:102` |
| Cargando pipeline… | `src/app/features/Admin/PipelineConfiguratorAdmin.jsx:277` |
| Cargando Zooms… | `src/app/views/ZoomControl/index.jsx:529` |
| Cargando… | `src/app/features/Admin/CatalogConfiguratorAdmin.jsx:127` |
| Cargo / Departamento | `src/app/views/RRHHModule.jsx:609` |
| Carpeta de crudos | `src/app/views/Marketing.jsx:2032` |
| Carpeta de Drive | `src/app/views/ERP.jsx:683` |
| Catálogo de Propiedades | `src/app/views/LandingPages/index.jsx:1300` |
| Catálogo de Proyectos | `src/app/views/ERP.jsx:331` |
| Catálogos y Drives por empresa | `src/app/features/Admin/CatalogConfiguratorAdmin.jsx:114` |
| Centro de Agentes IA | `src/app/views/CRM/index.jsx:5481` |
| Centro de Inteligencia | `src/app/components/DynamicIsland.jsx:81` |
| Centro de Inteligencia — Activo | `src/app/components/DynamicIsland.jsx:102` |
| Centro de soporte | `src/app/features/Admin/PlatformAdminConsole.jsx:198` |
| Cerrar | `src/app/App.jsx:2958` |
| Cerrar (Esc) | `src/app/views/ZoomControl/index.jsx:811` |
| Cerrar detalle | `src/app/views/ZoomControl/Resumen.jsx:309` |
| Cerrar editor | `src/app/views/ISpaceBoard.jsx:108` |
| Cerrar formulario | `src/app/views/CRM/index.jsx:3253` |
| Cerrar guía de funciones | `src/app/components/CopilotCapabilities.jsx:120` |
| Cerrar menú | `src/app/components/MobileHeaderMenu.jsx:52` |
| Cerrar Mi Espacio | `src/app/features/MetaPanel/index.jsx:764` |
| Cerrar sesión | `src/app/App.jsx:2727` |
| Cerrar vista previa | `src/app/views/LandingPages/LandingPagePreview.jsx:202` |
| Chats | `src/app/views/WhatsApp.jsx:633` |
| Cierres | `src/app/views/Team.jsx:116` |
| Citas asignadas al presentador principal | `src/app/views/ZoomControl/Graficas.jsx:244` |
| Citas del día | `src/dental-demo/HuliWorkspace.jsx:37` |
| Citas del rango por responsable de agenda | `src/app/views/ZoomControl/Graficas.jsx:239` |
| Citas demo | `src/dental-demo/DentalDemo.jsx:48` |
| Clave privada del perfil | `src/dental-demo/ClinicalProfile.jsx:13` |
| Click para agendar fecha/hora de la cita | `src/app/views/CRM/index.jsx:4632` |
| Click para editar | `src/app/features/MetaPanel/index.jsx:400` |
| Click para escribir el número directamente | `src/app/views/CRM/components.jsx:695` |
| Cliente | `src/app/views/CRM/ZoomBoard.jsx:299` |
| Clínica Dental · Demo | `src/dental-demo/DentalProfile.jsx:11` |
| Coaching IA · Análisis | `src/app/views/CRM/components.jsx:4998` |
| Cohorte con Zoom | `src/app/views/ComandoDirectivo.jsx:477` |
| Color de acento para la tarjeta | `src/app/views/LandingPages/index.jsx:802` |
| Color personalizado | `src/app/views/LandingPages/index.jsx:815` |
| Columna nueva | `src/app/views/Marketing.jsx:1463` |
| Columnas del equipo | `src/app/views/Marketing.jsx:3035` |
| Comando Directivo | `src/app/views/ComandoDirectivo.jsx:426` |
| Cómo funciona: | `src/app/features/Admin/PipelineConfiguratorAdmin.jsx:214` |
| Cómo se usa | `src/app/components/DynIsland.jsx:467` |
| Cómo trabaja el equipo IA | `src/app/views/IACRM.jsx:576` |
| Cómo verá el cliente | `src/app/views/LandingPages/index.jsx:131` |
| Complejidad: | `src/app/views/Marketing.jsx:2190` |
| Comprobando la agenda de hoy… | `src/app/views/MiDia.jsx:134` |
| Conectado | `src/app/views/Profile.jsx:751` |
| Conectando tu clínica con Huli… | `src/dental-demo/TenantHuliWorkspace.jsx:8` |
| Conectando… | `src/app/views/ConectarWhatsApp.jsx:122` |
| Conectar mi WhatsApp | `src/app/views/ConectarWhatsApp.jsx:123` |
| Conexión real · Sólo consulta | `src/dental-demo/HuliWorkspace.jsx:28` |
| Configuración | `src/app/App.jsx:3141` |
| Configuración de empresas nuevas | `src/app/features/Admin/CompanySetupAdmin.jsx:50` |
| Configuración del proceso comercial | `src/app/features/Admin/RailsSettings.jsx:69` |
| Confirmados | `src/app/views/ZoomControl/Resumen.jsx:450` |
| Confirmar contraseña | `src/app/views/Profile.jsx:333` |
| Confirmas y listo | `src/app/views/ConectarWhatsApp.jsx:107` |
| Contáctame Ya | `src/app/views/CRM/index.jsx:6179` |
| Contarlo ahora | `src/app/views/Marketing.jsx:708` |
| Continuar sin CV | `src/app/features/Portal/index.jsx:425` |
| Contraseña temporal | `src/app/features/Admin/AdminPanel.jsx:494` |
| Contraseña: | `src/app/features/Admin/PlatformAdminConsole.jsx:77` |
| Conversación de demostración | `src/dental-demo/DentalDemo.jsx:54` |
| Conversión | `src/app/views/Team.jsx:116` |
| Copiado | `src/app/views/LandingPages/LandingPagePreview.jsx:119` |
| Copiar | `src/app/views/InformeAvances.jsx:633` |
| Copiar el discovery al portapapeles | `src/app/views/ZoomControl/index.jsx:839` |
| Copiar prompt | `src/app/views/ISpaceBoard.jsx:125` |
| Copiar resumen para Telegram | `src/app/views/CRM/components.jsx:4560` |
| Copiar usuario y contraseña | `src/app/features/Admin/PlatformAdminConsole.jsx:142` |
| Copilot | `src/app/views/ISpaceBoard.jsx:102` |
| Copilot AI | `src/app/views/Copilot.jsx:1130` |
| Copilot dental | `src/dental-demo/DentalDemo.jsx:52` |
| Corregir lo que escribiste | `src/app/views/Marketing.jsx:1853` |
| Correo | `src/app/features/Admin/WhatsAppOnboardingAdmin.jsx:200` |
| Correo de acceso | `src/app/features/Admin/PlatformAdminConsole.jsx:83` |
| Correo de recuperación | `src/app/views/Profile.jsx:397` |
| Correo: | `src/app/features/Admin/PlatformAdminConsole.jsx:77` |
| Crear | `src/app/views/Marketing.jsx:915` |
| Crear administrador partner | `src/app/features/Admin/PlatformAdminConsole.jsx:79` |


_(684 textos más — usá `npm run buscar "texto"`)_

---

## 5. Archivos grandes sin describir

Estos no tienen comentario de cabecera, así que el mapa no puede explicar qué
hacen. Agregarles un bloque `/** ... */` arriba los hace aparecer solos acá.

- `src/app/views/CRM/index.jsx` (6665 líneas)
- `src/app/App.jsx` (3191 líneas)
- `src/app/views/Marketing.jsx` (3075 líneas)
- `src/landing/LandingMarketing.jsx` (1576 líneas)
- `src/landing/PrivacyPolicy.jsx` (1222 líneas)
- `src/landing/ManualMarketing.jsx` (1026 líneas)
- `src/landing/manual-content.js` (1004 líneas)
- `src/landing/Diagnostico.jsx` (974 líneas)
- `src/app/views/ComandoDirectivo.jsx` (961 líneas)
- `src/app/views/CRM/LeadWhatsAppChat.jsx` (942 líneas)
- `src/landing/DeliveryHubCRM.jsx` (881 líneas)
- `src/app/views/RRHHModule.jsx` (846 líneas)
- `src/app/features/Admin/Rails.css` (832 líneas)
- `src/landing/ManualCRM.jsx` (790 líneas)
- `src/app/views/InformeAvances.jsx` (747 líneas)
- `src/lib/auth.js` (725 líneas)
- `src/app/views/ERP.jsx` (719 líneas)
- `src/landing/OnboardingCallCenter.jsx` (687 líneas)
- `src/app/views/WhatsApp.jsx` (667 líneas)
- `src/app/data/catalogoProyectos.js` (611 líneas)
- `src/app/views/Caja.jsx` (593 líneas)
- `src/app/views/ChatEquipo.jsx` (569 líneas)
- `src/landing/DataDeletion.jsx` (554 líneas)
- `src/landing/PricingScreen.jsx` (552 líneas)
- `src/app/views/PlanSemanal.jsx` (515 líneas)
- `src/app/views/ComandoDirectivo.pdf.js` (514 líneas)
- `src/app/views/ZoomControl/Resumen.jsx` (490 líneas)
- `src/app/views/CuentasCobro.jsx` (463 líneas)
- `src/app/views/FinanzasAdmin.jsx` (443 líneas)
- `src/clients/gasil/config.js` (422 líneas)
- `src/lib/next-action-engine.js` (371 líneas)
- `src/lib/offline-mode.js` (351 líneas)
- `src/app/data/leads.js` (348 líneas)
- `src/app/views/Dash.jsx` (344 líneas)
- `src/landing/DukeLeadRouter.jsx` (343 líneas)
- `src/lib/lead-storage.js` (343 líneas)
- `src/app/views/ComandoOps.jsx` (327 líneas)
- `src/lib/whatsapp-chat.js` (326 líneas)
- `src/app/App.css` (321 líneas)
- `src/app/features/Admin/PipelineConfiguratorAdmin.jsx` (312 líneas)
- `src/clients/clinica-dental/config.js` (311 líneas)
- `src/lib/lead-save.js` (288 líneas)
- `src/landing/ManualGasil.jsx` (285 líneas)
- `src/landing/ManualNSG.jsx` (285 líneas)
- `src/app/views/ZoomControl/Graficas.jsx` (284 líneas)
- `src/lib/native.js` (282 líneas)
- `src/clients/nsg/config.js` (270 líneas)
- `src/lib/push-native.js` (265 líneas)
- `src/app/features/MetaPanel/DocsStratos.jsx` (262 líneas)
- `src/index.css` (256 líneas)
- `src/app/data/chat.js` (249 líneas)
- `src/landing/ManualLegacy.jsx` (246 líneas)
- `src/app/views/Nomina.jsx` (238 líneas)
- `src/app/features/Admin/WhatsAppOnboardingAdmin.jsx` (237 líneas)
- `src/landing/ManualBrasa.jsx` (235 líneas)
- `src/lib/manual-stratos-doc.js` (230 líneas)
- `src/app/views/ProductividadTab.jsx` (225 líneas)
- `src/landing/ManualMuebleria.jsx` (224 líneas)
- `src/app/features/Admin/PlatformAdminConsole.jsx` (223 líneas)
- `src/lib/organize-notes.js` (220 líneas)
- `src/app/constants/intelFeatures.js` (211 líneas)
- `src/app/views/CRM/zoom-metrics.js` (210 líneas)
- `src/hooks/useZoomAgendados.js` (202 líneas)
- `src/lib/docx.js` (201 líneas)
- `src/clients/vega/config.js` (196 líneas)
- `src/lib/whatsapp-signup.js` (196 líneas)
- `src/lib/lead-backup.js` (192 líneas)
- `src/lib/speech-native.js` (189 líneas)
- `src/app/views/CRM/CallActionButton.jsx` (184 líneas)
- `src/app/components/Chat.jsx` (182 líneas)
- `src/clients/muebleria/config.js` (182 líneas)
- `src/lib/recordatorios-locales.js` (179 líneas)
- `src/hooks/useWhatsAppInbox.js` (178 líneas)
- `src/app/views/CRM/RequiresHumanButton.jsx` (177 líneas)
- `src/landing/LoginScreenNative.jsx` (176 líneas)
- `src/lib/informe-doc.js` (175 líneas)
- `src/app/views/MiDrive.jsx` (171 líneas)
- `src/app/components/EstadoAvisos.jsx` (158 líneas)
- `src/app/features/Admin/CatalogConfiguratorAdmin.jsx` (158 líneas)
- `src/components/UpdatePill.jsx` (157 líneas)
- `src/app/views/MiDia.jsx` (155 líneas)
- `src/app/features/Admin/CajaPermissionsAdmin.jsx` (154 líneas)
- `src/app/components/DynamicIsland.jsx` (153 líneas)
- `src/app/views/CRM/LeadChatHistory.jsx` (152 líneas)
- `src/app/views/ISpaceBoard.jsx` (148 líneas)
- `src/app/views/CRM/ScheduledCallBadge.jsx` (144 líneas)
- `src/clients/brasa-y-piedra/config.js` (140 líneas)
- `src/app/components/CopilotCapabilities.jsx` (131 líneas)
- `src/app/constants/pipeline.js` (129 líneas)
- `src/lib/iagents-actions.js` (126 líneas)
- `src/mobile-perf.css` (121 líneas)
- `src/app/data/rivieraProperties.js` (119 líneas)
- `src/app/views/IACRMPlanes.jsx` (119 líneas)
- `src/app/views/ZoomControl/constants.js` (116 líneas)
- `src/app/components/CopilotMark.jsx` (113 líneas)
- `src/clients/demo/config.js` (113 líneas)
- `src/lib/rails-config.js` (107 líneas)
- `src/lib/chunk-recovery.js` (103 líneas)
- `src/app/views/CRM/command-metrics.js` (101 líneas)
- `src/clients/grupo28/config.js` (100 líneas)
- `src/app/constants/areas.js` (97 líneas)
- `src/app/views/CRM/date-range.js` (97 líneas)
- `src/lib/whatsapp-admin.js` (91 líneas)
- `src/clients/tgenius/config.js` (90 líneas)
- `src/app/features/Admin/RailsSettings.css` (86 líneas)
- `src/lib/backup.js` (85 líneas)
- `src/app/features/Admin/CompanySetupAdmin.jsx` (80 líneas)
- `src/clients/i-space/config.js` (80 líneas)
- `src/contexts/ClientOrgGuard.jsx` (79 líneas)
- `src/lib/avisos-nativos.js` (79 líneas)
- `src/lib/transcribir.js` (77 líneas)
- `src/hooks/useTeam.js` (74 líneas)
- `src/lib/ringer.js` (72 líneas)
- `src/lib/agenda.js` (71 líneas)
- `src/lib/supabase.js` (70 líneas)
- `src/app/components/MobileHeaderMenu.jsx` (65 líneas)
- `src/app/views/CRM/command-report.js` (63 líneas)
- `src/contexts/ClientContext.jsx` (63 líneas)
- `src/dental-demo/DentalDemo.jsx` (63 líneas)
- `src/lib/telefono.js` (61 líneas)
