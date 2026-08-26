# Plan de desarrollo — Email marketing para el webinar de Duke del Caribe

**Webinar:** Mondrian Cancún · **jueves 27 de agosto de 2026**
9:00 PM Cancún y Riviera Maya · 8:00 PM Ciudad de México · 7:00 PM California
**Hoy:** martes 25 de agosto de 2026 · quedan **2 días**
**Remitente acordado:** `admin@dukedelcaribe.com`
**Base:** organización `Stratos Capital Group` (`00000000-0000-0000-0000-000000000001`) en `glulgyhkrqpykxmujodb`

---

## 1. Lo que hay hoy (medido, no estimado)

### La base de Duke

| Dato | Número |
|---|---|
| Leads vivos y contactables (sin borrar, sin `do_not_contact`, sin `opt_out`) | **1,855** |
| Con teléfono | 1,814 (98%) |
| **Con correo válido y único** | **279 (15%)** |
| Registros borrados (`deleted_at`) | 350 |
| Marcados `do_not_contact` | 5 |
| Marcados `opt_out` | 0 |

**Dónde viven esos 279 correos:** Gmail 163 · Yahoo 40 · Hotmail 32 · iCloud 19 · el resto disperso.
Es bandeja de consumidor pura. Ahí las reglas de Gmail y Yahoo para remitentes masivos deciden si llegas
a Principal, a Promociones o a Spam. También hay basura que limpiar: por ejemplo un `prontonmail.com`
(dedazo de `protonmail.com`) que va a rebotar duro y a manchar la reputación del dominio nuevo.

### Segmentos por etapa del pipeline

| Segmento | Etapas | Correos |
|---|---|---|
| **A · calientes** | Nuevo Registro, Zoom Concretado, Zoom Agendado, Apartó, Visita Agendada | **35** |
| **B · tibios** | Reactivar Zoom, Contáctame Ya, Seguimiento, Pensando el presupuesto, Sin contactar | **155** |
| **C · fríos** | Segundo/Tercer Intento, Rotación, Remarketing IA, Largo Plazo | **89** |

El campo `project` está vacío en el 92% de los registros, así que **no se puede segmentar por
proyecto** (Bay View Grand, Mondrian, Corasol). Segmentamos por etapa y por antigüedad, que sí
están poblados.

### Lo que NO hay

- **Cero infraestructura de correo.** No hay proveedor, no hay edge function, no hay un solo nodo de
  email en los workflows de n8n. Se construye desde cero.
- **Cero registro de clientes cerrados.** Las tablas `deals`, `appointments` y `tags` están **vacías**
  para Duke. El CRM guarda prospectos, no compradores. Si "todos los clientes" incluye a los dueños
  que ya compraron en estos 4 años, **esa lista no está en el sistema** y hay que importarla.
- **Cero DMARC.** Ni `dukedelcaribe.com` ni `stratoscapitalgroup.com` tienen registro `_dmarc`.
- **`campaigns.channel` no acepta `'email'`.** El CHECK constraint solo permite facebook, instagram,
  google, linkedin, tiktok, referral, event, organic, manual, telegram, whatsapp, web, other.

### Lo que sí juega a favor

- `comunicaciones.tipo` **ya acepta `'email'`** y `lead_events.type` **también**. El registro de cada
  envío en la línea de tiempo del lead sale gratis, sin migración.
- `dukedelcaribe.com` se registró el **6 de junio de 2023**. Dos años de antigüedad ayudan: no es un
  dominio recién nacido, que es el peor escenario de entregabilidad.
- El DNS está en **HostGator México** (`ns56.hostgator.mx`, `ns57.hostgator.mx`), registrador PDR.
  Se edita desde el cPanel → *Editor de Zona DNS*. Acceso directo, sin intermediarios.
- El correo corporativo de Duke corre en **Titan** (`spf.titan.email`). Se puede montar el envío
  masivo **sin tocar ese SPF**, ver sección 4.

---

## 2. La observación que hay que decir antes de empezar

**279 correos no son "todos los clientes de Duke del Caribe".** Son el 15% de la base del CRM.
Los otros 1,576 leads existen, tienen teléfono, y por correo son inalcanzables.

Esto no invalida el proyecto de email — lo pone en su lugar. La ruta correcta es:

- **Correo** = el canal para los 279. Se construye bien porque es infraestructura que sirve para
  siempre, no solo para este miércoles.
- **WhatsApp** = el canal que realmente mueve la aguja este miércoles: 1,814 teléfonos. Duke ya tiene
  la plomería (`whatsapp_outbox`, ruteo multi-cliente de la migración 032/033) y los tres números
  conectados.
- **Ana (agente de voz)** = para el segmento A, 35 personas. Una llamada que invita y confirma
  asistencia convierte más que cualquier correo.

El plan cubre los tres, con el correo como columna vertebral porque es lo que pediste y lo que
falta construir.

---

## 3. Qué necesito de ti para arrancar

### Bloqueantes reales (sin esto no avanzo)

| # | Qué | Por qué bloquea | Cuándo lo necesito |
|---|---|---|---|
| 1 | **Cuenta en Resend + API key** — la creas tú (yo no doy de alta cuentas ni capturo contraseñas). El key me lo pasas para guardarlo en secrets de Supabase, **nunca en el repo** (es público). | Sin proveedor no hay envío | Hoy |
| 2 | **Acceso al cPanel de HostGator** de `dukedelcaribe.com`, o alguien que capture 4 registros DNS que yo te paso ya redactados | El DNS es lo único que no puedo acelerar: propaga en horas | Hoy |
| 3 | **Datos del webinar**: título, hora exacta y zona horaria, duración, quién presenta, plataforma (¿Zoom?) | Sin esto no se escribe ni un correo | Hoy |
| 4 | **Confirmar el alcance de "todos los clientes"**: ¿solo los 279 del CRM, o también los dueños/compradores históricos? Si es lo segundo, necesito ese archivo (Excel/CSV con nombre y correo) | Cambia el tamaño de la campaña y el mensaje | Miércoles 26 |
| 5 | **Dirección física de Duke + aviso de privacidad** (URL) | Requisito legal en el pie de todo correo masivo. Sin esto no se puede enviar | Jueves 27 |
| 6 | **Quién contesta los replies** a `admin@dukedelcaribe.com` | La gente va a responder "sí quiero entrar". Si nadie lee ese buzón, se pierde el lead | Antes del primer envío |

### Deseables (mejoran el resultado, no lo detienen)

- Logo de Duke en PNG con fondo transparente, mínimo 600px de ancho.
- 10–15 buzones de prueba del equipo (que haya Gmail, Outlook, Yahoo y iCloud entre ellos).
- Si el webinar tiene oferta o promoción, los términos exactos.

### Lo que arranco hoy sin esperar nada

Migración de esquema, las tres edge functions, el script de validación de correos, las plantillas
HTML y la segmentación. Todo eso es código y no depende de ti.

---

## 4. DNS — lo primero, porque es lo que tarda

El acuerdo fue enviar desde `admin@dukedelcaribe.com`, o sea el dominio raíz. Hay una tensión ahí
que vale nombrar: la reputación del dominio raíz es la misma que usa el correo diario del equipo en
Titan. Si el masivo junta quejas de spam, salpica al correo corporativo.

**La mitigación es real y no cuesta nada:** Resend pone el *Return-Path* (a dónde rebotan los
correos) en un subdominio `send.dukedelcaribe.com`, y firma con un selector propio
(`resend._domainkey`). Resultado: **el SPF de Titan en la raíz no se toca ni un carácter**, y el
rebote sucio queda aislado en el subdominio. Lo único compartido es la reputación de marca del
dominio, que es exactamente lo que quieres cuando el remitente es `admin@`.

### Los 4 registros a capturar en HostGator

| Tipo | Nombre | Valor | Nota |
|---|---|---|---|
| MX | `send` | (lo genera Resend, tipo `feedback-smtp.*.amazonses.com`) | prioridad 10 · Return-Path |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | SPF del subdominio de envío |
| TXT | `resend._domainkey` | (llave pública que genera Resend) | DKIM |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@dukedelcaribe.com; fo=1` | **empieza en `p=none`** |

**Los valores exactos de MX y DKIM los genera Resend al agregar el dominio.** La forma es esta; los
strings te los paso en cuanto exista la cuenta.

**Por qué DMARC arranca en `p=none`:** hoy no existe ningún DMARC. Saltar directo a `p=quarantine`
puede mandar a cuarentena el correo legítimo de Titan si algo no está alineado. Se arranca en
`p=none` (solo observa y reporta), se leen los reportes una semana, y **después** del webinar se
sube a `p=quarantine`.

**Nota de cumplimiento:** Gmail y Yahoo exigen DMARC formalmente arriba de 5,000 correos diarios —
Duke está muy por debajo. Pero SPF, DKIM y la baja en un clic sí aplican a todo remitente masivo sin
importar el volumen, y son la diferencia entre Principal y Spam.

### Verificación

```bash
dig +short TXT resend._domainkey.dukedelcaribe.com @8.8.8.8
dig +short TXT _dmarc.dukedelcaribe.com @8.8.8.8
dig +short MX send.dukedelcaribe.com @8.8.8.8
```

Más una prueba en **mail-tester.com** (meta: 9/10 o más) y dar de alta el dominio en **Google
Postmaster Tools** para ver la reputación real ante Gmail, que es donde está el 58% de la lista.

---

## 5. Arquitectura — la vía adecuada

### Decisión: Resend + Supabase Edge Functions + tablas propias

El correo **no se va a un silo externo**. La lista vive en Supabase donde ya está, se envía por API,
y cada evento (entregado, abierto, clic, rebote, queja) regresa al CRM y aparece en la línea de
tiempo del lead. El asesor entra al lead y ve *"abrió la invitación del webinar dos veces, no se
registró"*. Eso es lo que un Mailchimp nunca te va a dar.

**Por qué Resend y no otro:**

- API primero, encaja con Supabase Edge Functions sin pegamento.
- Webhooks de eventos firmados, que es lo que alimenta el CRM de vuelta.
- No hay que exportar los datos personales de los leads a una plataforma externa — importa por el
  aislamiento multi-tenant y por la LFPDPPP.
- Costo: el plan gratis topa en 100 correos al día, y 279 destinatarios × 4 correos ≈ 1,100 envíos.
  No alcanza. El plan de entrada anda en ~20 USD al mes y sobra. **Verifica el precio vigente al
  contratar.**

**Descartados:** Mailchimp y Brevo tienen mejor editor visual, pero la lista se les queda adentro,
el rebote no regresa al CRM, y ninguno resuelve el problema real de Duke, que es que el 85% de la
base no tiene correo.

### Componentes

```
supabase/migrations/034_email_marketing.sql   ← esquema + RLS
supabase/functions/email-dispatch/            ← arma el lote y envía
supabase/functions/email-webhook/             ← recibe eventos de Resend
supabase/functions/email-unsubscribe/         ← baja en un clic (RFC 8058)
scripts/email_validate.mjs                    ← limpia la lista antes de enviar
scripts/email_send_campaign.mjs               ← dispara la campaña por CLI
src/emails/                                   ← plantillas HTML
src/app/views/EmailCampanas.jsx               ← FASE 2, después del webinar
```

### Esquema (migración 034)

```sql
-- 1. Habilitar 'email' como canal de campaña
ALTER TABLE public.campaigns DROP CONSTRAINT campaigns_channel_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_channel_check
  CHECK (channel IS NULL OR channel = ANY (ARRAY[
    'facebook','instagram','google','linkedin','tiktok','referral','event',
    'organic','manual','telegram','whatsapp','web','email','other']));

-- 2. email_campaigns   → una fila por correo de la secuencia
-- 3. email_recipients  → una fila por destinatario, con message_id del proveedor,
--                        sent_at / delivered_at / opened_at / clicked_at /
--                        bounced_at / complained_at, y unsub_token único
-- 4. email_suppressions → org_id + email + motivo (rebote_duro | queja |
--                         baja | manual). LA TABLA MÁS IMPORTANTE DE TODAS.
```

**`email_suppressions` es la pieza que la gente olvida y la que decide si en seis meses sigues
llegando a la bandeja.** Un correo que rebotó duro o que se quejó **jamás** se vuelve a contactar.
El motor consulta esta tabla antes de cada envío, sin excepción.

**RLS:** todas las tablas nuevas con RLS activo y filtrado por `organization_id`.
`REVOKE ALL ... FROM anon, authenticated` en cada una — en Supabase `revoke from public` no basta,
toda tabla y RPC nace ejecutable por la llave anon pública. La única superficie anónima es el
endpoint de baja, y está acotado por token de un solo uso.

### Idempotencia

`email_recipients` lleva índice único `(campaign_id, email)`. Si el script se corre dos veces por
error, **nadie recibe el correo duplicado**. Con una base de 279 personas que ya conocen a Duke, un
correo repetido es una queja de spam casi asegurada.

### Cabeceras obligatorias en cada envío

```
List-Unsubscribe: <https://…/email-unsubscribe?t=TOKEN>, <mailto:baja@dukedelcaribe.com>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

Esto pinta el botón "Cancelar suscripción" nativo de Gmail. Suena contraintuitivo ponerlo fácil,
pero es al revés: **si no encuentran el botón, marcan spam**, y eso pesa cien veces más.

---

## 6. Registro: formulario de Google

El cliente ya tiene el registro montado en un formulario de Google, y el flyer
que está circulando apunta ahí. No se toca: cambiarlo a dos días del webinar
rompería las piezas que ya salieron.

Lo que hay que saber de esa decisión:

| | |
|---|---|
| **A favor** | Ya existe, ya está en el flyer, y `docs.google.com` es un dominio con buena reputación en los filtros |
| **En contra** | No manda recordatorios, no da enlace de acceso único por persona, y las respuestas no llegan al CRM |

**Consecuencias operativas, las tres importan:**

1. El correo de *"es hoy"* lo tenemos que mandar nosotros, con el enlace de Zoom.
   El formulario no lo va a hacer.
2. Para saber a quién mandárselo hay que **exportar las respuestas del formulario**
   el jueves temprano y sembrar la campaña con esos correos.
3. Quien se registre y no exista como lead en el CRM queda fuera de nuestro
   circuito. Vale la pena darlos de alta el viernes: son los más calientes de todos.

Se limpió el enlace: venía con `?usp=sharing&ouid=1061318…`, que identifica la
cuenta de Google que lo compartió. No aporta nada y viajaba en cada correo.

## 7. Calendario, comprimido a dos días

### Hoy martes 25 — toda la infraestructura
- [ ] **Tú:** cuenta en Resend, dominio agregado, los 3 registros que genera
- [ ] **Tú:** capturar esos 3 + el DMARC en HostGator (cPanel → Editor de Zona DNS)
- [ ] **Tú:** correr la migración 034 en el editor SQL
- [ ] **Tú:** presentador, enlace de Zoom, dirección postal, aviso de privacidad
- [ ] **Yo:** secrets, webhook, validar la lista, prueba semilla

### Miércoles 26 — invitación en tres tandas
- [ ] 10:00 CDMX — 100 · revisar reporte
- [ ] 14:00 CDMX — 100 · revisar reporte
- [ ] 18:00 CDMX — el resto
- [ ] Ese día también: los 1,814 de WhatsApp

### Jueves 27
- [ ] Mañana: reenvío a quien no abrió, con otro asunto
- [ ] Exportar las respuestas del formulario
- [ ] 16:00 California (T-3h): *"es hoy"* a registrados, con el enlace de Zoom

### Viernes 28 — donde está el dinero
- [ ] Asistió: agendar media hora y ver números
- [ ] No asistió: la grabación. Suele rendir más que toda la invitación

### El riesgo, dicho claro

No hay calentamiento posible en dos días. Se compensa con tres cosas: la lista se
valida por MX antes de mandar, el envío se parte en tandas con freno automático
entre cada una, y el dominio tiene dos años de antigüedad, que ayuda aunque la
firma DKIM sea nueva.

Si el DNS no propaga hoy, el correo se pospone y WhatsApp carga el webinar. No
vale la pena quemar el dominio de Duke por alcanzar una fecha.

## 8. Los 5 correos

| # | Cuándo | Asunto | Botón | Armazón |
|---|---|---|---|---|
| 1 | Mié 26, tres tandas | *{{nombre}}, el único en preventa en la Zona Hotelera* / *Mondrian Cancún: preventa para inversionistas* | Registrarme al webinar | diseñado |
| 2 | Jue 27 a.m. | *Es hoy: Mondrian Cancún en vivo* / *{{nombre}}, ¿alcanzas hoy en la noche?* — solo a quien no abrió el 1 | Apartar mi lugar | diseñado |
| 3 | Jue 27, 16:00 CA | *Es hoy — aquí está tu acceso* — solo registrados | Entrar al webinar | diseñado |
| 4a | Vie 28 | *Gracias por quedarte, {{nombre}}* / *Lo que queda de Mondrian* | Agenda tu media hora | plano |
| 4b | Vie 28 | *Te dejo la grabación* / *{{nombre}}, anoche no te vi* | Ver la grabación | plano |

Cada uno con dos asuntos: el motor reparte mitad y mitad y `reporte` dice cuál
ganó, para decidir el siguiente con datos y no con corazonada.

**Una sola acción por correo, con botón.** El objetivo es registro medible, así
que no hay llamadas ambiguas ni caminos alternos. El detalle de cada táctica y
por qué está así: **`ops/TECNICAS-EMAIL-DUKE.md`**.

**Reglas de redacción:**

- **Remitente:** `<presentador> · Duke del Caribe <admin@dukedelcaribe.com>`.
  Nombre de persona real: con `admin@` sola se lee institucional y frío.
- **Reply-To** al mismo buzón. Aunque la acción sea el botón, la gente va a
  responder, y esas respuestas son leads calientes.
- Español mexicano neutro, tú/puedes. Nunca voseo.
- Sin emojis. El texto original traía `👉`; en redes funciona, en un correo
  masivo pesa en contra de la entrega.
- Los tres horarios en el cuerpo, como en el flyer: la lista abarca tres husos.
- **Probado en modo oscuro y en celular.** Más de la mitad de la lista es iPhone
  y Gmail móvil.

## 9. Cumplimiento legal

- **México (LFPDPPP):** aviso de privacidad enlazado en el pie, mecanismo de derechos ARCO, y baja
  visible. Los leads dieron su correo pidiendo información inmobiliaria; invitarlos a un webinar de
  Duke es finalidad compatible. Está bien fundado.
- **Estados Unidos (CAN-SPAM):** Duke vende a compradores en USA (existe la campaña `WEBINAR MONDRIAN
  USA`). Aplica: **dirección postal física obligatoria en el pie**, asunto que no engañe, y baja
  honrada en máximo 10 días hábiles. Nuestro motor la honra en el acto.
- **Ningún correo comprado, raspado ni "enriquecido".** Solo la base propia de Duke.

---

## 10. Números de éxito y cuándo abortar

| Métrica | Meta | Alarma |
|---|---|---|
| Entregabilidad | > 97% | < 95% → parar y revisar autenticación |
| Rebote duro | < 2% | **> 5% → detener la campaña y limpiar la lista** |
| Quejas de spam | < 0.1% | **> 0.3% → detener todo** |
| Apertura (correo 1) | 35–45% (base propia y tibia) | < 20% → problema de entregabilidad, no de asunto |
| Clic al registro | 8–15% | |
| **Registrados por correo** | **45–70** de 279 | |
| **Asistentes** | **20–35** (40–50% de los registrados es lo normal) | |

Menos que con una semana de anticipación: dos días recortan el registro. El
número grande del webinar va a venir de WhatsApp, no del correo.

Los dos umbrales en negritas se vigilan **entre tanda y tanda** el miércoles. Si se cruzan, se para.
Quemar el dominio de Duke por apurar un envío no vale ningún webinar.

---

## 11. Lo que queda construido después del miércoles

Esto es lo que separa "mandar un correo" de "montar email marketing":

1. **Motor multi-cliente.** Filtrado por `organization_id` desde el diseño. Grupo 28, TGenius, Vega y
   Clínica Dental heredan la misma capacidad sin escribir código nuevo — solo verifican su dominio.
2. **Vista de campañas en el CRM** (`src/app/views/EmailCampanas.jsx`): crear, previsualizar, enviar
   de prueba, programar y ver resultados. Fase 2, la semana del 8 de septiembre.
3. **El correo alimenta al CRM.** Cada apertura y cada clic aterriza en `comunicaciones` y
   `lead_events`. El copiloto puede decirle al asesor *"este lead abrió el correo tres veces y no se
   registró — márcale"*.
4. **Higiene permanente.** `email_suppressions` crece sola y protege la reputación para siempre.
5. **Y lo más rentable de todo: el correo faltante.** El hallazgo real de este ejercicio es que
   1,576 leads de Duke no tienen correo. Agregar el campo al flujo de captura de WhatsApp y a Ana
   multiplica esta lista en semanas. **El siguiente proyecto no es mandar más correos: es tener a
   quién mandárselos.**

---

*Documento generado el 25 de agosto de 2026. Números medidos directo de producción
(`glulgyhkrqpykxmujodb`) y del DNS público ese día.*
