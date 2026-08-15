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
   └─ Sitio web ──► stratoscapitalgroup.com/<slug>      landing de marca, SIN formulario
        └─ clic en el botón, y en ese orden:
             1. fbq('track','Lead')                     Meta puede optimizar por la conversión
             2. sendBeacon → duke-lead-router           el clic queda en duke_ad_clicks
             3. window.location → wa.me/<asesor>        con el mensaje ya escrito
```

**La landing no pide datos.** El clic *es* la conversión. El nombre y el teléfono
reales llegan cuando la persona escribe por WhatsApp; hasta entonces la única
atribución es la fila en `duke_ad_clicks`.

Si en el futuro se quiere capturar nombre/teléfono en la landing, existe la
variante con formulario en `public/duke/registro/` — esa sí crea el lead en
`leads` con asesor asignado y etapa `Contáctame Ya`.

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

## 7. Estado actual

| Asesor | Clave | WhatsApp | Pool | Landing |
|---|---|---|---|---|
| Marco Lopez | `marco` | `+529848763357` | `duke_ads_marco` | `/mondrian` |
| Ken Duke | — | `+529842181660` | solo en round-robin | — |
| Carlos Reyes | — | `+529841794415` | solo en round-robin | — |

Ken y Carlos están en `duke_ads_round_robin` pero **no tienen pool directo**: hoy
`?advisor=ken` cae en round-robin. Correr el script del punto 3 para darlos de alta.
