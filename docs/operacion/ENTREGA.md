# Entrega, pruebas y criterio de lanzamiento

## Una entrega identificable

La salida web contiene `/release.json`: SHA, fecha de compilación, versión SW, despliegue y si el árbol estaba modificado. `ops:doctor` rechaza una entrega sucia, un manifiesto inválido, un recurso de entrada roto o un SW que no coincida. Las credenciales no forman parte del manifiesto.

Proceso: rama aislada desde la producción real → cambios y documentos → pruebas → PR con revisión requerida → preview → prueba del rol/flujo afectado → promoción con configuración de producción → diagnóstico por dominio → registro. No eludir la revisión configurada en main.

```sh
npm ci --no-audit --no-fund
npm test
npm run check:runtime
npm run verificar-rails
npm run ops:check
npm run verificar-docs
npm run verificar-contexto
npm run verificar-rpc
node scripts/check-tenant-modules.mjs
npm run planos
npm run build
```

Para repetir los doce controles PostgreSQL aislados (sin conexión a Supabase):

```sh
npm install --prefix /tmp/stratos-db-audit @electric-sql/pglite@0.5.8 --no-fund --no-audit
STRATOS_PGLITE_MODULE=/tmp/stratos-db-audit/node_modules/@electric-sql/pglite/dist/index.js npm run test:rails-db
```

El motor de prueba vive fuera de las dependencias de la aplicación; CI instala la misma versión. Los fixtures mínimos acreditan el comportamiento del nuevo SQL, no todas las políticas y triggers remotos.

El lint completo conserva deuda histórica. `check:runtime` comprueba referencias indefinidas, sintaxis y hooks condicionales; no equivale a pasar todas las reglas. Los tests con datos sintéticos no sustituyen el ensayo en un staging real de Supabase.

## Puerta de lanzamiento

| Condición | Evidencia exigida |
|---|---|
| Código recuperable | SHA/tag, lockfile, artefacto identificable, despliegue previo READY |
| Permisos Rieles | Vendedor rechazado por servidor, admin de la misma org permitido; otra org rechazada |
| No pérdida silenciosa | Error de guardado visible, estado confirmado tras recarga, conflicto sin sobrescritura |
| Copilot seguro | JWT validado por servidor, identidad derivada de sesión e idempotencia acreditada |
| Recuperación | Backup íntegro y restaurado en aislamiento, tiempos medidos, acceso de suplente |
| Entorno operativo | Titulares de dominios/cuentas, facturación, secretos y certificados recuperables |
| Integraciones | Prueba controlada de ida y vuelta por canal, sin usar prospectos reales como datos de prueba |
| Experiencia vendedor | Prueba en móvil y escritorio; usuarios del equipo completan flujo sin ayuda |

Si falta evidencia, marcar **pendiente**, no convertirlo en verde porque el build compiló. Cualquier alta de otro cliente debe verificar organización, módulos, roles, reglas, zona horaria y prueba de aislamiento antes de activar automatizaciones.

## Cambios de esquema

No editar migraciones históricas aplicadas. Una migración nueva debe tener propósito, compatibilidad con la web anterior, guardas, prueba de permisos y plan de recuperación. Aplicar primero en staging, verificar y después en producción. Separar errores de transporte de rechazos por permisos. Una migración que estrecha permisos puede afectar workflows con acceso directo: revisar n8n antes de activar la revocación de agenda en 243.

## Mantenimiento

Ejecutar pruebas en cada PR. Regenerar planos al cambiar rutas/imports/tablas/RPC. Repetir el ensayo de restauración cuando cambie el esquema operativo o mecanismo de backup. Mantener la fecha y resultado real de cada ensayo en el registro interno. Un monitoreo continuo aún necesita responsable, canal de aviso y comprobación de recepción; este trabajo no instala ni acredita ese monitoreo por sí solo.
