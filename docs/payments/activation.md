# Activación de pagos de Stratos

Estado: base de integración, cobros desactivados. No hay proveedor elegido, adaptador productivo, almacenamiento de órdenes ni credenciales de pagos configuradas en esta entrega. `GET /api/payments` informa el estado; `POST` rechaza cargos con 503. Nunca activar mediante una variable del navegador.

## Decisiones pendientes del propietario

Elegir Stripe u Openpay y la cuenta comercial receptora. Confirmar si se cobrarán suscripciones de Stratos, pagos de clientes de cada organización o ambos. Definir productos, importes, moneda, impuestos, renovaciones, cancelaciones y devoluciones. No reutilizar una cuenta receptora entre organizaciones sin definir expresamente ese modelo.

## Contrato implementado

`server/payments/core.mjs` recibe una identidad autenticada y una orden persistida. Rechaza acceso cruzado entre organizaciones, roles no autorizados, importes inválidos y retornos no permitidos. Los importes son enteros en unidades menores; no se reciben del navegador. `createCheckout` utiliza una clave estable por orden y un bloqueo durable. `receivePaymentEvent` exige un adaptador que verifique el evento antes de consultar órdenes, verifica importe/moneda/organización y no degrada pagos confirmados por eventos tardíos. La página de retorno nunca confirma un pago.

Las pruebas usan almacenes y adaptadores simulados: no prueban cargos reales ni sustituyen la transacción de base de datos.

## Trabajo para conectar el proveedor elegido

1. Crear tablas de órdenes, sesiones y eventos con aislamiento por organización. Revocar escrituras del cliente sobre importe, estado y referencias externas. Índice único `(provider,event_id)`.
2. Implementar `getOrder`, `withOrderLock`, `saveCheckout`, `applyEventOnce`. El bloqueo debe persistir entre instancias; el registro del evento y la actualización de la orden deben ser una sola transacción. Si falla la transacción, permitir reintento.
3. Autenticar en servidor con Supabase `getUser`, leer rol y organización activos de la base, nunca del cuerpo ni metadatos editables. Limitar intentos y tamaño de solicitudes.
4. Implementar adaptador Stripe u Openpay: checkout/tokenización alojados, URLs permitidas fijas, timeout, errores recuperables y verificación auténtica de eventos. Openpay requiere su mecanismo de validación y conciliación específico; no asumir que usa firmas Stripe. Definir el tratamiento de pagos pendientes, devoluciones parciales, disputas y renovaciones antes de habilitar esas operaciones.
5. Guardar credenciales en secretos del servidor, nunca `VITE_*`. Separar pruebas y producción. Persistir referencia externa para conciliación y reintentos sin duplicar cargos.
6. Probar pagos aprobados, rechazados, autenticación adicional, cancelación, reintentos concurrentes, webhooks duplicados/fuera de orden y recuperación tras caída. Validar un cobro real controlado y su devolución con autorización del propietario antes de anunciar disponibilidad.
7. Conectar la interfaz al estado real del servidor y habilitar únicamente organizaciones autorizadas. Mantener los flujos comerciales fuera de los binarios móviles existentes.

## Referencias oficiales

- https://docs.stripe.com/checkout/fulfillment
- https://docs.stripe.com/api/idempotent_requests
- https://documents.openpay.mx/docs/webhooks.html
- https://documents.openpay.mx/docs/testing
