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
   curl -s https://app.stratoscapitalgroup.com/sw.js | grep CACHE_VERSION
   ```

---

## Lo que está pendiente

### Solo Iván puede hacerlo

| Qué | Dónde | Por qué no lo puede hacer un dev |
|---|---|---|
| **Pagar las facturas de Supabase** | Dashboard → Billing | La tarjeta está bloqueada. Si suspenden el proyecto se cae todo. Es lo más urgente. |
| **Aplicar `237_post_zoom_protocol.sql`** | SQL editor del dashboard | Escritura a la base de producción |
| **Cargar `APPSTORE_PRIVATE_KEY`** | GitHub → Settings → Secrets | Es el `.p8` de la llave de API. Una llave privada la maneja solo su dueño. Se descarga una única vez. |
| **Prender Stratos Rails** | Dentro de la app: Menú → Proceso | Le reordena la pantalla a los 20 asesores |

### Lo que sí puede avanzar un dev

- **Conectar un procesador de pagos.** Hoy la pantalla de Planes lleva a hablar
  con un ejecutivo. Si se decide cobrar en línea, el lugar exacto es
  `ContratarModal` en `src/landing/PricingScreen.jsx`.
- **Auditar módulos con el método que ha funcionado**: abrir la pantalla, hacer
  el flujo completo, y comprobar el RESULTADO (la ficha del cliente, la fila en
  la base), no que el botón "hizo algo". Así salieron todos los bugs de esta
  semana.
- Las mejoras de performance listadas en `CLAUDE.md`, si algo se siente lento.
  **No antes** — la app va fluida hoy.

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
| Llave de API | **Stratos CI** · rol Gestor de apps · ID `F8Q7R9J7V7` |
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

### La app móvil

Vive en **`mobile/`**. Es un shell de Capacitor que empaqueta el CRM dentro del
binario (no carga la web remota). **No crear otro proyecto Capacitor** — ya pasó
y se tiró el trabajo.

Compila y corre hoy. Ver `mobile/README.md`.

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
