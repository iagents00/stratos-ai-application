# PLAN DESARROLLADOR — STRATOS AI
## Backend + Frontend conectado · Duke del Caribe · 10 usuarios · HOY

**Objetivo:** Conectar Supabase real para que los 10 asesores puedan iniciar sesión,
ver el CRM y que los datos persistan entre sesiones.

**Tiempo estimado:** 4–6 horas para un desarrollador con acceso al repo y a Supabase.

---

## CREDENCIALES Y ACCESO

```
Repositorio:    https://github.com/iagents00/stratos-ai-application
Rama:           main
App en Vercel:  https://stratos-ai-application.vercel.app
Supabase URL:   https://ezlwrqlyebahulbienjs.supabase.co
Supabase Key:   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6bHdycWx5ZWJhaHVsYmllbmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTk2NTEsImV4cCI6MjA5MTE3NTY1MX0.UOcj5weL0K34aKcukZxGYxsgUo5acyT6CJFs7KCBB5E
```

---

## PASO 1 — SQL en Supabase (15 min)

Ir a **supabase.com → proyecto → SQL Editor → New query** y ejecutar este script completo:

```sql
-- ════════════════════════════════════════════════════════════════════
-- STRATOS AI — Setup inicial Duke del Caribe
-- Ejecutar TODO en una sola query en el SQL Editor de Supabase
-- ════════════════════════════════════════════════════════════════════

-- 1. TABLA PROFILES (extiende auth.users con nombre y rol)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'asesor'
             CHECK (role IN ('super_admin','admin','ceo','director','asesor')),
  phone      TEXT,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLA LEADS (el CRM completo)
CREATE TABLE IF NOT EXISTS public.leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asesor_id        UUID REFERENCES public.profiles(id),
  asesor_name      TEXT,

  -- Datos del cliente
  name             TEXT NOT NULL,
  phone            TEXT,
  email            TEXT,
  tag              TEXT,

  -- Pipeline
  stage            TEXT NOT NULL DEFAULT 'Nuevo Registro',
  score            INT DEFAULT 5 CHECK (score BETWEEN 0 AND 100),
  hot              BOOLEAN DEFAULT false,
  is_new           BOOLEAN DEFAULT true,

  -- Financiero
  budget           TEXT,
  presupuesto      NUMERIC(12,2) DEFAULT 0,

  -- Proyecto
  project          TEXT,
  campaign         TEXT,
  source           TEXT DEFAULT 'manual',

  -- Operativo CRM
  next_action      TEXT,
  next_action_date TEXT,
  last_activity    TEXT,
  days_inactive    INT DEFAULT 0,
  seguimientos     INT DEFAULT 0,
  notas            TEXT,
  bio              TEXT,
  risk             TEXT,
  friction         TEXT,

  -- IA
  ai_agent         TEXT,

  -- Prioridad
  priority         BOOLEAN DEFAULT false,
  priority_order   INT,

  -- Timestamps
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at       TIMESTAMPTZ  -- soft delete
);

-- 3. ÍNDICES para performance
CREATE INDEX IF NOT EXISTS leads_asesor_idx  ON public.leads(asesor_id);
CREATE INDEX IF NOT EXISTS leads_stage_idx   ON public.leads(stage);
CREATE INDEX IF NOT EXISTS leads_hot_idx     ON public.leads(hot) WHERE hot = true;

-- 4. TRIGGER updated_at automático
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. TRIGGER: crea perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'asesor')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads    ENABLE ROW LEVEL SECURITY;

-- Profiles: cada usuario ve todos los de la misma app (sin org por ahora)
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Leads: todos los autenticados ven todos los leads (para equipo pequeño)
-- NOTA: cuando escale, aquí se agrega filtro por asesor_id para asesores
DROP POLICY IF EXISTS "leads_select" ON public.leads;
CREATE POLICY "leads_select" ON public.leads
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "leads_update" ON public.leads;
CREATE POLICY "leads_update" ON public.leads
  FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "leads_delete" ON public.leads;
CREATE POLICY "leads_delete" ON public.leads
  FOR DELETE USING (auth.role() = 'authenticated');

-- 7. FUNCIÓN para obtener el perfil del usuario actual (usada en el frontend)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE(id UUID, name TEXT, role TEXT, phone TEXT, active BOOLEAN)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT id, name, role, phone, active FROM public.profiles WHERE id = auth.uid();
$$;

-- Verificar que todo se creó correctamente
SELECT 'profiles' as tabla, count(*) FROM public.profiles
UNION ALL
SELECT 'leads', count(*) FROM public.leads;
```

Si muestra `profiles | 0` y `leads | 0` — ✅ todo correcto, tablas creadas vacías.

---

## PASO 2 — Crear los 10 usuarios (20 min)

### Opción A: Desde Supabase Dashboard (más rápido hoy)

Ir a **Authentication → Users → Add user** y crear cada uno:

| Nombre | Email | Contraseña | Rol |
|--------|-------|-----------|-----|
| Ivan Rodriguez | ivan@dukedel caribe.mx | Duke2027! | super_admin |
| Director Duke | director@dukedel caribe.mx | Duke2027! | director |
| Asesor 1 | asesor1@dukedel caribe.mx | Duke2027! | asesor |
| Asesor 2 | asesor2@dukedel caribe.mx | Duke2027! | asesor |
| Asesor 3 | asesor3@dukedel caribe.mx | Duke2027! | asesor |
| Asesor 4 | asesor4@dukedel caribe.mx | Duke2027! | asesor |
| Asesor 5 | asesor5@dukedel caribe.mx | Duke2027! | asesor |
| Asesor 6 | asesor6@dukedel caribe.mx | Duke2027! | asesor |
| Asesor 7 | asesor7@dukedel caribe.mx | Duke2027! | asesor |
| Asesor 8 | asesor8@dukedel caribe.mx | Duke2027! | asesor |

**IMPORTANTE:** En "Send confirmation email" → desactivar para que entren directo sin confirmar email.

### Después de crear los usuarios, asignar roles en SQL:

```sql
-- Ejecutar en SQL Editor — reemplazar los emails reales de tu equipo
UPDATE public.profiles SET role = 'super_admin' WHERE id = (
  SELECT id FROM auth.users WHERE email = 'ivan@dukedel caribe.mx'
);
UPDATE public.profiles SET role = 'director' WHERE id = (
  SELECT id FROM auth.users WHERE email = 'director@dukedel caribe.mx'
);
-- Los asesores ya tienen role='asesor' por default — no necesitan UPDATE

-- Verificar que todos tienen perfil y rol correcto:
SELECT p.name, p.role, u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.role;
```

---

## PASO 3 — Cambios en el código (2–3 horas)

### 3.1 Activar el cliente de Supabase

**Archivo:** `src/lib/supabase.js` — REEMPLAZAR TODO el contenido:

```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('⚠️ Faltan variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  }
})
```

---

### 3.2 Reemplazar auth.js con Supabase Auth

**Archivo:** `src/lib/auth.js` — REEMPLAZAR TODO el contenido:

```js
/**
 * lib/auth.js — Autenticación con Supabase Auth
 * Misma interfaz { data, error } que antes — AuthContext.jsx no cambia.
 */
import { supabase } from './supabase'

// seedDemoUser ya no hace nada — usuarios viven en Supabase
export function seedDemoUser() {}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { data: null, error: error.message }

  // Traer perfil con rol desde la tabla profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, role, phone, active')
    .eq('id', data.user.id)
    .single()

  if (profileError) return { data: null, error: 'No se encontró tu perfil. Contacta al admin.' }
  if (profile.active === false) return { data: null, error: 'Cuenta desactivada. Contacta al admin.' }

  // Retornar usuario con el mismo shape que antes: { id, name, email, role }
  const user = {
    id:    profile.id,
    name:  profile.name,
    email: data.user.email,
    role:  profile.role,
    phone: profile.phone,
  }
  return { data: user, error: null }
}

export async function signUp(name, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role: 'asesor' } }
  })
  if (error) return { data: null, error: error.message }

  const user = {
    id:    data.user.id,
    name,
    email: data.user.email,
    role:  'asesor',
  }
  return { data: user, error: null }
}

export async function signOut() {
  await supabase.auth.signOut()
  return { error: null }
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/?app&reset=true`,
  })
  if (error) return { data: null, error: error.message }
  return { data: { message: 'Email enviado. Revisa tu bandeja de entrada.' }, error: null }
}

export async function getStoredSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role, phone, active')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.active === false) return null

  return {
    id:    profile.id,
    name:  profile.name,
    email: session.user.email,
    role:  profile.role,
    phone: profile.phone,
  }
}

// Admin functions (para el panel de admin en App.jsx)
export async function adminGetAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, phone, active, created_at')
    .order('created_at')
  if (error) return []
  return data
}

export async function adminCreateUser({ name, email, password, role }) {
  // Crear auth user con Supabase Admin API (solo funciona con service_role key)
  // Por ahora: crear desde el dashboard de Supabase → Authentication → Users
  console.warn('adminCreateUser: crear usuario desde Supabase Dashboard directamente')
  return { data: null, error: 'Crear usuarios desde Supabase Dashboard → Authentication → Users' }
}

export async function adminUpdateUser(id, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return { data, error: error?.message ?? null }
}

export async function adminDeleteUser(id, currentUserId) {
  if (id === currentUserId) return { error: 'No puedes desactivar tu propia cuenta.' }
  const { error } = await supabase
    .from('profiles')
    .update({ active: false })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function adminResetPassword(id, newPassword) {
  // Reset de contraseña via Supabase Dashboard o email de reset
  return { data: null, error: 'Usar Supabase Dashboard → Authentication → Users → Reset password' }
}
```

---

### 3.3 Actualizar AuthContext para Supabase session listener

**Archivo:** `src/contexts/AuthContext.jsx` — REEMPLAZAR el `useEffect` inicial (líneas 35–47):

```jsx
// ANTES (líneas 35–47):
useEffect(() => {
  seedDemoUser();
  const session = getStoredSession();
  if (session && session.role) {
    setUser(session);
  } else {
    localStorage.removeItem("stratos_user");
    setUser(null);
  }
  setLoading(false);
}, []);

// DESPUÉS — reemplazar por esto:
useEffect(() => {
  // Hidratación inicial desde Supabase
  getStoredSession().then(session => {
    setUser(session);
    setLoading(false);
  });

  // Listener en tiempo real de cambios de sesión (login/logout/token refresh)
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        return;
      }
      // Refrescar perfil del usuario al cambiar sesión
      const profile = await getStoredSession();
      setUser(profile);
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

**También agregar el import al inicio de AuthContext.jsx:**
```jsx
import { supabase } from '../lib/supabase';
```

---

### 3.4 Conectar leads con Supabase en App.jsx

**Archivo:** `src/app/App.jsx`

**Buscar la línea 2204:**
```jsx
const [leadsData, setLeadsData] = useState(leads);
```

**Reemplazar por:**
```jsx
const [leadsData, setLeadsData] = useState([]);
const [leadsLoading, setLeadsLoading] = useState(true);

// Fetch leads desde Supabase al montar
useEffect(() => {
  if (!user) return;
  fetchLeads();

  // Realtime: actualiza cuando cualquier asesor cambia un lead
  const channel = supabase
    .channel('leads-realtime')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'leads' },
      () => fetchLeads()
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [user]);

async function fetchLeads() {
  setLeadsLoading(true);
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (!error && data) {
    // Normalizar campos snake_case → camelCase para que el frontend no cambie
    const normalized = data.map(l => ({
      ...l,
      n:               l.name,
      st:              l.stage,
      sc:              l.score,
      p:               l.project,
      campana:         l.campaign,
      budget:          l.budget,
      presupuesto:     l.presupuesto,
      hot:             l.hot,
      isNew:           l.is_new,
      nextAction:      l.next_action,
      nextActionDate:  l.next_action_date,
      lastActivity:    l.last_activity,
      daysInactive:    l.days_inactive,
      seguimientos:    l.seguimientos,
      notas:           l.notas,
      aiAgent:         l.ai_agent,
      asesor:          l.asesor_name,
      fechaIngreso:    new Date(l.created_at).toLocaleDateString('es-MX',
                         { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    }));
    setLeadsData(normalized);
  }
  setLeadsLoading(false);
}
```

**Agregar el import de supabase al inicio de App.jsx** (si no existe):
```jsx
import { supabase } from '../lib/supabase';
```

---

### 3.5 Hacer que updateLead guarde en Supabase

**Buscar en App.jsx la función `updateLead`** — agregar el save a Supabase dentro:

```jsx
// Buscar la función updateLead en App.jsx y agregar DESPUÉS del setLeadsData:
const updateLead = useCallback(async (updated) => {
  setLeadsData(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));

  // Guardar en Supabase (mapear camelCase → snake_case)
  const { error } = await supabase
    .from('leads')
    .update({
      name:             updated.n ?? updated.name,
      stage:            updated.st ?? updated.stage,
      score:            updated.sc ?? updated.score,
      hot:              updated.hot,
      is_new:           updated.isNew ?? updated.is_new,
      budget:           updated.budget,
      presupuesto:      updated.presupuesto,
      project:          updated.p ?? updated.project,
      campaign:         updated.campana ?? updated.campaign,
      source:           updated.source,
      next_action:      updated.nextAction ?? updated.next_action,
      next_action_date: updated.nextActionDate ?? updated.next_action_date,
      last_activity:    updated.lastActivity ?? updated.last_activity,
      days_inactive:    updated.daysInactive ?? updated.days_inactive,
      seguimientos:     updated.seguimientos,
      notas:            updated.notas,
      bio:              updated.bio,
      risk:             updated.risk,
      friction:         updated.friction,
      tag:              updated.tag,
      ai_agent:         updated.aiAgent ?? updated.ai_agent,
      priority:         updated.priority,
      priority_order:   updated.priority_order ?? updated.pinnedId,
      asesor_name:      updated.asesor,
      asesor_id:        updated.asesor_id,
    })
    .eq('id', updated.id);

  if (error) console.error('Error guardando lead:', error.message);
}, []);
```

---

### 3.6 Hacer que addNewLead guarde en Supabase

**Buscar la función `addNewLead` en App.jsx** — agregar insert a Supabase:

```jsx
// Al inicio de addNewLead, ANTES del setLeadsData([newLead, ...]):

const leadToInsert = {
  name:             newLead.n,
  phone:            newLead.phone,
  email:            newLead.email,
  stage:            newLead.st || 'Nuevo Registro',
  score:            newLead.sc || 5,
  hot:              newLead.hot || false,
  is_new:           true,
  budget:           newLead.budget,
  presupuesto:      newLead.presupuesto || 0,
  project:          newLead.p,
  campaign:         newLead.campana,
  source:           newLead.source || 'manual',
  next_action:      newLead.nextAction,
  notas:            newLead.notas,
  tag:              newLead.tag,
  asesor_name:      newLead.asesor,
  asesor_id:        user?.id,   // ID real del asesor logueado
};

const { data: savedLead, error } = await supabase
  .from('leads')
  .insert(leadToInsert)
  .select()
  .single();

if (error) {
  console.error('Error creando lead:', error.message);
  return; // No agregar al estado local si falló
}

// Usar el ID real de Supabase (UUID) en lugar del temporal
newLead.id = savedLead.id;
```

---

## PASO 4 — Variables de entorno en Vercel (5 min)

Ir a **vercel.com → proyecto stratos-ai-application → Settings → Environment Variables**
y agregar/confirmar estas 3 variables para **Production + Preview + Development**:

```
VITE_SUPABASE_URL     = https://ezlwrqlyebahulbienjs.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (la key completa)
VITE_IS_APP           = true
```

Después hacer **Deployments → Redeploy** para que Vercel tome las nuevas variables.

---

## PASO 5 — Verificación local (antes de deploy)

```bash
# Clonar / actualizar el repo
git clone https://github.com/iagents00/stratos-ai-application
cd stratos-ai-application

# Instalar dependencias
npm install

# Correr en desarrollo (las variables ya están en .env)
npm run dev

# Abrir http://localhost:5173/?app
# Intentar login con un usuario de Supabase
# Crear un lead → verificar que aparece en Supabase → SQL Editor:
# SELECT * FROM leads ORDER BY created_at DESC LIMIT 5;

# Si todo funciona:
git add -A
git commit -m "feat: Supabase auth + leads persistence conectado"
git push origin main
```

---

## PASO 6 — Configurar Supabase Auth (evitar emails de confirmación hoy)

Para que los asesores puedan entrar directo sin confirmar email:

1. Ir a **Supabase → Authentication → Providers → Email**
2. **Desactivar** "Confirm email"
3. Guardar

Esto permite login inmediato. Cuando el sistema esté estable, volver a activar.

---

## TROUBLESHOOTING — Problemas comunes

### Error: "No se encontró tu perfil"
```sql
-- Verificar que el trigger creó el perfil al registrar el usuario
SELECT p.name, p.role, u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id;

-- Si el usuario existe en auth.users pero no en profiles:
INSERT INTO public.profiles (id, name, role)
SELECT id, email, 'asesor' FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);
```

### Error: "new row violates row-level security"
```sql
-- Verificar que las políticas RLS están activas
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('leads', 'profiles');

-- Si no hay políticas, re-ejecutar el PASO 1 completo
```

### Los leads no aparecen después de crear
```sql
-- Verificar que los leads se guardaron
SELECT id, name, stage, created_at FROM public.leads ORDER BY created_at DESC LIMIT 10;
```

### Login falla con "credenciales incorrectas"
- Verificar que el usuario existe en Supabase → Authentication → Users
- Verificar que "Confirm email" está desactivado
- Intentar resetear la contraseña desde el dashboard de Supabase

---

## CHECKLIST FINAL — Antes de entregar a los asesores

- [ ] Tabla `profiles` creada con 10 usuarios y roles correctos
- [ ] Tabla `leads` creada y vacía (o con datos de prueba)
- [ ] RLS habilitado en ambas tablas
- [ ] Supabase Auth sin confirmación de email
- [ ] `src/lib/supabase.js` activado (no null)
- [ ] `src/lib/auth.js` usando Supabase Auth
- [ ] `src/contexts/AuthContext.jsx` con onAuthStateChange
- [ ] `src/app/App.jsx` fetchLeads + updateLead + addNewLead conectados
- [ ] Variables de entorno en Vercel configuradas
- [ ] Deploy en Vercel completado (verde)
- [ ] Login exitoso con al menos 2 usuarios de prueba
- [ ] Crear lead → verificar en Supabase SQL que aparece
- [ ] Cambiar stage de un lead → verificar que persiste al recargar

---

## DATOS DE PRUEBA OPCIONALES — Para llenar el CRM el primer día

Ejecutar en SQL Editor después de crear los usuarios:

```sql
-- Insertar 5 leads de prueba para que el equipo vea cómo funciona
-- Reemplazar 'ASESOR_UUID' con el UUID real del asesor en Supabase

INSERT INTO public.leads (name, phone, stage, score, hot, budget, presupuesto, project, source, next_action, asesor_name, seguimientos)
VALUES
  ('Carlos Mendoza',   '+52 998 123 4567', 'Primer Contacto',  35, false, '$500K USD',  500000, 'Monarca 28',      'whatsapp', 'Enviar brochure del proyecto',  'Asesor Demo', 1),
  ('Sofía Ramírez',    '+52 998 234 5678', 'Zoom Agendado',    62, true,  '$1.2M USD', 1200000, 'Torre Esmeralda', 'telegram', 'Confirmar zoom para el jueves', 'Asesor Demo', 3),
  ('Alejandro Torres', '+52 998 345 6789', 'Seguimiento',      45, false, '$800K USD',  800000, 'Portofino 28',    'facebook', 'Llamar para hacer seguimiento', 'Asesor Demo', 2),
  ('María García',     '+52 998 456 7890', 'Negociación',      85, true,  '$2M USD',  2000000, 'Gobernador 28',   'manual',   'Revisar contrato con legal',    'Asesor Demo', 7),
  ('Roberto López',    '+52 998 567 8901', 'Nuevo Registro',   10, false, '$300K USD',  300000, 'Monarca 28',      'web',      'Primer contacto este lunes',    'Asesor Demo', 0);
```

---

*Documento preparado el 24 de Abril, 2026 — Stratos AI · Duke del Caribe Sprint 1*
