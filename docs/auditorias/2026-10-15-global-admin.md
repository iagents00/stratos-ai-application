# Administración global de empresas y usuarios

## Alcance

La consola raíz incluye los clientes registrados, espacios históricos, empresas nuevas y partners. Duke aparece con el nombre del espacio y su identidad «Duke del Caribe», y puede encontrarse por cualquiera de ellos. Usuarios muestra cuentas activas e inactivas; Marketing incluye tanto el rol de Marketing como las cuentas que lo administran.

El editor permite cambiar nombre, área, rol, permisos y estado de una cuenta. Un traslado exige elegir destino y confirmarlo. La empresa original conserva sus clientes, tareas e historial. Los accesos temporales y permisos individuales de Caja anteriores se invalidan al trasladar la cuenta. Las conexiones con acciones de Telegram pendientes deben resolverse antes de moverla.

La configuración general permite editar nombre, estado y licencias de cualquier empresa. Se conservan slug, enlaces de acceso y ajustes de clientes históricos. Los módulos de empresas administradas mediante la entrada neutral mantienen su editor existente. El estado de una empresa limita nuevas altas y traslados; la baja de un usuario controla su acceso individual.

## Permisos y consistencia

- La autorización global requiere un operador de plataforma activo con alcance raíz. El rol `super_admin` de un cliente, por sí solo, conserva alcance dentro de su empresa.
- Los partners mantienen sus empresas y roles permitidos. Las nuevas operaciones de directorio y edición global son exclusivas del servidor y verifican al operador raíz.
- Las ediciones comprueban la versión anterior y conservan el borrador ante conflictos. Durante una recarga explícita se bloquea el editor para evitar sobrescribir cambios nuevos.
- Los traslados y reactivaciones respetan licencias. La empresa de origen conserva un administrador activo. La cuenta propia y los operadores de plataforma tienen sus permisos protegidos en este editor.
- Perfil, identidad Auth y auditoría de edición se actualizan en la misma transacción. Se revocan sesiones de refresco al cambiar acceso y se conservan sanciones Auth ajenas a la consola.
- Una baja se comprueba también ante un JWT vigente: hook de PostgREST para tablas y RPC, helpers de permisos con cuenta activa y políticas restrictivas sobre las tablas revisadas. Las tareas anónimas y `service_role` conservan su funcionamiento.
- El historial de Copilot sigue limitado a la organización actual. El historial de Telegram sin organización no se expone después de un traslado; los registros originales permanecen en la base.

El hook utiliza el mecanismo descrito en la [documentación oficial de Supabase](https://supabase.com/docs/guides/api/securing-your-api). Su instalación comprueba que no haya una configuración previa incompatible.

## Validación

Suite local: 164 pruebas aprobadas, controles de permisos, revisión independiente y recorrido de navegador con API de prueba. Se revisaron escritorio y móvil en temas claro y oscuro; creación de borradores, conflicto de versión, traslado confirmado, protección de operadores y edición de una empresa histórica.

Las migraciones 272 y 273 se aplicaron incrementalmente en `stratos-prod / glulgyhkrqpykxmujodb`, conservando respaldo privado de funciones, políticas y configuración anteriores. `whatsapp-admin` quedó en versión 22 con verificación JWT. El directorio usa una proyección SQL segura: el listado Auth Admin falla con algunas identidades antiguas, y se conserva ese legado sin reparar ni modificar sus credenciales.

El SQL productivo de prueba pasó en una transacción revertida. La comprobación HTTP con la cuenta raíz confirmó 35 empresas y 95 usuarios, incluido Duke y las cuatro cuentas de Marketing. Una cuenta QA aislada perdió acceso a tablas y RPC usando el mismo JWT después de la baja; su reactivación permitió entrar de nuevo. Se eliminó al terminar. Postflight: 35 organizaciones, 95 perfiles, 95 identidades Auth, cero registros QA y cero tickets pendientes.

La web se entrega mediante PR y compilación protegida. La comprobación final compara `release.json` con el SHA integrado y abre Empresas, Usuarios y Marketing con la cuenta raíz; el backend se verifica por separado del despliegue web.

Evidencia privada fuera del repositorio: `~/.codex/private-outputs/stratos-global-admin-2026-10-15/`. No contiene contraseñas en este informe. Rails conserva su estado por organización.
