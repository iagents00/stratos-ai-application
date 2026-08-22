# Stratos AI — App móvil (Android + iOS)

> **Qué es:** el shell NATIVO (Capacitor) de la app "Stratos AI". No duplica el
> CRM: el WebView carga **https://app.stratoscapitalgroup.com** directamente
> (`capacitor.config.json → server.url`). Por eso **toda actualización del CRM
> web llega SOLA a la app** — mergeás un PR del CRM, Vercel despliega, y la app
> ya lo muestra. **No hay que recompilar el APK para features del CRM.**

## Cuándo SÍ hay que tocar esta carpeta (y recompilar)

Solo para cambios NATIVOS:
- Ícono / splash / nombre de la app.
- Permisos nuevos (micrófono, cámara ya están; ubicación, etc. se agregan acá).
- Plugins nativos (push notifications = V2, Firebase).
- Dominios permitidos (`allowNavigation` en `capacitor.config.json`).
- Subir `versionCode`/`versionName` (android/app/build.gradle) para releases.

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

## iOS — subir a TestFlight

La cuenta **Apple Developer ya está pagada y aprobada** (ago-2026), así que el
bloqueo que decía esta sección quedó resuelto. Datos del binario:

| Dato | Valor |
|---|---|
| Bundle ID | `com.stratoscapitalgroup.crm` |
| Nombre visible | Stratos CRM AI |
| Versión | 1.0 (build 1) |
| Proyecto | `mobile/ios/App/App.xcodeproj` |

### Requisitos de la Mac  ⬅️ LO ÚNICO QUE FALTA

1. **macOS 26.2 o posterior.** El Xcode actual del App Store lo exige; una Mac
   en 26.1 verá "Obtener" pero la instalación falla. Ajustes → General →
   Actualización de software.
2. **Xcode** (9.45 GB de descarga, ~20 GB instalado). Después:
   `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
3. Espacio libre: encadenar la actualización de macOS (17.38 GB) con Xcode pide
   ~35 GB. Los cachés de navegador (`~/Library/Caches/Google`, `BraveSoftware`)
   son lo primero que conviene liberar; se regeneran solos.

### Pasos

1. Registrar el Bundle ID en
   [developer.apple.com](https://developer.apple.com/account/resources/identifiers/list)
   → Identifiers → **+** → App IDs → Explicit → `com.stratoscapitalgroup.crm`.
2. Crear la app en [App Store Connect](https://appstoreconnect.apple.com/apps)
   → **+** → iOS → nombre "Stratos AI" → idioma Español (México) → ese Bundle ID.
3. `cd mobile && npm ci && npx cap open ios`
4. Target **App** → Signing & Capabilities → *Automatically manage signing* →
   elegir el Team.
5. Destino **Any iOS Device (arm64)** → Product → **Archive** → Distribute App
   → TestFlight & App Store → Upload.
6. App Store Connect → TestFlight. *Internal Testing* es inmediato (hasta 100
   personas con rol en la cuenta); *External Testing* pasa por una revisión
   ligera de Apple y sirve para Duke y los clientes.

Para builds nuevos: subir `CURRENT_PROJECT_VERSION` en Xcode, porque App Store
Connect rechaza dos builds con el mismo número.

### ⚠️ Antes de publicar en el App Store PÚBLICO

TestFlight no lo exige, pero la revisión pública sí, y este shell es
precisamente el caso que Apple más rechaza:

- **Guideline 4.2 / 4.7 — Minimum Functionality.** `server.url` apunta a
  `https://app.stratoscapitalgroup.com`: para Apple esto es "un sitio web
  dentro de un WebView", el motivo de rechazo nº1 de este tipo de app. Los
  plugins nativos que ya hay (notificaciones locales, compartir PDF) ayudan
  pero no alcanzan solos. Lo que más pesa a favor: **push notifications
  reales** de leads nuevos (hoy son locales, no push), Face ID para entrar, y
  cámara nativa en el expediente.
- **Guideline 5.1.1(v) — borrado de cuenta.** La app crea cuentas, así que
  Apple exige poder borrarlas *desde dentro*. Existe `/eliminar-mis-datos` en
  la web, pero es una página informativa: hay que exponer un flujo real en el
  perfil.
- **Privacy Nutrition Label** en App Store Connect: declarar nombre, email,
  teléfono y datos de uso, vinculados a la identidad.
- Capturas 6.7" y 6.5" y descripción en español.

Para distribución interna a empresas cliente, **Custom Apps** vía Apple
Business Manager tiene una revisión menos estricta que el App Store público.

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
