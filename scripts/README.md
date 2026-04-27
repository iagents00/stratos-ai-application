# scripts/ — Utilidades de operación

## `create_team_users.mjs`

Crea los usuarios del equipo en Supabase Auth en lote, asigna roles, y genera un archivo de credenciales listo para repartir.

### Setup (una sola vez)

1. **Crear `.env.local` en la raíz** del proyecto (NO en `scripts/`):
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

   La **service_role key** está en: Supabase Dashboard → Settings → API → "service_role" (Secret).

   ⚠️ Esta key tiene permisos de admin. NUNCA la subas a git ni la pongas en el frontend. El `.gitignore` ya excluye `.env.local` y los archivos generados.

2. **Asegúrate de haber corrido las migraciones**:
   ```
   001_initial_schema.sql
   002_leads_complete_schema.sql
   003_audit_log.sql
   ```
   en Supabase → SQL Editor (en orden).

### Uso

1. **Copia el template y rellena con datos reales:**
   ```bash
   cp team_users.example.json team_users.json
   # Edita team_users.json con los 10 nombres + emails + roles
   ```

   Roles válidos: `super_admin`, `admin`, `ceo`, `director`, `asesor`.

2. **Ejecuta:**
   ```bash
   node scripts/create_team_users.mjs
   ```

3. **Salida:** se genera `team_credentials.md` en la raíz con:
   - Tabla de los 10 usuarios con sus passwords temporales.
   - Mensaje de bienvenida personalizado para cada uno (copy-paste para WhatsApp/email).

### Comportamiento

- **Idempotente:** si un email ya existe, no falla — solo actualiza el perfil (nombre, rol).
- **Auto-confirma email:** los usuarios pueden entrar sin verificar correo (útil para setup rápido).
- **Passwords seguras:** formato `Stratos-XXXX-NNNN` (4 letras + 4 dígitos), legibles y memorables.

### Limpieza después

```bash
# Una vez repartidas las credenciales:
rm team_credentials.md
rm team_users.json   # si no quieres reusar
```

Ambos están en `.gitignore`.
