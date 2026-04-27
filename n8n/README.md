# 🤖 Stratos AI — Bot de Telegram v2

**Workflow:** `workflows/stratos-telegram-bot-v2.json`
**Stack:** n8n + Telegram + Claude Sonnet 4.5 + Supabase
**Líneas de código:** 0 (todo es un JSON)

---

## ¿Qué hace?

Un bot conversacional inteligente que:
- ✅ Recibe mensajes de texto, **voz** y fotos en Telegram
- ✅ Transcribe audios automáticamente (Whisper, en español)
- ✅ Conversa de forma natural (no formularios) con Claude Sonnet 4.5
- ✅ Extrae nombre, teléfono, email, presupuesto, proyecto, urgencia
- ✅ Califica el lead con score 0-100 según reglas
- ✅ Crea o actualiza el lead en el CRM Stratos (Supabase)
- ✅ Mantiene memoria de la conversación (últimos 10 mensajes)
- ✅ Notifica al asesor en su Telegram cuando es lead caliente
- ✅ Audit log automático (vía triggers de Supabase)

**Costo estimado:** ~$0.05–$0.15 por conversación completa (Claude + Whisper).

---

## Setup en 6 pasos (15 min)

### Paso 1 — Crear cuenta nueva de n8n con correo Synergy

**Opción A (recomendado): n8n.cloud** — gratis 14 días + plan starter $20/mes
- Ir a https://app.n8n.cloud/register
- Email: `synergyfornature@gmail.com`
- Crear espacio de trabajo "Stratos AI"

**Opción B: self-hosted en tu Easypanel** — gratis pero tú administras
- Crear nueva instancia de n8n en tu Easypanel con email synergy
- Más control, más mantenimiento

### Paso 2 — Aplicar la migración SQL en Supabase

En **Supabase → SQL Editor → New query**, corre el contenido de:
`supabase/migrations/006_telegram_bot_support.sql`

Esto agrega:
- Columna `telegram_user_id` en `leads`
- Función RPC `append_lead_note` que el bot usa para agregar notas timestamped
- Índice para lookup rápido por telegram user

Verificación:
```sql
SELECT count(*) FROM information_schema.columns
WHERE table_name = 'leads' AND column_name = 'telegram_user_id';
-- debe devolver 1
```

### Paso 3 — Crear el bot en Telegram

1. Abre Telegram → busca **@BotFather**
2. Envía `/newbot`
3. Nombre: `Stratos CRM Bot` (o el que quieras)
4. Username: `stratos_crm_bot` (o disponible)
5. Copia el **token** que te da (formato `123456789:ABCdef...`)

### Paso 4 — Configurar credenciales en n8n

En n8n → **Credentials** → **+ Add credential**, crea las 3 siguientes:

#### a) Stratos Bot Token (Telegram)
- Tipo: **Telegram API**
- Access Token: el token de BotFather

#### b) Anthropic Stratos
- Tipo: **Anthropic API**
- API Key: obtenla en https://console.anthropic.com/settings/keys
- Modelo recomendado: `claude-sonnet-4-5` (el último, mejor balance precio/calidad)

#### c) OpenAI Stratos (solo si quieres voz)
- Tipo: **OpenAI API**
- API Key: obtenla en https://platform.openai.com/api-keys
- Solo se usa para Whisper (transcripción de audios)

### Paso 5 — Configurar variables de entorno en n8n

En n8n → **Settings → Environment** (o variables de entorno del contenedor):

```
SUPABASE_URL=https://glulgyhkrqpykxmujodb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← la service_role, NO la anon
TELEGRAM_BOT_TOKEN=123456789:ABC... ← el de BotFather
```

> ⚠️ **Importante:** estas variables son secretas. NUNCA las expongas en el frontend, nunca las pongas en GitHub. n8n es un servidor backend, ahí están seguras.

### Paso 6 — Importar el workflow

1. En n8n → **Workflows → Import from File**
2. Selecciona `n8n/workflows/stratos-telegram-bot-v2.json`
3. Asigna las credenciales que creaste en el Paso 4 a cada nodo (n8n te pregunta)
4. Click **Activate** (toggle arriba a la derecha)
5. ¡Manda un mensaje a tu bot en Telegram para probarlo!

---

## Arquitectura del workflow

```
Telegram Trigger
      ↓
Switch by message type
   /  |  \
voice text photo
  ↓    ↓    ↓
Whisper  Normalize context
  ↓       ↓
Normalize  ↓
   ↓       ↓
   └──→ Lookup existing lead (Supabase)
              ↓
        AI Agent (Claude Sonnet 4.5)
        ├── Memory (10 mensajes)
        ├── Tool: create_lead
        ├── Tool: update_lead
        ├── Tool: add_note_to_lead
        └── Tool: notify_asesor
              ↓
        Reply to user (Telegram)
```

**El AI Agent decide solo** qué herramientas llamar según la conversación. No tienes que mantener un árbol de decisiones rígido.

---

## Cómo lo usa el cliente

```
Cliente: Hola, me interesa Tulum
   ↓
Bot:    [internamente: lookup_lead → no existe]
        [internamente: create_lead con stage='Primer Contacto', score=15]
        ¡Hola! 👋 Bienvenido a Stratos. Me da gusto que te interese Tulum.
        ¿Me compartes tu nombre y un buen número para llamarte?

Cliente: Soy Marco. Mi tel es 555-123-4567. Tengo unos 500K USD.
   ↓
Bot:    [update_lead con score=55, name=Marco, phone=..., budget=500000]
        Perfecto Marco. Con 500K USD hay opciones excelentes en Tulum.
        ¿Buscas para vivir, rentar o como inversión?

Cliente: Inversión. Quiero ver algo en las próximas 2 semanas.
   ↓
Bot:    [update_lead con score=85, hot=true, urgency='2 weeks']
        [notify_asesor con resumen]
        🔥 [Asesor recibe alerta en su Telegram]
        Excelente Marco, te conecto con un asesor que ya vio tu interés.
        Te llama hoy mismo en las próximas 2 horas. ¿Está bien?
```

---

## Ajustes recomendados después del lanzamiento

### Cambiar el system prompt
En n8n → AI Agent node → **Options → System Message**.
Personalízalo con:
- Tus proyectos actuales (zonas, precios)
- Tu tono de marca
- Reglas de scoring específicas para tu negocio
- Ejemplos de conversaciones exitosas (few-shot)

### Cambiar el modelo de IA
- **Claude Sonnet 4.5** (default) — mejor calidad, ~$3/1M tokens input
- **Claude Haiku 4.5** — 5× más barato, casi igual de bueno para chat
- **GPT-4o-mini** — barato, no tan natural en español

### Configurar el chat del asesor
El bot necesita saber a qué chat de Telegram mandar las alertas. Opciones:
1. Hardcodear el chat_id en el system prompt (más simple)
2. Crear tabla `asesor_telegram_chats` en Supabase y rotear por proyecto
3. Tener un grupo de Telegram con todos los asesores y postear ahí

### Activar voz (Whisper)
Está en el JSON pero requiere credencial OpenAI. Si no la configuras, el switch redirecciona los voice notes al path normal (sin transcribir).

### Activar fotos
Por default las fotos se ignoran. Si quieres que el bot las analice (ej: cliente manda foto de su INE), agrega un nodo de Vision (Claude Vision o GPT-4 Vision) entre el switch y el normalize.

---

## Capacidad y costos

| Métrica | Valor |
|---|---|
| Mensajes/día soportados | hasta ~10,000 (n8n cloud starter) |
| Concurrencia | 50+ conversaciones simultáneas |
| Latencia respuesta | 2-4 segundos (Claude) |
| Costo Claude | ~$0.05 por conversación de 5 turnos |
| Costo Whisper | ~$0.006 por minuto de audio |
| Costo n8n.cloud | $20/mes (incluye 5K ejecuciones) |
| **Total mensual estimado** | **$30-50** para 1000 conversaciones |

---

## Mejoras futuras (Fase 2-3)

| Mejora | Esfuerzo | Impacto |
|---|---|---|
| Botones inline (📅 Agendar, 📞 Llamar, ❌ No interesado) | Bajo | Alto |
| Recordatorios automáticos al asesor (cron daily) | Medio | Alto |
| Dashboard del bot en la app Stratos | Medio | Medio |
| Soporte multi-tenant (un bot por organización) | Medio | Alto |
| Embedding-based semantic search ("¿hay propiedades como X?") | Alto | Medio |
| Analítica de conversaciones (qué funciona, qué no) | Medio | Alto |
| WhatsApp Business como segundo canal | Alto | Alto |
| Voz outbound (que el bot llame al cliente) | Muy alto | Alto |

---

## Troubleshooting

### "Bot no responde"
- Verifica que el workflow esté **Activated** (toggle arriba a la derecha)
- Revisa **Executions** en n8n para ver si hay errores
- Confirma que el token de Telegram esté bien

### "Error: schema cache"
- Corre la migración 006 en Supabase
- En SQL Editor: `NOTIFY pgrst, 'reload schema';`

### "El bot olvida lo que platicamos antes"
- La memoria está atada al `telegram_user_id`. Si esto se rompió, revisa el nodo "Conversation Memory"
- Puede que el contextWindowLength (10) no sea suficiente — súbelo a 20

### "Lead duplicado"
- Verifica que el `lookup-lead` esté funcionando — debe encontrar leads previos por `telegram_user_id`
- Revisa el system prompt: debe decirle al agente que **NO cree** lead si ya existe uno

---

## Cómo iterar rápido

n8n tiene un modo **Test workflow** que ejecuta el flujo paso a paso. Click en cualquier nodo → **"Execute Node"** para probarlo aisladamente.

Para iterar en el system prompt sin desplegar a producción:
1. Duplica el workflow → "Stratos Bot v2 — DEV"
2. Conecta a un bot de Telegram diferente (otro `/newbot`)
3. Itera ahí, cuando funcione bien copias el system prompt al de producción
