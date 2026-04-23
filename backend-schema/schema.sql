-- ════════════════════════════════════════════════════════════
-- STRATOS AI — PostgreSQL Schema v1.0
-- Ejecutar en Supabase SQL Editor o psql
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- EQUIPOS
CREATE TABLE IF NOT EXISTS equipos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- USUARIOS
CREATE TABLE IF NOT EXISTS users (
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

-- CAMPAÑAS
CREATE TABLE IF NOT EXISTS campanas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre     TEXT NOT NULL,
  canal      TEXT,
  activa     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO campanas (nombre, canal) VALUES
  ('Facebook Ads', 'paid_social'),
  ('Google Ads', 'paid_search'),
  ('LinkedIn', 'paid_social'),
  ('Referido', 'referral'),
  ('Referido VIP', 'referral'),
  ('Evento VIP', 'offline'),
  ('Cancún', 'offline'),
  ('Orgánico Web', 'organic')
ON CONFLICT DO NOTHING;

-- PROYECTOS
CREATE TABLE IF NOT EXISTS proyectos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre               TEXT NOT NULL,
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

INSERT INTO proyectos (nombre, ubicacion, status) VALUES
  ('Torre 25', 'Playa del Carmen', 'preventa'),
  ('BAGA', 'Playa del Carmen', 'activo'),
  ('Kaab On The Beach', 'Playa del Carmen', 'preventa'),
  ('Gobernador 28', 'Playa del Carmen', 'activo'),
  ('Monarca 28', 'Playa del Carmen', 'preventa'),
  ('Portofino', 'Riviera Maya', 'activo')
ON CONFLICT DO NOTHING;

-- LEADS
CREATE TABLE IF NOT EXISTS leads (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre           TEXT NOT NULL,
  tag              TEXT,
  phone            TEXT,
  email            TEXT,
  etapa            TEXT NOT NULL DEFAULT 'Nuevo Registro'
                   CHECK (etapa IN (
                     'Nuevo Registro','Primer Contacto','Seguimiento',
                     'Zoom Agendado','Zoom Concretado',
                     'Visita Agendada','Visita Concretada',
                     'Negociación','Cierre','Perdido'
                   )),
  presupuesto_usd  NUMERIC(15,2),
  presupuesto_txt  TEXT,
  score            SMALLINT DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  hot              BOOLEAN DEFAULT FALSE,
  is_new           BOOLEAN DEFAULT TRUE,
  friccion         TEXT DEFAULT 'Medio' CHECK (friccion IN ('Bajo','Medio','Alto')),
  bio              TEXT,
  risk             TEXT,
  notas            TEXT,
  next_action      TEXT,
  next_action_date TEXT,
  last_activity    TEXT,
  days_inactive    INTEGER DEFAULT 0,
  asesor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  proyecto_id      UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  campana_id       UUID REFERENCES campanas(id) ON DELETE SET NULL,
  seguimientos_count INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_etapa   ON leads(etapa);
CREATE INDEX IF NOT EXISTS idx_leads_asesor  ON leads(asesor_id);
CREATE INDEX IF NOT EXISTS idx_leads_hot     ON leads(hot) WHERE hot = TRUE;
CREATE INDEX IF NOT EXISTS idx_leads_score   ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_nombre  ON leads USING gin(nombre gin_trgm_ops);

-- SEGUIMIENTOS
CREATE TABLE IF NOT EXISTS seguimientos (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id    UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  asesor_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  tipo       TEXT DEFAULT 'llamada'
             CHECK (tipo IN ('llamada','whatsapp','email','zoom','visita','nota')),
  resumen    TEXT,
  fecha      TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seguimientos_lead ON seguimientos(lead_id);

-- Trigger: actualiza contador de seguimientos
CREATE OR REPLACE FUNCTION update_seguimientos_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE leads
  SET seguimientos_count = (
    SELECT COUNT(*) FROM seguimientos
    WHERE lead_id = COALESCE(NEW.lead_id, OLD.lead_id)
  ), updated_at = NOW()
  WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seguimientos_count ON seguimientos;
CREATE TRIGGER trg_seguimientos_count
AFTER INSERT OR DELETE ON seguimientos
FOR EACH ROW EXECUTE FUNCTION update_seguimientos_count();

-- NOTIFICACIONES
CREATE TABLE IF NOT EXISTS notificaciones (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  tipo       TEXT,
  agente     TEXT,
  titulo     TEXT NOT NULL,
  detalle    TEXT,
  accion_url TEXT,
  leida      BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_unread ON notificaciones(user_id, leida) WHERE leida = FALSE;

-- FINANZAS
CREATE TABLE IF NOT EXISTS transacciones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo        TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso','comision','devolucion')),
  monto_usd   NUMERIC(15,2) NOT NULL,
  categoria   TEXT,
  descripcion TEXT,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  lead_id     UUID REFERENCES leads(id) ON DELETE SET NULL,
  asesor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  fecha       DATE DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RRHH
CREATE TABLE IF NOT EXISTS rrhh_records (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  tipo        TEXT CHECK (tipo IN ('contrato','evaluacion','incidencia','bono','vacacion')),
  descripcion TEXT,
  monto_usd   NUMERIC(15,2),
  fecha       DATE DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger updated_at genérico
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_updated ON leads;
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_proyectos_updated ON proyectos;
CREATE TRIGGER trg_proyectos_updated BEFORE UPDATE ON proyectos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ════════════════════════════════════════
-- ROW LEVEL SECURITY (para Supabase)
-- ════════════════════════════════════════
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Asesores ven sus propios leads; roles superiores ven todo
CREATE POLICY "leads_access" ON leads FOR ALL
USING (
  asesor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid()
    AND role IN ('super_admin','ceo','director')
  )
);

-- Seguimientos: acceso via el lead
CREATE POLICY "seguimientos_access" ON seguimientos FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM leads l WHERE l.id = lead_id
    AND (
      l.asesor_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid()
        AND role IN ('super_admin','ceo','director')
      )
    )
  )
);

-- Notificaciones: solo el propio usuario
CREATE POLICY "notif_own" ON notificaciones FOR ALL
USING (user_id = auth.uid());
