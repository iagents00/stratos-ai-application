# Stratos AI — Plataforma CRM + ERP Inmobiliaria

Plataforma de gestión comercial para equipos de ventas inmobiliarias.
Incluye CRM con pipeline visual, agentes IA, ERP de proyectos, finanzas y RRHH.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite |
| Estilos | CSS-in-JS (inline styles) — NO Tailwind |
| Iconos | Lucide React |
| Gráficas | Recharts |
| Auth actual | localStorage (demo) |
| Auth producción | Supabase (pendiente — ver plan) |
| Base de datos | Supabase PostgreSQL (pendiente) |

---

## Inicio Rápido

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev
# → http://localhost:5173         (Landing marketing)
# → http://localhost:5173/?app    (Plataforma / CRM)

# Build de producción
npm run build

# Preview del build
npm run preview
```

### Credenciales de demo

```
Email:    demo@stratos.ai
Password: Demo2024
```

---

## Arquitectura

### Dos sitios, un repositorio

```
stratoscapitalgroup.com        → LandingMarketing.jsx (sin auth)
app.stratoscapitalgroup.com    → App.jsx (con LoginScreen interno)
```

La detección se hace en runtime en `main.jsx` via `window.location.hostname`.
Para desarrollo local usa `?app` como query param.

### Estructura de archivos

```
src/
├── main.jsx              ← Raíz. Enruta landing vs plataforma por hostname
├── App.jsx               ← Plataforma completa (7 200+ líneas)
├── LandingMarketing.jsx  ← Landing pública de marketing
├── LoginScreen.jsx       ← Pantalla de login de la plataforma
│
├── data/
│   ├── leads.js          ← Datos mock del CRM (8 leads reales)
│   └── constants.js      ← Paleta P, tipografías, STAGES del pipeline
│
├── lib/
│   └── supabase.js       ← Cliente Supabase (desactivado hasta migración)
│
├── components/           ← Componentes reutilizables (pendiente extraer)
│   ├── ui/               ← Pill, KPI, ScoreBar, etc.
│   └── layout/           ← Sidebar, Topbar, DynIsland
│
├── views/                ← Vistas principales (pendiente extraer de App.jsx)
│   └── (Dashboard, CRM, ERP, IACRM, AsesorCRM, Finanzas, RRHH)
│
├── hooks/                ← Custom hooks (useAuth, usePermissions — pendiente)
└── utils/                ← Helpers (formatCurrency, scoreColor — pendiente)
```

---

## Variables de Entorno

Crea `.env.local` (NO subir a Git):

```bash
VITE_APP_URL=https://app.stratoscapitalgroup.com
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

Ver `.env.example` como referencia.

---

## Vistas de la Plataforma

| Vista | ID | Descripción |
|-------|----|-------------|
| Dashboard | `d` | KPIs ejecutivos, comando directivo IA |
| CRM | `crm` | Pipeline de ventas con 10 etapas |
| IA CRM | `ia` | Agentes de inteligencia artificial |
| ERP | `erp` | Gestión de proyectos inmobiliarios |
| Asesores CRM | `acrm` | Base de datos de asesores |
| Landing Pages | `lp` | Generador de landings |
| Finanzas | `fin` | Módulo financiero |
| RRHH | `rrhh` | Recursos humanos |

---

## Pipeline CRM — 10 Etapas

```
Nuevo Registro → Primer Contacto → Seguimiento →
Zoom Agendado → Zoom Concretado →
Visita Agendada → Visita Concretada →
Negociación → Cierre → Perdido
```

---

## Siguiente Sprint: Migración a Supabase

El plan completo está en `.claude/plans/glittery-doodling-avalanche.md`.

### Prioridad Alta (Auth)
1. Crear proyecto en supabase.com
2. `npm install @supabase/supabase-js`
3. Activar `src/lib/supabase.js`
4. Crear `AuthContext` + `useAuth` hook
5. Reemplazar localStorage auth con `supabase.auth`

### Prioridad Media (Admin)
6. Panel de administración con gestión de usuarios
7. 4 roles: super_admin, ceo, director, asesor
8. Row Level Security (RLS) por rol

### Prioridad Baja (Datos)
9. Migrar leads mock → tabla `crm_leads` en Supabase
10. Migrar proyectos, team, agentes IA

---

## Deploy

Ver `DEPLOYMENT.md` para guía completa de Vercel + Namecheap DNS.

---

## Convenciones

- **Estilos**: Solo inline styles. Paleta `P` en `src/data/constants.js`
- **Iconos**: Solo Lucide React
- **Commits**: `feat:` `fix:` `style:` `perf:` `refactor:` `docs:`
- **NO** instalar nuevas librerías sin confirmar
- **NO** usar Tailwind

---

*Ver `CLAUDE.md` para instrucciones completas de desarrollo.*
