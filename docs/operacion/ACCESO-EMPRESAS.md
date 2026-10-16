# Acceso común y CRM de empresas

El enlace estable es `https://app.stratoscapitalgroup.com/login`. La pantalla de acceso conserva la marca Stratos. Tras autenticar, la configuración de la empresa del perfil se aplica en memoria; la dirección no se convierte en `/tenant` ni en una ruta de cliente. Las portadas específicas de clientes siguen disponibles en sus rutas.

Las cuentas autorizadas en `platform_admins` abren directamente Empresas. Una autorización raíz activa (`scope_organization_id` nulo) ve todas las empresas; un partner ve solamente su alcance. El correo y el rol `super_admin` por sí solos no conceden acceso global. Las cuentas comunes conservan su organización y los permisos existentes. La primera entrada común abre su CRM si tienen acceso; posteriores recargas conservan la vista elegida.

La consola comparte la paleta, la tipografía, la barra lateral de 72 px y el header de 52 px de Stratos. En móvil la navegación se abre desde el header. “Mi CRM” abre la cartera propia; “Empresas y administración global” permite volver a la consola sin cerrar sesión. Empresas ofrece “Abrir CRM” en la ficha del cliente; CRM de empresas mantiene un selector explícito de empresa.

## Operaciones disponibles

El CRM global permite buscar y paginar clientes, filtrar por etapa y asesor, consultar fichas y notas, registrar clientes, y editar datos básicos, etapa, asignación, notas y próxima acción. Conserva la identidad del operador original en la auditoría. Esta superficie no cambia la organización del perfil ni suplanta cuentas de clientes. Los módulos especializados de cada tenant mantienen sus flujos existentes.

`whatsapp-admin` verifica el JWT y deriva el operador de la sesión. Las cuatro acciones nuevas usan las funciones de la migración 274, ejecutables exclusivamente por `service_role`. Cada lectura y escritura comprueba de nuevo operador activo, empresa activa y alcance. Los cambios y su auditoría se guardan en la misma transacción. Una comprobación final impide que los triggers históricos sustituyan al asesor elegido, incluso si existen nombres iguales. Las ediciones exigen la versión exacta de la ficha; las altas usan un UUID estable para reintentos idempotentes.

Un conflicto conserva el borrador y permite revisar la ficha actual. Una respuesta incierta conserva el envío original. Cambiar de empresa, ficha o sección con cambios pendientes requiere guardar o descartar explícitamente. Cambiar de actor o empresa desmonta los datos anteriores. No se reutiliza el caché local del CRM ordinario para carteras globales.

## Despliegue y recuperación

Aplicar únicamente `274_platform_crm_gateway.sql` al proyecto Stratos `glulgyhkrqpykxmujodb` y desplegar la nueva versión de `whatsapp-admin`. La web debe publicarse después de verificar ambas versiones. La versión web es `stratos-v441`.

Antes de la aplicación se debe conservar la definición previa de las funciones y una copia de la función Edge. La migración es aditiva y compatible con la web anterior. Para revertir el acceso global nuevo, restaurar la versión anterior de `whatsapp-admin` y de la web; las funciones SQL nuevas quedan inaccesibles a usuarios ordinarios.

`tests/platform-crm-gateway-db.test.mjs` comprueba permisos, aislamiento, concurrencia, idempotencia y auditoría en PostgreSQL aislado. `tests/sql/platform-crm-gateway-live-rollback.sql` usa empresas e identidades QA nuevas dentro de una transacción que se revierte. Revisar los triggers reales antes de ejecutarlo. Las fixtures de navegador bajo `tests/fixtures/platform-qa.*` usan datos sintéticos y bloquean peticiones productivas.
