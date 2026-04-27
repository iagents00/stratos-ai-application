# 🤖 Fase 2 — Agente de Soporte Stratos

**Estado:** Diseño · pendiente de aprobación para implementar
**Tiempo estimado de build:** 5–8 días de desarrollo
**Dependencia:** Fase 1 (CRM productivo) en uso por al menos 1 semana

---

## Por qué este agente

Después de 1 semana del lanzamiento del CRM tendremos:
- Asesores con dudas operativas ("¿cómo cambio el asesor de un lead?")
- Bugs reales detectados en uso ("la próxima acción no se registró")
- Solicitudes de features ("quisiera filtrar por campaña + score>80")

Sin un canal claro, todo eso cae en chats dispersos. **El agente de soporte centraliza, responde 24/7 lo simple, y escala lo complejo.**

---

## Lo que NO es

- ❌ No es un chatbot que vende.
- ❌ No reemplaza al super_admin para decisiones críticas.
- ❌ No tiene acceso a datos sensibles del cliente.

## Lo que SÍ es

- ✅ Un asistente conversacional dentro de la app.
- ✅ Conoce el manual completo del CRM (este `CRM_TUTORIAL.md` + docs internos).
- ✅ Puede leer (no escribir) la base de datos para responder preguntas como "¿cuántos leads en negociación tengo?".
- ✅ Si no sabe, abre un ticket automáticamente al super_admin.
- ✅ Aprende de cada interacción (logs en `audit_log` con `entity_type='support'`).

---

## Arquitectura propuesta

```
┌──────────────────────────────────────────────────┐
│  Front: Drawer flotante en esquina (icono Atom)  │
│         Botón "Pregúntale a Stratos"             │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  Edge Function Supabase │
        │  /support-agent          │
        │  (Deno + TypeScript)    │
        └────────────┬────────────┘
                     │
                     ├─────► Claude API (Anthropic SDK)
                     │       con system prompt:
                     │       - manual del CRM
                     │       - schema de la DB
                     │       - políticas y reglas
                     │
                     ├─────► Tools / función calls:
                     │       • read_leads(filter)   — solo del usuario
                     │       • read_audit_log(entity_id)
                     │       • create_support_ticket(question)
                     │       • get_user_role()
                     │
                     └─────► Logging en `audit_log`
```

---

## Stack tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Modelo | Claude Sonnet 4.5 | Mejor balance precio/calidad para Q&A operativo |
| Backend | Supabase Edge Functions (Deno) | Mismo proveedor, sin servidor extra |
| Frontend | React drawer (similar al `HistoryDrawer` ya construido) | Reutiliza design system |
| Storage | Tabla `support_conversations` (Supabase) | Histórico de conversaciones |
| Tickets | Tabla `support_tickets` con notif. al super_admin | Cuando el agente no resuelve |

---

## Capacidades por rol

| Rol | Qué puede preguntar al agente |
|---|---|
| **Asesor** | Tutoriales + sus propios datos ("¿cuántos leads tengo en seguimiento?") |
| **Director** | Lo de asesor + datos de su equipo |
| **CEO/Admin** | Todo + reportes globales + aplicar cambios sugeridos |
| **Super_admin** | Todo + gestión del agente (ajustar prompt, ver tickets, ver costos) |

---

## Prompts ejemplo (lo que el equipo va a preguntar)

**Operativos (90% de las preguntas):**
- "¿Cómo cambio el asesor de un lead?"
- "¿Por qué no veo los leads de Juan?"
- "¿Cuáles son las etapas del pipeline?"
- "Mi cliente Sarah Williams cambió de teléfono, ¿cómo lo actualizo?"

**Reportes simples (consulta DB):**
- "¿Cuántos leads tengo en negociación?"
- "¿Cuál es mi tasa de conversión este mes?"
- "Lista los leads que llevan más de 10 días sin actividad."

**Diagnóstico:**
- "Marqué la próxima acción como hecha pero sigue saliendo en mi dashboard."
- "Me dice 'No se encontró tu perfil' al entrar."

**Escalación automática (abre ticket):**
- "Necesito que se cree un nuevo proyecto inmobiliario."
- "Olvidé mi contraseña y no me llegó el email."
- "Quiero exportar todo mi pipeline a Excel."

---

## Métricas de éxito

A los 30 días del agente en producción:

| Métrica | Meta |
|---|---|
| % preguntas resueltas sin ticket humano | ≥ 70% |
| Tiempo medio de respuesta | < 4s |
| Satisfacción reportada (👍/👎 por respuesta) | ≥ 4.2/5 |
| Costo mensual de API | < $80 USD para 10 usuarios activos |
| Reducción de mensajes directos al super_admin | ≥ 50% |

---

## Schema mínimo (Fase 2 — migración 004)

```sql
-- ── Conversaciones ──
CREATE TABLE public.support_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at      timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now(),
  message_count   integer DEFAULT 0
);

CREATE TABLE public.support_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  role            text CHECK (role IN ('user','assistant','system')),
  content         text NOT NULL,
  tools_used      jsonb,        -- qué tools llamó el agente
  rating          smallint,     -- thumbs up/down
  created_at      timestamptz DEFAULT now()
);

-- ── Tickets escalados ──
CREATE TABLE public.support_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id),
  conversation_id uuid REFERENCES public.support_conversations(id),
  question        text NOT NULL,
  status          text DEFAULT 'open' CHECK (status IN ('open','assigned','resolved','closed')),
  assigned_to     uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  resolved_at     timestamptz
);
```

Plus las RLS correspondientes (cada usuario solo ve sus propias conversaciones; super_admin ve todo).

---

## Roadmap de implementación

| Día | Entregable |
|---|---|
| 1 | Migración 004 + Edge Function esqueleto |
| 2 | Integración con Claude API + system prompt v1 |
| 3 | Tools: `read_leads`, `read_audit_log` con respeto de RLS |
| 4 | Frontend: drawer estilo `HistoryDrawer` con stream de respuesta |
| 5 | Tools: `create_support_ticket` + notif. al super_admin |
| 6 | Logging en `audit_log` + dashboard de costos |
| 7 | QA con preguntas reales del equipo |
| 8 | Deploy + onboarding del equipo |

---

## Criterios para activar la Fase 2

Pasamos a Fase 2 **cuando**:

- ✅ Fase 1 ha estado en producción al menos **7 días**.
- ✅ Al menos **5 asesores activos** lo usan diario.
- ✅ Hemos recolectado **20+ preguntas reales** del equipo (input para entrenar el system prompt).
- ✅ Las migraciones 001-003 están confirmadas como estables.

---

## Costos estimados

| Concepto | Mensual |
|---|---|
| Claude API (~10 usuarios × 50 mensajes/día) | $40-60 |
| Supabase Edge Functions | Incluido en plan Pro |
| Storage (logs + conversaciones) | < $5 |
| **Total estimado** | **~$50-70 USD/mes** |

---

## Decisión

✋ **Antes de implementar Fase 2, validar con el equipo después de la primera semana de uso real.**

Si la operación funciona suave sin agente, podemos posponer. Si vemos que el super_admin se satura de mensajes operativos, activamos.
