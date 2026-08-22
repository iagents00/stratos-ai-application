# Stratos AI en iOS — Guía de publicación

Rama: `feature/ios-app-capacitor` · Commit: `b6f4c1f`

Decisiones tomadas: **Capacitor** (envuelve la web actual, no es un rewrite) ·
**TestFlight primero** · **una sola app multi-cliente** (Duke, Grupo 28,
TGenius y Vega comparten binario; el tenant se resuelve tras el login).

| Dato | Valor |
|---|---|
| Bundle ID | `com.stratoscapitalgroup.app` |
| Nombre visible | Stratos AI |
| Versión | 1.0 (build 1) |
| iOS mínimo | 15.0 |
| Proyecto Xcode | `ios/App/App.xcodeproj` |

---

## Lo que ya está hecho

- Proyecto Xcode nativo generado (Capacitor 8 + Swift Package Manager).
- 8 plugins nativos enlazados: App, Camera, Haptics, Keyboard, Preferences,
  PushNotifications, SplashScreen, StatusBar.
- Ícono 1024×1024 sin canal alpha + splash 2732×2732, generados desde
  `public/favicon.svg` sobre el fondo `#060A11` de la marca.
- `Info.plist` con permisos de cámara, fotos y Face ID redactados en español
  (App Review rechaza los textos genéricos) y
  `ITSAppUsesNonExemptEncryption=false` para saltar la pregunta de export
  compliance en cada subida.
- Barra de estado configurada para no meterse bajo el Dynamic Island.
- Tres bugs de plataforma corregidos — ver la sección "Por qué no era solo
  envolver" más abajo.

---

## Dónde está la app móvil (auditado 21-ago-2026)

**El código de la app iOS ES el mismo código de la web.** No hay carpeta
`mobile/` ni proyecto aparte: Capacitor toma el bundle que produce
`npm run build` (la carpeta `dist/`) y lo mete dentro del proyecto Xcode.

| Qué | Dónde |
|---|---|
| Interfaz de la app | `src/` — el mismo React de la web |
| Layout móvil | `src/app/App.jsx` → `@media(max-width:768px)` (~línea 968) |
| Barra inferior | `src/app/App.jsx` → `.stratos-bottomnav` (~línea 1352) |
| Estilos solo-nativo | `src/index.css` → bloque `html.stratos-native` |
| Detección de plataforma | `src/lib/native.js` |
| Arranque nativo | `src/lib/native-bootstrap.js` |
| Proyecto Xcode | `ios/App/App.xcodeproj` |
| Bundle copiado al binario | `ios/App/App/public/` (se regenera, no se commitea) |
| Config del contenedor | `capacitor.config.json` |

Para ver cambios de web dentro de la app: `npm run ios:sync`.

### Resultado de la auditoría a 393×852 (iPhone 15/16)

Sano:
- Sin overflow horizontal de página en CRM ni en Comando.
- Las tres tablas de Comando viven en contenedores `overflow-x:auto` — scrollean
  solas, no se cortan columnas.
- Ya existe un diseño móvil real: barra inferior de pestañas, FAB, tarjetas de
  prioridad, header colapsado. No es la vista de escritorio encogida.
- Inputs a 16px (evita el zoom automático de iOS), `touch-action: manipulation`,
  tap highlight de marca.

Corregido en esta pasada:
- La barra inferior no respetaba el indicador de inicio del iPhone: los 34pt
  se comían las etiquetas CRM/Comando/Más. Igual el padding del contenido y el
  desplegable "Más".
- Faltaba apagar la selección de texto en el chrome de la UI: en iOS, dejar el
  dedo sobre un botón sacaba la lupa y el menú "Copiar · Buscar".
- El rebote elástico descubría el fondo del WebView al arrastrar de más.

Pendiente, decisión de diseño:
- **58 de 117 controles quedan por debajo de los 44×44 pt** que recomienda
  Apple; hay varios de 24×24 y 32×32. No es causa de rechazo en App Review,
  pero se sienten incómodos en un teléfono real. Agrandarlos cambia la
  densidad visual del CRM, que es referencia del cliente (`DESIGN_SYSTEM.md`),
  así que se deja como tarea aparte y consensuada. La alternativa sin tocar
  el diseño es ampliar solo el área táctil con un pseudo-elemento, botón por
  botón.

---

## Paso 0 — Actualizar macOS  ⬅️ BLOQUEANTE

**El Xcode actual del App Store exige macOS 26.2 o posterior.** Esta Mac estaba
en **26.1** (build 25B78), así que el botón "Obtener" habría fallado.

Configuración del Sistema → General → Actualización de software →
**macOS Tahoe 26.6.2** (17.38 GB, ~20 min de instalación + reinicio).

Requiere contraseña de administrador, así que lo lanza Ivan a mano.

> **Espacio en disco.** El disco estaba al 88% (25 GB libres) — insuficiente
> para encadenar los 17.38 GB de macOS con los 9.45 GB de Xcode. Se liberaron
> 9 GB de cachés de navegador (Chrome, Brave, Atlas, Claude, Edge) y Homebrew,
> quedando en **34 GB**. Si vuelve a faltar espacio, los cachés se regeneran y
> se pueden volver a borrar; NO borrar
> `~/Library/Application Support/Claude/vm_bundles` (10 GB) porque es la VM de
> Claude Desktop.

## Paso 1 — Instalar Xcode  ⬅️ BLOQUEANTE

App Store → buscar "Xcode" → **Obtener** (9.45 GB de descarga, ~20 GB ya
instalado). Al terminar, ábrelo una vez y acepta la licencia. Después:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Nada más se puede compilar hasta que esto exista.

## Paso 2 — Registrar el Bundle ID

En [developer.apple.com](https://developer.apple.com/account/resources/identifiers/list):

1. Identifiers → **+** → App IDs → App.
2. Description: `Stratos AI`
3. Bundle ID: **Explicit** → `com.stratoscapitalgroup.app`
4. Capabilities: marca **Push Notifications** (aunque todavía no la usemos —
   activarla después obliga a regenerar perfiles).

## Paso 3 — Crear la app en App Store Connect

En [appstoreconnect.apple.com](https://appstoreconnect.apple.com/apps) → **+** →
Nueva app:

- Plataforma: iOS
- Nombre: `Stratos AI`
- Idioma principal: Español (México)
- Bundle ID: el del paso 2
- SKU: `stratos-ai-ios`
- Acceso: Acceso completo

## Paso 4 — Firmar en Xcode

```bash
npm run ios:open
```

En el navegador de proyecto → target **App** → pestaña **Signing & Capabilities**:

1. Marca **Automatically manage signing**.
2. Team: tu equipo de Apple Developer.
3. Verifica que Bundle Identifier diga `com.stratoscapitalgroup.app`.

Si aparece un error de perfil, suele resolverse entrando tu Apple ID en
Xcode → Settings → Accounts.

## Paso 5 — Subir a TestFlight

En Xcode:

1. Selector de destino (arriba, junto al botón ▶) → **Any iOS Device (arm64)**.
   No sirve un simulador: los archives requieren dispositivo.
2. Menú **Product → Archive**. Tarda unos minutos la primera vez.
3. Al terminar se abre el Organizer → **Distribute App** → **TestFlight &
   App Store** → Upload.
4. Procesa en App Store Connect en ~10-15 min. Llega un mail cuando está listo.

## Paso 6 — Repartir a los testers

En App Store Connect → tu app → **TestFlight**:

- **Internal Testing**: hasta 100 personas con rol en tu cuenta. Sin revisión de
  Apple, disponible al instante. Empieza por aquí.
- **External Testing**: hasta 10,000 personas por link público. Requiere una
  revisión ligera de Apple (1-2 días). Es lo que usarás con Duke y los clientes.

Los testers instalan la app **TestFlight** desde el App Store y entran con el
link o la invitación por mail.

---

## Ciclo de desarrollo diario

Cada vez que cambies código web y quieras verlo en el iPhone:

```bash
npm run ios:sync
```

Eso compila Vite y copia el bundle al proyecto nativo. Después le das ▶ en
Xcode. Solo necesitas volver a `Archive` cuando quieras un build nuevo en
TestFlight — y en ese caso **sube `CURRENT_PROJECT_VERSION`** (el build number)
en Xcode, porque App Store Connect rechaza builds con número repetido.

---

## Por qué no era solo envolver la web

Tres cosas habrían roto la app nativa el primer día:

1. **La landing en vez del CRM.** Capacitor sirve el bundle desde
   `capacitor://localhost`, o sea `hostname === "localhost"`. La heurística de
   `main.jsx` trata eso como entorno de desarrollo y muestra la página de
   marketing. La app del App Store habría abierto la página de ventas.
2. **Reloads en loop.** El Service Worker se registraba bajo `capacitor://` e
   interceptaba requests que nunca pasan por red; su `controllerchange`
   disparaba `window.location.reload()` sin parar.
3. **Pantalla en blanco al entrar un cliente que no fuera Duke.**
   `ClientOrgGuard` hacía `location.replace()` a `/grupo28` — en nativo eso es
   `capacitor://localhost/grupo28`, un 404 sin servidor que rutee. Ahora el
   tenant se aplica en memoria desde `user.organizationId`.

También faltaban dos módulos que `components.jsx` y `AdvisorMetrics.jsx` ya
importaban pero nunca se escribieron (`constants/pipeline.js` y
`constants/labels.js`): el `npm run build` estaba roto en el árbol de trabajo
antes de empezar. Quedaron creados con el vocabulario y pipeline de Duke como
default, así que Duke no cambia y Vega hereda lo que declara en su config.

**No se tocó nada de auth.** La sesión de Supabase sigue en localStorage con la
config exacta de ZONA CRÍTICA en `CLAUDE.md`. En WKWebView con contenido servido
por la app, localStorage persiste igual que en web; meter un storage adapter
nativo solo habría reabierto el bug de "Conectando con el servidor…".

---

## Antes de publicar en el App Store público

TestFlight no lo exige, pero la revisión pública sí. En orden de riesgo:

1. **Guideline 4.2 — Minimum Functionality.** Apple rechaza apps que son un
   WebView apuntando a un sitio. Necesita valor nativo real. Lo más barato con
   lo ya instalado: **push de leads nuevos** (el plugin ya está enlazado, falta
   la key de APNs y el envío desde n8n), **Face ID** para entrar sin escribir
   contraseña, y **cámara nativa** para el expediente.
2. **Guideline 5.1.1(v) — Borrado de cuenta.** Como la app crea cuentas, tiene
   que poder borrarlas *desde dentro*. Ya existe `/eliminar-mis-datos` en web;
   hay que exponerlo como pantalla del perfil, no como link externo.
3. **Privacy Nutrition Label** en App Store Connect: declarar que se recogen
   nombre, email, teléfono y datos de uso, vinculados a la identidad del
   usuario.
4. **Capturas de pantalla** 6.7" y 6.5" y descripción en español.

---

*Creado Agosto 2026 — Capacitor 8, Xcode SPM, sin CocoaPods.*
