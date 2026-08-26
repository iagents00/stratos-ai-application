# Runbook — Correo del webinar Mondrian Cancún

**Jueves 27 de agosto de 2026** · 9:00 PM Cancún · 8:00 PM CDMX · 7:00 PM California

Guía operativa paso a paso.

- El plan y el porqué: [`PLAN_EMAIL_MARKETING_DUKE.md`](../PLAN_EMAIL_MARKETING_DUKE.md)
- Las tácticas de redacción y por qué están así: [`TECNICAS-EMAIL-DUKE.md`](TECNICAS-EMAIL-DUKE.md)

---

## HECHO el 26 de agosto (3:34 PM)

El dominio de envío **no** es `dukedelcaribe.com`. Su DNS está en HostGator y no
hubo acceso, así que se montó sobre **`stratoscapitalgroup.com`**, cuyo DNS vive
en Namecheap. Ya quedó todo:

| Pieza | Estado |
|---|---|
| Dominio `stratoscapitalgroup.com` en Resend | **Verificado** |
| CNAME `rsend`, CNAME `send`, TXT `resend._domainkey`, TXT `_dmarc` | capturados en Namecheap y propagados |
| `RESEND_API_KEY` (permiso solo de envío) | en secrets de Supabase |
| `RESEND_WEBHOOK_SECRET` | en secrets de Supabase |
| Webhook con los 5 eventos | activo |
| Remitente | `Óscar Gálvez · Duke del Caribe <oscar.galvez@stratoscapitalgroup.com>` |

Nada del dominio se rompió: la app en Vercel, los MX de PrivateEmail y el SPF
quedaron idénticos. Resend usa CNAMEs, no MX, así que *Mail Settings* nunca se tocó.

**Falta solo la migración 034** y los datos del webinar. Nada más.

## Quedan dos días

El webinar es **pasado mañana**. No hay margen para calentar el dominio por
escalones a lo largo de una semana: todo el trabajo de infraestructura cae hoy y
el primer envío sale mañana en tres tandas.

Lo que eso significa en la práctica:

- **La lista se valida antes de mandar, sin excepción.** Con una firma DKIM nueva,
  un rebote de 5% en el primer envío deja el dominio marcado. `validar --aplicar`
  no es opcional.
- **Tres tandas el miércoles**, no un solo disparo de 279.
- **WhatsApp carga el peso.** 1,814 teléfonos contra 279 correos, y sin DNS de por
  medio. Si algo se atora con el dominio, el webinar se llena por ahí.

## Estado al 25 de agosto de 2026

### Ya está hecho y desplegado

| Pieza | Dónde | Estado |
|---|---|---|
| Esquema (3 tablas + audiencia) | `supabase/migrations/034_email_marketing.sql` | escrito, **falta correrlo** |
| Motor de envío | `supabase/functions/email-dispatch/` | **desplegado** en producción |
| Receptor de eventos | `supabase/functions/email-webhook/` | **desplegado**, sin JWT |
| Baja en un clic | `supabase/functions/email-unsubscribe/` | **desplegado**, sin JWT |
| Herramienta de operación | `supabase/email_campana.mjs` | listo |
| Secuencia de 5 correos | `src/emails/` + `supabase/email_campanas_webinar.json` | listos, **faltan los datos del webinar** |

Probado en vivo contra producción:

```
dispatch sin credenciales      → 401
webhook sin firma Svix         → 401 {"error":"Firma inválida"}
unsubscribe con token inválido → 404 con página
```

### Falta (y lo tienes que hacer tú)

1. Correr la migración 034
2. Crear la cuenta de Resend y capturar el DNS
3. Guardar los dos secrets
4. Configurar el webhook en Resend
5. Llenar los datos del webinar en el JSON

---

## Paso 1 — Migración

`supabase db push` **no**: los historiales de migración están divergidos.

Abre el [editor SQL](https://supabase.com/dashboard/project/glulgyhkrqpykxmujodb/sql/new),
pega completo `supabase/migrations/034_email_marketing.sql` y córrelo. Es idempotente:
si algo falla a la mitad, lo arreglas y lo vuelves a correr entero.

Verificación:

```sql
select table_name from information_schema.tables
where table_schema='public' and table_name like 'email_%';
-- esperado: email_campaigns, email_recipients, email_suppressions

select count(*) from fn_email_audiencia('00000000-0000-0000-0000-000000000001');
-- esperado: ~279
```

---

## Paso 2 — Resend y DNS

### 2.1 Cuenta

En [resend.com](https://resend.com): crear cuenta → **Domains** → **Add Domain** →
`dukedelcaribe.com`. Contrata el plan de paga (~20 USD/mes): el gratis topa en
100 correos al día y el calendario tiene días de 279.

### 2.2 DNS en HostGator

El dominio está en **HostGator México** (`ns56.hostgator.mx` / `ns57.hostgator.mx`).
cPanel → **Editor de Zona DNS** → dominio `dukedelcaribe.com`.

Resend te muestra 3 registros. La forma es esta; **los valores exactos los genera tu cuenta**:

| Tipo | Nombre | Valor | Prioridad |
|---|---|---|---|
| MX | `send` | `feedback-smtp.<región>.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
| TXT | `resend._domainkey` | la llave larga que te da Resend | — |

Y uno más que Resend no pide pero hay que poner, porque hoy no existe:

| Tipo | Nombre | Valor |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@dukedelcaribe.com; fo=1` |

**No toques el TXT que ya está en la raíz** (`v=spf1 include:spf.titan.email ~all`).
Ese es el correo del equipo. Resend manda los rebotes por `send.` y firma con su
propio selector, así que los dos conviven sin pisarse.

**DMARC arranca en `p=none`** a propósito: solo observa y reporta. Subirlo a
`p=quarantine` de golpe, sin haber leído un reporte, puede mandar a cuarentena el
correo legítimo de Titan. Se sube **después** del webinar.

### 2.3 Verificar

```bash
dig +short TXT resend._domainkey.dukedelcaribe.com @8.8.8.8
dig +short TXT _dmarc.dukedelcaribe.com @8.8.8.8
dig +short MX send.dukedelcaribe.com @8.8.8.8
```

Los tres tienen que contestar. Propagación normal: de 15 minutos a 4 horas.

Después, en Resend, botón **Verify**. Y da de alta el dominio en
[Google Postmaster Tools](https://postmaster.google.com): el 58% de la lista es Gmail,
y ahí se ve la reputación real.

---

## Paso 3 — Secrets

Nunca en el repo: **es público**.

```bash
supabase secrets set RESEND_API_KEY=re_xxxxx --project-ref glulgyhkrqpykxmujodb
supabase secrets set EMAIL_BRAND_NAME="Duke del Caribe" --project-ref glulgyhkrqpykxmujodb
```

El `RESEND_WEBHOOK_SECRET` sale del paso 4.

---

## Paso 4 — Webhook

Resend → **Webhooks** → **Add Webhook**:

```
https://glulgyhkrqpykxmujodb.supabase.co/functions/v1/email-webhook
```

Eventos: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`,
`email.complained`.

Copia el **Signing Secret** (`whsec_...`) y guárdalo:

```bash
supabase secrets set RESEND_WEBHOOK_SECRET=whsec_xxxxx --project-ref glulgyhkrqpykxmujodb
```

Prueba desde el botón **Send test event** de Resend. Debe responder 200.
Mientras el secret no esté puesto, contesta 401 a todo — que es lo correcto.

---

## Paso 5 — Datos del webinar

Llena `supabase/email_campanas_webinar.json`. Todo lo que dice `PENDIENTE_*`:

Ya están puestos el título (Mondrian Cancún), la fecha, los tres horarios y la
URL del formulario de registro. Falta:

```
presentador            nombre de quien presenta, para firmar y para el remitente
acceso_url             el enlace de Zoom del jueves
agenda_url             a dónde mandas a quien quiere ver números
grabacion_url          la grabación (se llena el jueves en la noche)
direccion_postal       dirección física de Duke  ← obligatoria por CAN-SPAM
aviso_privacidad_url   el aviso de privacidad    ← obligatorio por LFPDPPP
```

La dirección postal **no es negociable**: hay destinatarios en California,
Houston y Miami, así que CAN-SPAM aplica.

Revísalos antes de mandar nada:

```bash
node supabase/email_campana.mjs previsualizar
```

Abre `preview-emails/index.html`. Si algo sigue en PENDIENTE, ahí lo dice, y
`render` se niega a marcar la campaña como lista.

---

## Paso 6 — Preparar

```bash
# 1. Limpiar la lista: dedazos y dominios sin servidor de correo
node supabase/email_campana.mjs validar
node supabase/email_campana.mjs validar --aplicar     # cuando estés de acuerdo

# 2. Dar de alta las 5 campañas
node supabase/email_campana.mjs crear

# 3. Cargar el HTML
node supabase/email_campana.mjs render mondrian-01-invitacion

# 4. Llenar los destinatarios
node supabase/email_campana.mjs audiencia mondrian-01-invitacion
```

---

## Paso 7 — Prueba semilla

**Antes de tocar a un solo cliente.** Manda a 10-15 buzones del equipo, que haya
Gmail, Outlook, Yahoo e iCloud entre ellos.

Crea una campaña `prueba-semilla` en el JSON apuntando a la misma plantilla, mete
los correos internos a mano en `email_recipients`, y:

```bash
node supabase/email_campana.mjs enviar prueba-semilla --lote 20
```

Qué revisar:

- [ ] Llega a **Principal**, no a Promociones ni a Spam
- [ ] Se ve bien en celular y en modo oscuro
- [ ] El botón abre el registro correcto
- [ ] "Cancelar suscripción" abre la página y da de baja de verdad
- [ ] Gmail muestra su botón nativo de cancelar arriba
- [ ] En Gmail: **Mostrar original** → SPF `PASS`, DKIM `PASS`, DMARC `PASS`
- [ ] [mail-tester.com](https://www.mail-tester.com) da 9/10 o más

Y que los eventos aterricen:

```sql
select estado, count(*) from email_recipients group by 1;
select action, count(*) from lead_events where type='email' group by 1;
```

---

## Paso 8 — Calendario, comprimido a dos días

### Hoy martes 25 — toda la infraestructura

Pasos 1 al 7 de este documento, en orden. Meta: terminar el día con el dominio
verificado, la lista limpia y la prueba semilla en la bandeja del equipo.

Si el DNS no propagó al final del día, avísame: se replantea a WhatsApp como canal
principal y el correo sale cuando esté listo, sin forzarlo.

### Miércoles 26 — invitación en tres tandas

La lista abarca tres husos horarios. Las tandas se reparten para caer en horario
decente en los tres.

```bash
node supabase/email_campana.mjs render    mondrian-01-invitacion
node supabase/email_campana.mjs audiencia mondrian-01-invitacion

# 10:00 CDMX
node supabase/email_campana.mjs enviar mondrian-01-invitacion --lote 100 --max 100
node supabase/email_campana.mjs reporte mondrian-01-invitacion

# 14:00 CDMX — solo si el reporte viene limpio
node supabase/email_campana.mjs enviar mondrian-01-invitacion --lote 100 --max 100

# 18:00 CDMX — el resto
node supabase/email_campana.mjs enviar mondrian-01-invitacion --lote 100
```

**Entre tanda y tanda se revisa el reporte.** Si el rebote pasa de 5%, el script
se detiene solo; no lo fuerces.

Ese mismo día salen los 1,814 de WhatsApp.

### Jueves 27 por la mañana — reenvío a quien no abrió

Mismo contenido, otro asunto, solo a quien no abrió la invitación. Recupera entre
30% y 50% de aperturas adicionales.

```bash
node supabase/email_campana.mjs render    mondrian-02-reenvio
node supabase/email_campana.mjs audiencia mondrian-02-reenvio --no-abrieron mondrian-01-invitacion
node supabase/email_campana.mjs enviar    mondrian-02-reenvio --lote 100
```

### Jueves 27 a las 16:00 California — es hoy

**Solo a registrados**, y con el enlace de Zoom, no el del formulario.

El registro vive en un formulario de Google, así que el sistema no sabe quién se
apuntó. Hay que exportar las respuestas y sembrar la campaña con esos correos:

```bash
# Exporta el formulario a CSV y saca la columna de correos, separados por coma
node supabase/email_campana.mjs render    mondrian-03-es-hoy
node supabase/email_campana.mjs audiencia mondrian-03-es-hoy --solo "correo1@x.com,correo2@y.com,..."
node supabase/email_campana.mjs enviar    mondrian-03-es-hoy --lote 100
```

`--solo` toma únicamente los correos indicados, y solo si además pasan las reglas
de elegibilidad (sin baja, sin rebote previo).

Quien se registró y **no** está en la base de leads no recibe este correo por aquí:
a esos les llega el que mande el formulario o Zoom. Vale la pena darlos de alta
como leads el viernes.

### Viernes 28 — seguimiento

Según el reporte de asistencia de Zoom, se parte en dos:

```bash
node supabase/email_campana.mjs render    mondrian-04a-asistio
node supabase/email_campana.mjs audiencia mondrian-04a-asistio --solo "<los que sí entraron>"
node supabase/email_campana.mjs enviar    mondrian-04a-asistio --lote 100

node supabase/email_campana.mjs render    mondrian-04b-no-asistio
node supabase/email_campana.mjs audiencia mondrian-04b-no-asistio --excluir mondrian-04a-asistio
node supabase/email_campana.mjs enviar    mondrian-04b-no-asistio --lote 100
```

**Aquí está el dinero.** El correo del viernes a quien no asistió suele rendir más
que toda la invitación: ya sabe de qué se trata y no tuvo que apartar la noche.

## Frenos automáticos

`enviar` se detiene solo y deja la campaña en `pausado` si, con al menos 40 correos
ya procesados:

| Métrica | Tope | Qué significa |
|---|---|---|
| Rebote | 5% | La lista está sucia. Limpiar antes de seguir. |
| Quejas de spam | 0.3% | Esto es lo que mata un dominio. Parar en seco. |

Reanudar después de arreglar:

```sql
update email_campaigns set estado='listo' where slug='...';
```

---

## Si algo se rompe

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `enviar` da 401 | falta `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` | revisar el archivo |
| dispatch: "Falta el secret RESEND_API_KEY" | no se guardó el secret | paso 3 |
| "La campaña está en borrador" | falta `render`, o quedan datos PENDIENTE | paso 5 y 6 |
| Todo cae en spam | DNS a medias | `dig` los tres registros; ver SPF/DKIM/DMARC en Mostrar original |
| No llegan aperturas ni clics | webhook mal configurado | paso 4; los logs en el dashboard de funciones |
| Rebote arriba de 5% | lista sin validar | `validar --aplicar` y volver a armar la audiencia |

Logs de las funciones:
`https://supabase.com/dashboard/project/glulgyhkrqpykxmujodb/functions`

---

## Lo que el motor nunca hace

- Mandar dos veces el mismo correo a la misma persona (índice único por campaña).
- Escribirle a alguien que rebotó duro, se quejó o se dio de baja
  (`email_suppressions` se consulta antes de cada lote).
- Mandar un correo sin enlace de baja (`render` lo rechaza).
- Dejar el envío accesible desde el navegador (solo `service_role`).
