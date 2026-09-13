# Ventas sobre Rieles: contrato operativo

## Dos personas, dos responsabilidades

| Acción | Vendedor | Admin / super_admin de la misma organización |
|---|---|---|
| Ver las acciones que le permiten sus permisos | Sí | Sí |
| Abrir ficha, contactar, registrar resultado y reprogramar | Sí, sobre clientes autorizados | Sí, según alcance de datos |
| Cambiar reglas, prioridad, instrucciones o activar proceso | No | Sí, con sesión real y publicación explícita |
| Forzar vista previa por URL | No | Sí; no cambia la configuración de la empresa |
| Revisar versiones históricas de configuración | No | Desde servidor, después de migración 243 |

Los roles `ceo`, `director`, etc. no configuran Rieles salvo que el modelo de permisos se cambie formalmente. Un vendedor no puede desactivar el proceso con `?rails=0`. Consultar todos los clientes es una navegación, no una reconfiguración; siempre existe **Volver a Mi Día**.

## Configurar sin sorpresas

1. Admin abre **Proceso → Ventas sobre Rieles**. Ve el estado vigente.
2. Prepara borrador: activación, máximo por lista, reglas e instrucciones. Puede editar sin alterar inmediatamente al equipo.
3. Ve un ejemplo ilustrativo de la instrucción antes de publicarla. Nunca se envía ese texto interno a un prospecto como mensaje prellenado.
4. Pulsa **Publicar proceso para el equipo**. Solo se muestra éxito después de confirmar la fila guardada.
5. Si otra persona cambió la configuración, no se sobrescribe: se conserva el borrador y se solicita cargar la versión vigente. Descártalo para cargarla.
6. El cliente refresca la configuración al volver a la app y cada minuto mientras está visible. Si falla, conserva la última configuración confirmada y avisa; el primer acceso sin configuración verificada muestra el CRM con aviso.

La regla **Definir el siguiente paso** permanece activa. Evitar instrucciones ambiguas: cada regla debe describir qué pasó, qué conseguir y qué registrar después. El administrador es responsable de que cada regla aplique al proceso comercial de su empresa; el motor actual conserva reglas de ventas inmobiliarias y no convierte cualquier negocio en un ERP genérico.

## Trabajar sin confusión

El vendedor ve una lista corta, ordenada por prioridad, con cliente, etapa, razón y qué conseguir. Puede abrir la ficha, llamar o abrir WhatsApp y luego registrar **Realizado**, **No contestó** o **Reprogramar**. Abrir WhatsApp no prueba envío ni contacto efectivo.

Un resultado fallido conserva la acción y muestra recuperación. **No contestó** no suma a “realizados”; **reprogramado** se cuenta aparte. Al agotar una lista quedan visibles los pendientes adicionales y puede abrir la siguiente. No se anuncia “terminaste el día” mientras queden clientes por atender.

El orden se mantiene mientras trabaja, pero seguridad y actualidad tienen prioridad: una baja, opt-out o seguimiento pactado para otro día saca al cliente de las recomendaciones. Datos cargados de otra persona/organización nunca deben reutilizar la tienda de configuración anterior.

Reprogramar usa las 9:00 del día elegido en la zona del dispositivo y guarda un instante ISO. Otra hora se define en la ficha. La fecha del lead y el resultado de agenda todavía son dos escrituras: si solo se confirma la fecha se informa el éxito parcial y no se invita a volver a moverla a ciegas. Para transaccionalidad total debe añadirse una RPC conjunta con despliegue coordinado.

## Dónde reparar

| Síntoma | Código / dato | Verificación |
|---|---|---|
| Configuración no carga o pertenece a otra sesión | `src/lib/rails-store.js`, `src/hooks/useRailsConfig.js` | Identidad, organización, respuesta de lectura; caché por sesión |
| Cambios desaparecen o se pisan | `organizations.meta_config.rails` | Compare-and-swap, fila devuelta, conflicto entre admins |
| Permite cambiar reglas a vendedor | RLS organizations + migración 243 | Pruebas con JWT de vendedor, no solo menú oculto |
| Instrucción errónea / no respeta fecha | `src/lib/next-action-engine.js` | Lead real normalizado, regla y `next_action_at` |
| Resultado vuelve al recargar | `src/lib/agenda.js`, RPC `rails_marcar_accion` | Permiso, respuesta, fila por lead/día |
| Sobran o faltan tarjetas | `src/app/views/MiDia.jsx` | Carga de agenda, bajas, fechas futuras, siguiente lista |

## Seguridad pendiente de servidor

La migración 243 añade un historial inmutable para el usuario, exige admin de la misma organización para modificar la clave rails, revoca escrituras directas de agenda y refuerza su RPC con acceso al cliente y opt-out. **Preparar el SQL no lo despliega.** Antes de publicarlo, verificar en staging y comparar políticas remotas.

Limitación temporal: las RPC existentes agrupan por `CURRENT_DATE` del servidor (UTC en Supabase). Mi Día reinicia resultados con la misma frontera UTC. Se debe acordar e implementar una zona comercial por organización antes de prometer jornadas locales exactas. Los seguimientos sí guardan fecha/hora ISO y se muestran en el dispositivo.

## Referencias usadas, sin copiar complejidad

[Salesforce Path](https://trailhead.salesforce.com/content/learn/modules/sales_admin_optimize_salesforce_for_selling/sales_admin_optimize_for_selling_unit_1) coloca etapas, campos relevantes e instrucciones dentro del trabajo del vendedor. [HubSpot Pipeline Rules](https://knowledge.hubspot.com/object-settings/set-up-pipeline-rules) separa configuración y restricciones de avance, con matices para integraciones y permisos. Aplicación en Stratos: guía visible, configuración administrada y verificaciones del servidor; ninguna de estas referencias demuestra que nuestras integraciones ya estén seguras.

## Prueba de aceptación con Duke

Usar cuentas controladas admin/vendedor en dos organizaciones. Admin publica una regla de prueba; vendedor la recibe sin poder modificarla. Simular red caída, doble clic y dos admins editando. Registrar un resultado, recargar y comprobarlo. Reprogramar y verificar hora; retirar consentimiento y comprobar que no reaparezca. Resolver más clientes que el tamaño de lista. Restaurar configuración anterior. Medir éxito sin ayuda y errores; registrar resultados antes de declarar experiencia validada con vendedores reales.
