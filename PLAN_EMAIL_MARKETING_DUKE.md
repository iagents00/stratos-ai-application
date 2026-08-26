# Plan de desarrollo — Email marketing para el webinar de Duke del Caribe

**Webinar:** miércoles 2 de septiembre de 2026
**Hoy:** martes 25 de agosto de 2026 · quedan **8 días**
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

## 6. Registro al webinar — no lo construyas

Recomiendo **usar el registro nativo de Zoom** en lugar de armar una landing propia. Razones:

- Zoom genera un link de acceso único por persona, manda sus propios recordatorios y te da el
  reporte de asistencia real (quién entró, cuánto duró). Replicar eso son días de trabajo.
- El link de registro va como botón en el correo; el UTM se conserva.
- Los registrados regresan al CRM por webhook de Zoom → n8n → `leads` + `lead_events`, marcando
  `campaign = 'Webinar 2-sep'`. Si el registrado no existe como lead, se crea.

**Decisión pendiente tuya:** Zoom Meetings con registro (viene en los planes de pago) alcanza para
esto. Zoom Webinars es un complemento aparte que cuesta más y solo se justifica si esperas más de
100 asistentes o quieres que el público no se vea entre sí. Con 279 invitados, Meetings basta.

Si prefieres landing propia (para capturar campos extra), es medio día más de trabajo y te la hago
en el repo bajo `/webinar`. Dime.

---

## 7. Calendario día por día

### Martes 26 (hoy) — desbloquear
- [ ] **Tú:** crear cuenta en Resend, agregar `dukedelcaribe.com`, pasarme los 4 registros DNS
- [ ] **Tú:** capturar los registros en HostGator (o darme acceso)
- [ ] **Tú:** definir título, hora y presentador del webinar
- [ ] **Yo:** migración 034 + las tres edge functions

### Miércoles 27 — infraestructura de pie
- [ ] Verificar propagación DNS (`dig`) y validación del dominio en Resend
- [ ] Desplegar edge functions, probar webhook de punta a punta
- [ ] Correr `email_validate.mjs`: regex, chequeo de MX real, corrección de dedazos tipo
      `prontonmail.com`. Esperado: se caen entre 5 y 15 de los 279
- [ ] **Tú:** confirmar si entra la lista de compradores históricos
- [ ] Crear el evento en Zoom con registro activado

### Jueves 28 — contenido y primera prueba
- [ ] Plantillas HTML de los 4 correos (peso máximo 100 KB, tabla + estilos en línea, sin JS,
      probadas en modo oscuro)
- [ ] Envío semilla a 10–15 buzones internos + mail-tester
- [ ] Copy revisado y aprobado por ti
- [ ] **Tú:** dirección física + URL del aviso de privacidad

### Viernes 29 — CORREO 1 (invitación), en tandas de calentamiento
- [ ] 10:00 — Segmento A (35) + primeros 65 de B = **100 envíos**
- [ ] 16:00 — resto de B = **90 envíos**
- [ ] Revisar tasa de rebote antes de cada tanda

### Sábado 30
- [ ] 11:00 — Segmento C = **89 envíos**. Correo 1 completo
- [ ] WhatsApp: enviar la plantilla de invitación a los 1,814 teléfonos, en tandas

### Domingo 31 — CORREO 2 (contenido de valor + agenda)
- [ ] A los 279, ya con el dominio caliente
- [ ] Ana empieza a llamar al segmento A para confirmar asistencia

### Lunes 1 de septiembre — CORREO 3 (último llamado)
- [ ] Asunto distinto para quien no abrió el correo 1
- [ ] Reporte de registrados vs. invitados

### Martes 2 de septiembre — día del webinar
- [ ] **T-3h:** CORREO 4 "es hoy" solo a registrados, con el link de acceso
- [ ] **T-1h:** recordatorio por WhatsApp a registrados
- [ ] **T-15min:** prueba de audio, video y pantalla compartida

### Miércoles 3 en adelante — el seguimiento, que es donde está el dinero
- [ ] CORREO 5, dos versiones: **asistió** (gracias + siguiente paso) y **no asistió**
      (grabación + segunda oportunidad)
- [ ] Los que asistieron entran al CRM con etapa e interés actualizados, repartidos a asesores
- [ ] Reporte de resultados

---

## 8. Los 7 correos

| # | Cuándo | Asunto | Pide | Armazón |
|---|---|---|---|---|
| 1 | Vie 29 | *{{nombre}}, te invito al miércoles* / *¿Te aparto un lugar para el miércoles?* | **respuesta** | plano |
| 1-bis | Dom 31 a.m. | *¿Lo viste, {{nombre}}?* — solo a quien no abrió el 1 | respuesta | plano |
| 2 | Dom 31 p.m. | *Lo que vamos a ver el miércoles (y lo que no)* | clic | diseñado |
| 3 | Lun 1 | *{{nombre}}, ¿te apunto?* / *Hoy cierro el registro* | **respuesta** | plano |
| 4 | Mié 2, T-3h | *Es hoy — aquí está tu acceso* | clic | diseñado |
| 5a | Jue 3 | *Gracias por quedarte, {{nombre}}* | **respuesta** | plano |
| 5b | Jue 3 | *Te dejo la grabación* / *{{nombre}}, ayer no te vi* | **respuesta** | plano |

Cada uno con dos asuntos: el motor reparte mitad y mitad y `reporte` te dice cuál
ganó, para el siguiente correo ya decidir con datos.

**Cuatro de los siete piden respuesta, no clic.** Es la decisión de fondo de toda
la secuencia: contestar convierte más que registrarse, y cada respuesta le enseña
a Gmail que este remitente se quiere — lo cual mejora la entrega de todos los
demás correos, incluidos los de quien no contestó.

El detalle de cada táctica y por qué está así: **`ops/TECNICAS-EMAIL-QUE-CONTESTAN.md`**.

**Reglas de redacción**, alineadas al tono del bot y de la marca:

- **Remitente:** `Óscar Gálvez · Duke del Caribe <admin@dukedelcaribe.com>`. Nombre
  de persona real. Con `admin@` sola, el correo se lee institucional y frío.
- **Reply-To** al buzón que alguien lea de verdad — sin eso, la mitad de la
  estrategia no sirve.
- Español mexicano neutro, tú/puedes. Nunca voseo.
- Sin emojis. Iconos tipográficos si hace falta.
- Pocas palabras. Una sola acción por correo.
- Nada de "¡ÚLTIMA OPORTUNIDAD!", mayúsculas sostenidas ni signos repetidos.
- **Se prueba en modo oscuro y en celular antes de enviar.** Más de la mitad de la
  lista es iPhone y Gmail móvil.

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
| **Registrados** | **60–85** de 279 | |
| **Asistentes** | **25–40** (40–50% de los registrados es lo normal) | |

Los dos umbrales en negritas se vigilan **entre tanda y tanda** el viernes. Si se cruzan, se para.
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
