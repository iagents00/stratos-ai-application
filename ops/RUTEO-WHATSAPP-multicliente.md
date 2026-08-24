# Ruteo multi-cliente de WhatsApp — contrato para n8n

_Aplicado a producción el 23-ago-2026 · migración `supabase/migrations/233_whatsapp_tech_provider_routing.sql`_

---

## Qué cambió y por qué

El ruteo viejo (`fn_asesor_del_numero`) tenía dos defectos que impiden ser Tech Provider:

1. **Hardcodeaba la organización de Stratos.** Con Embedded Signup cada cliente
   conecta su propia WABA; el WhatsApp de Grupo 28 o Vega habría resuelto a la
   org de Stratos y sus leads habrían caído en el CRM equivocado.
2. **Ruteaba por los últimos 10 dígitos del número visible.** Frágil, y obliga a
   mantener un MAP a mano por cada asesor nuevo.

El identificador estable que Meta manda en **cada** webhook es
`metadata.phone_number_id`. Ese es el nuevo eje del ruteo.

---

## Función 1 — resolver el canal (reemplaza al MAP hardcodeado)

```
POST /rest/v1/rpc/fn_resolver_canal_whatsapp
```

```json
{
  "p_phone_number_id": "106540352242922",
  "p_waba_id": "134611108788032",
  "p_display_phone_number": "529848779295",
  "p_organization_id": null
}
```

Devuelve una fila, o **ninguna** si el canal no está registrado:

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000001",
  "org_slug": "stratos",
  "asesor_id": "941ad724-dc5d-46a5-8487-fda87a297b31",
  "asesor_name": "Gael G",
  "numero_whatsapp": "+529848779295",
  "phone_number_id": null,
  "waba_id": null,
  "platform_type": null,
  "match_by": "display_phone_number"
}
```

**Orden de prioridad del match** — manda los tres parámetros y la función elige:

| Prioridad | Campo | Cuándo aplica |
|---|---|---|
| 1 | `phone_number_id` | Siempre que el canal se haya dado de alta por Embedded Signup |
| 2 | `waba_id` | Cliente con un solo número |
| 3 | últimos 10 dígitos del número | **Compatibilidad** con los canales conectados a mano |

`match_by` te dice cuál se usó. Si viene `display_phone_number`, ese canal
todavía es legacy y conviene migrarlo.

### De dónde sale cada dato en el webhook de Meta

```
waba_id              → entry[0].id
phone_number_id      → entry[0].changes[0].value.metadata.phone_number_id
display_phone_number → entry[0].changes[0].value.metadata.display_phone_number
```

### Cambio concreto en n8n

En el workflow `aJdFcIJAsGQsNBQj`, nodo **“Parsear Meta y asignar asesor”**:
borrar el objeto `MAP` de números y sustituirlo por una llamada a esta RPC.
El `organization_id` que devuelve es el que debe escribirse en el lead — hoy
se asume Stratos, y eso es justo lo que rompe con multi-cliente.

**Si la RPC no devuelve fila, no inventes un asesor.** Manda el lead a la cola
sin asignar y avisa; un canal sin registrar es un error de configuración, no un
lead de Stratos.

---

## Función 2 — alta de canal desde Embedded Signup

```
POST /rest/v1/rpc/fn_registrar_canal_whatsapp
```

```json
{
  "payload": {
    "org_slug": "grupo-28",
    "phone_number_id": "106540352242922",
    "waba_id": "134611108788032",
    "numero_whatsapp": "+525500000000",
    "asesor_name": "Nombre del asesor",
    "asesor_id": null,
    "verified_name": "Grupo 28",
    "quality_rating": "GREEN",
    "platform_type": "CLOUD_API",
    "onboarded_via": "embedded_signup"
  }
}
```

Acepta `organization_id` (uuid) **o** `org_slug`. Devuelve
`{"ok": true, "id": "..."}` o `{"ok": false, "error": "..."}`.

Es idempotente: reintentar con el mismo `phone_number_id` actualiza la fila, no
duplica.

### Rechaza ON_PREMISE a propósito

```json
{"ok": false, "error": "El numero esta en ON_PREMISE (API vieja). No recibe webhooks de Cloud API: hay que migrarlo antes de conectarlo."}
```

Esta es la trampa que costó una sesión entera con el número de Marco Lopez
(ver `ops/ESTADO-FINAL-marco-whatsapp.md`). Un número ON_PREMISE se conecta sin
error aparente y luego **nunca** entrega webhooks. Ahora se rechaza de entrada.

### Dónde encaja en el flujo de Embedded Signup

1. El cliente completa el popup de Meta → devuelve un `code`
2. Intercambias el `code` por un token de acceso
3. `GET /{waba_id}/phone_numbers` para leer `id`, `display_phone_number`,
   `verified_name`, `quality_rating`, `platform_type`
4. **Llamas a `fn_registrar_canal_whatsapp` con eso**
5. Suscribes tu app a la WABA del cliente (`POST /{waba_id}/subscribed_apps`)

---

## Seguridad

Ambas funciones son `SECURITY DEFINER` y están concedidas **solo a
`service_role`**. `anon` y `authenticated` fueron revocados de forma nominal.

Esto importa: `revoke ... from public` **no basta** en Supabase — concede
EXECUTE explícito a `anon` y `authenticated` por default privileges. Sin el
revoke nominal, cualquiera con el anon key público del bundle JS podría
reescribir a qué cliente pertenece un número de WhatsApp.

---

## Estado verificado en producción

| Prueba | Resultado |
|---|---|
| Los 4 canales manuales resuelven por número visible | ✅ Ken, Marco, Gael, Oscar |
| Alta de canal de otro cliente cae en **su** org, no en Stratos | ✅ `grupo-28` |
| Resolución por `phone_number_id` | ✅ |
| Resolución por `waba_id` | ✅ |
| Número desconocido no resuelve a nada | ✅ (cero filas) |
| Re-alta del mismo `phone_number_id` no duplica | ✅ |
| ON_PREMISE rechazado | ✅ |
| `anon` / `authenticated` sin EXECUTE | ✅ |

`fn_asesor_del_numero` sigue existiendo y funcionando: no se tocó nada de lo que
hoy está en vivo. Se puede retirar cuando n8n haya migrado a la función nueva.
