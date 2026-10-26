# Stratos AI — estado y pendientes de producción

Revisado el 26 de octubre de 2026. Sustituye el checklist de prototipo de abril, que ya no describía la plataforma y contenía ejemplos de claves de IA en el navegador. Las credenciales de proveedores pertenecen exclusivamente al servidor.

## Publicado y comprobado

- Web y plataforma desde `main`, con identidad de Stratos y aislamiento por organización. Los cuatro dominios de `ops/services.json` sirven la misma entrega verificada.
- 71 integraciones en el último mes: recuperación de producción, CRM y carga de carteras, Mi Espacio y proyectos, administración de empresas y usuarios, Create, recuperación de contraseña, tema azul, web pública, demo clínica y seguridad de cuenta.
- Ocho funciones Edge contrastadas con su fuente: administración de usuarios/empresas, recuperación de contraseña, entrada Meta Ads, transcripción, notas, sugerencias y Copilot de proyectos.
- Esquema de altas y administración 266, 267, 271–274 registrado en Supabase. Controles de 268–270 comprobados directamente en funciones/permisos; no repetir migraciones por diferencias en su numeración histórica.
- Android APK y carga a TestFlight completados para la entrega revisada. Esto no acredita publicación de esa versión en las tiendas.

Evidencia y límites: [reconciliación del último mes](docs/auditorias/2026-10-26-reconciliacion-produccion.md).

## Pendientes reales

| Área | Qué falta para considerarla disponible |
| --- | --- |
| Pagos | Elegir proveedor y cuenta receptora, productos, moneda y reglas comerciales; implementar almacenamiento/adaptador y probar antes de habilitar cobros. [Contrato y activación](docs/payments/activation.md). |
| WhatsApp por empresa | Autorización del propietario, número, permisos del proveedor y piloto de entrada/eco por canal. La base de solo lectura no activa canales automáticamente. [Procedimiento](docs/operacion/INFOBIP-LECTURA.md). |
| Clínicas adicionales | Conexiones y usuarios autorizados por organización; la demo clínica no es un expediente productivo ni acredita requisitos regulatorios. [Alcance](docs/auditoria-clinica/README.md). |
| Apps nativas | Verificar versión aprobada y publicada en cada tienda y probar el binario instalado; TestFlight/APK no equivalen a distribución pública. |
| Recuperación operativa | Ensayo de restauración de backups/PITR y verificación de proveedores/n8n con responsables y accesos apropiados. |

Rails permanece apagado por defecto; únicamente se activa para una organización por petición expresa. Los PR históricos y stashes se conservan como respaldo, no como instrucciones para reemplazar la fuente actual.

## Entrega de cambios futuros

Seguir `AGENTS.md`: `main` reciente → rama `codex/` → pruebas → PR → `Validar Stratos` y `verificar` aprobados → integración → comprobar `release.json` en todos los dominios. Las funciones y migraciones de Supabase requieren comprobación y despliegue independiente.

`npm run ops:doctor -- --expect SHA_COMPLETO` verifica identidad, versión, assets, service worker, Auth y disponibilidad de base de datos. No sustituye pruebas autenticadas por organización ni pruebas de proveedores externos.
