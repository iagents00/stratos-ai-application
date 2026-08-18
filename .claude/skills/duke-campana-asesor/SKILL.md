---
name: duke-campana-asesor
description: >-
  Receta completa para montar una campaña de Meta Ads de Duke del Caribe dirigida a UN asesor
  concreto, con su WhatsApp y su desarrollo, de forma que el lead llegue a la cuenta de ESE asesor
  en Stratos AI CRM. Úsala cuando haya que: lanzar un desarrollo nuevo (Mondrian, Bay View Grand,
  Portofino…), dar de alta un asesor en las campañas de Duke, crear la landing con link corto,
  cambiar el WhatsApp de destino de una campaña, o entender por qué un lead no cayó en la cuenta
  del asesor que lo atendió. Cubre Supabase (pool + etiquetado), la landing, el píxel de Meta,
  el registro de clics y la configuración exacta del anuncio.
---

# Duke del Caribe — campaña de Meta por asesor

> Replica lo que ya corre en producción para **Marco Lopez / Mondrian**.
> Referencia viva: `https://stratoscapitalgroup.com/mondrian`

## 0. Constantes

| Cosa | Valor |
|---|---|
| Supabase ref | `glulgyhkrqpykxmujodb` (MCP `stratos-prod`) |
| Org Duke | `00000000-0000-0000-0000-000000000001` |
| Cuenta de anuncios | `DUKE DEL CARIBE MKT` — `661863492474992` |
| Business/portfolio | `134611108788032` |
| Página / IG | `El duke del Caribe` / `eldukedelcaribe` |
| Píxel de Meta | `1768687304377919` (DUKE DEL CARIBE MKT) |
| Edge Function | `duke-lead-router` |
| Tabla de clics | `duke_ad_clicks` |

## 1. Cómo fluye un lead (entender esto primero)

```
Anuncio de Meta
   └─ Sitio web ──► stratoscapitalgroup.com/<slug>
        │
        ├─ al CARGAR:  sendBeacon event=landing_view    ► duke_ad_clicks
        │              (todo el que llega, aunque no haga nada más)
        │
        └─ al dar CLIC, en este orden:
             1. fbq('track','Lead')                     Meta optimiza por la conversión
             2. sendBeacon event=whatsapp_click         ► duke_ad_clicks + LEAD en el CRM
             3. window.location → wa.me/<asesor>        mensaje ya escrito, con (ref MD-XXXX)
```

**Se registran los dos momentos, no solo el clic.** Esto salió de una auditoría
de Mondrian: había 33 visitas y 9 clics. De las otras 24 personas no quedaba ni
rastro — ni siquiera que habían llegado. Medir solo el clic esconde dos tercios
del embudo.

### 1.1 El clic crea el lead. No lo quites.

Durante un tiempo el router registraba el clic en `duke_ad_clicks` y **no**
creaba lead, con este razonamiento en el código: *"no ensucia el pipeline de
leads con registros sin teléfono"*.

El resultado fue peor. En dos días 16 personas pasaron a WhatsApp entre Marco y
Ken, y **cero** aparecieron en el CRM. Los asesores nunca se enteraron. El
motivo de fondo:

| asesor | leads automáticos por WhatsApp (`whatsapp_inbound`) |
|---|---|
| Gael G | 339 |
| Carlos Reyes | 45 |
| Marco Lopez | **0** |
| Ken Duke | **0** |
| Oscar Gálvez | **0** |

La captura automática de WhatsApp solo está conectada al número de Gael. Para
los demás, si el clic no crea el lead, el prospecto es invisible.

**Vale más un lead sin teléfono que un prospecto que nadie ve.**

### 1.2 El código de pareo

El mensaje de WhatsApp lleva `(ref MD-XXXX)` al final. Ese código se genera en
el navegador — no en el servidor, para que el mensaje esté listo sin esperar
un viaje de red — y se guarda junto al clic en `duke_ad_clicks.pair_code`.

Sirve para lo único que la conversación de WhatsApp no trae consigo: **de qué
anuncio vino**. Sin él, un mensaje entrante es indistinguible de cualquier otro.

El alfabeto excluye caracteres que se confunden al leerlos (`0`/`O`, `1`/`I`).

### 1.3 La variante con formulario instantáneo

La landing sin formulario tiene un techo: el dato real solo llega si la persona
escribe. El formulario instantáneo de Meta lo resuelve — precarga nombre,
teléfono y correo del perfil, y en la pantalla de gracias pone un botón a
WhatsApp. **El dato llega aunque nunca escriba.**

La tubería ya existe:

```
Formulario Meta → n8n (duke-meta-lead-ads-trigger) → fn_upsert_lead_from_meta_ads → CRM
```

Requiere que el workflow esté **activo** en n8n y conectado a la página
*El duke del caribe*. Si no lo está, los leads de formulario no llegan por
ningún lado: históricamente solo entraron por CSV a mano.

## 2. El pool ES la configuración

Un asesor queda "directo" cuando existe el pool `duke_ads_<clave>` con él dentro.
`duke-lead-router` lo lee en caliente: **no hay nada hardcodeado y no hay que
redesplegar la función para dar de alta a alguien.**

```
?advisor=ken  →  pool duke_ads_ken  →  ese asesor
?advisor=xxx  →  no existe el pool  →  cae en duke_ads_round_robin
```

> Esto era un bug hasta agosto 2026: el mapa de asesores vivía hardcodeado en la
> función con Marco adentro, mientras la landing sí tenía a Ken y Carlos. Con
> `?advisor=ken` el prospecto le escribía a Ken y el lead se le asignaba a otro
> por round-robin. Si ves ese síntoma, revisa que exista el pool.

## 3. Alta de un asesor + desarrollo

```bash
node scripts/duke_setup_advisor.mjs \
  --asesor "Ken Duke" --clave ken --telefono +529842181660 \
  --proyecto "Bay View Grand" --slug bayview
```

Corre primero con `--dry-run` para validar sin escribir.

El script es idempotente y hace:

1. Verifica que exista `profiles.name = "Ken Duke"` en la org de Duke.
   **Si no existe, aborta** — sin `asesor_id` real el lead entra con el nombre
   pero fuera de la cuenta del asesor, que es exactamente el fallo a evitar.
2. Crea el pool `duke_ads_ken` con ese único miembro y su WhatsApp.
3. Registra la regla en `meta_ads_lead_routing_overrides` para que todo lead que
   mencione el desarrollo entre con `project` y `tag` correctos.
4. Genera `public/duke/bayview/index.html` desde la landing de Mondrian.
5. Agrega el rewrite `/bayview` en `vercel.json`.

Después, a mano:

- Cambiar `public/duke/<slug>/hero-1000.jpg` por la foto del desarrollo
  (el script copia la de Mondrian como placeholder).
- Ajustar el subtítulo si el desarrollo lo pide.
- **Bumpear `CACHE_VERSION` en `public/sw.js`** — sin esto los navegadores con
  service worker viejo siguen sirviendo el bundle anterior.
- Commit → PR → merge → verificar que `/sw.js` en producción ya traiga la versión nueva.

## 4. La campaña en Meta

### 4.1 Lo que NO se debe hacer

- **No usar formulario instantáneo.** El lead se queda dentro de Meta: no existe
  `META_APP_SECRET` ni `META_PAGE_ACCESS_TOKEN` en Supabase, y sin eso el webhook
  `leadgen` responde `server_misconfigured` a propósito. Habría que capturar a mano.
- **No apuntar el anuncio a la URL de la Edge Function.** Supabase reescribe las
  respuestas de las Edge Functions a `content-type: text/plain` con
  `content-security-policy: default-src 'none'; sandbox`, así que el navegador
  muestra el código fuente en vez de la página. `HEAD` sí devuelve `text/html`,
  por eso es fácil no darse cuenta. La landing va siempre en el dominio propio.

### 4.2 Configuración

```
CAMPAÑA   DUKE - <Proyecto> - USA - <Asesor>
          Objetivo: Clientes potenciales
          Categoría especial: Vivienda
          Países: Estados Unidos          ← ver 4.3, es el paso clave
          Presupuesto de campaña (CBO), volumen más alto

CONJUNTO  Ubicación de la conversión: Sitio web
          Píxel: 1768687304377919
          Evento: visitas a la página de destino
                  → cambiar a "Lead" cuando el píxel junte ~50/semana
          Lugares: Estados Unidos, o mejor las 4 ciudades probadas con +40 km:
                   Los Angeles CA · Miami FL · Dallas TX · Midland TX
          Segmentación detallada: NINGUNA
          Advantage+ audience: ON

ANUNCIO   Video vertical del desarrollo
          Botón: Más información
          URL: https://stratoscapitalgroup.com/<slug>
```

### 4.3 El paso que destraba todo

En **Categorías de anuncios especiales → Países**, selecciona **Estados Unidos**.

Si ese campo está en México (o vacío), Meta bloquea el editor de Lugares y no te
deja segmentar a EE.UU. Al ponerlo en Estados Unidos, Meta hace tres cosas solo:

- cambia Lugares de México a Estados Unidos,
- elimina los intereses que la categoría Vivienda no permite,
- el público estimado sube (en Mondrian pasó de 26.8M a 51.2M).

### 4.3.1 Si la campaña YA existía: el bloqueo circular

Sobre una campaña **ya publicada**, cambiar el país no basta — aparece un
`Error de entrega` (`#2909034`) que **bloquea justo la publicación que lo
arreglaría**. Pasa por esto:

> `special_ad_category_country` — *"will default to tax country if not set"*.

La campaña se creó sin declarar país, así que Meta le puso el **país fiscal de la
cuenta**: México. El borrador apunta a EE.UU. → conflicto → error → no publica.

**La salida es el orden.** Publica en dos pasos, nunca de golpe:

1. **Primero la campaña sola** (solo el país). Al aplicarse, el conflicto
   desaparece del conjunto.
2. **Después el conjunto** (público + ubicación).
3. Recién entonces enciende: conjunto → campaña.

Antes de nada, revisa que no haya una **prueba A/B activa** sobre la campaña: con
una prueba viva, Meta congela las ediciones y el botón Publicar queda muerto.
Cancélala y el editor de Lugares reaparece.

### 4.3.2 Nunca uses "Revisar y publicar" tal cual

Ese botón trae **todos** los borradores pendientes de la cuenta — en Duke suelen
ser 20+, de campañas de otros con presupuestos propios. Publicarlos por error
lanza campañas que nadie aprobó y empiezan a gastar.

El diálogo tiene **casillas por fila** y tres pestañas (Campañas / Conjuntos /
Anuncios). El procedimiento seguro:

1. Desmarca todo con la casilla del encabezado, **en cada una de las tres pestañas**.
2. Marca solo tu objeto. Confirma que el contador diga `1 de N` donde toca y
   `0 de N` en las otras dos.
3. Publica. El contador de arriba debe bajar exactamente en 1.

Si tu objeto es una **edición** sobre algo ya publicado, no tendrá "Publicar" en
la fila de la tabla (eso solo sale en borradores nuevos): va por este diálogo.

### 4.3.3 Cómo saber que quedó

La columna Entrega del conjunto cuenta la historia:

| Dice | Significa |
|---|---|
| `Error de entrega` | Sigue el conflicto de país. Ver 4.3.1 |
| `Campaña desactiva` | El conjunto ya está bien; falta encender la campaña |
| `Aprendizaje` | Entregando. Listo |

### 4.4 Por qué EE.UU. y sin intereses

Datos de la propia cuenta, 30 días a agosto 2026:

| Campaña | Resultados | Costo |
|---|---|---|
| KEN - BAY VIEW GRAND 2025 no 1660 (4 ciudades US, cero intereses) | 81 | **$38.17** |
| PDC GOBERNADOR 28 DUKE USA - 6686 | 11 | $224.27 |

Y la categoría Vivienda elimina el targeting por intereses de todos modos: dejarlos
solo achica el público sin dar nada a cambio.

## 5. Verificar que quedó bien

```bash
# la landing responde y trae el píxel
curl -s https://stratoscapitalgroup.com/<slug> | grep -c 1768687304377919

# el router resuelve al asesor correcto
curl -s -X POST https://glulgyhkrqpykxmujodb.supabase.co/functions/v1/duke-lead-router \
  -H 'Content-Type: application/json' \
  -d '{"event":"whatsapp_click","advisor":"<clave>","project":"<Proyecto>","utm_source":"qa"}'
# debe devolver el nombre del asesor y su wa_url
```

En Supabase, y **borrar la fila de prueba después**:

```sql
select advisor_name, advisor_phone_e164, project, campaign
from duke_ad_clicks order by created_at desc limit 1;

delete from duke_ad_clicks where utm_source = 'qa';
```

## 6. Si algo falla

| Síntoma | Causa casi siempre |
|---|---|
| El lead cae en otro asesor | No existe el pool `duke_ads_<clave>` → cayó en round-robin |
| El lead entra con el nombre pero no en su cuenta | `profiles.name` no coincide exacto → sin `asesor_id` |
| El clic no aparece en `duke_ad_clicks` | `sendBeacon` con `application/json`: obliga a un preflight CORS que beacon no puede hacer y el navegador lo descarta **sin error en consola**. Va en `text/plain` |
| El editor de Lugares no abre en Meta | Categoría especial declarada para México. Ver 4.3 |
| El anuncio muestra código fuente | La URL apunta a la Edge Function. Ver 4.1 |
| El cambio no se ve en producción | Falta bumpear `CACHE_VERSION` en `public/sw.js` |
| Hay clics pero ningún lead en el CRM | El clic no está creando el lead, o el asesor no tiene `asesor_id`. Ver 1.1 |
| Todos los leads salen con la misma campaña | El router no está mandando `campaign_id`/`adset_id`/`ad_id` a la RPC: sin ids solo aplica la regla comodín por nombre |
| Se ven clics pero no visitas | La landing no está mandando `landing_view` al cargar. Ver 1 |
| Un lead de formulario cae en round-robin | Falta la regla de `meta_ads_lead_routing_overrides` con el `campaign_id` de esa campaña |

## 7. Estado actual

| Asesor | Clave | WhatsApp | Pool | Campaña Meta |
|---|---|---|---|---|
| Marco Lopez | `marco` | `+529848763357` | `duke_ads_marco` | `Mondrian Stratos AI - Marco` · Activa |
| Ken Duke | `ken` | `+529842181660` | `duke_ads_ken` | `Mondrian Stratos AI - Ken` · Activa |
| Oscar Gálvez | `duke` y `oscar` | `+529841376686` | `duke_ads_duke` y `duke_ads_oscar` | `Mondrian Stratos AI - Oscar` · conjunto sin publicar |
| Carlos Reyes | — | `+529841794415` | solo round-robin | — |

Todos entran por `stratoscapitalgroup.com/mondrian?advisor=<clave>`. Sin
parámetro cae en Marco.

**Duke del Caribe es Oscar Gálvez.** Las claves `duke` y `oscar` apuntan al
mismo teléfono y a la misma cuenta; ambas existen para que ninguna forma de
escribirlo falle.

### Rendimiento a 18-ago-2026

| campaña | resultados | costo | gastado |
|---|---|---|---|
| Ken | 33 visitas a la landing | **$2,60** | $85,82 |
| Marco | 33 visitas a la landing | **$3,60** | $118,80 |

Para comparar: `WEBINAR MONDRIAN USA` va en $6,05 y `MARCO- MONDRIAN 1 USA-3357`
en cero resultados. **No toques las de Marco y Ken sin razón** — cambiarles el
destino reinicia el aprendizaje de Meta.

Si se quiere probar el formulario instantáneo, hacerlo primero en la de Oscar,
que aún no gasta.
