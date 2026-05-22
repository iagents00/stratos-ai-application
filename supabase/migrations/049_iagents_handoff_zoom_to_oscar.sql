-- 049_iagents_handoff_zoom_to_oscar.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Ajuste del handoff automático de iAgents (reemplaza 047):
--   - 'Zoom Agendado' (meet agendado)      → Oscar Gálvez (88f6d379-…, super_admin)
--   - priority='urgente' (requiere humano) → Gael G       (941ad724-…)
--
-- Oscar ya es super_admin → entra solo al pool de gerentes que reciben
-- notificaciones (resuelto por rol + telegram_chat_id); recibirá cuando vincule
-- su Telegram. Resto igual a 047: solo iAgents como origen, solo en la
-- transición hacia el estado, solo cambia dueño, deja traza en expediente_items.
--
-- Se renombra la fn a fn_iagents_lead_handoff (antes fn_iagents_to_gael_handoff)
-- porque ahora rutea a dos destinos según el motivo.
-- ─────────────────────────────────────────────────────────────────────────────

drop trigger if exists trg_iagents_to_gael_handoff on public.leads;

create or replace function public.fn_iagents_lead_handoff()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_iagents uuid := '77ec98b9-25b0-48eb-8c37-7266c3971ef3';
  v_oscar   uuid := '88f6d379-4d24-4085-bd59-90a603a9c207';  -- Zoom Agendado (meet)
  v_gael    uuid := '941ad724-dc5d-46a5-8487-fda87a297b31';  -- urgente (requiere humano)
  v_target uuid; v_tname text; v_reason text; v_fire boolean := false;
begin
  if NEW.asesor_id is distinct from v_iagents then return null; end if;
  if TG_OP='INSERT' then
    if NEW.stage='Zoom Agendado' then v_fire:=true; v_reason:='Zoom Agendado'; v_target:=v_oscar;
    elsif NEW.priority='urgente' then v_fire:=true; v_reason:='urgente (requiere humano)'; v_target:=v_gael; end if;
  else
    if NEW.stage='Zoom Agendado' and OLD.stage is distinct from 'Zoom Agendado' then v_fire:=true; v_reason:='Zoom Agendado'; v_target:=v_oscar;
    elsif NEW.priority='urgente' and OLD.priority is distinct from 'urgente' then v_fire:=true; v_reason:='urgente (requiere humano)'; v_target:=v_gael; end if;
  end if;
  if not v_fire then return null; end if;

  select name into v_tname from public.profiles where id=v_target;
  update public.leads set asesor_id=v_target, asesor_name=coalesce(v_tname,'Asesor'), updated_at=now()
    where id=NEW.id and asesor_id=v_iagents;
  insert into public.expediente_items (lead_id, organization_id, tipo, titulo, descripcion, asesor_id, metadata)
    values (NEW.id, NEW.organization_id, 'nota', 'Reasignación automática',
            'Reasignado de iAgents → '||coalesce(v_tname,'?')||' (motivo: '||v_reason||').', v_target,
            jsonb_build_object('source','iagents_lead_handoff','reason',v_reason,'to_id',v_target));
  return null;
end; $fn$;

drop function if exists public.fn_iagents_to_gael_handoff();

create trigger trg_iagents_lead_handoff
after insert or update of stage, priority, asesor_id on public.leads
for each row execute function public.fn_iagents_lead_handoff();
