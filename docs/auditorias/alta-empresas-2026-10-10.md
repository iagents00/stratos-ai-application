# Alta de empresas — auditoría del 10 de octubre de 2026

## Estado

Implementación y pruebas locales completas. Pendiente comprobar y desplegar el
backend en **stratos-prod / glulgyhkrqpykxmujodb**, integrar el PR y comprobar los
SHA de producción. No presentar esta auditoría como una certificación de la base
activa: la sesión CLI disponible sólo enumeró los dos proyectos Amistad; el
navegador abrió el inicio de sesión de Supabase. El usuario identificó la cuenta
correcta como **synergyfornature**.

## Alcance y hallazgos corregidos

- P1: la consola fijaba el tema oscuro. Ahora hereda tema y selector del CRM,
  con el negro neutro de producción y la paleta clara existente.
- P1: empresa, usuario e integración se mezclaban en una pantalla. El alta abre
  directamente Empresas y recorre empresa → administrador → acceso. WhatsApp es
  opcional y separado. Las empresas de configuración histórica no se editan en
  esta nueva pantalla.
- P1: el trigger Auth versionado tomaba organización y rol de `user_metadata`,
  controlada por el usuario. La migración nueva sólo acepta una asignación a
  empresa existente desde `app_metadata`, escrita por el servidor. Un signup
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
  migraciones 247 y 266 reales, trigger Auth, rollback al agotar licencias,
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

## Publicación pendiente: orden y verificaciones

1. Acceder a la cuenta indicada y comprobar el ID del proyecto. Descargar fuera
   de `src`, `public` y `dist` las versiones activas de `whatsapp-admin`,
   `admin-create-user` y `pg_get_functiondef('public.handle_new_user()'::regprocedure)`.
   Compararlas con la base del cambio; conciliar cualquier diferencia antes de
   aplicar nada. Comprobar también los triggers de `auth.users` y las guardas 247.
2. Aplicar exclusivamente `266_company_provisioning_isolation.sql`. No ejecutar
   el historial completo. Esta migración no modifica registros existentes.
3. Publicar **ambas** Edge Functions: `whatsapp-admin` y `admin-create-user`.
   La migración debe existir primero. Verificar su versión activa; un build o
   preview Vercel no sustituye estos pasos. Evitar altas durante esta ventana.
4. Con cuentas QA explícitas del proyecto, probar empresa/administrador/login,
   cupos, duplicado de correo, reintento, permisos partner y aislamiento con
   consultas autenticadas. Revisar la política efectiva de tablas dependientes
   y credenciales temporales; comprobar que no se creó una organización extra.
5. Integrar sólo con `Validar Stratos` y `verificar` aprobados. Actualizar la
   carpeta principal y comprobar `release.json` de los dominios contra el SHA
   integrado, además del flujo y ambos temas en producción.

Rails permanece desactivado. No se han cambiado contactos, organizaciones,
usuarios, canales ni permisos reales de Duke, NSG u otros clientes.
