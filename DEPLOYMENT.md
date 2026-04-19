# DEPLOYMENT — Stratos AI

Dos sitios, un repositorio. Esta guía cubre el deploy completo en Vercel + Namecheap.

---

## Arquitectura

| URL | Qué sirve | Auth |
|-----|-----------|------|
| `stratoscapitalgroup.com` | Landing Page (marketing) | ❌ Ninguna |
| `app.stratoscapitalgroup.com` | Plataforma (CRM, ERP, IA…) | ✅ LoginScreen |

El mismo build de Vite detecta el hostname en runtime y renderiza el componente correcto (`main.jsx`).

---

## 1. Preparar Vercel

### 1.1 Crear proyecto en Vercel

1. Ve a [vercel.com](https://vercel.com) → **Add New Project**
2. Conecta tu repositorio de GitHub/GitLab
3. Framework: **Vite**
4. Build command: `npm run build`
5. Output dir: `dist`
6. Click **Deploy**

### 1.2 Variables de entorno en Vercel

En el proyecto → **Settings → Environment Variables**:

```
VITE_APP_URL = https://app.stratoscapitalgroup.com
```

*(Agrega las de Supabase cuando las tengas)*

---

## 2. Configurar dominios en Vercel

Vercel → tu proyecto → **Settings → Domains**

Agrega ambos dominios:
- `stratoscapitalgroup.com`
- `app.stratoscapitalgroup.com`

Vercel te dará registros DNS para configurar en Namecheap.

---

## 3. Configurar DNS en Namecheap

Ve a **Namecheap → Manage → Advanced DNS** de tu dominio.

### Registros requeridos

| Tipo | Host | Valor | TTL |
|------|------|-------|-----|
| `A` | `@` | `76.76.21.21` | Automatic |
| `CNAME` | `www` | `cname.vercel-dns.com` | Automatic |
| `CNAME` | `app` | `cname.vercel-dns.com` | Automatic |

> **Nota:** Los IPs/CNAME exactos los muestra Vercel al agregar el dominio. Usa los que te indique Vercel, no los de arriba si difieren.

### Nameservers

Si Namecheap tiene nameservers personalizados, verifica que no bloqueen los registros CNAME. Lo más simple: deja los nameservers de Namecheap y agrega los registros manualmente.

---

## 4. Verificar propagación

La propagación DNS tarda entre 5 minutos y 48 horas.

Para verificar:
```bash
dig stratoscapitalgroup.com
dig app.stratoscapitalgroup.com
```

O usa [dnschecker.org](https://dnschecker.org).

---

## 5. Prueba de funcionamiento

| URL | Resultado esperado |
|-----|--------------------|
| `stratoscapitalgroup.com` | Landing Page (sin login) |
| `app.stratoscapitalgroup.com` | Login screen de Stratos |
| `localhost:5173` | Landing Page |
| `localhost:5173/?app` | Login screen (dev only) |

---

## 6. Deploy continuo

Cada `git push` a `main` despliega automáticamente en Vercel.

Para un deploy manual:
```bash
npm run build
# Vercel detecta el push y despliega
```

---

## Credenciales de demo (desarrollo)

```
Email:    demo@stratos.ai
Password: Demo2024
```

Se crean automáticamente en `localStorage` al primer login.

---

## Próximo paso: Supabase

Cuando migres de `localStorage` a Supabase real:
1. Crea proyecto en [supabase.com](https://supabase.com)
2. Copia `URL` y `anon key` al `.env.local`
3. Agrega las mismas variables en Vercel → Environment Variables
4. Sigue el plan en `.claude/plans/glittery-doodling-avalanche.md`
