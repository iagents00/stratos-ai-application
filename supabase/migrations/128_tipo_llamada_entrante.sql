-- ─────────────────────────────────────────────────────────────────────────────
-- 128 · Tipo 'llamada_entrante' permitido en proactive_reminders (espejo)
-- Aplicada por MCP en stratos-prod el 24-jul-2026.
-- ─────────────────────────────────────────────────────────────────────────────
-- El check `proactive_reminders_tipo_check` es una lista blanca y no incluía
-- 'llamada_entrante' → el aviso "📞 X te está llamando" del botón Llamar
-- (fn_start_team_call, migración 127) fallaba SILENCIOSO. Se recreó el check
-- con la lista previa intacta + 'llamada_entrante' (aditivo).
-- Reversión: recrear el check sin el valor nuevo.
select 'espejo migración 128 — ver definición aplicada en stratos-prod' as nota;
