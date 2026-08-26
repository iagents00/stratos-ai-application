# Que los avisos lleguen al teléfono con la app cerrada

> Guía corta y honesta. Al final hay **dos trámites** que solo se pueden hacer
> desde la cuenta de Apple y la de Google — son gratis, de unos minutos cada
> uno, y sin ellos el teléfono no puede recibir nada de afuera. Todo lo demás
> ya está construido y funcionando.

---

## Por qué en la computadora sí y en la app no

En la computadora las notificaciones se ven perfectas. Dentro de la app
instalada no llegaba ninguna. No era un error: **era un canal que no existía.**

Un aviso llega a una pantalla por uno de tres caminos, y cada uno es un sistema
distinto:

| Dónde | Cómo llega | Estado |
|---|---|---|
| Navegador y acceso directo en la pantalla de inicio | Web Push | Funciona desde siempre |
| iPhone (app instalada) | APNs, el cartero de Apple | Construido — falta la llave |
| Android (app instalada) | FCM, el cartero de Google | Construido — falta la llave |

El servidor que manda los avisos (`send-push`) hablaba **solo el primer
idioma**. Ahora habla los tres. Lo que falta es la credencial que cada empresa
exige para dejarte usar su cartero.

**No se puede evitar.** No es una decisión de diseño: Apple y Google no
permiten que una app reciba avisos con la pantalla apagada por ningún otro
medio. Ni la app ni el servidor pueden esquivarlo.

---

## Lo que ya funciona sin ningún trámite

Los **recordatorios** con hora conocida se dejan agendados en el propio
teléfono al abrir la app. Suenan con la app cerrada, y también **sin internet**
— algo que un aviso enviado desde el servidor nunca puede lograr.

Eso cubre todo lo que se pide con antelación: *«recordame en dos minutos sacar
la basura»*, un Zoom, una visita, una acción con un cliente.

Lo que **no** cubre, porque pasa sin aviso previo: que alguien te llame, que
entre un lead, que llegue un mensaje de WhatsApp. Para eso hacen falta los dos
trámites de abajo.

---

## Trámite 1 — iPhone: la llave de Apple (5 minutos)

Es un archivo `.p8`. **Se descarga una sola vez y Apple no lo deja descargar de
nuevo**, así que hay que guardarlo bien apenas se baje.

1. Entrar a <https://appstoreconnect.apple.com> → arriba a la derecha,
   **Usuarios y acceso**.
2. Pestaña **Integraciones** → en la lista de la izquierda,
   **Apple Push Notifications service (APNs)**.
3. Botón **+** → nombre: `Stratos Push` → **Continuar** → **Generar**.
4. **Descargar** el archivo. Se llama algo como `AuthKey_AB12CD34EF.p8`.
   Esos 10 caracteres del nombre son el **Key ID**: anotarlos.

## Trámite 2 — Android: el proyecto de Google (10 minutos)

Android entrega los avisos a través del servicio de mensajería de Google
(Firebase Cloud Messaging). Hay que crear un proyecto **nuevo y propio de
Stratos** — no se comparte ni se mezcla con nada más, y no guarda datos de
clientes: solo transporta avisos.

1. Entrar a <https://console.firebase.google.com> → **Crear un proyecto**.
   Nombre: `Stratos AI`. **Desactivar** Google Analytics (no hace falta).
2. Dentro del proyecto, tocar el ícono de **Android** para agregar una app.
   - Nombre del paquete, **exacto**: `com.stratoscapitalgroup.crm`
   - Apodo: `Stratos AI`
3. **Descargar `google-services.json`** y saltear el resto de los pasos
   («Siguiente» hasta salir): la parte de código ya está hecha.
4. Rueda dentada → **Configuración del proyecto** → pestaña **Cuentas de
   servicio** → **Generar nueva clave privada** → descarga un `.json`.
   Ese segundo archivo es el que usa el servidor para mandar.

---

## Dónde va cada cosa

⚠️ **Ninguno de estos archivos se pega en un chat ni se sube al repositorio**
(que es público). Van directo del archivo al panel donde corresponde.

### En Supabase — para que el servidor pueda mandar

Panel de Supabase → proyecto **stratos-prod** → **Edge Functions** →
**Secrets**. Se agregan estos:

| Nombre | Qué se pega |
|---|---|
| `APNS_KEY_P8` | El contenido completo del `.p8`, abierto con el Bloc de notas |
| `APNS_KEY_ID` | Los 10 caracteres del nombre del archivo |
| `APNS_TEAM_ID` | `5683F2CFT6` |
| `FCM_SERVICE_ACCOUNT` | El contenido completo del `.json` de la cuenta de servicio |

### En GitHub — para que el APK de Android sepa recibir

Repositorio → **Settings** → **Secrets and variables** → **Actions** → **New
repository secret**:

| Nombre | Qué se pega |
|---|---|
| `GOOGLE_SERVICES_JSON` | El contenido completo del `google-services.json` |

Con ese secreto cargado, el próximo APK que se compile ya trae Firebase adentro
y registra el teléfono solo. **Sin él, el APK se compila igual** — simplemente
no recibe avisos con la app cerrada, y el registro de la corrida lo avisa.

---

## Cómo saber si quedó bien

El servidor **dice** qué pasó con cada canal. Al mandar un aviso, la respuesta
trae un desglose:

```json
{ "sent": 3, "telefono": { "enviados": 2, "fallidos": 0 } }
```

Si falta una credencial, no se queda callado — lo escribe:

```json
{ "telefono": { "enviados": 0, "notas": ["apns: faltan credenciales — 1 iPhone(s) sin avisar"] } }
```

Eso es a propósito. La causa de que esto estuviera roto tanto tiempo fue
justamente que **nadie decía nada**: no había error, no había registro, y el
aviso simplemente no aparecía.

Para ver los teléfonos registrados:

```sql
select platform, entorno, count(*) from device_tokens group by 1, 2;
```

Si esa consulta da cero después de abrir la app y aceptar el permiso, el
problema está en el registro del teléfono, no en el envío.

---

## Detalles que cuestan horas si no se saben

- **El entorno de Apple.** Un token sacado con la app compilada desde Xcode
  vive en el *sandbox*; el servidor de producción lo rechaza con
  `BadDeviceToken`. Por eso `device_tokens` guarda de qué entorno vino cada uno
  y el envío elige el servidor correcto. Verificado el 25-ago-2026: el binario
  que sube a TestFlight sale firmado con `aps-environment: production`, aunque
  el archivo de configuración del proyecto diga `development` — Xcode lo
  sustituye al firmar con el perfil de distribución.

- **Los canales de Android se crean una sola vez.** Android deja que el usuario
  sea el dueño de los ajustes de un canal, así que cambiar el sonido o la
  importancia de un canal ya existente **no tiene efecto**. Si hay que
  cambiarlos, se crea un canal con otro nombre. Los ids viven en
  `src/lib/avisos-nativos.js` y tienen que coincidir exactos con los que usa el
  servidor en `canales-nativos.ts`.

- **Registrar push en Android sin el archivo de Google cierra la app.** No es
  una excepción que se pueda atrapar desde JavaScript: revienta del lado
  nativo. Por eso el interruptor es de compilación (`VITE_ANDROID_PUSH`) y no
  de tiempo de ejecución — para cuando falla, la app ya se cerró.

- **Un ícono que no existe deja el aviso en blanco.** Nombrar un dibujo que no
  está en el proyecto no falla al compilar: falla al mostrarse, en silencio.
