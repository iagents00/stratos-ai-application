# Auditoría de Stratos AI y publicación en producción

Fecha de solicitud: 12 de septiembre de 2026 (Tijuana). Verificaciones técnicas realizadas durante la sesión del 13 de septiembre UTC.

## Estado y alcance

**La web está publicada con las correcciones verificadas, versión stratos-v426. La certificación de todo el sistema permanece pendiente de acceso administrativo a Supabase y n8n.** Un build correcto no acredita permisos de base de datos, entrega de mensajes, funcionamiento de proveedores ni contabilidad completa.

Se revisaron código del cliente, rutas de Vercel, dependencias, permisos de navegación, flujos de CRM/Copilot/Caja/Finanzas, accesibilidad del alta de clientes, configuración de clientes, scripts de control, paquete web para iOS y respuestas públicas de producción. Se probaron datos sintéticos localmente y se leyeron sesiones existentes en producción; no se hicieron llamadas o envíos a clientes ni se alteraron sus registros para probar.

La carpeta original tenía HEAD `bea83ea` y cambios sin guardar en Git. Producción y origin/main estaban en **e08d0c9b2d5b59adbfa81cdefc69904d2fd20ea2**, con funciones mucho más recientes. Se creó una copia de trabajo aislada sobre esa revisión. Los cambios originales se conservaron y se guardó un respaldo local del diff previo. Las observaciones sobre checkout ficticio y voz de aquella copia antigua no se atribuyen a la producción actual: el checkout actual ya dirige a ventas y existe un servidor de transcripción.

## Cambios de esta entrega

| Prioridad | Hallazgo confirmado | Corrección |
|---|---|---|
| P1 | AnalysisDrawer referencia una llamada programada fuera de su ámbito; puede interrumpir el render | Usa su propio acceso al estado de llamadas |
| P1 | Dos botones de CRM ejecutaban hooks después de retornos condicionales | Orden estable de hooks en CallActionButton y RequiresHumanButton |
| P1 | Finanzas y Caja sumaban monedas diferentes, con totales presentados en una sola moneda | Selector de moneda y totales separados, sin conversiones inventadas; filas sin moneda permanecen diferenciadas |
| P1 | Caja guardaba cualquier movimiento en ARS | Moneda explícita de alta, validación de monto finito y moneda; protección de alta sin cuenta real |
| P1 | Historial financiero limitado a 400/1.000 movimientos y referencias de proyectos incompletas | Lectura paginada con orden estable; un error en cualquier página interrumpe la actualización de totales |
| P1 | El mes incluía movimientos de meses posteriores | Comprobación de mes y año, rechazo de fechas inválidas en el resumen mensual |
| P1 | Copilot reintentaba un comando hasta tres veces después de perder la respuesta | Un solo envío; ante entrega incierta utiliza la conciliación existente del historial, evitando duplicaciones por reintento automático |
| P1 | Modal de nuevo cliente permitía foco detrás y carecía de nombres accesibles | Diálogo identificado, fondo inerte, foco inicial, Tab circular, Escape, restauración del foco, nombres de campos y contraste mejorado |
| P1 | 12 vulnerabilidades reportadas en el lockfile vigente | Actualización compatible de dependencias: auditoría final sin vulnerabilidades conocidas reportadas por npm |
| P2 | Comando presentaba 100% sin denominador y barras positivas con cero | “Sin base” cuando corresponde y ancho cero para valor cero |
| P2 | CRM confundía clientes calientes/inactividad desconocida con actividad de hoy | El indicador ahora cuenta registros con updated_at de hoy y dice “actualizados hoy” |
| P2 | Prioridades limitadas a 60 presentadas como total | Total real y aclaración del recorte visual; todos siguen disponibles en Lista |
| P2 | Exportación CSV permitía fórmulas desde texto de movimientos | Neutralización de fórmulas y escape de todas las columnas |
| P2 | Portafolio construía un fetch de servidor desde Host sin validar | Lista de hosts permitidos, timeout, rechazo de redirecciones y comprobación del HTTP de origen |
| P2 | Renovación push aceptaba entrada incompleta y podía esperar indefinidamente | Validación del endpoint previo y claves, método declarado y timeout |
| P2 | El módulo Proceso no tenía glifo propio en 12 clientes | Ícono integrado al sistema existente; verificación de navegación pasa |
| P2 | Caja en demo podía quedar cargando sin organización | Estado de carga finaliza y no permite registrar movimientos sin cuenta real |

La versión del service worker pasa de **stratos-v425 a stratos-v426**. Se conserva el comportamiento previo de restauración de sesión.

## Comprobaciones reproducibles

- `npm test`: **7 pruebas**. Monedas y fechas, paginación más allá de 1.000 filas y errores de páginas, CSV, Host/HTTP del portafolio, renovación push, identidad de usuario en IA y entrega incierta del Copilot sin duplicación.
- `npm run build`: compilación web y controles previos de rendimiento móvil/plan semanal.
- `npm run build:app` y `npm run verificar:appstore-ios`: paquete web nativo compilado; verificaciones de exclusión de contratación/alta, acceso aislado de revisión, destino iPhone y ausencia de CallKit/PushKit/VoIP. **No equivale a publicar un nuevo binario en App Store.**
- `npm run check:runtime`: sin referencias indefinidas, sintaxis fatal ni hooks condicionales en src y api.
- `node scripts/check-tenant-modules.mjs`: **12 clientes × 2 roles**, navegación y módulos habilitados coherentes. **No prueba aislamiento RLS entre usuarios autenticados.**
- Contexto de clientes, configuración Rails, registro de **58 RPC**, imports JSX, documentación y lenguaje pasan los controles del repositorio.
- `npm audit` y `npm audit --omit=dev`: cero vulnerabilidades conocidas reportadas tras actualización.
- Escaneo de JWT en archivos versionados: no se encontraron JWT con rol distinto de anon. Es un control parcial; no certifica ausencia de todos los tipos de secretos ni del historial Git.
- QA de navegador: CRM demo, modal de alta en escritorio/claro y 390×844/oscuro, campos identificados, Tab desde el último control regresa al primero, Escape cierra, Caja y selector de moneda. La demo y las pruebas unitarias no acreditan CRUD con un usuario real.
- QA real: Copilot respondió a una consulta de solo lectura de tareas pendientes, sin solicitar creación o modificación de registros. Se verificó la respuesta y su persistencia en el historial; no se contrastó su conteo con una consulta administrativa independiente.
- Después de publicar, la sesión real de NSG se restauró en **tres recargas** y el CRM mostró el indicador corregido “actualizados hoy”. Se observó un aviso de `getSession` lento y uso del mecanismo existente de caché local; la sesión y los datos terminaron de cargar. Queda pendiente investigar la latencia de Auth. Los demás avisos observados en esa revisión procedían de una extensión del navegador.
- Se añade **Release checks** en GitHub Actions para mantener build, pruebas, controles de errores de ejecución, navegación y registro RPC.

## Pruebas públicas de producción

La base, Auth y aplicación respondían al iniciar la auditoría. Con la llave pública, sin usuario:

| Recurso | Resultado |
|---|---|
| leads, profiles, team_expenses, team_actions, tg_bot_activity (consulta limitada) | HTTP 200, cero filas |
| get_my_copilot_activity y fn_qa_rpc_del_front | HTTP 401 / permiso denegado |
| organize-lead-notes y suggest-next-actions | HTTP 404 NOT_FOUND |
| transcribir-voz, cuerpo vacío | HTTP 400 peticion_invalida; alcanza validación de entrada con la llave pública |

No se enviaron audios, texto a modelos pagados ni datos de prospectos como parte de estas sondas.

## Pendientes que impiden declarar todo el sistema certificado

1. **P1 — Autenticación real del servidor de voz.** La función publicada acepta la llave anon hasta validar entrada. El código confiaba únicamente en verify_jwt, que también puede aceptar el JWT público. Se preparó `requireUser` y se integró en transcribir-voz y las dos funciones de IA relacionadas, con prueba de rechazo de anon. **Estas modificaciones necesitan despliegue independiente en Supabase; Vercel no las publica.**
2. **P1 — Seguridad e idempotencia de n8n.** El cliente iAgents documenta un webhook público para llamadas y otras acciones; Copilot transmite chat_id al webhook desde el navegador. Falta comprobar y reforzar en el servidor que el JWT determina usuario, organización y permisos, con idempotencia por petición. No se intentó explotar el endpoint ni generar llamadas. El parche web de reintentos reduce duplicación, pero no sustituye la validación del servidor.
3. **P1 — Funciones de IA ausentes.** organize-lead-notes y suggest-next-actions no aparecen desplegadas en el proyecto al momento de comprobarlas. Se requiere verificar si la producción utiliza otra ruta o si deben publicarse con sus secretos de proveedor y la autenticación corregida.
4. **Control pendiente — Base de datos completa.** No hubo acceso administrativo al proyecto Stratos: la CLI autenticada solo lista Amistad y el Studio exige login. Falta ejecutar el centinela fn_qa_rpc_del_front con permisos adecuados, comprobar RLS/Storage y SECURITY DEFINER, cron/reminders, salud de consultas, backups recuperables y migraciones realmente aplicadas. No se corrieron migraciones históricas a ciegas.
5. **Control pendiente — Operación integral.** No se acreditaron con pruebas de ida y vuelta los cobros, Meta, WhatsApp, Retell, Telegram, notificaciones con aplicación cerrada, adjuntos y guardado con distintos roles reales. Requieren sesiones operativas y destinatarios de prueba definidos. No se activa un proveedor pagado ni una campaña por mera compilación.
6. **P2 — Deuda estática y rendimiento.** El lint completo conserva **332 errores y 29 advertencias** históricos de componentes anidados, variables sin uso y reglas del compilador React. No se ocultaron para declarar un resultado verde: pasa el control específico de errores de ejecución, no el lint completo. El bundle principal aún supera 500 kB; el detector visual encontró animaciones de ancho, efectos y contrastes pendientes fuera del formulario intervenido. La restauración de sesión funcionó con el mecanismo de caché, pero se observó latencia de Auth pendiente de diagnóstico.

## Estado de interfaz (evaluación limitada a las superficies inspeccionadas)

| Dimensión | Puntuación / 4 | Evidencia |
|---|---:|---|
| Accesibilidad | 2 | Alta corregida; otros formularios y controles pequeños conservan deuda |
| Rendimiento | 2 | Render limitado y carga diferida presentes; chunk principal grande |
| Responsive | 3 | Alta usable en escritorio y móvil; faltan todas las combinaciones de módulos y roles |
| Temas | 2 | Tokens y dos temas existen; siguen colores locales y contraste desigual |
| Integridad de implementación | 2 | Mejora de exactitud financiera y manejo de errores; dependencias externas pendientes |
| Total | **11/20** | Evaluación parcial, no certificado de accesibilidad |

El detector es una ayuda estática: una transición de ancho o una curva elástica no prueba por sí sola un problema visible de rendimiento. Se conservaron los patrones existentes cuando no hubo una falla verificada en esta sesión.

## Publicación y reversión

Producción anterior: `dpl_CHHaFcNYWeJgT9RzLp1nHWTrKjRD`, `stratos-ai-application-613lsqx5m-iagents-projects.vercel.app`, revisión e08d0c9. Los dominios app.stratoscapitalgroup.com, stratoscapitalgroup.com y getstratosai.com apuntaban al mismo despliegue.

**Publicación completada:** revisión `afdd64b755911026a562289090aee86c62d88a8f`, despliegue de producción `dpl_Fwx7c8XAsHPTdm11vz62Zodrda5F`, estado **READY**, URL `https://stratos-ai-application-fm4ifybqx-iagents-projects.vercel.app`. Se promocionó la entrega verificada mediante Vercel, que generó el despliegue con la configuración de producción.

Verificación posterior: app.stratoscapitalgroup.com, stratoscapitalgroup.com y getstratosai.com respondieron HTTP 200, con el mismo recurso JavaScript y service worker **stratos-v426**. Las rutas `/nsg`, `/grupo28`, `/vega`, `/mondrian` y `/p` devolvieron HTML con HTTP 200. Se comprobaron las cabeceras `X-Frame-Options: DENY` y `X-Content-Type-Options: nosniff`; una renovación push incompleta fue rechazada con HTTP 400. El script de salud confirmó aplicación, base y Auth disponibles.

Los cambios están en la rama `codex/system-audit-live-20260912` y en [PR #755](https://github.com/iagents00/stratos-ai-application/pull/755). Los controles de release, planos y Vercel pasaron para la revisión publicada. **La integración a main requiere la revisión configurada en GitHub y sigue pendiente**; no se eludió esa protección. Es necesario integrar el PR antes de que otra publicación desde main sustituya estas correcciones. Un eventual commit posterior que solo actualice este informe no cambia la revisión de código publicada.

La reversión de Vercel puede recuperar el despliegue anterior; no modifica Supabase. No se hicieron cambios de esquema ni borrados en la base de producción durante esta auditoría. Las correcciones de funciones Supabase descritas arriba están preparadas en Git, pero **no están desplegadas en el servidor de Supabase**.
