# Inventario de superficies del sistema

Generado por scripts/ops/generate-system-index.mjs. No editar a mano. Identifica entradas HTTP, funciones, workflows y nombres de variables; no expone valores. Las importaciones/consultas dinámicas pueden requerir revisión manual.

## API web de Vercel

| Archivo | Despliegue |
|---|---|
| [api/og-landing.js](../../api/og-landing.js) | Verificar en su proveedor; existencia en Git no acredita publicación |
| [api/push/refresh.js](../../api/push/refresh.js) | Verificar en su proveedor; existencia en Git no acredita publicación |

## Entradas Edge de Supabase

| Archivo | Despliegue |
|---|---|
| [supabase/functions/admin-create-user/index.ts](../../supabase/functions/admin-create-user/index.ts) | Verificar en su proveedor; existencia en Git no acredita publicación |
| [supabase/functions/delete-my-account/index.ts](../../supabase/functions/delete-my-account/index.ts) | Verificar en su proveedor; existencia en Git no acredita publicación |
| [supabase/functions/duke-lead-router/index.ts](../../supabase/functions/duke-lead-router/index.ts) | Verificar en su proveedor; existencia en Git no acredita publicación |
| [supabase/functions/form-submit/index.ts](../../supabase/functions/form-submit/index.ts) | Verificar en su proveedor; existencia en Git no acredita publicación |
| [supabase/functions/organize-lead-notes/index.ts](../../supabase/functions/organize-lead-notes/index.ts) | Verificar en su proveedor; existencia en Git no acredita publicación |
| [supabase/functions/password-recovery/index.ts](../../supabase/functions/password-recovery/index.ts) | Verificar en su proveedor; existencia en Git no acredita publicación |
| [supabase/functions/send-push/index.ts](../../supabase/functions/send-push/index.ts) | Verificar en su proveedor; existencia en Git no acredita publicación |
| [supabase/functions/suggest-next-actions/index.ts](../../supabase/functions/suggest-next-actions/index.ts) | Verificar en su proveedor; existencia en Git no acredita publicación |
| [supabase/functions/transcribir-voz/index.ts](../../supabase/functions/transcribir-voz/index.ts) | Verificar en su proveedor; existencia en Git no acredita publicación |

## Workflows exportados de n8n

| Archivo | Despliegue |
|---|---|
| [n8n/workflows/duke-meta-lead-ads-trigger.json](../../n8n/workflows/duke-meta-lead-ads-trigger.json) | Verificar en su proveedor; existencia en Git no acredita publicación |
| [n8n/workflows/stratos-telegram-bot-MVP.json](../../n8n/workflows/stratos-telegram-bot-MVP.json) | Verificar en su proveedor; existencia en Git no acredita publicación |
| [n8n/workflows/stratos-telegram-bot-v2.json](../../n8n/workflows/stratos-telegram-bot-v2.json) | Verificar en su proveedor; existencia en Git no acredita publicación |
| [n8n/workflows/stratos-telegram-bot-v3-asesor.json](../../n8n/workflows/stratos-telegram-bot-v3-asesor.json) | Verificar en su proveedor; existencia en Git no acredita publicación |
| [n8n/workflows/stratos-telegram-bot-v4.json](../../n8n/workflows/stratos-telegram-bot-v4.json) | Verificar en su proveedor; existencia en Git no acredita publicación |

## Variables encontradas en el código

VITE_ se publica al navegador. Las demás necesitan clasificación y custodia del servidor correspondiente; nunca colocar credenciales privadas en una variable VITE_.

| Nombre | Referencias |
|---|---|
| ANTHROPIC_API_KEY | [supabase/functions/organize-lead-notes/index.ts](../../supabase/functions/organize-lead-notes/index.ts), [supabase/functions/suggest-next-actions/index.ts](../../supabase/functions/suggest-next-actions/index.ts) |
| APNS_BUNDLE_ID | [supabase/functions/send-push/canales-nativos.ts](../../supabase/functions/send-push/canales-nativos.ts) |
| APNS_KEY_ID | [supabase/functions/send-push/canales-nativos.ts](../../supabase/functions/send-push/canales-nativos.ts) |
| APNS_KEY_P8 | [supabase/functions/send-push/canales-nativos.ts](../../supabase/functions/send-push/canales-nativos.ts) |
| APNS_TEAM_ID | [supabase/functions/send-push/canales-nativos.ts](../../supabase/functions/send-push/canales-nativos.ts) |
| BREVO_API_KEY | [supabase/functions/form-submit/index.ts](../../supabase/functions/form-submit/index.ts) |
| DEV | [src/contexts/ClientOrgGuard.jsx](../../src/contexts/ClientOrgGuard.jsx), [src/lib/push-native.js](../../src/lib/push-native.js) |
| DUKE_LEAD_ROUTER_POOL_KEY | [supabase/functions/duke-lead-router/index.ts](../../supabase/functions/duke-lead-router/index.ts) |
| ELEVENLABS_API_KEY | [supabase/functions/transcribir-voz/index.ts](../../supabase/functions/transcribir-voz/index.ts) |
| FCM_SERVICE_ACCOUNT | [supabase/functions/send-push/canales-nativos.ts](../../supabase/functions/send-push/canales-nativos.ts) |
| FORM_NOTIFY_FROM | [supabase/functions/form-submit/index.ts](../../supabase/functions/form-submit/index.ts) |
| FORM_NOTIFY_TO | [supabase/functions/form-submit/index.ts](../../supabase/functions/form-submit/index.ts) |
| GEMINI_API_KEY | [supabase/functions/organize-lead-notes/index.ts](../../supabase/functions/organize-lead-notes/index.ts), [supabase/functions/suggest-next-actions/index.ts](../../supabase/functions/suggest-next-actions/index.ts) |
| N8N_RECOVERY_SECRET | [supabase/functions/password-recovery/index.ts](../../supabase/functions/password-recovery/index.ts) |
| N8N_RECOVERY_WEBHOOK | [supabase/functions/password-recovery/index.ts](../../supabase/functions/password-recovery/index.ts) |
| OPENAI_API_KEY | [supabase/functions/transcribir-voz/index.ts](../../supabase/functions/transcribir-voz/index.ts) |
| PROD | [src/lib/push-native.js](../../src/lib/push-native.js), [src/main.jsx](../../src/main.jsx) |
| PUSH_WEBHOOK_SECRET | [supabase/functions/send-push/index.ts](../../supabase/functions/send-push/index.ts) |
| RESEND_API_KEY | [supabase/functions/form-submit/index.ts](../../supabase/functions/form-submit/index.ts) |
| SB_ANON_KEY | [supabase/functions/admin-create-user/index.ts](../../supabase/functions/admin-create-user/index.ts), [supabase/functions/delete-my-account/index.ts](../../supabase/functions/delete-my-account/index.ts) |
| SB_SERVICE_ROLE_KEY | [supabase/functions/admin-create-user/index.ts](../../supabase/functions/admin-create-user/index.ts), [supabase/functions/delete-my-account/index.ts](../../supabase/functions/delete-my-account/index.ts), [supabase/functions/duke-lead-router/index.ts](../../supabase/functions/duke-lead-router/index.ts), [supabase/functions/password-recovery/index.ts](../../supabase/functions/password-recovery/index.ts), [supabase/functions/send-push/index.ts](../../supabase/functions/send-push/index.ts) |
| SB_URL | [supabase/functions/admin-create-user/index.ts](../../supabase/functions/admin-create-user/index.ts), [supabase/functions/delete-my-account/index.ts](../../supabase/functions/delete-my-account/index.ts), [supabase/functions/duke-lead-router/index.ts](../../supabase/functions/duke-lead-router/index.ts), [supabase/functions/password-recovery/index.ts](../../supabase/functions/password-recovery/index.ts), [supabase/functions/send-push/index.ts](../../supabase/functions/send-push/index.ts) |
| SUPABASE_ANON_KEY | [supabase/functions/_shared/require-user.ts](../../supabase/functions/_shared/require-user.ts), [supabase/functions/admin-create-user/index.ts](../../supabase/functions/admin-create-user/index.ts), [supabase/functions/delete-my-account/index.ts](../../supabase/functions/delete-my-account/index.ts) |
| SUPABASE_SERVICE_ROLE_KEY | [supabase/functions/admin-create-user/index.ts](../../supabase/functions/admin-create-user/index.ts), [supabase/functions/delete-my-account/index.ts](../../supabase/functions/delete-my-account/index.ts), [supabase/functions/duke-lead-router/index.ts](../../supabase/functions/duke-lead-router/index.ts), [supabase/functions/form-submit/index.ts](../../supabase/functions/form-submit/index.ts), [supabase/functions/password-recovery/index.ts](../../supabase/functions/password-recovery/index.ts), [supabase/functions/send-push/index.ts](../../supabase/functions/send-push/index.ts) |
| SUPABASE_URL | [supabase/functions/_shared/require-user.ts](../../supabase/functions/_shared/require-user.ts), [supabase/functions/admin-create-user/index.ts](../../supabase/functions/admin-create-user/index.ts), [supabase/functions/delete-my-account/index.ts](../../supabase/functions/delete-my-account/index.ts), [supabase/functions/duke-lead-router/index.ts](../../supabase/functions/duke-lead-router/index.ts), [supabase/functions/form-submit/index.ts](../../supabase/functions/form-submit/index.ts), [supabase/functions/password-recovery/index.ts](../../supabase/functions/password-recovery/index.ts), [supabase/functions/send-push/index.ts](../../supabase/functions/send-push/index.ts) |
| TRANSCRIPTOR | [supabase/functions/transcribir-voz/index.ts](../../supabase/functions/transcribir-voz/index.ts) |
| VAPID_PRIVATE_KEY | [supabase/functions/send-push/index.ts](../../supabase/functions/send-push/index.ts) |
| VERCEL_BRANCH_URL | [api/og-landing.js](../../api/og-landing.js) |
| VERCEL_PROJECT_PRODUCTION_URL | [api/og-landing.js](../../api/og-landing.js) |
| VERCEL_URL | [api/og-landing.js](../../api/og-landing.js) |
| VITE_ANDROID_PUSH | [src/lib/push-native.js](../../src/lib/push-native.js) |
| VITE_APP_URL | [src/main.jsx](../../src/main.jsx) |
| VITE_DIAGNOSTICO_CALCOM_URL | [src/landing/Diagnostico.jsx](../../src/landing/Diagnostico.jsx) |
| VITE_DIAGNOSTICO_STRATOS_WEBHOOK_URL | [src/lib/webhook-diagnostico-stratos.js](../../src/lib/webhook-diagnostico-stratos.js) |
| VITE_FORM_SUBMIT_URL | [src/lib/form-submit.js](../../src/lib/form-submit.js) |
| VITE_SUPABASE_ANON_KEY | [src/app/App.jsx](../../src/app/App.jsx), [src/lib/supabase.js](../../src/lib/supabase.js), [api/push/refresh.js](../../api/push/refresh.js) |
| VITE_SUPABASE_URL | [src/app/App.jsx](../../src/app/App.jsx), [src/lib/form-submit.js](../../src/lib/form-submit.js), [src/lib/supabase.js](../../src/lib/supabase.js), [src/lib/transcribir.js](../../src/lib/transcribir.js), [api/push/refresh.js](../../api/push/refresh.js) |
| VITE_TELEGRAM_BOT_USERNAME | [src/app/views/Profile.jsx](../../src/app/views/Profile.jsx) |
