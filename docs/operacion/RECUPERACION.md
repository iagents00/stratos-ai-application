# Recuperación y continuidad

## Objetivos y evidencia

**Objetivo propuesto:** diagnóstico web en menos de 30 segundos y reversión de interfaz en 2–5 minutos, con una entrega previa disponible y acceso operativo. No son tiempos garantizados. Medir tiempo hasta detectar, decidir, ejecutar y verificar; no contar solo la duración del comando.

Una caída del proveedor, pérdida de base o pérdida de claves no se resuelve necesariamente en minutos. El tiempo de recuperación (RTO) y cuánto dato se puede perder (RPO) requieren confirmar el plan contratado, volumen y respaldo. No prometer al mercado RPO cero ni recuperación total en segundos sin demostrarlo.

| Capa | Objetivo inicial | Requisito | Estado en esta auditoría |
|---|---|---|---|
| Web defectuosa | 2–5 min | SHA anterior READY, configuración compatible, acceso Vercel | Herramienta de diagnóstico y ensayo de promoción |
| Configuración Rieles | 2–5 min | Admin de la misma org, versión previa registrada | Guardado confirmado; historial nuevo requiere migración 243 |
| Base/Auth | Determinar con ensayo | Backup/PITR y permisos del proyecto correcto | Acceso y restauración pendientes |
| Storage | Determinar con volumen | Copia de objetos, metadatos y políticas | No certificado |
| n8n | Determinar con ensayo | Base, exports, clave de cifrado y versión del servidor | Acceso pendiente |
| App nativa | Depende de distribución | Binario firmado y vía de distribución | Rollback web no la modifica |

## Primer minuto

Ejecutar desde una copia limpia con Node 24 y dependencias instaladas:

```sh
npm run ops:doctor -- --output /tmp/stratos-incidente.json
```

El resultado no contiene credenciales ni filas de clientes. Revisa `ok` por servicio, tiempo, SHA y versión. El health de Auth confirma disponibilidad HTTP, no un login real. Una respuesta de PostgREST confirma acceso al servicio, no todas las tablas ni permisos. Una respuesta HTML 200 tampoco basta: el diagnóstico comprueba el JavaScript de entrada, manifiesto y service worker.

No borres almacenamiento del navegador, tokens o colas pendientes como primer intento: puede haber trabajo aún no sincronizado. No publiques varias correcciones simultáneas durante la investigación.

## Web: revertir una entrega

1. Localiza en Vercel una entrega anterior que funcionaba con la base actual. Confirma su SHA, no solo su fecha o nombre.
2. Lee el modo de ensayo:

```sh
npm run ops:rollback -- --deployment dpl_Fwx7c8XAsHPTdm11vz62Zodrda5F
```

Ese ID es una referencia histórica de la entrega v426, no una recomendación permanente de rollback. La herramienta consulta Vercel y rechaza IDs de otro proyecto o no listos. Comprueba siempre compatibilidad de esquema y variables: la promoción puede reconstruir con la configuración actual.

3. Cuando decidas volver a esa entrega, repite con `--execute`. Usa credenciales existentes y scope `iagents-projects`. No modifica base ni secretos.
4. Ejecuta `ops:doctor` y confirma sesión + CRM + una consulta Copilot en cuenta de prueba. Si la versión anterior no tiene `release.json`, el diagnóstico lo marcará: verifica ese SHA mediante Vercel y registra la excepción.
5. Corrige la rama y el PR antes de reanudar publicaciones automáticas. Un deploy posterior de main puede reemplazar una promoción de emergencia.

## Base y Auth

- HTTP 402: revisar facturación en el proyecto correcto. No recrear la base.
- DNS/timeout: comparar proveedor y otra conexión. Un DNS que resuelve no prueba que la base esté sana.
- Auth responde pero la persona no entra: revisar sesión y logs en Supabase. Preservar los límites/guardas de `src/lib/auth.js` mientras se investiga. No debilitar rotación de tokens para ocultar el síntoma.
- Error de permisos en módulos: ejecutar con operador autorizado `select * from public.fn_qa_rpc_del_front() where estado <> 'OK';`. Contrastar permisos de asesores, admins y organizaciones diferentes. No conceder EXECUTE a todo indiscriminadamente.
- Pérdida/corrupción: detener las escrituras afectadas y capturar evidencia antes de una restauración. Restaurar primero en un proyecto aislado. Activar integraciones únicamente después de verificar filas, permisos, archivos y coherencia.

## Qué debe contener un respaldo real

| Artefacto | Incluye | Precaución |
|---|---|---|
| Backup PostgreSQL/PITR de Supabase | Tablas, esquema, roles/políticas según método | Confirmar cobertura y retención del plan; Auth requiere el procedimiento soportado por Supabase |
| Objetos Storage | Archivos y relación con buckets/metadatos | El backup de la base no incluye el contenido binario de Storage |
| Base de n8n + exports | Workflows, configuración e historial según política | Restaurar en la versión compatible |
| Clave de cifrado n8n | Permite descifrar credenciales existentes | Custodia separada en gestor; perderla puede inutilizar las credenciales |
| Código y artefactos | SHA, lockfiles, migraciones, binarios, manifiesto | No basta tener una carpeta de código sin identificar el despliegue |
| Referencia a secretos/DNS | Nombre y ubicación segura, no valores en Git | Confirmar acceso del suplente y titularidad de cuentas |

El botón **Exportar datos CRM** incluye filas visibles de cuatro tablas y respeta RLS. Está paginado, pero no es una instantánea transaccional y excluye Auth, Storage y otros módulos. No usarlo como plan de recuperación de desastres.

Para respaldo lógico administrado, usar herramientas oficiales con una conexión del proyecto correcto y archivos cifrados. Ejemplo de estructura del paquete, sin incluir secretos en este repositorio:

```json
{
  "schemaVersion": 1,
  "createdAt": "FECHA_ISO_REAL",
  "sourceProject": "glulgyhkrqpykxmujodb",
  "artifacts": [
    {"kind":"database","path":"db.dump.enc","sha256":"HASH_REAL"},
    {"kind":"storage","path":"storage.tar.enc","sha256":"HASH_REAL"},
    {"kind":"automations","path":"n8n.tar.enc","sha256":"HASH_REAL"},
    {"kind":"secrets-reference","path":"custodia.txt","sha256":"HASH_REAL"}
  ]
}
```

```sh
npm run ops:backup-check -- /ruta/segura/manifest.json
```

Comprueba existencia, antigüedad máxima de 24h y SHA-256 de cada artefacto. **Integridad no significa restaurabilidad**. Las claves para descifrar se custodian fuera del paquete. El manifiesto debe cubrir toda la instancia o detallar expresamente las exclusiones.

## Ensayo de restauración: condición antes de vender recuperación rápida

1. Crear destino aislado, mismo esquema y versiones compatibles. Bloquear salidas a WhatsApp, correo, llamadas, pagos y cron productivos.
2. Restaurar con el mecanismo oficial de Supabase o `pg_restore` en el destino aislado. Nunca pegar comandos de restauración sobre producción ni usar `--clean` allí.
3. Recuperar objetos Storage y comprobar una muestra con hashes. No basta que existan los nombres en la base.
4. Restaurar n8n y su clave; mantener workflows inactivos. Comprobar credenciales sin enviar mensajes.
5. Ejecutar centinela RPC, pruebas de aislamiento por rol y dos organizaciones, conteos, relaciones y una transacción de prueba. Comparar con el manifiesto de origen.
6. Registrar inicio/fin, pérdida máxima de datos, filas/objetos esperados y reales, resultado y responsable. Repetir al cambiar arquitectura o mecanismo de backup.
7. Solo entonces definir RTO/RPO comercial y autorizar un cambio de tráfico real si es necesario.

## Copilot, automatizaciones y proveedores

Si el comando quedó “pendiente de confirmar”, busca primero su ejecución e historial. No lo reenvíes a ciegas: pudo ejecutarse y perderse la respuesta. Si hay duplicaciones, pausa el workflow afectado desde n8n, identifica el origen e idempotencia, restaura una versión exportada y prueba con destinatarios controlados antes de activarla.

Para Edge Functions, seleccionar explícitamente `--project-ref glulgyhkrqpykxmujodb` y publicar solo la función corregida. No ejecutar todas las migraciones históricas con `db push`: hay numeración heredada y scripts ya aplicados con identificadores diferentes. Revisar el inventario remoto antes de una migración nueva.

Para push/móvil, revisar `src/lib/push.js`, `src/lib/push-native.js`, función de envío y proveedor. El indicador “conectado” del navegador no acredita notificaciones con la aplicación cerrada. Mantener una prueba con dispositivo real y destinatario definido.

## Registro de incidente

Guardar fecha/hora, dominio, módulo, rol (sin datos privados), SHA anterior/nuevo, señal que falló, comando ejecutado, impacto, tiempo de recuperación, pérdida de datos y verificación final. Agregar causa y prueba de regresión a la entrega que lo corrige.

Fuentes de procedimientos: [Backups de Supabase](https://supabase.com/docs/guides/platform/backups), [variables de cifrado n8n](https://docs.n8n.io/hosting/configuration/environment-variables/deployment/), [promoción con Vercel CLI](https://vercel.com/docs/cli/promote). Verificar versiones y plan antes de ejecutar.
