# Integración Chatwoot + Retell → CRM Stratos (Duke)

Doc operativo para que el workflow de n8n del ecosistema "Duke del Caribe"
escriba leads, appointments y voice logs en nuestro CRM (Supabase
`glulgyhkrqpykxmujodb`), asignados al usuario `iagents@stratos.ai`.

## Arquitectura del flujo

```
WhatsApp (Meta)
   ↓
Chatwoot (EasyPanel) ──webhook message_created──→ n8n
                                                   ↓
                                  [NODO HTTP nuevo: POST a Supabase RPC]
                                                   ↓
                       https://<PROJECT>.supabase.co/rest/v1/rpc/<fn>
                                                   ↓
                                            Supabase (nuestro CRM)
                                                   ↓
                                  Lead aparece en la UI de iagents@
```

## Credenciales necesarias en n8n

Configurar UNA credencial "Supabase Stratos CRM" tipo HTTP Header Auth con:

| Variable | Valor |
|---|---|
| URL base | `https://glulgyhkrqpykxmujodb.supabase.co/rest/v1/rpc` |
| Header `apikey` | `<SERVICE_ROLE_KEY>` (NO la anon key) |
| Header `Authorization` | `Bearer <SERVICE_ROLE_KEY>` |
| Header `Content-Type` | `application/json` |

> ⚠️ La `SERVICE_ROLE_KEY` la sacás de Supabase Dashboard → Settings → API.
> Bypasea RLS, mantenela como secret. No subir a Git ni compartir en chat.

## 5 funciones RPC disponibles

### 1. `fn_upsert_lead_from_chatwoot` (la principal)

**Cuándo llamarla:** en cada evento `message_created` que n8n reciba de
Chatwoot, sin importar el inbox ni el message_type.

**Endpoint:** `POST /rest/v1/rpc/fn_upsert_lead_from_chatwoot`

**Body:** el payload de Chatwoot literal, envuelto en `payload`:

```json
{
  "payload": {
    "private": false,
    "content": "Hola, ¿me podrías mandar info de Cancún?",
    "id": 576,
    "conversation": {
      "id": 20,
      "inbox_id": 6,
      "labels": ["perfilamiento-ia"],
      "meta": {
        "sender": {
          "phone_number": "+12146772589",
          "name": "Juan Pérez",
          "id": 19,
          "email": "juan@example.com"
        }
      }
    }
  }
}
```

**Qué hace internamente:**
1. Busca lead por `whatsapp_phone_e164 / phone / phone_normalized` en Duke org.
2. Si existe → actualiza (sin pisar nombre/email si ya hay un valor mejor).
3. Si no existe → inserta con `asesor_name='iAgents'`, `source='whatsapp'`.
4. Mapea `labels[0]` → stage del pipeline (ver tabla abajo).
5. Si `label='requiere-humano'` → marca `hot=true, priority='urgente'` para
   que cualquier humano lo vea y pueda atender. **No cambia el stage**.
6. Si `private=true` y hay `content` → guarda en `expediente_items` como
   `tipo='nota_ia'` (la "Nota Privada" o el "Perfil Estratégico" Markdown).

**Respuesta:**
```json
{
  "ok": true,
  "lead_id": "uuid-del-lead",
  "existed": false,
  "stage": "Segundo Intento",
  "human_needed": false,
  "label_received": "perfilamiento-ia"
}
```

### 2. `fn_register_appointment` (Zoom agendado)

**Cuándo llamarla:** cuando n8n agenda una cita con Zoom API (tras el
discovery exitoso de Retell).

**Body:**
```json
{
  "payload": {
    "phone": "+12146772589",
    "zoom_meeting_id": "84512345678",
    "meet_link": "https://zoom.us/j/84512345678?pwd=...",
    "start_time": "2026-05-17T15:30:00-05:00",
    "end_time": "2026-05-17T16:30:00-05:00",
    "timezone": "America/Cancun",
    "advisor_name": "Alex Velázquez",
    "status": "scheduled"
  }
}
```

**Side-effects:** además de insertar en `appointments`, actualiza el lead a
`stage='Zoom Agendado'`, `next_action='Zoom con cliente'`, y agenda el
`next_action_at` con el horario de Zoom (para que aparezca en la agenda del
asesor humano).

### 3. `fn_register_voice_call` (log de llamada Retell)

**Cuándo llamarla:** en el webhook `call_ended` de Retell, después de
recibir el payload con transcript + recording_url.

**Body:**
```json
{
  "payload": {
    "phone": "+12146772589",
    "call_id": "retell-call-abc123",
    "direction": "outbound",
    "duration_seconds": 425,
    "call_summary": "Cliente interesado en Cancún, presupuesto 300K USD...",
    "transcript": "agent: Hola Juan... user: Hola, sí...",
    "recording_url": "https://retell-storage.../recording.wav",
    "disconnection_reason": "user_hangup"
  }
}
```

Idempotente vía `call_id` UNIQUE → si Retell reintenta, hace UPDATE en lugar
de insertar duplicado.

### 4. `fn_upsert_discovery` (perfilamiento extraído por IA)

**Cuándo llamarla:** en el webhook `post_call_analysis` de Retell, con el
JSON estructurado que extrajo la IA.

**Body:**
```json
{
  "payload": {
    "phone": "+12146772589",
    "data": {
      "zona": "Cancún",
      "objetivo": "Mixto — inversión + uso personal",
      "presupuesto": "300 mil USD",
      "enganche_30": "Sí cuenta con el 30%",
      "recamaras": "3 recámaras",
      "cita_pactada": "Hoy a las 3:30 PM",
      "duracion_segundos": 425
    }
  }
}
```

**Side-effects:** además del upsert en `discovery_data`, actualiza el lead
con `budget = data.presupuesto` y `bio = data.objetivo` (para que el asesor
humano vea contexto al primer vistazo).

Si llamás dos veces con el mismo phone, el JSON se hace **merge** (no
overwrite). O sea agrega claves nuevas y actualiza las existentes.

### 5. `fn_delete_lead_completely` (hard-delete por conversation_id)

**Cuándo llamarla:** cuando el operador escribe el comando "reiniciar" en
Chatwoot y querés borrar TODO el lead asociado a esa conversación.

**Body:**
```json
{
  "payload": {
    "conversation_id": 20
  }
}
```

**Qué hace internamente:**
1. Busca el lead por `chatwoot_conversation_id` dentro de la org Stratos/Duke.
2. Si no lo encuentra → devuelve `{ok: false, error: "lead not found..."}`.
3. Si lo encuentra → cuenta filas relacionadas, borra explícito en
   expediente_items / lead_events / lead_assignments / lead_tasks, y
   después DELETE del lead (cascadea a discovery_data, appointments,
   voice_call_logs).

**Respuesta:**
```json
{
  "ok": true,
  "lead_id": "uuid-borrado",
  "phone": "+57...",
  "conversation_id": 20,
  "deleted_counts": {
    "lead": 1,
    "expediente_items": 3,
    "voice_call_logs": 1,
    "appointments": 1,
    "discovery_data": 1,
    "lead_events": 0,
    "lead_assignments": 0,
    "lead_tasks": 0
  }
}
```

**Importante:** este es un HARD DELETE — el lead desaparece de la BD
real, no va a la papelera. La papelera del CRM (`deleted_at IS NOT NULL`)
no aplica acá. Usalo solo para resetear flujos de testing del bot, no
para descartar leads reales (para eso está `soft_delete` desde la UI).

## Mapeo de labels de Chatwoot → stages del CRM

La función `fn_upsert_lead_from_chatwoot` lee `conversation.labels[0]` y lo
mapea según esta tabla:

| Label Chatwoot | Stage CRM | Notas |
|---|---|---|
| `inbound`, `nuevo` | **Contáctame ya** | Default cuando no hay label |
| `perfilamiento-ia` | **Segundo Intento** | IA en pleno discovery |
| `meet-agendado`, `meet-pendiente`, `meet-confirmado` | **Zoom Agendado** | |
| `zoom-realizado`, `meet-realizado` | **Zoom Concretado** | |
| `visita-agendada` | **Visita Agendada** | |
| `visita-realizada` | **Visita Concretada** | |
| `negociacion` | **Negociación** | |
| `cierre`, `cerrado-ganado` | **Cierre** | |
| `no-show` | **No Show** | |
| `perdido`, `rotacion` | **Rotación** | |
| `remarketing` | **Remarketing** | |
| `postventa` | **Postventa** | |
| **`requiere-humano`** | (no cambia stage) | Marca `hot=true` + `priority=urgente` → handoff visible |
| (label desconocido o vacío) | (no cambia stage) | El lead queda en su stage actual |

> Si tu Chatwoot usa OTROS nombres de label, decímelos y los mapeo en otro PR.
> Por ahora, los labels desconocidos no rompen nada — simplemente no cambian
> el stage. El lead se inserta/actualiza con la info de teléfono/nombre/email
> de todos modos.

## Visibilidad del lead

- El lead se crea con `asesor_name = 'iAgents'` y `organization_id = Duke`.
- Como `iagents@stratos.ai` tiene `view_all_leads=false` (PR #117), solo ve
  los leads asignados a sí mismo → estos.
- Los OTROS admins de Duke (Ivan, Alex, Emmanuel, Oscar, Admin Stratos)
  tienen `view_all_leads=true` → también ven los leads de iAgents.
- Eso es deliberado: cuando un lead pasa a `requiere-humano`, cualquier
  admin/asesor con view-all puede tomarlo desde la UI.

## Test rápido con curl

```bash
SUPABASE_URL="https://glulgyhkrqpykxmujodb.supabase.co"
SERVICE_ROLE="<tu-service-role-key>"

curl -X POST "$SUPABASE_URL/rest/v1/rpc/fn_upsert_lead_from_chatwoot" \
  -H "apikey: $SERVICE_ROLE" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "private": false,
      "content": "Test desde curl",
      "id": 1,
      "conversation": {
        "id": 99,
        "inbox_id": 6,
        "labels": ["perfilamiento-ia"],
        "meta": {
          "sender": {
            "phone_number": "+5219991234567",
            "name": "Test Curl",
            "id": 999
          }
        }
      }
    }
  }'
```

Respuesta esperada: `{"ok":true,"lead_id":"...","existed":false,"stage":"Segundo Intento",...}`

Después logueate como `iagents@stratos.ai` en `app.stratoscapitalgroup.com`
y deberías ver "Test Curl" en la lista del CRM.

## Limitaciones conocidas (fase 1)

- Si el `name` del sender en Chatwoot es solo dígitos (ej. "89") y después
  la IA aprende el nombre real, **no se sobrescribe** automáticamente
  (asumimos que el nombre actual fue puesto por alguien intencionalmente).
  Workaround: el asesor humano lo edita manualmente, o nosotros agregamos
  un opcional `force_name=true` en otro sprint.
- Audio de la llamada Retell se guarda como URL en `voice_call_logs`,
  pero **el CRM todavía no lo reproduce** en la vista del lead — eso es
  Fase 4 (UI).
- `discovery_data` JSONB se merge-acumula, no hay historial de versiones.
  Si querés timeline, hablalo y agregamos snapshot por llamada.
