-- ═══════════════════════════════════════════════════════════════════════════
-- EL HISTORIAL DEL COPILOT NO SE GUARDABA — 24-ago-2026
-- (aplicada como 20260824212244_copilot_historial_devolver_execute_a_authenticated)
--
-- SÍNTOMA (Ángel, capturas): el Copilot contesta pero la conversación
-- desaparece al salir; la pantalla Comando muestra «permission denied for
-- function fn_comando_nsg»; y el aviso que llega al teléfono nunca aparece
-- dentro del chat del Copilot.
--
-- CAUSA REAL (probada, no deducida): NO es Supabase sin pagar — la base está
-- viva y escribió 126 filas en las últimas 24 h. Lo que falta es el permiso de
-- EJECUCIÓN: el rol `authenticated` (el que usa la persona logueada desde la
-- aplicación) perdió el EXECUTE sobre las funciones que el front llama.
--   · Sin el permiso:  select get_my_copilot_activity(25)  → permission denied
--   · Con el permiso:  devuelve las 25 filas de siempre
-- Los datos NUNCA se perdieron: están los 22.397 mensajes en tg_bot_activity.
-- La app no podía LEERLOS ni ESCRIBIR los nuevos.
--
-- Por qué se explican los tres síntomas con una sola causa:
--   · get_my_copilot_activity  denegada → el historial se ve vacío
--   · copilot_log_msg / _media denegadas → lo nuevo no se guarda
--   · get_my_copilot_activity  denegada → getCopilotActivity() corta antes de
--     mezclar los avisos (proactive_reminders) → el aviso no llega al chat
--
-- ESTA MIGRACIÓN devuelve el EXECUTE SOLO a las funciones que sacan la
-- identidad de auth.uid() por dentro. Son las que no se pueden engañar: quien
-- llama no elige de quién son los datos, los deriva la base del token. `anon`
-- (la llave pública que viaja en el JavaScript) NO recibe nada: sigue cerrado.
--
-- Las que reciben `p_profile_id` del navegador quedan FUERA a propósito y se
-- tratan en la 240 — devolverles el permiso tal como están sería reabrir el
-- agujero que la auditoría de agosto cerró bien.
--
-- Reversa: revoke execute on function <fn> from authenticated;
-- ═══════════════════════════════════════════════════════════════════════════

-- ── El Copilot: leer el historial y escribir en él ─────────────────────────
grant execute on function public.get_my_copilot_activity(integer)               to authenticated;
grant execute on function public.copilot_log_msg(text, text)                    to authenticated;
grant execute on function public.copilot_log_msg_media(text, text, text, text)  to authenticated;
grant execute on function public.copilot_send(text)                             to authenticated;
grant execute on function public.copilot_handle_pending(text)                   to authenticated;
grant execute on function public.copilot_handle_callback(text)                  to authenticated;
grant execute on function public.copilot_agenda_create_from_text(text, text)    to authenticated;

-- ── El resto del CRM que también quedó mudo por lo mismo ───────────────────
grant execute on function public.fn_assign_team_action(uuid, text)              to authenticated;
grant execute on function public.fn_call_targets()                              to authenticated;
grant execute on function public.fn_claim_lead(uuid, text, text)                to authenticated;
grant execute on function public.fn_get_my_recovery_email()                     to authenticated;
grant execute on function public.fn_set_my_recovery_email(text)                 to authenticated;
grant execute on function public.fn_get_my_timezone()                           to authenticated;
grant execute on function public.fn_set_my_timezone(text)                       to authenticated;
grant execute on function public.fn_org_team_members()                          to authenticated;
grant execute on function public.fn_team_users(uuid)                            to authenticated;
grant execute on function public.fn_start_team_call()                           to authenticated;
grant execute on function public.fn_start_team_call(uuid)                       to authenticated;
grant execute on function public.fn_wa_conversations()                          to authenticated;
grant execute on function public.fn_wa_outbox_retry(uuid)                       to authenticated;
grant execute on function public.create_portfolio_link(text, text)              to authenticated;
grant execute on function public.resolve_portfolio_link(text)                   to authenticated;
grant execute on function public.mkt_evidence_candidates()                      to authenticated;
grant execute on function public.mkt_approve_evidence(uuid)                     to authenticated;
grant execute on function public.mkt_attach_evidence_to(uuid, text, text)       to authenticated;
grant execute on function public.mkt_comment_evidence(uuid, text)               to authenticated;

-- La llave pública sigue sin poder ejecutar NADA de esto.
revoke execute on function public.get_my_copilot_activity(integer)              from anon;
revoke execute on function public.copilot_log_msg(text, text)                   from anon;
revoke execute on function public.copilot_log_msg_media(text, text, text, text) from anon;
revoke execute on function public.copilot_send(text)                            from anon;
