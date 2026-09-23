# Manual de operación de Stratos

Este es el punto de entrada para mantener el sistema sin depender de su autor. Fecha de revisión: 13 de septiembre de 2026. Los documentos históricos no sustituyen las comprobaciones del entorno real.

## Si está fallando ahora

1. Ejecuta `npm run ops:doctor -- --output /tmp/stratos-incidente.json`. Consulta [Recuperación](RECUPERACION.md) según la capa que falle.
2. Identifica SHA, versión de service worker y dominio afectados. No supongas que `main` coincide con Vercel: una promoción puede publicar otra revisión.
3. Si empezó justo después de publicar la web, ensaya `npm run ops:rollback -- --deployment dpl_ID_VERIFICADO`. Ejecuta el comando con `--execute` solo cuando ese despliegue sea la revisión que quieres recuperar.
4. Si falla la base, Auth, n8n o una app nativa, sigue su procedimiento. Un rollback web no restaura esas capas.
5. Comprueba el resultado con el diagnóstico y una operación representativa en una cuenta de prueba. Registra hora de inicio y recuperación.

## Dónde están los planos

| Necesidad | Fuente | Mantenimiento |
|---|---|---|
| Encontrar pantalla, componente o texto | [MAPA](../../MAPA.md), `npm run buscar -- "texto"` | Generado desde código; comprobado en CI |
| Tablas, RPC, dependencias y flujos | [PLANO](../../PLANO.md) | Generado; el escáner no interpreta SQL dinámico ni configuración remota |
| API, funciones, workflows y variables | [Inventario](INVENTARIO.md) | Generado y verificado en CI; no prueba despliegue remoto |
| Sistemas, responsables y llaves de paso | [Catálogo](../../ops/services.json) | `npm run ops:check`; dueño por función, personas por asignar |
| Incidentes, respaldo y restauración | [Recuperación](RECUPERACION.md) | Ensayo con evidencia antes del lanzamiento |
| Configuración admin y trabajo del vendedor | [Rieles](RIELES.md) | Pruebas de comportamiento y permisos |
| Condiciones para publicar | [Entrega y aceptación](ENTREGA.md) | Verificación en cada PR y despliegue |
| Evidencia de publicación v430 | [Registro](evidencias/2026-09-14-v430.json) | SHA, despliegue, comprobaciones y límites |
| Hallazgos de esta revisión | [Auditoría](../auditorias/2026-09-13-planos-estabilidad-rieles.md) | Estado comprobado; pendientes visibles |

## Plano lógico

```text
Navegador / app móvil
  → main.jsx → AuthContext → ClientOrgGuard → App.jsx → navegación por rol
    → CRM → alta/edición → Supabase Postgres → RLS → fila de la organización
    → Rieles admin → borrador → compare-and-swap → organizations.meta_config.rails
    → Rieles vendedor → motor puro → Mi Día → RPC agenda → agenda_items
    → Copilot → integración → n8n → Supabase / proveedor → historial → interfaz
    → Caja/Finanzas → movimientos paginados → totales por moneda
Vercel: sitio, recursos estáticos, API HTTP. Supabase: Auth, datos, Storage y Edge.
Easypanel/n8n: automatizaciones. Apple/Google: binarios móviles independientes.
```

La autorización efectiva está en la base y los servidores. Ocultar un menú en React no protege datos ni acciones.

## Propiedad y continuidad

Asignar un titular y un suplente reales para cada `ownerRole` del catálogo. Ambos necesitan acceso probado al proyecto correcto, MFA y recuperación del acceso almacenada en el gestor corporativo. Registrar sus nombres en el registro interno de responsables; el repositorio contiene funciones, no contraseñas. Hoy no se ha acreditado el acceso administrativo a Supabase Stratos ni a n8n en esta sesión.

Guardar en el gestor: titularidad de DNS/dominios, facturación de Vercel/Supabase/Easypanel, proyecto y organización, clave de cifrado n8n, referencias a secretos, certificados de firma móvil y procedimiento de recuperación de cuentas. No guardar valores secretos en Git, informes, capturas o tickets.

Cada cambio que añade un servicio debe añadir: responsable, entrada de código, dependencia, estado de fallo, verificación y reversión. Los checks detectan rutas rotas; una persona debe revisar que el contenido siga describiendo el funcionamiento real.
