# Alta de empresas — auditoría del 10 de octubre de 2026

## Estado

Implementación y backend verificados en **stratos-prod / glulgyhkrqpykxmujodb**
con la cuenta synergyfornature. Migraciones incrementales 266 y 267 aplicadas,
ambas Edge Functions publicadas y su fuente descargada comparada con el código
local. Pendiente la integración del PR y comprobar el SHA del frontend publicado.

La inspección activa confirmó que el trigger anterior ya rechazaba metadata de
usuario para elegir empresa, aunque ese cambio no estaba versionado. Se conservó
compatibilidad con sus claves seguras `organization_id`/`role`.

## Alcance y hallazgos corregidos

- P1: la consola fijaba el tema oscuro. Ahora hereda tema y selector del CRM,
  con el negro neutro de producción y la paleta clara existente.
- P1: empresa, usuario e integración se mezclaban en una pantalla. El alta abre
  directamente Empresas y recorre empresa → administrador → acceso. WhatsApp es
  opcional y separado. Las empresas de configuración histórica no se editan en
  esta nueva pantalla.
- P1: el trigger Auth versionado tomaba organización y rol de `user_metadata`,
  controlada por el usuario. Las migraciones aceptan una asignación a
  empresa existente desde metadata de servidor o un ticket de un solo uso
  emitido exclusivamente por el servidor. Un signup
  independiente recibe su propia organización y nunca adopta Duke, NSG u otra.
  Véase [la guía oficial de usuarios de Supabase](https://supabase.com/docs/guides/auth/users).
- P1: las funciones creaban Auth sin destino y luego movían el perfil. La
  asignación ahora ocurre en la transacción del trigger, sin organización
  provisional. La guarda de licencias también puede abortar Auth completo.
- P1: el cupo de empresas del partner dependía de un contador previo a insertar.
  La nueva RPC serializa por operador y contenedor; empresa y evento se guardan
  juntos. Una clave estable permite recuperar la misma alta después de una
  respuesta perdida. Un reintento de otro operador/alcance se rechaza.
- P2: perfiles/empresas se truncaban en el límite de PostgREST. Bootstrap pagina
  ambos conjuntos para conservar conteos y disponibilidad de licencias.
- P2: formularios sin validación, contexto o protección de doble envío. Se
  conservan datos al fallar, se valida correo/cupo/rol, se exige administrador
  inicial y se muestra siempre la empresa receptora. Cambiar de empresa limpia
  borradores y credenciales.
- P2: las claves temporales se muestran ocultas, con copia del acceso completo
  y recuperación si el portapapeles falla. La aprobación de WhatsApp conserva
  el diálogo si el servidor rechaza la operación.
- P2: el fallback de sesión exploraba claves de cualquier proyecto Supabase.
  Ahora sólo lee la clave del proyecto configurado de Stratos.

## Evidencia reproducible

- `tests/company-onboarding.test.mjs`: validación, licencias, administrador,
  contexto de empresa, exclusión de clientes históricos y contenedores partner.
- `tests/company-admin-edge.test.mjs`: ejecuta el handler TypeScript real con
  transporte Supabase simulado; operadores desactivados/no autorizados, scope
  partner y rechazo de altas dirigidas a Duke, NSG u otro partner.
- `tests/company-provisioning-db.test.mjs`: PostgreSQL aislado (PGlite),
  migraciones 247, 266 y 267 reales, trigger Auth, rollback al agotar licencias,
  metadata manipulada, idempotencia, permisos de RPC, límites de cupo, cambio
  prohibido de empresa/rol y consultas/escrituras cruzadas con las políticas
  RLS versionadas de perfiles/leads. No conecta con producción. No prueba
  concurrencia con múltiples sesiones de PostgreSQL ni todas las políticas
  acumuladas de producción.
- Prueba de navegador con API interceptada: dos intentos de empresa con la
  misma clave, recuperación del formulario, un administrador en la empresa
  correcta, contraseña oculta, limpieza al cambiar empresa y WhatsApp móvil.
- Capturas locales en `output/playwright/companies/`: listado, alta y acceso,
  escritorio 1440×960 y móvil 390×844, oscuro/claro. No hay datos productivos.
- `npm run test`, `check:runtime`, `probar-rails`, `test:rails-db`,
  `check-tenant-modules`, `verificar-tenant-route`, `verificar-docs`,
  `verificar-rpc`, `verificar-migraciones`, `ops:check` y `build`.

## Revisión de interfaz

La implementación conserva Inter, negro neutro, menta, bordes y superficies del
CRM live. Etiquetas enlazadas, foco visible, controles de 44px, contraseñas
ocultas, feedback accesible y composición móvil sin scroll horizontal.

El detector Impeccable produjo 18 avisos orientativos, sin hallazgos de bloqueo.
Su referencia DESIGN.md describe exclusivamente Rails; las diferencias de
escalas, bordes y colores de esta consola se revisaron contra los tokens actuales
y la captura live. No se reemplazó la guía global de diseño con reglas del alta.

## Backend y pruebas en producción

- Respaldo previo fuera del repositorio de las dos Edge Functions, trigger Auth,
  guardas de licencias/permisos, triggers y políticas RLS efectivas.
- 266 registrada como `20261010130000`, 267 como `20261010133000`.
  Se instaló exclusivamente la RPC faltante `fn_activate_whatsapp_readonly`
  de 265, requerida por la pantalla vigente; no se reprodujo 265 completa ni
  se activó WhatsApp para ninguna organización.
- La prueba real descubrió que Auth Admin escribe custom `app_metadata` después
  del INSERT. 267 y `provision-user.ts` corrigen ese orden con tickets UUID de
  un solo uso, vinculados a correo/empresa/rol, expiración de cinco minutos,
  RLS y ausencia de permisos para anon/authenticated. El trigger consume el
  ticket dentro de la transacción de Auth. Duplicados/fallos limpian el ticket.
- `tests/sql/company-provisioning-live-rollback.sql` pasó contra la base activa:
  alta, asignación de perfil, reintentos, licencias, roles, consultas y escrituras
  cruzadas de leads/perfiles/organizaciones, RPC privada y credenciales. Todo se
  revierte por transacción; las políticas de producción están presentes.
- Prueba HTTP contra las Edge Functions activas: empresa, primer administrador,
  login real, correo duplicado, lectura aislada, destino manipulado ignorado por
  admin-create-user, permisos partner y credenciales temporales cifradas.
- Dos altas HTTP concurrentes para la última licencia: exactamente una terminó
  correctamente y el total quedó en tres perfiles para tres licencias.
- Las cuatro cuentas y dos empresas del recorrido final se eliminaron. También
  se limpió la cuenta/espacio provisional de la prueba inicial fallida. Consulta
  posterior: cero cuentas QA, cero empresas QA y cero tickets pendientes.
- La prueba no envió correos ni avisos de partner, no conectó canales y no accedió
  al contenido de leads de clientes. Conservó la auditoría normal del sistema.

Rails permanece desactivado. No se han cambiado contactos, organizaciones,
usuarios, canales ni permisos reales de Duke, NSG u otros clientes.

## Verificación del frontend

Integrar con `Validar Stratos` y `verificar` aprobados, actualizar la carpeta
principal y comprobar `release.json` de los dominios contra el SHA integrado.
Las pruebas de apariencia y flujo con API interceptada cubren escritorio/móvil
y claro/oscuro; no sustituyen las pruebas reales de backend descritas arriba.
