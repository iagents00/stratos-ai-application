# Empezar aquí

Este archivo es para quien retoma el proyecto. Dice qué está vivo, qué falta, y
qué se puede tocar sin romper nada.

Última actualización: **23 de agosto de 2026** · Service Worker en **v410**

---

## Lo primero: el proyecto está en producción, con gente adentro

No es un prototipo. Ahora mismo lo usan:

- El equipo de ventas de **Duke del Caribe** (~20 asesores, 2,500 clientes en el CRM)
- **NSG**, **Grupo 28**, **Vega**, **TGenius** como clientes white-label

Cualquier cosa que se merge a `main` se despliega solo a
`app.stratoscapitalgroup.com` en unos 2 minutos. No hay staging. Eso significa
que el chequeo se hace antes de mergear, no después.

> El README dice cosas que ya no son ciertas sobre auth y base de datos.
> **CLAUDE.md** es la fuente confiable, y este archivo lo complementa.

---

## Arranque en 5 minutos

```bash
npm install
npm run dev          # → http://localhost:5173/?app
```

Para entrar sin cuenta: botón **"Entrar como Demo"** en el login. Trae datos
falsos y no toca producción.

Antes de abrir cualquier PR:

```bash
npm run verificar-docs          # ninguna doc apunta a un archivo que no existe
npm run verificar-contexto      # la config por cliente llega a los componentes
npm run verificar-rails         # prender/apagar/personalizar Rails funciona (19 pruebas)
npm run verificar-lenguaje      # la interfaz habla mexicano neutro, nunca voseo
npm run verificar-migraciones   # las migraciones se leen en orden
```

Los cinco corren solos en cada PR. **Si uno falla, no es burocracia: cada uno
existe porque ya se rompió algo de verdad por eso.** El de contexto nació de un
bug que apagó toda la personalización por cliente durante días sin un solo error
en consola.

Para encontrar dónde vive algo:

```bash
npm run buscar "lo que sea"     # busca en el mapa del código
```

`MAPA.md` y `PLANO.md` se **generan** — no se editan a mano, se regeneran con
`npm run planos`.

---

## Montar el proyecto en otra computadora

Lo que necesitas instalar:

| | Para qué |
|---|---|
| **Node 22** | correr el proyecto |
| **git** y **gh** (`gh auth login`) | clonar, abrir PRs, disparar el flujo de TestFlight |
| **Xcode 26+** | solo si vas a tocar la app móvil |
| **Supabase CLI** | opcional, solo para consultas de lectura |

```bash
gh repo clone iagents00/stratos-ai-application
cd stratos-ai-application
npm install
npm run dev
```

**No hace falta configurar credenciales para empezar.** El cliente de Supabase
trae valores de respaldo y el login tiene botón de Demo, así que la app levanta
sin pedirte llaves. Para trabajar contra datos reales hace falta una cuenta del
CRM, que la crea un admin.

### Lo que NO viaja con la cuenta

Si retomas el proyecto en otra máquina, esto se queda atrás:

- **La memoria de las sesiones anteriores.** Vive en `~/.claude/` de cada
  computadora, no en la nube. Por eso el conocimiento que importa está en este
  repo —`CLAUDE.md`, este archivo, `MAPA.md`— y no en la cabeza de una sesión:
  ahí sí viaja, y además queda versionado y revisable.
- **La sesión de `gh`, la del CLI de Supabase y la de Xcode.** Cada una se
  autentica en cada máquina.

Lo que sí viaja con el repo: `.claude/settings.json`, `.claude/launch.json` y
las skills de `.claude/skills/`.

### Este repositorio es PÚBLICO

Cualquiera en internet puede leer el código. Eso no es un accidente que haya que
corregir a las carreras —la seguridad del sistema está en la RLS de Supabase y en
los secretos de GitHub, no en que el código sea secreto— pero **cambia lo que se
puede escribir aquí**:

- Nunca una llave, un token, un `.p8`, ni el ID de una credencial.
- Nunca datos de clientes reales: ni nombres, ni teléfonos, ni correos.
- La llave `anon` de Supabase sí está en el código, y está bien: va en el bundle
  del navegador de todos modos, y sin RLS correcta no serviría de nada tenerla
  escondida.

Si algún día se decide hacerlo privado, ojo con lo que depende de él (despliegues
e integraciones) antes de cambiar la visibilidad.

## Cómo se trabaja aquí

```bash
git worktree add ../rama-nueva -b feat/lo-que-sea origin/main
```

**Siempre desde `origin/main`, nunca desde el árbol local.** El árbol local de
Iván tiene archivos sin commitear que no van al repo; partir de ahí ya provocó
que se descartara medio día de trabajo.

Al terminar:

1. Bumpea `CACHE_VERSION` en `public/sw.js` (`v410` → `v411`). **Sin esto, los
   navegadores con el service worker viejo siguen sirviendo el bundle anterior**
   y parece que tu cambio no se desplegó.
2. `npm run build` y los cinco `verificar-*`.
3. PR → merge → verifica el deploy real:
   ```bash
   npm run salud
   ```
   Te dice qué versión está sirviendo de verdad. Si no es la tuya, todavía no
   llegó: espera y vuelve a correrlo.

---

## Lo que está pendiente

### Solo Iván puede hacerlo

| Qué | Dónde | Por qué no lo puede hacer un dev |
|---|---|---|
| **Pagar la factura de Supabase** | Dashboard → Billing | Queda pagada el **martes 25 de agosto por la tarde**. Mientras tanto producción sigue en pie: lo verifiqué contra la base — lectura y escritura, 2 515 clientes, gente registrando leads esta madrugada. No está restringida. |
| **Aplicar `237_post_zoom_protocol.sql`** | SQL editor del dashboard | Escritura a producción. **No corre prisa**: comprobé que ninguna de sus seis funciones existe todavía en la base, y que la app desplegada no llama a ninguna. No hay nada roto esperándola; aplica limpio cuando se quiera. |
| **Cargar `APPSTORE_PRIVATE_KEY`** | GitHub → Settings → Secrets | Es el `.p8` de la llave de API. Una llave privada la maneja solo su dueño. Se descarga una única vez. |
| **Prender Stratos Rails** | Dentro de la app: Menú → Proceso | Le reordena la pantalla a los 20 asesores |

---

## Plan de arranque para un dev que entra hoy

Nada de esto depende de la factura de Supabase ni de Apple. Está ordenado por
valor, no por dificultad.

### Primera hora — montar y mirar

1. Clona, `npm install`, `npm run dev`. Entra con el botón de Demo.
2. **`npm run salud`** — te dice en dos segundos si producción está viva y con
   qué versión. Córrelo antes de sospechar de tu código: la mitad de los "no
   funciona" son que estás viendo un despliegue viejo.
3. `npm run buscar <lo que sea>` y una pasada a `MAPA.md`. No leas el código
   completo; aprende a encontrarlo.

### Lo primero que vale la pena

**1 · Triar los PRs abiertos.** Hay once, el más viejo de abril. Siete ya tienen
conflicto, o sea que nadie los va a mergear tal cual — pero siguen ahí
sugiriendo que hay trabajo pendiente que en realidad no existe.

Un veredicto ya está hecho, como muestra del método: el
[#221](https://github.com/iagents00/stratos-ai-application/pull/221) dice
*"HOTFIX: corrige crash en producción"* y lleva dos meses abierto. Da miedo. No
lo es: arreglaba que `accent` se usara antes de declararse en
`ComandoDirectivo.jsx`, y ese archivo se reescribió desde entonces —hoy `T` se
resuelve en la línea 251 y `accent` en la 252, antes de cualquier uso. **El bug
ya no existe; el PR se cierra.**

Lo mismo para los otros diez: abrir, ver si lo que arreglaban sigue roto,
cerrar o rescatar. Es la forma más rápida de aprender el código y deja el
tablero diciendo la verdad.

**2 · Terminar el chequeo de permisos de RPC.** `npm run verificar-rpc` revisa
la mitad que se puede ver desde el repo y te lo dice: *falta la otra mitad,
contra la base*. Esa mitad es una consulta:

```sql
select * from fn_qa_rpc_del_front() where estado <> 'OK';
```

Existe porque una función nueva nace ejecutable por la llave `anon` pública, y
eso ya rompió el historial del Copiloto una vez. Correrla y dejar dicho qué
salió cierra el hueco.

**3 · Auditar un módulo con el método que ha funcionado.** Abrir la pantalla,
hacer el flujo completo, y comprobar **el resultado** —la ficha del cliente, la
fila en la base—, no que el botón "hizo algo". Así salieron todos los bugs de
esta semana, incluido uno donde la tarjeta desaparecía de la pantalla y no
guardaba nada.

### Si sobra tiempo

- **Conectar un procesador de pagos.** Hoy la pantalla de Planes lleva a hablar
  con un ejecutivo. Si se decide cobrar en línea, el lugar exacto es
  `ContratarModal` en `src/landing/PricingScreen.jsx`.
- Las mejoras de performance listadas en `CLAUDE.md`, si algo se siente lento.
  **No antes** — la app va fluida hoy, y ya hubo una falsa alarma de lentitud
  que costó tiempo.

---

## Detalles de esta semana que ahorran tiempo

### Stratos Rails (el proceso diario guiado)

Está terminado y verificado en producción, pero **apagado**. Dos llaves
distintas, a propósito:

- `features.procesoGuiado` en la config del cliente → *¿esta empresa PUEDE
  tenerlo?* (vive en el bundle)
- `organizations.meta_config.rails.activo` → *¿está prendido hoy?* (vive en la
  base, se cambia desde Menú → Proceso, sin deploy)

Para verlo sin prendérselo a nadie:

```
https://app.stratoscapitalgroup.com/?rails=1
```

`?rails=0` lo apaga aunque la bandera esté prendida — sirve de escape.

**La regla que no se rompe:** la lista del día congela orden y membresía al
montar. Solo pueden agregarse clientes al final, y el que acabas de registrar va
primero. Nada se mueve solo bajo el asesor. Ver
`src/app/views/MiDia.jsx` y `src/lib/next-action-engine.js`.

### Lo de Apple que ya está hecho (24-ago-2026)

| | |
|---|---|
| Contrato del Developer Program | **Aceptado** (la versión nueva, con plazo al 1-oct) |
| Acceso a la API de App Store Connect | **Aprobado** — la solicitud se aprobó al instante |
| Identificador de la app | `com.stratoscapitalgroup.crm`, con **Push Notifications** habilitado |
| App en App Store Connect | **Stratos AI** · ID `6804826565` · versión 1.0 en preparación |
| Llave de API | **Stratos CI** · rol Gestor de apps (el ID vive en App Store Connect, no acá: **este repo es público**) |
| Secretos en GitHub | `APPLE_TEAM_ID`, `APPSTORE_ISSUER_ID` y `APPSTORE_KEY_ID` cargados |

La casilla de Push hay que marcarla **al registrar el identificador**: si falta, la
compilación falla al firmar y el error no dice que es por eso.

El **Acuerdo para apps gratuitas** quedó **activo** el 24-ago-2026 al aceptar el
contrato del programa. Eso es lo que habilita distribuir una app gratis, así que
por el lado contractual TestFlight ya no tiene freno. El *Acuerdo para apps de
pago* sigue sin firmar y **no hace falta**: solo se necesita para cobrar dentro
de la app.

### La declaración de comerciante para la Unión Europea

Está en App Store Connect → Negocio, y **no frena TestFlight**. Pero es una
decisión personal que nadie más debería tomar, porque las dos opciones tienen
consecuencias distintas:

- **"Soy un comerciante sujeto al DSA"** → Apple **publica tu dirección, tu
  teléfono y tu correo en la ficha de la app**. La cuenta está inscrita como
  *Individual* con una dirección particular, así que lo que se publicaría es un
  domicilio de casa.
- **"No soy comerciante o no tengo intención de distribuir en la UE"** → no se
  publica ningún dato de contacto, y la app no se distribuye en la Unión Europea.

Si algún día la app va a la UE, conviene inscribir la cuenta como *Organización*
con un domicilio fiscal antes de declararse comerciante.

**Falta un solo secreto: `APPSTORE_PRIVATE_KEY`.** Es el archivo `.p8` de la
llave, y lo carga Iván a mano — una llave privada no se le pasa a nadie más, ni
siquiera para pegarla. Se descarga desde App Store Connect → Users and Access →
Integrations (botón *Descargar*, **solo funciona una vez**) y se pega completo,
incluidas las líneas `BEGIN` y `END`.

Con ese secreto cargado, el flujo `ios-testflight.yml` corre solo desde la
pestaña Actions.

### Dar acceso a Apple sin exponer la cuenta personal

Regla de arranque: **nunca se comparte el Apple ID ni la contraseña de Iván.**
Apple tiene roles justo para esto, y hay tres niveles según lo que se necesite.

**Nivel 1 — subir builds a TestFlight: cero acceso a Apple.**
El flujo `ios-testflight.yml` es `workflow_dispatch`: se dispara a mano desde la
pestaña Actions de GitHub. Iván carga los cuatro secretos UNA vez; GitHub los
cifra y a partir de ahí nadie puede leerlos, solo usarlos. Un dev con permiso de
escritura en el repo entra a Actions → Run workflow y ya. No ve nada de Apple.

**Nivel 2 — gestionar TestFlight (invitar probadores, ver crashes, metadata).**
Invitación a App Store Connect **con el Apple ID propio del dev**, rol
**App Manager**:

- puede administrar la app, subir builds y manejar TestFlight;
- **no ve** Acuerdos, Impuestos ni Banca — ahí está la información fiscal y
  financiera personal. Solo el Account Holder y el rol Finance la ven;
- se le puede limitar a **apps específicas**, así no ve otras apps de la cuenta;
- se le puede quitar el acceso a Certificates, Identifiers & Profiles si no
  necesita tocar la firma.

**Nivel 3 — compilar y firmar en su propia Mac.**
Rol **Developer** en el Apple Developer Program: crea certificados de
desarrollo, no puede distribuir.

**Sobre la API key:** la crea Iván con rol **App Manager**, no Admin. El archivo
`.p8` se descarga UNA sola vez — va a GitHub Secrets y a un gestor de
contraseñas. Si el dev se va, se revoca esa key y listo; la cuenta no se toca.

### Cuando prendas Rails: el chequeo de 3 minutos

El panel está verificado en producción — se abre, los interruptores responden, el
tope de tarjetas se mueve, y cada cambio guarda solo (no hay botón que olvidar).
El gate de la interfaz y la RLS de `organizations` coinciden: solo `super_admin`
y `admin`, así que un asesor ni lo ve.

Lo único que no se puede probar sin una cuenta real es el viaje completo: que lo
que guarda el admin llegue a la pantalla del asesor. Cuando lo prendas:

1. **Menú → Proceso**, prende el interruptor grande. Debe decir *Guardado*.
2. **Recarga la página** y vuelve a Proceso — si el interruptor sigue prendido,
   la base lo guardó de verdad.
3. Entra al **CRM**: debe aparecer Mi Día arriba de todo.
4. Apaga una regla (por ejemplo *Validar apartado*), recarga, y comprueba que
   ninguna tarjeta de esa clase aparezca.
5. Si algo no cuadra, `?rails=0` en la URL te devuelve el CRM de siempre al
   instante, sin esperar deploy.

El equipo lo ve en su **siguiente carga**, no al instante: la configuración se
lee al montar la pantalla.

### La app móvil

Vive en **`mobile/`**. Es un shell de Capacitor que empaqueta el CRM dentro del
binario (no carga la web remota). **No crear otro proyecto Capacitor** — ya pasó
y se tiró el trabajo. Ver `mobile/README.md`.

Verificado contra el `main` del 24-ago-2026:

- `npm run build:app` deja 4.5 MB, con las 15 páginas públicas excluidas.
- El proyecto de Xcode compila en Debug y en Release.
- El manifiesto de privacidad que Apple exige (`PrivacyInfo.xcprivacy`) **sí
  queda dentro del `.app`** — comprobado en el binario compilado, no solo en el
  repo. Xcode lo incluye por los grupos sincronizados, sin entrada explícita en
  Copy Bundle Resources.
- Arranca a la pantalla de login, sin website, con el nombre "Stratos AI".

**Un dato para medir en el primer build de TestFlight:** en el simulador tarda
entre 4.6 y 9 segundos en pintar la primera pantalla, y Release no mejora sobre
Debug. La misma app en web pinta en 574 ms, así que no es el bundle de React:
es el arranque del WebView. El simulador es lento levantando su primer proceso
de WebKit, así que lo más probable es que en un teléfono real sea mucho menos —
pero **hay que medirlo ahí antes de darlo por bueno**. Si en dispositivo también
son segundos, vale la pena investigarlo: es pantalla oscura cada vez que un
asesor abre la app.

### Antes de crear un proyecto en Supabase: mira en qué organización

**Cada proyecto activo en la organización Pro cuesta ~$10/mes.** El plan Pro son
$25 e incluye crédito de compute para UN solo proyecto. Tres proyectos costaban
$45 — que es exactamente el ejemplo que trae la documentación de Supabase.

Por eso desde el 24-ago-2026 están separados:

| Organización | Plan | Proyecto |
|---|---|---|
| `synergyfornature@gmail.com's Org` | **Pro $25** | `stratos-prod` |
| `Gvintell` | Free $0 | `gvintell-prod` |
| `Finanzas Plenas` | Free $0 | `finanzas-plenas` |

Si creas un proyecto nuevo en la organización Pro sin pensarlo, la factura sube
$10 al mes y nadie se entera hasta que llega. El diagnóstico se hace en
`/dashboard/org/<org>/usage`: la línea **Micro Compute Hours** delata cuántos
proyectos están corriendo.

Dos cosas que aprendimos por las malas: **los proyectos Pro no se pueden
pausar** —hay que transferirlos primero a una organización Free—, y pausar o
transferir **no borra el consumo que ya ocurrió** en el ciclo en curso.

Los dos proyectos en Free tienen tope de 500 MB de base, sin respaldos
automáticos, y se pausan solos tras una semana sin actividad. Miden 24 y 25 MB,
así que sobra espacio — pero si alguno empieza a tener uso real de clientes,
devuélvelo a Pro por los respaldos.

### Migraciones

La carpeta va por el **238**. Toda migración nueva usa el siguiente número
libre; `npm run verificar-migraciones` lo revisa. La base las registra por
timestamp y slug, no por nombre de archivo, así que renombrar es seguro.

**No usar `supabase db push`** — los historiales divergen. El SQL se pega en el
editor del dashboard y el archivo `NNN_*.sql` queda como registro.

---

## Zonas que no se tocan sin leer primero

`CLAUDE.md` tiene tres secciones marcadas **ZONA CRÍTICA** con el porqué de cada
valor:

- **Auth** — `flowType: 'implicit'`, los timeouts de 3.5s y 5s. Cada número
  costó días de depuración. Cambiar uno regresa el bug de "se sale al F5".
- **Performance** — los listeners con función nombrada, el `useMemo` del
  Context. Sin eso vuelven los stutters del mouse.
- **Multi-cliente** — el aislamiento por `organization_id` + RLS.

No son recomendaciones. Están escritas después de romperlas.

---

## Contacto

- **Cliente / decisiones de producto:** Iván Rodríguez Ruelas
- **Supabase de producción:** proyecto `glulgyhkrqpykxmujodb`
- **Referencia completa:** `CLAUDE.md` → `DEVELOPMENT.md` → `MAPA.md`
