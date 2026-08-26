# Runbook — Correo del webinar del 2 de septiembre

Guía operativa paso a paso.

- El plan y el porqué: [`PLAN_EMAIL_MARKETING_DUKE.md`](../PLAN_EMAIL_MARKETING_DUKE.md)
- Las tácticas de redacción y por qué están así: [`TECNICAS-EMAIL-QUE-CONTESTAN.md`](TECNICAS-EMAIL-QUE-CONTESTAN.md)

---

## Estado al 25 de agosto de 2026

### Ya está hecho y desplegado

| Pieza | Dónde | Estado |
|---|---|---|
| Esquema (3 tablas + audiencia) | `supabase/migrations/034_email_marketing.sql` | escrito, **falta correrlo** |
| Motor de envío | `supabase/functions/email-dispatch/` | **desplegado** en producción |
| Receptor de eventos | `supabase/functions/email-webhook/` | **desplegado**, sin JWT |
| Baja en un clic | `supabase/functions/email-unsubscribe/` | **desplegado**, sin JWT |
| Herramienta de operación | `supabase/email_campana.mjs` | listo |
| Secuencia de 7 correos | `src/emails/` + `supabase/email_campanas_webinar.json` | listos, **faltan los datos del webinar** |

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

```
presentador            Óscar Gálvez
titulo                 el tema del webinar
hora                   6:00 p.m. (o la que sea)
duracion               45 minutos
registro_url           el enlace de registro de Zoom
acceso_url             el enlace de acceso
agenda_url             a dónde mandas a quien quiere platicar
grabacion_url          la grabación (se llena el miércoles en la noche)
direccion_postal       dirección física de Duke  ← obligatoria por ley
aviso_privacidad_url   el aviso de privacidad    ← obligatorio por ley
```

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

# 2. Dar de alta las 7 campañas
node supabase/email_campana.mjs crear

# 3. Cargar el HTML
node supabase/email_campana.mjs render webinar-01-invitacion

# 4. Llenar los destinatarios
node supabase/email_campana.mjs audiencia webinar-01-invitacion
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

## Paso 8 — Calendario de envío

El dominio es viejo pero la firma DKIM es nueva. Se sube el volumen por escalones,
no de golpe.

### Viernes 29 — invitación en tandas

```bash
# 10:00 · calientes + primeros tibios
node supabase/email_campana.mjs enviar webinar-01-invitacion --lote 100 --max 100
node supabase/email_campana.mjs reporte webinar-01-invitacion

# 16:00 · resto de tibios — solo si el reporte de la mañana viene limpio
node supabase/email_campana.mjs enviar webinar-01-invitacion --lote 90 --max 90
```

### Sábado 30

```bash
node supabase/email_campana.mjs enviar webinar-01-invitacion --lote 100 --max 100
```

Aquí también salen los 1,814 de WhatsApp. Ese es el canal que llena el webinar.

### Domingo 31 — reenvío a quien no abrió, y luego el contenido

El reenvío va **primero, en la mañana**. Mismo correo, otro asunto, solo a quien
no abrió la invitación. Recupera entre 30% y 50% de aperturas extra.

```bash
node supabase/email_campana.mjs render    webinar-01-reenvio
node supabase/email_campana.mjs audiencia webinar-01-reenvio --no-abrieron webinar-01-invitacion
node supabase/email_campana.mjs enviar    webinar-01-reenvio --lote 100
```

Por la tarde, el correo de contenido a todos:

```bash
node supabase/email_campana.mjs render    webinar-02-contenido
node supabase/email_campana.mjs audiencia webinar-02-contenido
node supabase/email_campana.mjs enviar    webinar-02-contenido --lote 100
```

### Lunes 1 — último llamado

Solo a quien no se ha registrado:

```bash
node supabase/email_campana.mjs render    webinar-03-ultimo-llamado
node supabase/email_campana.mjs audiencia webinar-03-ultimo-llamado --excluir webinar-04-es-hoy
node supabase/email_campana.mjs enviar    webinar-03-ultimo-llamado --lote 100
```

(Ve metiendo a los registrados en `webinar-04-es-hoy` conforme lleguen; así
`--excluir` los quita solo.)

### Miércoles 2 — tres horas antes

`webinar-04-es-hoy`, **solo a registrados**.

### Jueves 3 — el seguimiento, que es donde está el dinero

`webinar-05a-asistio` y `webinar-05b-no-asistio`, según el reporte de asistencia
de Zoom. Los dos piden respuesta directa, no clic.

### Y toda la semana: contestar

Los correos 1, 3, 5a y 5b piden que la gente **responda**, no que haga clic. Eso
es a propósito — convierte más y le enseña a Gmail que este remitente se quiere.

Solo funciona si alguien está leyendo `admin@dukedelcaribe.com` y contesta el
mismo día. Si nadie lo va a leer, avísame y cambiamos la llamada a la acción
antes del viernes.

---

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
