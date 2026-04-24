# Stratos AI — Producción: Checklist para Dev Team

> Estado actual: **Prototipo funcional completo** (auth local, datos mock)
> Objetivo: **Producción para equipo de 10 personas**
> Stack: React 18 + Vite · CSS inline · Supabase (pendiente) · Vercel (recomendado)

---

## 1. Infraestructura & Auth — CRÍTICO

### 1.1 Supabase
- [ ] Crear proyecto en [supabase.com](https://supabase.com)
- [ ] Instalar SDK: `npm install @supabase/supabase-js`
- [ ] Crear `src/lib/supabase.js`:
  ```js
  import { createClient } from '@supabase/supabase-js'
  export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )
  ```
- [ ] Crear `.env.local` (NO subir a Git — ya está en `.gitignore`):
  ```
  VITE_SUPABASE_URL=https://xxxx.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJxxx...
  ```
- [ ] Reemplazar `src/lib/auth.js` (hoy usa localStorage) con `supabase.auth.*`
- [ ] Habilitar confirmación por email en Supabase Dashboard → Auth → Settings
- [ ] Habilitar reset password por email (ya funciona en `LoginScreen.jsx`, solo falta el provider real)

### 1.2 Roles de usuario (Row Level Security)
- [ ] Crear tabla `profiles` en Supabase con campos: `id`, `role`, `name`, `email`, `team`
- [ ] Roles requeridos: `super_admin` · `ceo` · `director` · `asesor`
- [ ] Activar RLS en todas las tablas y crear policies por rol
- [ ] En `AuthContext.jsx`: hacer fetch del perfil al login para cargar el rol
- [ ] Pasar `userRole` como prop o contexto a `App.jsx` para filtrar vistas

---

## 2. Base de Datos — Tablas requeridas

Ver esquema completo en `docs/backend-architecture.md`.

### Tablas principales
- [ ] `profiles` — usuarios y roles
- [ ] `leads` — CRM (reemplaza `src/data/leads.js`)
- [ ] `lead_activities` — historial de seguimiento por lead
- [ ] `meta_actions` — Lista de Acción del MetaPanel (hoy en React state)
- [ ] `meta_plan` — Plan Estratégico (hoy en React state)
- [ ] `meta_protocol` — Protocolo de Ventas (hoy en React state)
- [ ] `erp_projects` — proyectos inmobiliarios
- [ ] `team_members` — directorio del equipo
- [ ] `rrhh_candidates` — candidatos del portal de vacantes
- [ ] `finanzas_entries` — entradas del módulo de finanzas

### Acciones por tabla
- [ ] Escribir migrations SQL (usar `supabase/migrations/`)
- [ ] Crear indexes en: `leads.asesor_id`, `leads.stage`, `leads.created_at`
- [ ] Crear triggers para `updated_at` automático
- [ ] Seedear con los datos mock actuales de `src/data/leads.js`

---

## 3. Wiring de Datos (reemplazar mocks)

Cada vista hoy usa datos hardcoded. Reemplazar con queries reales:

### CRM (`App.jsx` → componente `CRM`)
- [ ] `useEffect` → `supabase.from('leads').select('*').eq('asesor_id', user.id)`
- [ ] `setLeadsData` se convierte en setter que actualiza Supabase + local state
- [ ] Paginación (hoy se cargan todos los leads — problema a 500+ registros)
- [ ] Realtime: `supabase.channel('leads').on('postgres_changes', ...)` para sincronización entre asesores

### MetaPanel (Lista de Acción, Plan, Protocolo)
- [ ] `metaActions` → tabla `meta_actions` (load on mount, save on change)
- [ ] `metaPlan` → tabla `meta_plan` (un registro por empresa/team)
- [ ] `metaProtocol` → tabla `meta_protocol` (un registro por empresa/team)
- [ ] El campo `E` (contentEditable) ya tiene `onBlur` — conectar al UPDATE de Supabase

### Dashboard (`Dash`)
- [ ] Calcular KPIs desde queries reales: pipeline total, score promedio, leads activos
- [ ] AreaChart de Asesores/iAgents → datos reales de actividad por semana

### ERP (`ERP`)
- [ ] Tabla `erp_projects` + query por estado/etapa
- [ ] Upload de documentos → Supabase Storage bucket `project-docs`

### RRHH (`RRHHModule`)
- [ ] Portal público de candidatos → endpoint separado o tabla pública con RLS
- [ ] Scoring IA de CVs → llamada a OpenAI/Anthropic API (desde Edge Function)

---

## 4. Variables de Entorno para Producción

```bash
# .env.production (Vercel dashboard → Environment Variables)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_OPENAI_API_KEY=        # para scoring IA de CVs
VITE_ANTHROPIC_API_KEY=     # para iAgents (próxima fase)
```

---

## 5. Deploy — Vercel (recomendado)

- [ ] `npm run build` → verificar que no haya errores (hoy: ✅ pasa limpio)
- [ ] Conectar repo a [vercel.com](https://vercel.com)
- [ ] Configurar dominios:
  - `stratoscapitalgroup.com` → `LandingMarketing.jsx` (landing público)
  - `app.stratoscapitalgroup.com` → `App.jsx` (plataforma autenticada)
- [ ] El routing por hostname ya está implementado en `src/main.jsx` (`isApp` flag)
- [ ] Activar Edge Functions en Supabase para lógica server-side sensible

---

## 6. Seguridad

- [ ] Mover cualquier API key a Edge Functions de Supabase (nunca exponer en el frontend)
- [ ] Revisar que RLS esté activo en TODAS las tablas antes de lanzar
- [ ] Validar inputs en el backend (hoy solo hay validación en el frontend)
- [ ] Rate limiting en auth endpoints (Supabase lo ofrece por defecto)
- [ ] CORS: configurar dominios permitidos en Supabase Dashboard

---

## 7. Features pendientes (Fase 2 — post-launch)

| Feature | Esfuerzo | Prioridad |
|---------|---------|-----------|
| iAgents IA activos (botón ya visible, deshabilitado) | Alto | Alta |
| Realtime sync entre asesores en el CRM | Medio | Alta |
| Notificaciones push (leads sin seguimiento) | Medio | Media |
| Integración WhatsApp Business API | Alto | Media |
| App móvil (React Native / PWA) | Muy Alto | Media |
| Grabaciones de llamadas con coaching IA | Alto | Media |
| Exportar reportes PDF | Bajo | Baja |
| Integración Google Calendar | Medio | Baja |

---

## 8. Calidad & Testing

- [ ] Agregar Vitest + React Testing Library (`npm install -D vitest @testing-library/react`)
- [ ] Tests unitarios para: `auth.js`, cálculos de KPIs, helpers de formato
- [ ] Test E2E (Playwright) para: login flow, agregar lead, marcar acción completada
- [ ] Lighthouse audit: performance, accesibilidad, SEO en landing

---

## 9. Performance (cuando haya datos reales)

- [ ] Lazy loading de vistas (`React.lazy` + `Suspense`) — `App.jsx` es hoy un solo bundle de 1.2MB
- [ ] Virtualización de la lista de leads (react-virtual) cuando supere 100 items
- [ ] Memoizar componentes pesados con `React.memo` y `useMemo`
- [ ] Image optimization: `hero.png` convertir a WebP

---

## 10. Onboarding del Equipo (10 personas)

- [ ] Crear las 10 cuentas en Supabase Auth o dejar que registren ellos con sus emails
- [ ] Asignar roles en tabla `profiles` manualmente (o desde panel de super_admin)
- [ ] Capacitación: walkthrough del CRM + MetaPanel (30 min por asesor)
- [ ] Seedear leads reales del equipo (exportar de donde estén hoy + importar)
- [ ] Definir con Ivan quién es `super_admin` vs `director` vs `asesor` en el equipo actual

---

## Estado actual del frontend ✅

Todo lo siguiente ya está entregado y listo:

- [x] CRM completo: pipeline, kanban drag, score, hot leads, filtros, MetaPanel
- [x] Lista de Acción: quick-add, prioridades, responsables, completadas colapsables
- [x] Plan Estratégico: edición inline, OKRs, números críticos, tema anual
- [x] Protocolo de Ventas: hero, flujo de trabajo, BANT, SLA, objeciones
- [x] iAgents IA: botón visible (deshabilitado — listo para conectar)
- [x] ERP: proyectos inmobiliarios, progreso, documentos
- [x] RRHH: portal de candidatos, scoring IA, vacantes
- [x] Finanzas: dashboard con gráficas, categorías, reportes
- [x] Landing + Login + Pricing (sitio público)
- [x] Dark mode + Light mode en toda la app
- [x] Responsive en breakpoints principales
- [x] Auth con localStorage (demo) → listo para migrar a Supabase

---

*Generado: Abril 2026 · Stratos AI · Para cualquier duda técnica contactar a Ivan*
