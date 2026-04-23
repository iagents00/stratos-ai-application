# Stratos AI — Arquitectura Backend & Base de Datos

> **Para Jorge Calderón (Dev Backend)**
> Este documento fue generado automáticamente analizando el frontend completo del CRM.
> Contiene el modelo de datos, las 3 propuestas de infraestructura y los pasos para arrancar.

---

## 1. Modelo de Datos (derivado del frontend)

### Entidades identificadas

| Entidad | Descripción |
|---|---|
| `users` | Asesores, directores, CEO, super_admin |
| `leads` | Clientes del pipeline CRM |
| `seguimientos` | Historial de contactos por lead |
| `proyectos` | Inmuebles/desarrollos disponibles |
| `campanas` | Fuentes de marketing (Meta Ads, Google, Referido, etc.) |
| `tareas` | Próximas acciones por lead |
| `notificaciones` | Alertas del sistema y agentes IA |
| `equipos` | Grupos de asesores por director |
| `transacciones` | Módulo de finanzas |
| `rrhh_records` | Módulo RRHH |

### Pipeline CRM — Etapas

```
Nuevo Registro → Primer Contacto → Seguimiento → Zoom Agendado →
Zoom Concretado → Visita Agendada → Visita Concretada → Negociación → Cierre
                                                                     ↘ Perdido
```

### Roles de usuario

```
super_admin  → Acceso total + gestión de usuarios
ceo          → Dashboard, CRM, ERP, Finanzas, Equipo (lectura completa)
director     → Su equipo + sus leads + su pipeline
asesor       → Solo sus leads asignados
```

---

## 2. Esquema PostgreSQL Completo

```sql
-- ════════════════════════════════════════════════════════════
-- STRATOS AI — PostgreSQL Schema v1.0
-- Compatible con Supabase y PostgreSQL standalone
-- ════════════════════════════════════════════════════════════

-- EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- búsqueda fuzzy en nombres

-- ─────────────────────────────────────────────────────────────
-- EQUIPOS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE equipos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- USUARIOS (asesores, directores, etc.)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT UNIQUE NOT NULL,
  nombre      TEXT NOT NULL,
  avatar_url  TEXT,
  role        TEXT NOT NULL CHECK (role IN ('super_admin','ceo','director','asesor')),
  equipo_id   UUID REFERENCES equipos(id) ON DELETE SET NULL,
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- CAMPAÑAS (fuentes de leads)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE campanas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,        -- "Facebook Ads", "Google Ads", "Referido", etc.
  canal       TEXT,                 -- "paid_social", "paid_search", "organic", "referral"
  activa      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed inicial
INSERT INTO campanas (nombre, canal) VALUES
  ('Facebook Ads', 'paid_social'),
  ('Google Ads', 'paid_search'),
  ('LinkedIn', 'paid_social'),
  ('Referido', 'referral'),
  ('Referido VIP', 'referral'),
  ('Evento VIP', 'offline'),
  ('Cancún', 'offline'),
  ('Orgánico Web', 'organic');

-- ─────────────────────────────────────────────────────────────
-- PROYECTOS INMOBILIARIOS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE proyectos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre               TEXT NOT NULL,          -- "Torre 25", "Gobernador 28"
  ubicacion            TEXT,
  descripcion          TEXT,
  precio_base_usd      NUMERIC(15,2),
  unidades_total       INTEGER DEFAULT 0,
  unidades_disponibles INTEGER DEFAULT 0,
  status               TEXT DEFAULT 'activo' CHECK (status IN ('activo','preventa','entregado','pausado')),
  imagen_url           TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Seed inicial
INSERT INTO proyectos (nombre, ubicacion, status) VALUES
  ('Torre 25', 'Playa del Carmen', 'preventa'),
  ('BAGA', 'Playa del Carmen', 'activo'),
  ('Kaab On The Beach', 'Playa del Carmen', 'preventa'),
  ('Gobernador 28', 'Playa del Carmen', 'activo'),
  ('Monarca 28', 'Playa del Carmen', 'preventa'),
  ('Portofino', 'Riviera Maya', 'activo');

-- ─────────────────────────────────────────────────────────────
-- LEADS (núcleo del CRM)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE leads (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Datos de contacto
  nombre           TEXT NOT NULL,
  tag              TEXT,                          -- "Inversión + Disfrute", "CEO · Tecnología"
  phone            TEXT,
  email            TEXT,

  -- Pipeline
  etapa            TEXT NOT NULL DEFAULT 'Nuevo Registro'
                   CHECK (etapa IN (
                     'Nuevo Registro','Primer Contacto','Seguimiento',
                     'Zoom Agendado','Zoom Concretado',
                     'Visita Agendada','Visita Concretada',
                     'Negociación','Cierre','Perdido'
                   )),

  -- Presupuesto
  presupuesto_usd  NUMERIC(15,2),                -- numérico para ordenar/filtrar
  presupuesto_txt  TEXT,                         -- "$4.2M USD" — texto display

  -- Clasificación
  score            SMALLINT DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  hot              BOOLEAN DEFAULT FALSE,
  is_new           BOOLEAN DEFAULT TRUE,
  friccion         TEXT DEFAULT 'Medio' CHECK (friccion IN ('Bajo','Medio','Alto')),

  -- Perfil IA
  bio              TEXT,                          -- perfil del cliente
  risk             TEXT,                          -- riesgo identificado
  notas            TEXT,                          -- historial completo (markdown)

  -- Próxima acción
  next_action      TEXT,
  next_action_date TEXT,                          -- puede ser "Esta semana", "Hoy", ISO date
  last_activity    TEXT,
  days_inactive    INTEGER DEFAULT 0,

  -- Relaciones
  asesor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  proyecto_id      UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  campana_id       UUID REFERENCES campanas(id) ON DELETE SET NULL,

  -- Seguimientos (contador desnormalizado para performance)
  seguimientos_count INTEGER DEFAULT 0,

  -- Meta
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda y filtros del CRM
CREATE INDEX idx_leads_etapa ON leads(etapa);
CREATE INDEX idx_leads_asesor ON leads(asesor_id);
CREATE INDEX idx_leads_hot ON leads(hot) WHERE hot = TRUE;
CREATE INDEX idx_leads_score ON leads(score DESC);
CREATE INDEX idx_leads_nombre_trgm ON leads USING gin(nombre gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────
-- SEGUIMIENTOS (historial de contactos)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE seguimientos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  asesor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  tipo        TEXT DEFAULT 'llamada'
              CHECK (tipo IN ('llamada','whatsapp','email','zoom','visita','nota')),
  resumen     TEXT,
  fecha       TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_seguimientos_lead ON seguimientos(lead_id);

-- Trigger: actualiza seguimientos_count en leads automáticamente
CREATE OR REPLACE FUNCTION update_seguimientos_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE leads
  SET seguimientos_count = (
    SELECT COUNT(*) FROM seguimientos WHERE lead_id = COALESCE(NEW.lead_id, OLD.lead_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seguimientos_count
AFTER INSERT OR DELETE ON seguimientos
FOR EACH ROW EXECUTE FUNCTION update_seguimientos_count();

-- ─────────────────────────────────────────────────────────────
-- NOTIFICACIONES (DynIsland + alertas IA)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE notificaciones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  tipo        TEXT,                              -- "alerta_ia", "tarea", "sistema"
  agente      TEXT,                              -- "Agente Estratégico", "Inteligencia de Datos"
  titulo      TEXT NOT NULL,
  detalle     TEXT,
  accion_url  TEXT,
  leida       BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_user_unread ON notificaciones(user_id, leida) WHERE leida = FALSE;

-- ─────────────────────────────────────────────────────────────
-- FINANZAS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE transacciones (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo         TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso','comision','devolucion')),
  monto_usd    NUMERIC(15,2) NOT NULL,
  categoria    TEXT,
  descripcion  TEXT,
  proyecto_id  UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  lead_id      UUID REFERENCES leads(id) ON DELETE SET NULL,
  asesor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  fecha        DATE DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- RRHH
-- ─────────────────────────────────────────────────────────────
CREATE TABLE rrhh_records (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  tipo         TEXT CHECK (tipo IN ('contrato','evaluacion','incidencia','bono','vacacion')),
  descripcion  TEXT,
  monto_usd    NUMERIC(15,2),
  fecha        DATE DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- UPDATED_AT automático (para todas las tablas que lo usan)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_proyectos_updated_at
BEFORE UPDATE ON proyectos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## 3. Las 3 Propuestas de Backend

---

### 🟢 Opción A — Supabase (MVP más rápido)
**Tiempo al aire: 1 semana**

```
React Frontend ←──────────────→ Supabase
                  supabase-js       ├── PostgreSQL (el schema de arriba)
                                    ├── Auth (email/pass + roles)
                                    ├── Realtime (pipeline en vivo)
                                    ├── Storage (docs de clientes)
                                    └── Edge Functions (lógica IA)
```

**Cuándo usar:** Quieren salir a producción rápido. El frontend ya tiene `src/lib/supabase.js` listo.

**Costo:** $0 → $25/mes

---

### 🔵 Opción B — Node.js + Express + PostgreSQL
**Tiempo al aire: 3-4 semanas**

```
React Frontend ←──── API REST ────→ PostgreSQL
                  (Node + Express)      (Railway / Render / VPS)
                       │
                   ├── JWT Auth
                   ├── Prisma ORM
                   ├── Redis (cache)
                   ├── Bull (colas)
                   └── Claude/OpenAI SDK
```

**Stack recomendado:**
```json
{
  "runtime": "Node.js 20 LTS",
  "framework": "Express 5 + TypeScript",
  "orm": "Prisma",
  "auth": "JWT + bcrypt",
  "cache": "Redis (Upstash - serverless)",
  "queue": "BullMQ",
  "email": "Resend",
  "ai": "Anthropic Claude SDK",
  "deploy": "Railway",
  "db": "PostgreSQL (Railway)"
}
```

**Estructura de carpetas:**
```
backend/
├── src/
│   ├── routes/
│   │   ├── leads.router.ts
│   │   ├── users.router.ts
│   │   ├── proyectos.router.ts
│   │   ├── seguimientos.router.ts
│   │   ├── analytics.router.ts
│   │   └── ai.router.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts      ← JWT verify
│   │   └── rbac.middleware.ts      ← Roles y permisos
│   ├── services/
│   │   ├── leads.service.ts
│   │   ├── ai.service.ts           ← Claude integración
│   │   ├── email.service.ts        ← Resend
│   │   └── analytics.service.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── index.ts
├── .env
├── package.json
└── Dockerfile
```

**Costo:** $10-30/mes (Railway todo incluido)

---

### 🟡 Opción C — Híbrido Supabase + Node.js ⭐ RECOMENDADA
**Tiempo al aire: 2 semanas MVP, escalable a enterprise**

```
React Frontend
      │
      ├──── supabase-js ────→ Supabase
      │                          ├── Auth + RLS (seguridad por rol)
      │                          ├── PostgreSQL CRUD directo
      │                          ├── Realtime subscriptions
      │                          └── Storage (archivos)
      │
      └──── axios/fetch ───→ Node.js Microservicio (Railway)
                                 ├── Agentes IA (Claude API)
                                 ├── Webhooks Meta/Google Ads
                                 ├── Emails automáticos (Resend)
                                 ├── Reportes PDF
                                 └── Score predictivo de leads
```

**Por qué es la mejor:**
- Lanzas en 1 semana solo con Supabase
- Añades Node.js progresivamente sin reescribir nada
- Auth y seguridad (RLS) las maneja Supabase — no las construyes
- Los Agentes IA tienen su propio servidor con Claude integrado
- Escala a miles de usuarios sin cambiar arquitectura

---

## 4. APIs necesarias (contratos para el frontend)

### Leads
```
GET    /api/leads              → Lista con filtros (etapa, asesor, hot, búsqueda)
GET    /api/leads/:id          → Lead individual + seguimientos
POST   /api/leads              → Crear lead
PATCH  /api/leads/:id          → Actualizar (etapa, score, notas, etc.)
DELETE /api/leads/:id          → Eliminar (solo super_admin)
PATCH  /api/leads/:id/etapa    → Mover en pipeline (con log automático)
```

### Seguimientos
```
GET    /api/leads/:id/seguimientos   → Historial
POST   /api/leads/:id/seguimientos   → Registrar (+1 al contador)
```

### Analytics (Dashboard)
```
GET    /api/analytics/dashboard      → KPIs del CRM
GET    /api/analytics/pipeline       → Leads por etapa
GET    /api/analytics/equipo         → Performance por asesor
GET    /api/analytics/campanas       → ROI por campaña
```

### Agentes IA
```
POST   /api/ai/score-lead            → Score predictivo de un lead
POST   /api/ai/next-action           → Sugerir próxima acción
POST   /api/ai/dossier/:id           → Generar dossier PDF
POST   /api/ai/chat                  → Chat contextual del CRM
```

---

## 5. Seguridad (Row Level Security con Supabase)

```sql
-- Asesores solo ven SUS leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asesor_own_leads" ON leads
  FOR ALL USING (
    asesor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin','ceo','director')
    )
  );

-- Directores ven leads de su equipo
CREATE POLICY "director_team_leads" ON leads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'director'
      AND asesor_id IN (
        SELECT id FROM users WHERE equipo_id = u.equipo_id
      )
    )
  );
```

---

## 6. Variables de Entorno necesarias

```bash
# .env — Backend Node.js
DATABASE_URL=postgresql://user:pass@host:5432/stratos_ai
JWT_SECRET=super_secret_key_256bits
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # solo si usa híbrido
PORT=3001

# .env.local — Frontend React (ya existe)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=https://api.stratoscapitalgroup.com
```

---

## 7. Plan de Implementación por Fases

### Fase 1 — MVP (Semana 1-2)
- [ ] Crear proyecto Supabase
- [ ] Correr el SQL del schema (sección 2 de este doc)
- [ ] Configurar Auth con roles
- [ ] Conectar frontend: reemplazar `leads.js` mock con queries reales
- [ ] Desplegar en Vercel (frontend) + Supabase (backend)

### Fase 2 — Funcionalidades Core (Semana 3-4)
- [ ] Node.js microservicio en Railway
- [ ] Integración Claude API para scoring de leads
- [ ] Emails automáticos de seguimiento (Resend)
- [ ] Webhooks de Meta Ads y Google Ads

### Fase 3 — Escala (Mes 2+)
- [ ] Reportes PDF con Puppeteer
- [ ] Dashboard analytics avanzado
- [ ] Módulo Finanzas conectado a DB
- [ ] Módulo RRHH conectado a DB
- [ ] App móvil (React Native con el mismo backend)

---

## 8. Decisión Final Recomendada

```
┌─────────────────────────────────────────────────────────┐
│  RECOMENDACIÓN: OPCIÓN C (Híbrido)                      │
│                                                         │
│  Semana 1:  Supabase solo → frontend conectado a DB     │
│  Semana 2:  Auth + RLS + Realtime funcionando           │
│  Semana 3:  Node.js microservicio → Agentes IA reales   │
│  Semana 4:  QA + deploy producción                      │
│                                                         │
│  Costo mensual: ~$35/mes (Supabase Pro + Railway)       │
│  Stack: PostgreSQL + Supabase + Node.js + Claude API    │
└─────────────────────────────────────────────────────────┘
```

---

*Documento generado por Claude Code analizando el frontend de Stratos AI — Abril 2026*
*Para preguntas técnicas, el frontend está en: `src/app/App.jsx` y `src/data/leads.js`*
