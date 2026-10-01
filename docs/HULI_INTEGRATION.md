# Stratos AI + Huli · piloto dental

Perfil independiente dentro de la interfaz oficial de Stratos. Conserva identidad, clientes y destino de publicación del proyecto.

## Piloto real · 26 de septiembre de 2026

Acceso: https://stratos-ai-application-5ayh25sac-iagents-projects.vercel.app/clinica-dental

Clave privada de acceso en `.dental-huli-access.local` (0600, excluida de Git y Vercel). El servidor recibe `DENTAL_HULI_CONFIG` únicamente en este despliegue de vista previa. La credencial Huli nunca se entrega al navegador. Este despliegue no cambia el dominio productivo y una futura publicación requiere configurar nuevamente el secreto del servidor.

La cuenta Huli autorizada es la organización 123855. Su profesional registrado tiene especialidad Radiología y sede Consultorio Virtual. El usuario autorizó usarla para el piloto dental; no se cambiaron los datos registrados en Huli.

Funciones reales: buscar y paginar pacientes, consultar citas por día, consultar disponibilidad, seleccionar profesionales y sedes autorizados y mostrar la zona horaria de la sede. Copilot ofrece consulta de horarios mediante controles visuales. La creación, modificación y cancelación de citas se realizan mediante el acceso al calendario nativo de Huli. No hay recordatorios automáticos ni recomendaciones médicas.

Los datos son consultados en vivo. La sesión firmada de cuatro horas utiliza cookie HttpOnly, Secure y SameSite Strict. El servidor descubre profesionales y sedes desde autorizaciones activas de la organización fija y rechaza selecciones ajenas. Sólo admite acciones de lectura. No registra respuestas de pacientes ni las envía al bot inmobiliario. La ruta clínica bloquea solicitudes al Supabase compartido y no restaura sus sesiones productivas.

Código: `api/dental-huli.js`, `server/dental-huli.mjs`, `server/dental-security.mjs`, `src/dental-demo/ClinicalProfile.jsx` y `HuliWorkspace.jsx`.

La demo ficticia continúa en `/clinica-dental-demo`, con identidad y almacenamiento independientes.

## Validación

Autenticación Huli, organización, pacientes, agenda vacía y disponibilidad vacía verificados con la cuenta real. Se respeta el límite del proveedor de 20 citas por página. Huli devuelve un objeto vacío cuando no hay citas.

17 pruebas verifican autenticación, expiración, manipulación de sesión, aislamiento, selección de sede, minimización de datos, zona horaria y cambios de horario de verano, CSRF y respuestas del proveedor. Compilación y lint del código nuevo correctos.

```
npm run check:project
node --test tests/huli.test.mjs tests/dental-demo.test.mjs tests/dental-huli-server.test.mjs
npm run build
```

Documentación del proveedor: https://api.huli.io/docs/

## Integración futura por organizaciones Stratos

La función `supabase/functions/huli-copilot` y la migración `108_huli_access.sql` están preparadas pero no desplegadas ni aplicadas. No se dispone de acceso de administración al proyecto Supabase correspondiente; no se aprovisionaron cuentas en otros proyectos. Para uso comercial multiclínica, aprovisionar conexiones por organización y usuarios autorizados, probar aislamiento y revocación, y establecer autenticación individual. El piloto actual usa un acceso privado compartido para una sola cuenta Huli.

## Alta de tenant real pendiente

El cliente actual no tiene UUID de organización Supabase y conserva una sesión independiente para el piloto. No equivale a un tenant productivo registrado.

`scripts/provision-dental-tenant.mjs` prepara el alta administrativa exclusivamente en el proyecto Stratos verificado. Requiere un archivo privado con `name`, `slug: "clinica-dental"`, `adminName`, `adminEmail`; genera y conserva un UUID nuevo en ese archivo. Primero ejecutar sin `--apply` para validar. La aplicación requiere credenciales de servidor `STRATOS_SUPABASE_URL` y `STRATOS_SUPABASE_SERVICE_ROLE_KEY`, y la migración `huli_access` aplicada.

El alta verifica conflictos antes de escribir, rechaza correos de usuarios pertenecientes a otro tenant, no mueve clientes ni usuarios existentes, crea una organización con plan pro en prueba, crea acceso individual sin enviar correos y habilita exclusivamente al administrador clínico en `huli_access`. La contraseña generada se guarda sólo en un archivo privado 0600. Si falla una etapa, el script explica que puede existir un alta parcial y permite retomar con el mismo UUID.

Después de provisionar: registrar el UUID real en la configuración del cliente; reemplazar el acceso compartido del piloto por Supabase Auth; servir consultas Huli autenticadas y asociadas al perfil; verificar usuario de otra organización, usuario deshabilitado y sesión revocada antes de publicar. No publicar como alta terminada mientras estos pasos estén pendientes.

## App móvil solicitada

Destino del usuario: https://apps.apple.com/mx/app/stratos-ai/id6804826565 (Stratos AI, versión pública 4.7 verificada el 26-09-2026). El shell local declara bundle ID `com.stratoscapitalgroup.crm` y carga `https://app.stratoscapitalgroup.com`, asociado al mismo proyecto Vercel que `getstratosai.com`. La versión iOS local 1.0/build 1 no coincide con la pública; falta verificar el código del binario instalado antes de afirmar compatibilidad o publicar una actualización nativa.

El tenant deberá abrir después del login estándar y permanecer en el mismo origen dentro del WebView. Probar con cuenta individual en web y app instalada, persistencia de sesión al reabrir, zona horaria, selección de profesional/sede, Huli y logout, además de denegación entre organizaciones. No se ha creado aún la cuenta administradora: falta el correo del usuario. Tampoco se ha publicado el tenant en producción ni una actualización en App Store.

## Auditoría posterior de producción

Se encontró una organización existente `clinica-dental`, UUID `6c5cf32a-3db4-477d-bbed-26d90231bc9a`, y administrador activo `1d0b40a4-6a7b-482d-a0c7-e7eabbb7ae2a`, correo `clinicadental@stratos.ai`. El INSERT defensivo no agregó otra organización porque el slug ya existía. No se cambiaron contraseñas ni permisos.

El password solicitado no autenticó en Supabase (`invalid_credentials`). La API `/api/dental-huli` en el dominio productivo respondió 503, conexión sin configurar. Por tanto no está verificado el login clínico ni Huli para ese tenant en producción. La vista previa mantiene la integración independiente; no debe anunciarse como acceso individual productivo.

## Integración del tenant publicada · revisión final

El registro de cliente `clinica-dental` ahora apunta al UUID de la organización existente y usa el AuthProvider normal de Stratos. El guard de organización lleva esa cuenta al perfil clínico después del login desde raíz, permaneciendo en el mismo dominio. La ruta real ya no bloquea Supabase ni usa un usuario demo; las rutas de demo conservan su aislamiento.

`server/clinical-auth.mjs` verifica el bearer token con Supabase Auth, el UUID del administrador autorizado, su perfil activo en la organización fija y la organización activa. La API en modo tenant no acepta la cookie ni la contraseña compartida del piloto. La vista obtiene el token de la sesión normal y ofrece reintento si no puede conectar. Configuración Huli guardada como secreto de producción en Vercel y despliegue productivo realizado desde este proyecto.

20 pruebas pasaron, lint del código nuevo y compilación correctos. Se verificaron ambos dominios productivos: peticiones sin sesión o con token inválido reciben 401. La conexión directa del servidor a Huli está verificada; el login positivo de la cuenta sigue pendiente porque la contraseña solicitada no autentica. Se dejó un borrador en SQL Editor para que el propietario establezca la contraseña; no se ejecutó el cambio. La herramienta de navegador requiere intervención del usuario para cambiar credenciales. No anunciar como verificado el flujo completo ni la app instalada hasta completar esa comprobación.
