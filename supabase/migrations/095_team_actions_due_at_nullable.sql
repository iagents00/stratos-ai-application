-- 095_team_actions_due_at_nullable.sql
-- Permite acciones de agenda SIN fecha ("Registrar sin fecha" en Mi Espacio / MetaPanel).
--
-- Antes team_actions.due_at era NOT NULL, así que toda acción exigía fecha/hora.
-- Este cambio es PERMISIVO y REVERSIBLE: las funciones que filtran por due_at
-- (bot_agenda_hoy, bot_proximas_acciones, fn_proactive_scan_team_overdue/insist,
-- fn_proactive_scan_team_actions) simplemente NO incluyen las acciones sin fecha
-- (correcto: no tienen recordatorio ni vencen). El frontend ya toleraba due_at null
-- (muestra "—" y ordena por created_at).
--
-- Revertir (solo si no hay filas con due_at NULL):
--   ALTER TABLE public.team_actions ALTER COLUMN due_at SET NOT NULL;

ALTER TABLE public.team_actions ALTER COLUMN due_at DROP NOT NULL;
