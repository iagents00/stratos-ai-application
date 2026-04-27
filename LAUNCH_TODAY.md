# 🚀 Lanzamiento HOY — Stratos AI CRM

**Objetivo:** Tener `app.stratoscapitalgroup.com` funcionando con el CRM listo para que el equipo lo empiece a usar HOY.

**Tiempo total estimado:** 90 minutos (incluyendo verificación).

---

## ✅ ORDEN DE EJECUCIÓN (no saltarse pasos)

### Paso 1 — Aplicar schema en Supabase (10 min)

Abre tu proyecto Supabase → **SQL Editor** → New query. Ejecuta en este orden:

| # | Migración | Qué hace |
|---|---|---|
| 1 | `supabase/migrations/001_initial_schema.sql` | Crea `profiles` + `leads` + RLS + trigger de auto-perfil |
| 2 | `supabase/migrations/002_leads_complete_schema.sql` | Agrega columnas que faltaban (`action_history`, `tasks`, `budget`, `notas`, `friction`, `tag`, `priority`, `priority_order`, `asesor_id`) |
| 3 | `supabase/migrations/003_audit_log.sql` | Tabla de auditoría + triggers automáticos en `leads` y `profiles` |
| 4 | `supabase/migrations/004_performance_tuning.sql` | Índices compuestos + RLS optimizado para escala (10 × 30 = 300+ leads) |

**Verificación rápida** (ejecutar al final, en SQL Editor):
```sql
-- Debe devolver 3 tablas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'leads', 'audit_log');

-- Debe devolver columnas: action_history, tasks, notas, budget, etc.
SELECT column_name FROM information_schema.columns
WHERE table_name = 'leads' ORDER BY ordinal_position;
```

---

### Paso 2 — Crear cuentas del equipo (15 min)

**Ubicación:** Supabase Dashboard → Authentication → Users → "Add user" → "Create new user".

Para cada miembro del equipo:
1. Email + password temporal (ej: `Stratos2026!`)
2. ✅ Marcar **"Auto Confirm User"** (evita verificación por email para el setup inicial)
3. Click **Create user**

El trigger `on_auth_user_created` automáticamente crea su perfil con rol `asesor`.

**Asignar roles correctos** (corre en SQL Editor — reemplaza los emails):

```sql
-- ── Equipo Stratos — asignación de roles ──
UPDATE public.profiles SET role = 'super_admin'
  WHERE id = (SELECT id FROM auth.users WHERE email = 'tu-correo@stratos.ai');

UPDATE public.profiles SET role = 'ceo', name = 'Ivan Rodriguez Ruelas'
  WHERE id = (SELECT id FROM auth.users WHERE email = 'ivan@stratos.ai');

-- Directores
UPDATE public.profiles SET role = 'director'
  WHERE id IN (SELECT id FROM auth.users WHERE email IN (
    'director1@stratos.ai',
    'director2@stratos.ai'
  ));

-- Asesores (ya tienen rol 'asesor' por default; solo si cambia algo)
UPDATE public.profiles SET name = 'Nombre del Asesor'
  WHERE id = (SELECT id FROM auth.users WHERE email = 'asesor@stratos.ai');

-- Verificar
SELECT email, p.name, p.role, p.active
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.role, p.name;
```

> 📌 **Roles válidos:** `super_admin`, `admin`, `ceo`, `director`, `asesor`.
> Los `asesor` solo ven SUS propios leads. Los demás ven todos.

---

### Paso 3 — Variables de entorno en Vercel (5 min)

**Ubicación:** Vercel Dashboard → Tu proyecto → Settings → Environment Variables.

Agrega para **Production**, **Preview** y **Development**:

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` (tu proyecto Supabase) |
| `VITE_SUPABASE_ANON_KEY` | (anon key — Settings → API en Supabase) |
| `VITE_APP_URL` | `https://app.stratoscapitalgroup.com` |

> ⚠️ **Importante:** después de agregar variables, redeploy desde Vercel para que apliquen.

---

### Paso 4 — DNS para `app.stratoscapitalgroup.com` (15 min)

**En Vercel:** Settings → Domains → Add → `app.stratoscapitalgroup.com`.

Vercel te dará un registro DNS para configurar. Ejemplo:

| Type | Name | Value |
|---|---|---|
| CNAME | `app` | `cname.vercel-dns.com` |

**En Namecheap** (o tu registrador): Domain List → Manage → Advanced DNS → Add Record con los datos de arriba.

Espera 5-15 min para que propague. Verifica en https://dnschecker.org/.

---

### Paso 5 — Deploy y verificación (15 min)

**Desde Vercel Dashboard:**
1. Deployments → último deploy → "Redeploy" (con cache limpio).
2. Espera a que termine.
3. Abre `https://app.stratoscapitalgroup.com`.

**Checklist de pruebas en producción:**

- [ ] Carga la pantalla de login (no la landing).
- [ ] Login con la cuenta del super_admin funciona.
- [ ] Aparece el dashboard sin errores en consola (F12 → Console).
- [ ] Navegar a CRM muestra los leads (puede estar vacío al inicio — eso es OK).
- [ ] Crear un lead nuevo desde el botón "+ Nuevo cliente" → guarda sin error.
- [ ] **Editar desde Perfil** (cambiar etapa, score, asesor) → guarda y aparece en Historial.
- [ ] **Editar desde Expediente** (agregar nota) → guarda y aparece en Historial.
- [ ] **Editar desde Análisis IA** (cambiar próxima acción) → guarda y aparece en Historial.
- [ ] Ver botón "Historial" arriba a la derecha → muestra los 3 cambios anteriores con quién/cuándo/qué cambió.
- [ ] Cerrar sesión → volver a entrar → la sesión persiste correctamente.
- [ ] **En Supabase SQL Editor:**
  ```sql
  SELECT actor_name, action, entity_type, changed_fields, created_at
  FROM audit_log ORDER BY created_at DESC LIMIT 10;
  ```
  Debe mostrar tus ediciones recientes con el diff campo-por-campo.
- [ ] **Login auditado:**
  ```sql
  SELECT actor_name, action, metadata->>'email', created_at
  FROM audit_log WHERE entity_type = 'auth' ORDER BY created_at DESC LIMIT 5;
  ```
  Debe mostrar tus inicios/cierres de sesión.

---

### Paso 6 — Compartir con el equipo (10 min)

**Mensaje para el equipo (copiar y pegar en WhatsApp/Slack):**

```
🚀 Stratos AI CRM ya está disponible.

🔗 Link: https://app.stratoscapitalgroup.com
📧 Tu correo: [su email]
🔑 Password temporal: [el que creaste]

⚠️ Pasos importantes:
1. Inicia sesión con la contraseña temporal.
2. Ve a tu perfil y CÁMBIALA ahora mismo.
3. Lee la guía rápida (link adjunto): CRM_TUTORIAL.md

Cualquier duda, repórtala. Bienvenidos al sistema operativo de Stratos.
```

Adjunta `CRM_TUTORIAL.md` (la guía para el equipo).

---

## 🟢 LISTO — Qué tienes ya funcionando

Después de estos 6 pasos, el equipo puede:

- Iniciar sesión.
- Ver el pipeline de leads (filtrado por su rol).
- Crear, editar, mover leads entre etapas.
- Agregar notas, próximas acciones, scores.
- Ver el **historial completo** de cambios de cada lead (quién hizo qué, cuándo).
- Los logins, cambios de rol, ediciones quedan **auditados** en `audit_log`.

---

## 🟡 Lo que NO está en esta fase (Fase 2 — siguiente sprint)

- UI para crear/editar usuarios sin salir de la app (hoy se hace desde Supabase Dashboard).
- Forzar cambio de password en primer login.
- Subida de archivos (Supabase Storage no configurado todavía).
- Notificaciones por email.
- Agente de soporte conversacional (ver `PHASE_2_SUPPORT_AGENT.md`).

---

## 🚨 Si algo falla — diagnóstico rápido

| Síntoma | Causa probable | Solución |
|---|---|---|
| "Could not find column X" | Faltó migración 002 | Re-ejecuta `002_leads_complete_schema.sql` |
| Login: "No se encontró tu perfil" | Usuario en auth pero sin row en `profiles` | Crear manualmente: `INSERT INTO profiles (id, name, role) VALUES ('<auth-uid>', 'Nombre', 'asesor');` |
| Asesor ve TODOS los leads | RLS no aplicada | Verifica: `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('leads','profiles');` — `relrowsecurity` debe ser `t` |
| Asesor NO ve sus leads | El campo `asesor_name` del lead no coincide con `profiles.name` | Verifica que coinciden exactos (sin espacios, mismas tildes) |
| `app.stratos…` no carga | DNS no propagó | Espera más, o verifica en dnschecker.org |
| Cambios no se guardan | Variables de entorno mal seteadas en Vercel | Settings → Environment Variables → redeploy |

---

## 📞 Soporte directo

Si te bloqueas en cualquier paso, copia el mensaje exacto del error (consola del navegador o Supabase) y abre una sesión con Claude Code para diagnosticar en vivo.
