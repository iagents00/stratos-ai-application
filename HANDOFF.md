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
| **Los 4 secretos de Apple** | GitHub → Settings → Secrets | Requiere su cuenta de Apple Developer |
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
