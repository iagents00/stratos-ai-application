# Stratos AI — App móvil (Android + iOS)

> **Qué es:** el shell NATIVO (Capacitor) de la app "Stratos AI". El WebView
> **empaqueta el CRM dentro del binario** (`capacitor.config.json → webDir:
> "../dist"`) y lo sirve desde `capacitor://localhost`.
>
> **Por qué empaquetado y no remoto.** Hasta agosto 2026 esto usaba
> `server.url` apuntando al sitio en vivo. Se cambió por dos razones:
> 1. **Sin señal la app no abría.** Desde iOS 14, WKWebView solo permite Service
>    Workers si la app declara `WKAppBoundDomains`, y no lo hacía: no había nada
>    de offline. Un asesor sin señal en una propiedad veía "no se pudo cargar".
> 2. **Guideline 4.2.** Para Apple, un `server.url` apuntando a un sitio web es
>    "una web dentro de un WebView", el motivo de rechazo nº1 de este tipo de app.
>
> Los **datos** (leads, métricas, pipeline) siguen viniendo en vivo de Supabase.
> Lo único que se congela hasta el próximo release es el código de la interfaz.
>
> **El sitio web NO va dentro del binario.** `npm run build:app` excluye la
> landing de marketing, la política de privacidad, los siete manuales de cliente
> y 1.5 MB de estáticos del sitio: **6.7 MB → 4.5 MB**. La app solo lleva el
> login y el CRM. Además de peso, importa porque Apple revisa el contenido del
> paquete: un sitio de marketing ahí adentro refuerza justo la lectura de "web
> enlatada" que hay que evitar.
>
> El módulo **Planes** también se oculta en la app: muestra precios de
> suscripción y un botón de pago que hoy ni cobra. Apple exige In-App Purchase
> para bienes digitales, así que dejarlo visible es rechazo seguro.

## Cuándo hay que recompilar

Ahora que el CRM va empaquetado, **cualquier cambio de la interfaz necesita un
release nuevo**. También los cambios NATIVOS:
- Ícono / splash / nombre de la app.
- Permisos nuevos (micrófono, cámara ya están; ubicación, etc. se agregan acá).
- Plugins nativos (push notifications = V2, Firebase).
- Dominios permitidos (`allowNavigation` en `capacitor.config.json`).
- Subir la version para un release. **Se sube en los DOS lados o no se sube:**
  - Android: `mobile/android/app/build.gradle` -> `versionCode` (+1) y `versionName`.
  - iPhone: `mobile/ios/App/App.xcodeproj/project.pbxproj` -> `MARKETING_VERSION`,
    que aparece **DOS veces** (bloque Debug y bloque Release). Mismo valor que el
    `versionName` de Android, para que las dos apps se puedan comparar de un vistazo.
  El **numero de compilacion** del iPhone NO se toca: lo pone solo el contador de
  corridas de GitHub (`CURRENT_PROJECT_VERSION=${{ github.run_number }}`).

  > ⚠️ **Por que esto esta escrito aca (28-ago-2026).** El numero visible del iPhone
  > **nunca estuvo guardado en el proyecto**: decia `1.0` desde el origen, y el `1.2.3`
  > que se veia en TestFlight lo tecleaba una persona a mano en el campo
  > `marketing_version` del workflow, que solo se aplica si viene lleno. Cuando el
  > workflow paso a dispararse solo, ya no habia nadie tecleando y la app **retrocedio
  > a 1.0**. Como App Store Connect ordena por ese numero y no por fecha, las entregas
  > nuevas aparecieron **al fondo** de la lista y se creyo que los arreglos no se habian
  > subido. Un dato que solo existe cuando un humano lo teclea, no existe.

## Cómo se compila el APK (automático)

Cada push a `main` que toque `mobile/**` dispara **GitHub Actions**
(`.github/workflows/android-apk.yml`) → publica el APK en el release
**`android-latest`** del repo:

**Descargar:** GitHub → Releases → "App Android (última)" → `stratos-ai.apk`
→ pasarlo al teléfono (WhatsApp/USB/link) → abrir → instalar (aceptar
"orígenes desconocidos" la primera vez). Instala ENCIMA de versiones
anteriores sin desinstalar (firma consistente).

También se puede correr a mano: Actions → "Android APK (Stratos AI móvil)" →
Run workflow.

## Push de lead nuevo

Es la razón de peso para que la app exista: entra un lead de Meta Ads y el
teléfono del asesor suena en segundos. En bienes raíces la velocidad de primer
contacto decide la conversión.

### Por qué no alcanzaba con lo que ya había

- `src/lib/push.js` implementa **Web Push** (VAPID + `push_subscriptions`).
  Funciona en navegador y en la PWA instalada, pero necesita un Service Worker,
  y WKWebView solo los permite si la app declara `WKAppBoundDomains`. Dentro de
  la app nativa, Web Push **no funciona ni va a funcionar**.
- `notifyUser()` en `src/lib/native.js` son notificaciones **locales**: las
  dispara React al cambiar el estado, así que solo aparecen con la app ABIERTA.
  Un lead que entra a las 11pm no despierta a nadie.

`src/lib/push-native.js` cubre el hueco con APNs, que sí llega con la app cerrada.

### Lo que ya está hecho

- Plugin `@capacitor/push-notifications` instalado y enlazado en el proyecto iOS.
- `App.entitlements` con `aps-environment`, referenciado en Debug y Release.
- Registro cableado a la sesión: arranca tras el login y borra el token al
  cerrar sesión (si no, el teléfono seguiría recibiendo los leads del anterior).
- Tabla `device_tokens` con RLS — migración `232_push_nativo_device_tokens.sql`,
  **ya aplicada en producción** (23-ago-2026). Verificado: RLS activo, una
  política por usuario, y `anon` sin acceso — un token filtrado permitiría
  mandarle notificaciones al teléfono de un asesor.

### Lo que falta, y necesita la cuenta de Apple

1. **Key de APNs (.p8).** developer.apple.com → Keys → **+** → marcar *Apple Push
   Notifications service*. Se descarga **una sola vez**: guardarla.
2. **Quién envía.** Cuando n8n registra un lead, tiene que llamar a APNs con esa
   key (JWT ES256) y el token del asesor sacado de `device_tokens`. Lo más
   simple es una Edge Function de Supabase que reciba `{ user_id, title, body }`
   y n8n la invoque, reusando el patrón de `send-push`.

Payload de ejemplo — `view` decide a qué pantalla salta la app al tocarla:

```json
{
  "aps": { "alert": { "title": "Lead nuevo · Duke", "body": "Marco Aurelio — $1.5M USD" }, "sound": "default" },
  "view": "c",
  "leadId": "12345"
}
```

> **El entorno importa.** Un token sacado con la app compilada desde Xcode vive
> en el **sandbox** de APNs y el servidor de producción lo rechaza con
> `BadDeviceToken`. Por eso `device_tokens` guarda de qué entorno vino cada uno.

### Qué se verificó y qué no

| | |
|---|---|
| Plugin enlazado en el proyecto iOS | ✅ 4 plugins encontrados |
| `App.entitlements` válido y referenciado | ✅ en Debug y Release |
| Compilación con push | ✅ `BUILD SUCCEEDED` |
| `simctl push` entrega al bundle | ✅ sin error |
| Ícono de la app | ✅ el rayo de Stratos, ya no el de Capacitor |
| **Diálogo de permiso y banner** | ⚠️ **sin verificar** — requiere tocar la pantalla del simulador |
| **Entrega real por APNs** | ⚠️ **sin verificar** — requiere la key .p8 |

---

## iOS — subir a TestFlight (desde GitHub Actions, sin Xcode local)

La cuenta **Apple Developer ya está pagada y aprobada** (ago-2026). El release
sale del workflow `.github/workflows/ios-testflight.yml`: los runners macOS de
GitHub ya traen Xcode, así que **no hace falta instalarlo en ninguna Mac** (son
9.45 GB de descarga y ~20 GB en disco) ni depender de quién tenga la Mac.

| Dato | Valor |
|---|---|
| Bundle ID | `com.stratoscapitalgroup.crm` |
| Nombre visible | Stratos CRM AI |
| Proyecto | `mobile/ios/App/App.xcodeproj` |
| Scheme | `App` (compartido y commiteado, si no el CI no lo encuentra) |
| Nº de build | `github.run_number` — siempre sube, nunca lo rechazan por repetido |

### Preparación, una sola vez (~10 min, todo en el navegador)

1. **Registrar el Bundle ID** en
   [developer.apple.com](https://developer.apple.com/account/resources/identifiers/list)
   → Identifiers → **+** → App IDs → App → Explicit → `com.stratoscapitalgroup.crm`.
2. **Crear la app** en [App Store Connect](https://appstoreconnect.apple.com/apps)
   → **+** → iOS → nombre "Stratos AI" → idioma Español (México) → ese Bundle ID
   → SKU `stratos-ai-ios`.
3. **Crear una API key**: App Store Connect → Users and Access → Integrations →
   App Store Connect API → **+**. Rol **App Manager** (con menos, el upload se
   rechaza). Descargar el `.p8` — Apple solo lo deja bajar **una vez**.
4. **Cargar 4 secrets** en GitHub → Settings → Secrets and variables → Actions:

   | Secret | De dónde sale |
   |---|---|
   | `APPLE_TEAM_ID` | developer.apple.com → Membership details |
   | `APPSTORE_ISSUER_ID` | El UUID arriba de la tabla de API keys |
   | `APPSTORE_KEY_ID` | La columna KEY ID de esa tabla |
   | `APPSTORE_PRIVATE_KEY` | Contenido completo del `.p8`, con las líneas BEGIN/END |

### Cada release

GitHub → Actions → **iOS TestFlight (Stratos AI móvil)** → Run workflow.
Opcionalmente se escribe la versión visible (ej. `1.0.1`); si se deja vacío usa
la del proyecto. Tarda ~20 min y App Store Connect procesa otros ~10-15.

El workflow **valida el `.ipa` antes de subirlo** (`altool --validate-app`), así
que si algo está mal falla con un mensaje claro en vez de a mitad del upload.
El `.ipa` queda como artifact de la corrida por 30 días.

### Repartir a los testers

App Store Connect → TestFlight:
- **Internal Testing**: hasta 100 personas con rol en la cuenta, sin revisión de
  Apple, disponible al instante. Empezar por acá.
- **External Testing**: hasta 10,000 por link público; pasa una revisión ligera
  de Apple (1-2 días). Es lo que se usa con Duke y los clientes.

Los testers instalan la app **TestFlight** del App Store y entran con el link.

### Si preferís compilar desde una Mac

Hace falta **macOS 26.2+** y Xcode instalado. Después:
`cd mobile && npm ci && npx cap open ios` → Signing & Capabilities → elegir el
Team → destino **Any iOS Device (arm64)** → Product → Archive → Distribute App.

### ⚠️ Antes de publicar en el App Store PÚBLICO

TestFlight no lo exige, pero la revisión pública sí, y este shell es justo el
caso que Apple más rechaza:

- **Guideline 4.2 / 4.7 — Minimum Functionality.** `server.url` apunta a
  `https://app.stratoscapitalgroup.com`: para Apple eso es "un sitio web dentro
  de un WebView", el motivo de rechazo nº1 de este tipo de app. Los plugins
  nativos que ya hay (notificaciones locales, compartir PDF) ayudan pero no
  alcanzan solos. Lo que más pesa a favor: **push notifications reales** de
  leads nuevos, Face ID para entrar, y cámara nativa en el expediente.
- **Guideline 5.1.1(v) — borrado de cuenta.** La app crea cuentas, así que hay
  que poder borrarlas *desde dentro*. Existe `/eliminar-mis-datos` en la web,
  pero es informativa: falta un flujo real en el perfil.
- **Privacy Nutrition Label**: declarar nombre, email, teléfono y datos de uso,
  vinculados a la identidad.
- Capturas 6.7" y 6.5" y descripción en español.

Para distribución interna a empresas cliente, **Custom Apps** vía Apple Business
Manager tiene una revisión menos estricta que el App Store público.

## Firma (⚠️ leer antes de publicar en tiendas)

`android/app/testing.keystore` es un keystore **de pruebas commiteado a
propósito** (repo privado): da firma consistente al APK interno para que las
actualizaciones instalen encima. **NO publica nada por sí solo.** Antes de
subir a Google Play: generar un keystore REAL privado (secret de GitHub) y
reemplazar el signingConfig — está anotado en el build.gradle.

## Desarrollo local

```bash
cd mobile
npm ci
npx cap sync android     # sincroniza config → proyectos nativos
# compilar requiere Android SDK local (o dejar que lo haga el CI)
```

Skill del proyecto en el AIOS: `skills/stratos-mobile-app` (leerla antes de tocar).
