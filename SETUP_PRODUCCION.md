# Setup de Producción · Stratos AI

Guía paso a paso de los 3 secrets/configuraciones que faltan
para activar las funciones nuevas. Cada uno toma 5 minutos.

---

## 1. Backup automático nocturno → 5 min

Activa que **cada noche a las 3 AM** GitHub Actions descargue
todos los datos de Supabase y los suba a tu repo como respaldo.
Si Supabase desaparece mañana, todos los leads + perfiles +
auditoría están en GitHub listos para restaurar.

### Pasos

1. Abre tu repo: <https://github.com/iagents00/stratos-ai-application/settings/secrets/actions>
2. Click **"New repository secret"** y agrega los 2 secrets:

   **Secret 1**
   - Name: `SUPABASE_URL`
   - Value: el URL de tu proyecto (ej: `https://xyzabc.supabase.co`)
     Lo encuentras en Supabase → Project Settings → API

   **Secret 2**
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: el `service_role` key (NO el anon)
     ⚠️ Este key bypassa RLS. Solo va en el secret de GitHub, nunca en el frontend.
     Lo encuentras en Supabase → Project Settings → API → "service_role" (Reveal)

3. Verifica el setup: ve a la pestaña **Actions** del repo y dispara
   manualmente el workflow **"Daily Supabase Backup"** con el botón
   **"Run workflow"**.

4. Si todo OK, en ~30 segundos verás un nuevo commit en `main`:
   `chore(backup): snapshot diario YYYY-MM-DD [skip ci]` con el archivo
   `backups/YYYY-MM-DD.json`.

5. A partir de ahí, **el backup corre automáticamente cada noche**.

### Restaurar desde un backup

Si Supabase falla catastróficamente:

```bash
# Bajar el último backup
curl -O https://raw.githubusercontent.com/iagents00/stratos-ai-application/main/backups/latest.json

# Importar a una instancia nueva con un script de seed
# (te ayudo a hacer este script si llega ese momento)
```

---

## 2. Gemini Flash gratis para los agentes IA → 3 min

Cambia los agentes IA (Sugerir Acciones + Organizar Notas) de
Anthropic Claude (~$0.06 por análisis) a **Google Gemini 2.5 Flash gratis**
(1500 análisis al día, calidad equivalente para este caso).

### Pasos

1. Crea API key gratis en Google AI Studio: <https://aistudio.google.com/apikey>
   - Click **"Create API key"**
   - Selecciona **"Create API key in new project"** (o usa uno existente)
   - Copia la key (empieza con `AIzaSy…`)

2. Ve a Supabase → **Edge Functions** → click en **suggest-next-actions**
   → pestaña **Settings** (o "Secrets") → **"Add new secret"**:
   - Name: `GEMINI_API_KEY`
   - Value: la key que copiaste

3. Repite para la función **organize-lead-notes** (mismo `GEMINI_API_KEY`).

4. **Listo.** Los agentes IA ya están usando Gemini gratis. Si en algún
   momento Gemini se cae, automáticamente caen al ANTHROPIC_API_KEY si
   está configurado (fallback).

### Si quieres mantener Claude como respaldo

Deja `ANTHROPIC_API_KEY` configurada también. Las funciones eligen
**Gemini primero** y solo usan Anthropic si Gemini no está disponible.

---

## 3. Monitoreo de uptime con UptimeRobot → 5 min

Te llega email/SMS en menos de 5 minutos cuando la app o Supabase
se caen. Te enteras antes que tus asesores.

### Pasos

1. Crea cuenta gratis: <https://uptimerobot.com/signUp>

2. **+ Add New Monitor**, agrega 2 monitores:

   **Monitor 1: App principal**
   - Monitor Type: HTTP(s)
   - Friendly Name: `Stratos AI App`
   - URL: `https://app.stratoscapitalgroup.com`
   - Monitoring Interval: 5 minutes (free tier)

   **Monitor 2: Supabase**
   - Monitor Type: HTTP(s)
   - Friendly Name: `Stratos Supabase API`
   - URL: `https://<TU-PROYECTO>.supabase.co/rest/v1/?apikey=<ANON_KEY>`
     (usa el `anon` public key, no el service_role)
   - Monitoring Interval: 5 minutes

3. **My Settings → Add Alert Contact** → agrega tu email + WhatsApp/SMS
   si quieres alerta en celular (gratis hasta cierto volumen).

4. Listo. Cualquier caída > 5 min te llega como notificación.

---

## Resumen ejecutivo

| Tarea | Tiempo | Costo | Beneficio |
|-------|--------|-------|-----------|
| 1. GitHub backup secrets | 5 min | $0 | Cero pérdida de datos jamás |
| 2. Gemini API key | 3 min | $0 | IA gratis para los agentes |
| 3. UptimeRobot | 5 min | $0 | Te enteras antes que los asesores |

**Total: 13 minutos para protección casi total.**

---

## Lo que ya está activo (no requiere acción tuya)

- ✅ Login con timeout 8s + mensaje claro
- ✅ Caché local de sesión 24h
- ✅ **Modo offline transparente**: si Supabase falla, la app sigue
  funcionando con los datos seed (`src/data/offline-seed/`).
  Asesores ni se enteran.
- ✅ **Auto-sync silencioso**: cada 60s y al recuperar foco, la app
  reintenta llegar a Supabase y sincroniza los cambios pendientes
  de localStorage. Sin notificación al asesor.
- ✅ **Auto-recovery offline → online**: si entraron en modo offline,
  cuando Supabase vuelve, la app los pasa a online sin logout/relogin.
- ✅ **Service Worker / PWA**: la app carga incluso sin internet.
  Asesores pueden agregar a pantalla de inicio del celular como app nativa.
- ✅ **Code splitting**: bundle inicial 49% más chico → la app entra
  casi al doble de rápido en celulares con datos.
- ✅ **Botón "Descargar respaldo"** en el panel de admin.

---

## Cómo instalar Stratos AI como app en el celular del asesor

### iPhone / Safari
1. Abrir `app.stratoscapitalgroup.com` en Safari
2. Botón compartir (cuadrado con flecha hacia arriba)
3. **"Add to Home Screen"** / "Añadir a pantalla de inicio"
4. Listo — aparece el ícono Stratos AI en la pantalla del celular

### Android / Chrome
1. Abrir `app.stratoscapitalgroup.com` en Chrome
2. Menú (⋮) arriba a la derecha
3. **"Add to Home screen"** / "Añadir a pantalla de inicio"
4. Listo — funciona como app nativa, incluso sin internet

---

## Contacto / Dudas

- Repo: https://github.com/iagents00/stratos-ai-application
- Backups: ver carpeta `backups/` en `main`
- Setup: este archivo (`SETUP_PRODUCCION.md`)
