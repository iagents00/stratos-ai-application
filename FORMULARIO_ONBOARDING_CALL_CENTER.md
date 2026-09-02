# Formulario de onboarding del AI Call Center

**Link para el cliente:** https://stratoscapitalgroup.com/onboarding-call-center
(también responde en `/call-center` y `/ai-call-center`).

Es la "Guía de Configuración Inicial — AI Call Center" de NSG Consulting, pero
en vez de un Word: una pantalla por sección, barra de avance arriba, y al
terminar la información llega sola.

## A dónde llega lo que contesta el cliente

1. **Correo al equipo.** Sale de `formularios@stratoscapitalgroup.com` a
   `info@stratoscapitalgroup.com`, con todas las respuestas en una tabla y el
   *Reply-To* apuntando al correo del cliente: contestas ese correo y le llega
   a él. Para cambiar el destinatario: secret `FORM_NOTIFY_TO` en la edge
   function (Supabase → Edge Functions → Secrets), varios separados por coma.
2. **Lead en el CRM de Stratos Sales** (`app.stratoscapitalgroup.com/stratos-sales`).
   Entra como *Nuevo Registro*, marcado caliente, con la etiqueta
   `Onboarding AI Call Center`, el resumen completo en las notas y la siguiente
   acción "Revisar el cuestionario y preparar la propuesta" para mañana. Si el
   correo o el WhatsApp ya existían en ese CRM, se actualiza el lead en vez de
   duplicarlo.
3. **Registro completo en la base**, tabla `form_respuestas` (respuestas en
   JSON, duración, fecha, si el correo salió y por cuál proveedor). Solo la ven
   los admins de la organización.

## Piezas

| Pieza | Archivo |
|---|---|
| Pantalla (secciones, validación, borrador en el navegador) | `src/landing/OnboardingCallCenter.jsx` |
| Cliente HTTP que manda el formulario | `src/lib/form-submit.js` |
| Ruta pública | `src/main.jsx` (`ONBOARDING_CC_PATHS`) |
| Edge function que guarda, crea el lead y manda el correo | `supabase/functions/form-submit/index.ts` |
| Tabla + función SQL | `supabase/migrations/242_formularios_publicos.sql` |

## Cómo se protege

- La llave pública del navegador no escribe en ninguna tabla: todo pasa por la
  edge function con `service_role`, que solo acepta los formularios registrados
  en su lista (`FORMULARIOS`).
- Honeypot para bots, tamaños máximos y tope de 5 envíos por correo al día.
- Si el correo falla, la respuesta ya quedó guardada y el lead ya está en el
  CRM; el error queda en los logs de la función.

## Agregar otro formulario después

1. Nueva página en `src/landing/` con el mismo patrón (o reutilizar esta con
   otro contenido) y su ruta en `main.jsx`.
2. Registrar el slug en `FORMULARIOS` de `supabase/functions/form-submit/index.ts`
   con la organización destino y cómo se leen sus campos. Volver a desplegar:
   `supabase functions deploy form-submit --no-verify-jwt`.
