# Stratos AI — Guía para Desarrolladores

Este archivo es leído automáticamente por Claude Code al abrir el proyecto.
Es el punto de entrada oficial para cualquier dev que trabaje aquí.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite |
| Estilos | CSS-in-JS (inline styles) — NO Tailwind |
| Iconos | Lucide React |
| Gráficas | Recharts |
| Auth actual | localStorage (demo/prototipo) |
| Auth producción | Supabase (plan listo, pendiente de implementar) |
| Base de datos | Supabase PostgreSQL (pendiente) |

---

## Estructura de Archivos

```
src/
├── main.jsx              ← Raíz de la app. Controla auth state central.
├── App.jsx               ← Plataforma completa (Dashboard, CRM, ERP, etc.)
├── LandingMarketing.jsx  ← Landing pública con auth modal integrado
├── App.css               ← Estilos globales mínimos
└── index.css             ← Reset base

CLAUDE.md                 ← Este archivo (léelo primero)
DESIGN_SYSTEM.md          ← Colores, tipografías, espaciado
DEVELOPMENT.md            ← Patrones de código y convenciones
QUICK_REFERENCE.md        ← Componentes copy-paste
CHANGELOG.md              ← Historial de versiones
```

---

## Cómo Correr el Proyecto

```bash
# 1. Instalar dependencias
npm install

# 2. Correr en desarrollo
npm run dev
# → http://localhost:5173

# 3. Build de producción
npm run build

# 4. Preview del build
npm run preview
```

---

## Flujo de Autenticación (Estado Actual)

El auth vive en `main.jsx` como estado React central:

```
main.jsx
  ├── user = null  → muestra <LandingMarketing onLogin={handleLogin} />
  └── user = {...} → muestra <App onLogout={handleLogout} user={user} />
```

### Cómo funciona el login/registro ahora

Todos los usuarios se guardan en `localStorage["stratos_users"]` como array JSON:

```json
[
  { "id": 1, "name": "Usuario Demo", "email": "demo@stratos.ai", "password": "Demo2024" },
  { "id": 1700000000, "name": "Juan Pérez", "email": "juan@empresa.com", "password": "MiPass123" }
]
```

La sesión activa se guarda en `localStorage["stratos_user"]` (sin 's').

### Cuenta demo pre-sembrada

```
Email:      demo@stratos.ai
Password:   Demo2024
```

Esta cuenta se crea automáticamente en el primer render si no existe.

---

## Cómo Migrar a Supabase (PENDIENTE — siguiente sprint)

El plan completo está en `.claude/plans/glittery-doodling-avalanche.md`.

### Pasos resumidos:

1. **Crear proyecto en Supabase** (manual en supabase.com)
2. **Instalar SDK**: `npm install @supabase/supabase-js`
3. **Crear `src/lib/supabase.js`**:
```js
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```
4. **Crear `.env.local`** (NO subir a Git):
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```
5. **Reemplazar el auth de localStorage** en `main.jsx` y `LandingMarketing.jsx`
   con llamadas a `supabase.auth.signIn()` / `signUp()` / `resetPasswordForEmail()`

Con Supabase, el envío de emails (verificación y recuperación) funciona automáticamente.

---

## Design System — Reglas Críticas

Lee `DESIGN_SYSTEM.md` completo. Resumen ejecutivo:

```js
// Paleta — App.jsx (P)
const P = {
  bg: "#060A11",       // Fondo principal
  accent: "#6EE7C2",   // Verde menta — usar con moderación
  txt: "#E2E8F0",      // Texto principal
  border: "rgba(255,255,255,0.07)",
}

// Paleta — LandingMarketing.jsx (P)
const P = {
  bg: "#04080F",
  accent: "#52D9B8",
  // ... ligeramente distinta (landing vs app)
}

// Tipografías
fontDisp = "SF Pro Display, Segoe UI, sans-serif"  // Títulos
font     = "SF Pro Text, Segoe UI, sans-serif"     // Cuerpo

// Espaciado — múltiplos de 8px
// 4, 8, 12, 16, 24, 32, 48, 64
```

**NUNCA** usar colores hardcodeados. Siempre usar `P.color`.
**NUNCA** usar Tailwind — todo es inline styles.
**NUNCA** instalar nuevas librerías sin confirmar con el cliente.

---

## Componentes Principales en App.jsx

| Componente | Vista | Línea aprox. |
|-----------|-------|-------------|
| `Dash` | Comando / Dashboard | ~260 |
| `CRM` | Pipeline de ventas | ~549 |
| `IACRM` | Agentes IA | ~750 |
| `ERP` | Proyectos inmobiliarios | ~736 |
| `AsesorCRM` | Base de datos asesores | ~1040 |
| `LandingPages` | Generador de landing | ~2450 |
| `FinanzasAdmin` | Módulo finanzas | ~4300 |
| `RRHHModule` | Recursos humanos | ~5000 |

---

## Cómo Agregar una Vista Nueva

1. Crear función `const MiVista = ({ oc }) => { ... }` en `App.jsx`
2. Agregar al array `nav` en `App.jsx`:
```js
{ id: "mv", l: "Mi Vista", i: IconName }
```
3. Agregar render en el switch de vistas:
```jsx
{v === "mv" && <MiVista oc={oc} />}
```

---

## Roles de Usuario (Para cuando se integre Supabase)

```
super_admin  → Ve y controla todo
ceo          → Dashboard, CRM, ERP, Finanzas, Team
director     → Su equipo, su CRM, su pipeline
asesor       → Solo sus leads y sus registros
```

---

## Git & Colaboración

```bash
# Rama principal
main

# Flujo recomendado
git checkout -b feat/nombre-feature
# ... cambios ...
git commit -m "feat: descripción clara"
git push origin feat/nombre-feature
# → Pull Request → Review → Merge
```

### Convenciones de commits
```
feat:     Nueva funcionalidad
fix:      Corrección de bug
style:    Solo cambios visuales/CSS
perf:     Mejora de performance
refactor: Cambio interno sin afectar UX
docs:     Solo documentación
```

---

## Variables de Entorno

```bash
# .env.local (crear localmente, NO subir a git)
VITE_SUPABASE_URL=         # URL de tu proyecto Supabase
VITE_SUPABASE_ANON_KEY=    # Anon key de Supabase

# .env.example (ya existe en repo, como referencia)
```

---

## Lo Que NO Hay Que Tocar Sin Consultar

- `DESIGN_SYSTEM.md` — es la referencia de diseño del cliente
- La paleta de colores `P` — cualquier cambio afecta toda la app
- El sistema de auth en `main.jsx` — es el punto central
- Los datos mock en `App.jsx` — serán reemplazados por Supabase queries

---

## Contacto del Proyecto

- **Cliente**: Ivan Rodriguez Ruelas
- **Claude Code**: disponible para hacer cambios vía sesión
- **Desarrollador externo**: usar este archivo + DEVELOPMENT.md como referencia completa

---

*Última actualización: Abril 2026*
