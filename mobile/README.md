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

## iOS (preparado, pendiente de cuenta Apple)

El proyecto `ios/` está listo (permisos declarados en Info.plist). Para
compilarlo hace falta: (1) **cuenta Apple Developer** (USD $99/año — lado
Iván), (2) una Mac con Xcode: `npx cap open ios` → firmar con el team →
TestFlight. La app es la misma (carga la misma URL).

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
