# Stratos AI → Meta Tech Provider
### Briefing para arrancar en un chat nuevo
_23-ago-2026_

---

## 1. Por qué esto importa (contexto real, no teórico)

Stratos AI conecta el WhatsApp de cada asesor inmobiliario a su CRM. Hoy eso
se hace **a mano, asesor por asesor**, y es insostenible.

Lo que costó conectar a UN solo asesor (Marco Lopez, +52 1 984 876 3357):

- Crear una app de Meta dedicada solo para él
- Suscribir esa app a su cuenta de WhatsApp vía Graph API
- Configurar webhook + suscribir el campo `messages`
- Intentar vincular su número → Meta nunca mandó el código
- **Y al final: sigue sin funcionar.** Su número quedó atrapado en
  `platform_type: ON_PREMISE`, un fósil de LeadConnector que no se puede
  liberar sin llamadas destructivas a la API

Resultado tras una sesión entera: **1 de 4 asesores conectados** (Gael, que ya
venía de antes). Y cada asesor nuevo repetiría el mismo viacrucis.

**Así lo hacen GoHighLevel, HubSpot, Respond.io:** el cliente entra a su panel,
hace clic en "Conectar WhatsApp", aparece un popup de Meta, elige su número,
y en 3 clics está conectado. Sin apps por cliente, sin tokens a mano, sin
consola de desarrolladores.

Eso se llama **Embedded Signup**, y requiere ser **Tech Provider**.

---

## 2. Qué es exactamente lo que hay que conseguir

Meta tiene dos figuras y conviene no confundirlas:

| Figura | Qué habilita | ¿Stratos la necesita? |
|---|---|---|
| **Tech Provider** | Embedded Signup: onboarding self-service de números de clientes, gestión de sus WABAs, enviar/recibir en su nombre | **SÍ — es la clave** |
| **Solution Partner (BSP)** | Además: revender mensajería, facturación consolidada, soporte de Meta | Opcional, más adelante |

**Arranca por Tech Provider.** Es lo que desbloquea el "conectar en 3 clics".
Solution Partner es un escalón posterior que solo importa si vas a revender
conversaciones.

---

## 3. Requisitos de Meta (verificar cada uno)

1. **Portafolio comercial propio y verificado** para Stratos AI
   — NO usar el de "El Duke del Caribe" (`134611108788032`): Duke es **cliente**,
     no el proveedor. Mezclarlos es un error de arquitectura que costará caro.
2. **Una sola app de Meta** para todo Stratos AI (no una por asesor)
3. **Producto WhatsApp** agregado a esa app
4. **Acceso avanzado** (App Review) a:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `business_management`
5. **Registro como Tech Provider** en la consola de desarrolladores
6. **Implementar Embedded Signup** con el JS SDK de Facebook en la app de Stratos
7. **Webhook centralizado** que reciba de todos los clientes y rutee por WABA

---

## 4. Lo que YA existe y hay que reaprovechar

| Pieza | Detalle |
|---|---|
| Webhook en producción | `https://personal-n8n.suwsiw.easypanel.host/webhook/meta-directo-leads` |
| Verify token | **Indistinto** — n8n devuelve el `hub.challenge` sin validarlo |
| Ruteo | n8n mapea `display_phone_number` (últimos 10 dígitos) → asesor |
| Destino final | Supabase `glulgyhkrqpykxmujodb`, tabla `leads` |
| Atribución de campaña | Ya funciona: el webhook trae `referral.source_id` con el ad_id |
| Caso de éxito | Gael G — `platform_type` Cloud API, calidad Alta, leads entrando |

**Ojo con el ruteo:** hoy n8n identifica al asesor por número de teléfono con un
MAP hardcodeado. Como Tech Provider eso no escala — habrá que rutear por
**WABA ID → cliente** y guardar esa relación en Supabase.

---

## 5. Que la app en App Store no confunda

Stratos AI va a estar en App Store, pero **eso es independiente del Embedded
Signup**. Meta no revisa la app de iOS; revisa la **app de Meta** (la de
developers.facebook.com) y los permisos que pide.

El Embedded Signup se ejecuta en un **contexto web** (el panel de Stratos, o un
webview dentro de la app móvil). No hay SDK nativo de iOS para esto.

---

## 6. Preguntas a resolver antes de escribir código

1. ¿Stratos AI ya tiene portafolio comercial propio en Meta, o hay que crearlo?
2. ¿La verificación de negocio de esa entidad está hecha? (requiere documentos
   fiscales — es el paso más lento, semanas)
3. ¿Los clientes van a tener su propia WABA, o van a colgar de una de Stratos?
4. ¿Se va a revender mensajería (→ Solution Partner) o solo conectar (→ Tech
   Provider basta)?
5. ¿Qué pasa con los asesores ya conectados a mano (Gael)? ¿Se migran al nuevo
   esquema o conviven?

---

## 7. Trampas encontradas en producción — no repetirlas

- **`platform_type: ON_PREMISE`** es una trampa mortal. Números que quedaron en
  la API vieja no reciben webhooks de Cloud API, no se pueden vincular, y
  liberarlos requiere `DELETE` destructivo. **Verificar `platform_type` de cada
  número ANTES de intentar cualquier cosa.**
- **Un saldo de pago rechazado congela la cuenta entera**: no se pueden pausar
  campañas, ni publicar anuncios, ni hacer cambios de estado. Los botones
  simplemente no responden, sin mensaje de error. Perdimos horas por esto.
- **Anuncios de bienes raíces**: nunca usar "invertir", "inversión", "alto
  potencial", "#Inversionistas". Meta los rechaza por política de productos
  financieros. Los recorridos de propiedad pasan sin problema.
- **Coexistencia** (app + API en el mismo número) tiene costos permanentes:
  listas de difusión en solo lectura, sin editar/eliminar mensajes en 1:1,
  y hay que abrir la app cada 14 días o se cae la conexión.

---

## 8. Prompt sugerido para el chat nuevo

> Quiero convertir Stratos AI en Meta Tech Provider para que nuestros clientes
> conecten su WhatsApp Business en 3 clics, como lo hacen GoHighLevel y HubSpot,
> en vez de configurarlo a mano asesor por asesor.
>
> Contexto: Stratos AI es un CRM inmobiliario, se está desarrollando como app
> para App Store, y hoy los leads de WhatsApp llegan vía webhook de Meta → n8n →
> Supabase. Ya tenemos un asesor funcionando (Gael) pero conectarlo fue manual y
> no escala.
>
> Lee `ops/META-TECH-PROVIDER-briefing.md` para el contexto completo, y ayúdame a:
> 1. Definir si necesito Tech Provider, Solution Partner, o ambos
> 2. Listar los requisitos con tiempos realistas
> 3. Diseñar la arquitectura del Embedded Signup y el ruteo multi-cliente
> 4. Armar el plan de migración de los asesores ya conectados

---

_Detalle técnico de lo intentado: `ops/ESTADO-FINAL-marco-whatsapp.md`_
_Receta manual actual: `ops/conectar-asesor-whatsapp-stratos.md`_

---

## 9. AUDITORÍA EN VIVO — 23-ago-2026 (verificado en la consola de Meta)

### Estado de cuentas

| Punto | Hallazgo |
|---|---|
| Sesión activa | **Oscar Galvez** (no Ivan) |
| Portafolios comerciales | **Uno solo: "El Duke del Caribe"** (`134611108788032`) |
| Portafolio Stratos AI | **NO EXISTE** |
| Verificación del negocio (Duke) | **APROBADA** — entidad legal `EL DUKE DEL CARIBE SAPI DE CV`, verificada el 06-may-2026 |
| Apps de Meta | **10, todas bajo el portafolio de Duke** (incluidas 3 duplicadas "Marco - STRATOS AI") |

### La sorpresa buena: el registro está a mitad de camino

En `developers.facebook.com/apps/2501337266955777/whatsapp-business/onboard-v2/`
la página **"Registrarte como proveedor de tecnología independiente"** dice:

> **1 de 2 pasos completados**
> 1. Verificación del negocio — **Aprobado** ✅
> 2. Revisión de la app — pendiente

La verificación de negocio (el paso de semanas) **ya está resuelta**, porque la
app cuelga del portafolio verificado de Duke. Solo falta App Review.

### App candidata como base: `Stratos AI - CRM iAgents 2`

- App ID `2501337266955777` · modo **Desarrollo** · tipo Negocios
- Ya tiene agregados: **WhatsApp**, **Webhooks** e **Inicio de sesión con
  Facebook para empresas** (este último es el producto que exige Embedded Signup)

### Permisos hoy (todos en estándar, ninguno enviado a revisión)

| Permiso | Nivel actual | Necesario |
|---|---|---|
| `whatsapp_business_messaging` | Estándar (1 activa) | **Avanzado** |
| `whatsapp_business_management` | Estándar (1 activa) | **Avanzado** |
| `business_management` | Estándar (0 llamadas) | **Avanzado** |

Meta añade un requisito que el briefing original no contemplaba:
además de la verificación del negocio hay una **"verificación de acceso"**
(Access Verification) específica para proveedores de tecnología.

### Atajo que Meta ya ofrece: Embedded Signup alojado por Meta

En la misma página existe **"Registro insertado alojado por Meta → Generar
enlace"**: genera una landing de onboarding sin tener que implementar el JS SDK.
Sirve para arrancar con clientes reales antes de construir el flujo propio
dentro del panel de Stratos.

### Lo que falta en la configuración de la app (bloquea App Review)

| Campo | Estado |
|---|---|
| URL política de privacidad | ✅ `stratoscapitalgroup.com/politica-de-privacidad` (existe, v1.0, sólida) |
| Correo de contacto | ✅ `ivanrroficial@gmail.com` |
| **Dominios de la app** | ❌ vacío |
| **URL Condiciones del servicio** | ❌ `https://www.facebook.com/` (placeholder basura) |
| **Eliminación de datos de usuario** | ❌ `https://www.facebook.com/` (placeholder basura) |
| **Ícono de la app** | ❌ vacío |
| **Categoría** | ❌ vacía |
| Nombre visible | ⚠️ "Stratos AI - CRM iAgents 2" — **esto es lo que verá el cliente en el popup** |

Además hay que grabar **dos videos** para App Review: uno enviando un mensaje
desde la app a un WhatsApp real (`whatsapp_business_messaging`) y otro creando
una plantilla vía API (`whatsapp_business_management`).

### Upgrade posterior a Tech Partner (no urgente)

Requiere ≥2,500 mensajes/día (promedio 7 días), ≥10 clientes activos al mes y
calidad ≥90%.

### La decisión pendiente

Registrar Tech Provider bajo el portafolio de **Duke** es rápido (verificación
ya aprobada) pero deja la infraestructura multi-cliente de Stratos colgando de
la entidad legal de un cliente. Crear portafolio propio de Stratos AI es lo
correcto, pero exige entidad legal propia y semanas de verificación.

---

## 10. DECISIÓN TOMADA Y RUTA (23-ago-2026)

**Decisión:** portafolio comercial **propio de Stratos AI**. Existe razón social
con RFC, así que la verificación de negocio es viable.

### Dos bloqueantes que son del cliente, no técnicos

1. **La sesión activa es de Oscar Galvez, no de Ivan.** Quien crea el portafolio
   queda como su administrador original. Crear el portafolio de Stratos AI desde
   la cuenta de Oscar repite el mismo error de arquitectura un nivel más abajo:
   la infraestructura de todos los clientes colgaría de una cuenta personal
   ajena. **Debe crearse desde la cuenta de Facebook de Ivan.**
2. **El botón "Crear" acepta las Condiciones comerciales de Meta en nombre del
   negocio.** Es un acto legal a nombre de la razón social — lo firma Ivan.

### Datos que pide el formulario (son solo cuatro)

- Nombre del portafolio comercial (**debe coincidir con el nombre público del
  negocio**, no necesariamente con la razón social)
- Nombre y apellido del contacto
- Correo electrónico del negocio

### Páginas legales: ya existen y están vivas

| Página | Ruta | Estado |
|---|---|---|
| Política de privacidad | `/politica-de-privacidad` · `/privacy-policy` | ✅ live, v1.0 |
| Eliminación de datos | `/eliminar-mis-datos` · `/data-deletion` | ✅ live |

Código en `src/landing/PrivacyPolicy.jsx` y `src/landing/DataDeletion.jsx`,
ruteadas en `src/main.jsx:69-70`. **La app de Meta apunta a `facebook.com` en
ambos campos — es placeholder basura que hay que corregir por estas URLs.**

### Ruta completa, en orden

1. Ivan crea el portafolio Stratos AI desde su cuenta *(bloqueante)*
2. Verificación del negocio con documentos de la razón social *(semanas — el paso largo)*
3. Crear/mover la app de Meta a ese portafolio, con nombre limpio
   (**"Stratos AI"** — es lo que el cliente ve en el popup de Embedded Signup)
4. Completar configuración básica: ícono, categoría, dominio, y las dos URLs legales correctas
5. Grabar los 2 videos de App Review
6. Solicitar acceso avanzado a `whatsapp_business_messaging`, `whatsapp_business_management` y `business_management`
7. Access Verification de proveedor de tecnología
8. Generar el enlace de Embedded Signup alojado por Meta → onboarding real de clientes
9. Migrar el ruteo de n8n de MAP de teléfonos hardcodeado a **WABA ID → cliente** en Supabase
10. Implementar el Embedded Signup propio con el JS SDK dentro del panel de Stratos

Los pasos 3-6 y 9-10 se pueden preparar en paralelo mientras corre la
verificación del paso 2.

---

## 11. HECHO — ruteo multi-cliente en producción (23-ago-2026)

El paso 9 de la ruta ya está **aplicado y verificado en producción**.

- Migración `supabase/migrations/032_whatsapp_tech_provider_routing.sql`
- Contrato de integración para n8n: `ops/RUTEO-WHATSAPP-multicliente.md`

Se corrigió el defecto de fondo: `fn_asesor_del_numero` hardcodeaba
`organization_id = Stratos`, así que con Embedded Signup los leads de cualquier
cliente habrían caído en el CRM de Stratos. El nuevo
`fn_resolver_canal_whatsapp` rutea por `phone_number_id` → `waba_id` → número
visible, sin org fija, y `fn_registrar_canal_whatsapp` da de alta canales desde
el callback de Embedded Signup rechazando ON_PREMISE de entrada.

Los 4 canales que hoy están en vivo siguen funcionando igual: no se tocó
`fn_asesor_del_numero`.

**Lo único que queda bloqueado sigue siendo lo mismo:** crear el portafolio
comercial de Stratos AI desde la cuenta de Facebook de Ivan. La sesión de Chrome
en esta máquina es la de Oscar Galvez, y no hay otra cuenta disponible ahí.

---

## 12. HECHO — Embedded Signup listo en el código (23-ago-2026)

| Pieza | Archivo | Estado |
|---|---|---|
| Librería de Embedded Signup | `src/lib/whatsapp-signup.js` | ✅ en main |
| Panel "Conectar WhatsApp" | `src/app/views/ConectarWhatsApp.jsx` | ⚠️ escrito, **sin montar** |
| Feature flag + config de Meta | `src/clients/_shared/defaults.js` | ✅ en main |

### Por qué el panel no está montado

El id de navegación `wa` **ya existe en main**: es la bandeja de conversaciones
(`src/app/views/WhatsApp.jsx`, 666 líneas, con `useWhatsAppInbox` y realtime).
Montar un módulo nuevo con ese id lo habría roto.

El lugar correcto para "Conectar mi WhatsApp" es **dentro de esa bandeja**, no
como módulo aparte. Esa integración se hará cuando exista la app de Meta real y
se pueda probar el flujo de punta a punta con el flag encendido — meter un botón
que todavía no puede funcionar dentro de un módulo en uso no aporta y sí arriesga.

### Cómo se prende el día que Meta apruebe

1. En `src/clients/<cliente>/config.js`:

```js
features: { whatsappSignup: true },
meta: {
  appId:             "<app id de Meta>",
  configId:          "<id de la configuración de Embedded Signup>",
  signupCallbackUrl: "https://personal-n8n.suwsiw.easypanel.host/webhook/wa-signup",
},
```

2. Montar `<ConectarWhatsApp T={T} />` dentro de `views/WhatsApp.jsx`,
   gated por `features.whatsappSignup`.

### Decisiones que vale la pena conocer

- **El app secret nunca toca el navegador.** El popup devuelve un `code` de un
  solo uso; el intercambio por token lo hace n8n del lado servidor y de ahí
  llama a `fn_registrar_canal_whatsapp`. Por eso hace falta
  `meta.signupCallbackUrl` y no basta con el frontend.
- **`phone_number_id` y `waba_id` no vienen en el `code`.** Llegan por
  `postMessage` desde el popup (`WA_EMBEDDED_SIGNUP`). La librería escucha ese
  evento y **valida el origin**: sin esa validación cualquier iframe podría
  inyectar un `waba_id` ajeno y secuestrar el alta de un canal.

### Estado de la ruta de la sección 10

| Paso | Estado |
|---|---|
| 1. Crear portafolio propio | ⛔ **Bloqueado** — requiere la cuenta de Facebook de Ivan |
| 2. Verificación del negocio | ⛔ Depende del paso 1 |
| 3-6. App, config, videos, acceso avanzado | 🟡 Código listo; falta la app real |
| 7. Access Verification | ⛔ Depende del paso 2 |
| 8. Enlace de Embedded Signup | 🟡 Meta ya lo ofrece; falta la app |
| 9. Ruteo WABA → cliente | ✅ **Hecho y verificado en producción** |
| 10. Embedded Signup propio | 🟡 Librería lista; falta montar el panel |
