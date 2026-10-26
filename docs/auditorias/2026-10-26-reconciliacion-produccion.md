# Reconciliación de producción · 26 de octubre de 2026

## Alcance y fuente

Revisión del 26 de septiembre al 26 de octubre. Fuente inicial: `e397555f526517c64827e417cd041ad8390f5cee`, `origin/main`, árbol inicialmente limpio. Identidad comprobada mediante `npm run check:project`. Supabase: cuenta dedicada `synergyfornature@gmail.com`, proyecto `glulgyhkrqpykxmujodb`; todas las consultas remotas pasaron por el wrapper aislado. No se modificaron datos, credenciales, canales ni configuración de organizaciones.

## Trabajo del mes

71 integraciones de primer padre en main. Se revisaron 110 referencias locales/remotas recientes y los siete checkouts registrados; no había cambios de código sin guardar. El checkout de auditoría de septiembre conserva únicamente evidencia local no versionada.

Las ramas con commits que Git no reconocía como equivalentes por squash se contrastaron con su PR integrado. Coinciden todos sus archivos modificados en el momento de la integración: seguridad/pagos #834, Create/proyectos #789, tema negro #773, enlaces #792, demo clínica #810, I Space #769, descargas #826 y tema azul #795. También coinciden las ramas remotas de agenda #777, luces #821/#816, animación #814 y separación web/login #818. Las diferencias posteriores pertenecen a cambios sucesivos en main, no a trabajo omitido.

No hay PR abiertos creados durante el período. Los 12 PR abiertos son históricos (abril–agosto); la recuperación #765 ya documenta su tratamiento. Se conserva #616 marcado expresamente «NO MERGEAR» y #711 con una campaña de fecha vencida. No se reintroducen versiones antiguas sobre la plataforma actual.

Los tres stashes se conservaron. El autostash del 10 de octubre corresponde al alta de empresas, temas y provisión de usuarios incorporados y posteriormente endurecidos. Los dos respaldos antiguos corresponden a la recuperación de septiembre: métricas, agenda, Copilot, navegación y bot. Se compararon sus archivos principales con la recuperación #765; parte es idéntica y parte fue sustituida por código posterior. No se aplicaron íntegros, pues contienen fuente anterior y cambios de dependencias/configuración obsoletos. Referencia: [recuperación](../recovery/2026-09-30-production-recovery.md).

## Producción real

Los cuatro dominios `getstratosai.com`, `app.getstratosai.com`, `stratoscapitalgroup.com` y `app.stratoscapitalgroup.com` devolvieron la revisión inicial completa, `dirty=false` y service worker `stratos-v451`. Comprobados HTML, asset JavaScript, manifiesto y worker; Auth y REST respondieron 200. Revisión visual de portada y navegación real desde «Iniciar sesión» al formulario en `app.getstratosai.com/login`.

Descargadas ocho funciones Edge a una carpeta temporal externa, sin sobreescribir fuentes: `admin-create-user`, `whatsapp-admin`, `password-recovery`, `meta-lead-ads`, `transcribir-voz`, `organize-lead-notes`, `suggest-next-actions`, `project-copilot`. Coinciden con la fuente: dos solo difieren en el salto de línea final; `project-copilot` contiene el módulo compartido expandido y coincide al reconstruirlo. También coinciden los módulos compartidos descargados de provisión, autenticación y credenciales temporales.

Migraciones 266, 267, 271, 272, 273 y 274 registradas remotamente. Para 268–270 se verificaron los controles instalados: ejecución pública del resolver de portafolios, RLS de su tabla, generador de enlaces con nombre y serialización de ambas funciones de recuperación. El historial usa versiones de fecha distintas de los nombres locales; no justifica ejecutar otra vez el historial SQL.

`huli-copilot` no figura como función Edge desplegada, pero tampoco está conectado a una vista activa: la integración clínica usa `/api/dental-huli`. No se publicó una segunda vía incompleta ni se confundió la demo con disponibilidad multiclínica.

## Correcciones de esta entrega

- Añadido `app.getstratosai.com` al catálogo de dominios monitorizados: es el destino vigente del login y faltaba en `ops:doctor`.
- El monitor horario conserva la comparación de assets contra Vercel y ahora verifica todos los dominios contra el SHA de main, además de Auth y base de datos.
- El diagnóstico rechaza manifiestos de otro proyecto, ID de Vercel o repositorio, aunque respondan 200 y tengan un SHA válido.
- `supabase/.temp/cli-latest` deja de estar versionado. Las consultas CLI cambiaban ese caché e identificaban la compilación local como sucia. El archivo local y el enlace de proyecto se conservan.
- Reemplazado el checklist obsoleto de abril por estado comprobado, pendientes concretos y flujo de entrega vigente.

## Validación y límites

246 pruebas de aplicación aprobadas sobre la fuente inicial; compilación web correcta y comprobación runtime sin errores de sintaxis, referencias indefinidas ni hooks condicionales. Permanecen 337 avisos adicionales de lint anteriores. Ampliadas las pruebas operativas para rechazar identidades ajenas.

Los workflows de Android APK y TestFlight del SHA inicial terminaron correctamente. No equivalen a aprobación/publicación en App Store o Google Play. No se probaron cargos, campañas, llamadas ni mensajes reales. Tampoco se ejecutó un ensayo de restauración o CRUD autenticado de todos los clientes.

Pagos permanece desactivado porque faltan proveedor, cuenta y reglas comerciales. WhatsApp requiere alta/piloto por canal; Rails permanece apagado por defecto. Estas dependencias no se resuelven activando indiscriminadamente módulos para todas las empresas.
