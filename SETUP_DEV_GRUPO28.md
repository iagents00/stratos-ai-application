# Setup para el desarrollador de Grupo 28

Esta guía es **solo para el dev externo de Grupo 28**. Si trabajás en el CRM
de Duke (cliente original), no aplica.

> **Antes de empezar:** leer también `CLAUDE.md` en la raíz del repo. Tiene
> las reglas inviolables del proyecto, zonas críticas y arquitectura. Es lo
> primero que Claude Code va a cargar en cada sesión tuya.

---

## 1. Acceso al repo

El owner del proyecto te va a invitar como colaborador del repo
`iagents00/stratos-ai-application`.

Cuando recibas la invitación por email (o en tu inbox de GitHub):
1. Abrí <https://github.com/iagents00/stratos-ai-application/invitations>
2. Click en **Accept invitation**.

---

## 2. Software necesario en tu PC

```bash
# Node 20+ (el repo usa Vite 8 y React 19)
node --version    # debería decir v20.x o superior

# Git
git --version

# Claude Code CLI (asumiendo plan Max compartido)
# https://docs.claude.com/en/docs/claude-code
claude --version
```

Si te falta alguno, instalalo antes de seguir.

---

## 3. Clonar y arrancar el proyecto

```bash
# Clonar
git clone https://github.com/iagents00/stratos-ai-application.git
cd stratos-ai-application

# Instalar dependencias
npm install

# Crear tu rama de trabajo (NUNCA trabajes directo en main)
git checkout -b feature/grupo28-setup
```

---

## 4. Configurar `.env.local` (credenciales)

El owner te va a pasar las credenciales por canal seguro (1Password, Signal,
etc. — **nunca por email ni Slack en claro**).

Creá el archivo `.env.local` en la raíz del repo con:

```bash
# .env.local — NO commitearlo (ya está en .gitignore)
VITE_SUPABASE_URL=https://XXXXXXXX.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Estas credenciales apuntan al Supabase **de Grupo 28** (no al de Duke).
Si querés verificar que las recibiste bien, corré:

```bash
npm run dev
# → abrí http://localhost:5173/?app&client=grupo28
# La pestaña del navegador debe decir "Grupo 28 — Plataforma".
# En DevTools → Elements → <html> debe tener data-client="grupo28".
```

---

## 5. Abrir Claude Code en el proyecto

```bash
# Desde la raíz del repo
claude
```

Lo primero que hace Claude Code es leer `CLAUDE.md`. Para verificar que el
contexto cargó bien, en tu primera sesión preguntale:

> ¿Qué reglas tengo para trabajar en este proyecto siendo dev de Grupo 28?

Debe responderte con las reglas inviolables: solo tocar
`src/clients/grupo28/`, no commit directo a main, PR + review obligatorio
para tocar el core, etc.

---

## 6. Zona donde podés trabajar libremente

```
src/clients/grupo28/
├── config.js         ← branding (logo, accent, nombre), features habilitadas
├── theme.js          ← (a crear si necesitás overrides visuales)
└── overrides/        ← (a crear si necesitás componentes custom para Grupo 28)
```

**Reglas:**

| Acción | ¿Permitido sin review? |
|---|---|
| Editar `src/clients/grupo28/config.js` | ✅ Sí |
| Crear archivos nuevos dentro de `src/clients/grupo28/` | ✅ Sí |
| Editar cualquier cosa fuera de `src/clients/grupo28/` | ❌ Requiere PR + review del owner |
| `git push` directo a `main` | ❌ Bloqueado por branch protection |
| Tocar `src/clients/duke/` | ❌ Es de otro cliente |

Si Claude Code te sugiere editar archivos fuera de `src/clients/grupo28/`,
**parálo** y avisale al owner. Probablemente sí se puede hacer, pero requiere
PR + review.

### 🔴 NUNCA — Bases de datos, Supabase, autenticación

Estas son acciones **prohibidas de forma absoluta**, incluso con PR + review.
Si necesitás algo de acá, **pasale el ticket al owner para que lo haga él**:

| Acción prohibida | Por qué |
|---|---|
| Ejecutar SQL directo en Supabase (INSERT/UPDATE/DELETE) | Puede borrar/corromper datos de Duke en producción |
| Crear o modificar **tablas, columnas, índices** en Supabase | Es schema compartido — afecta a Duke |
| Modificar **RLS policies** | Pueden exponer datos de un cliente a otro |
| Editar `src/lib/supabase.js`, `src/lib/auth.js`, `src/lib/lead-save.js` | Capa de auth/datos compartida |
| Editar `src/app/constants/navigation.js` | Define quién ve qué módulos (zona crítica de seguridad) |
| Crear migraciones nuevas en `supabase/migrations/` | Cambios estructurales del schema |
| Cambiar credenciales en `.env.local` sin coordinarlo con el owner | Podés desconectar a Grupo 28 de producción |
| Hacer queries en Claude Code del tipo `DELETE FROM ...`, `DROP ...`, `TRUNCATE ...` | Riesgo de pérdida de datos catastrófica |
| Pedirle a Claude Code que "limpie", "resetee" o "borre" datos | Lo mismo |
| Tocar el contenido de `backups/` | Son snapshots históricos — solo lectura |

**Si Claude Code te sugiere alguna de estas acciones, parálo INMEDIATAMENTE
y avisale al owner.** Las queries de lectura (`SELECT`) sí están OK para
debugging, pero ANTE LA DUDA pregunta.

### 🟢 Lo que SÍ podés hacer desde Claude Code para personalizar Grupo 28

Tres niveles de personalización, en orden de simplicidad:

**Nivel A — Solo config (autónomo, sin review):**
- Editar `src/clients/grupo28/config.js`: cambiar `legalName`, `brand.logoText`,
  `brand.accent` (color), `tagline`, `features.<modulo> = false` para apagar
  módulos del cliente.
- Crear `src/clients/grupo28/theme.js` o `src/clients/grupo28/overrides/` si
  necesitás overrides visuales complejos.

**Nivel B — Texto dinámico configurable por el cliente desde la UI (no toca código):**
- Plan, Protocolo y Goal del CRM ya son **editables por organización** vía
  `meta_config` en la tabla `organizations` (PR #90). El super_admin de Grupo 28
  (Felipe Grillasca) puede editar esos textos directamente desde la app —
  **no requiere intervención del dev**.
- Si el cliente quiere cambiar uno de esos textos, decile que lo edite él
  mismo desde la UI logueado como super_admin. Vos no tenés que hacer nada.

**Nivel C — Texto hardcoded en el CRM compartido (requiere PR + review):**
- Si hay strings tipo `"Duke del Caribe"` o `"Stratos"` hardcoded en `src/app/`
  que deberían depender del cliente, hay dos enfoques posibles:
  1. **Mover el string al config del cliente** (`src/clients/<id>/config.js`)
     y usar `useClient().config.X` para leerlo. Es el enfoque correcto a largo
     plazo.
  2. **Gate visual con `useClient().clientId`** y mostrar texto distinto según
     cliente.
- En ambos casos requiere editar archivos del core (`src/app/`), entonces:
  - Abrí PR con tu propuesta.
  - El owner revisa que el cambio no rompa Duke ni otros clientes.
  - Merge cuando el owner aprueba.

---

## 7. Flujo de trabajo diario

```bash
# Al empezar el día — bajar últimos cambios
git checkout main
git pull origin main

# Crear rama para la tarea del día
git checkout -b feature/grupo28-<descripcion-corta>
# Ejemplos:
#   feature/grupo28-branding-inicial
#   feature/grupo28-disable-rrhh
#   feature/grupo28-color-marca

# Hacer cambios → testear → commit
git add src/clients/grupo28/
git commit -m "feat(grupo28): descripción del cambio"

# Subir y abrir PR
git push -u origin feature/grupo28-<descripcion>
gh pr create --base main --title "feat(grupo28): ..." --body "..."

# Esperar review del owner antes de mergear
```

---

## 8. Probar tus cambios

```bash
# Dev server
npm run dev
# → http://localhost:5173/?app&client=grupo28 → ves la versión de Grupo 28
# → http://localhost:5173/?app                → ves la versión de Duke (NO debe romperse)

# Antes de abrir PR, validar que el build pasa
npm run build
# → debe terminar sin errores
```

**Test obligatorio antes de pedir review:**
1. Tu cambio funciona en `localhost:5173/?app&client=grupo28`.
2. Duke sigue funcionando igual en `localhost:5173/?app` (sin `client=`).
3. `npm run build` corre sin errores.
4. Console del navegador limpio (sin errores ni warnings nuevos).

---

## 9. Promover una mejora al core (a Duke también)

Si mientras trabajás encontrás algo que mejorarías en el CRM compartido (ej:
una optimización en el módulo de clientes, un bug fix en la búsqueda),
**NO lo edites directamente**. Hacé lo siguiente:

1. Documentá el cambio que querés hacer en el PR (descripción + diff).
2. Hacelo en una rama separada: `feature/core-<mejora>`.
3. Asegurate de que el cambio esté **gated por feature flag** si afecta
   comportamiento visible. Ejemplo:

```js
// En src/clients/_shared/defaults.js
features: {
  ...
  busquedaMejorada: false,  // default off, Grupo 28 lo prende
}

// En src/clients/grupo28/config.js
features: {
  ...
  busquedaMejorada: true,
}

// En el componente que usa la mejora
const { isFeatureEnabled } = useClient();
if (isFeatureEnabled("busquedaMejorada")) {
  // código nuevo
} else {
  // código viejo
}
```

4. El owner revisa, prueba con Duke y Grupo 28, y mergea.
5. Cuando se valide, el owner prende la bandera para Duke también.

---

## 10. Si Claude Code se confunde

- Si la sesión actual perdió contexto, decile:
  > Leé CLAUDE.md y SETUP_DEV_GRUPO28.md y resumime las reglas de este proyecto.
- Si te sugiere algo prohibido (tocar el core sin PR, push directo a main,
  borrar archivos de Duke), **rechazá y avisame**.
- Si hay duda sobre una decisión arquitectónica, pregúntale al owner antes
  de codear.

---

## Contacto

- Owner del proyecto: Ivan Rodriguez Ruelas (synergyfornature@gmail.com)
- Issues del repo: <https://github.com/iagents00/stratos-ai-application/issues>
