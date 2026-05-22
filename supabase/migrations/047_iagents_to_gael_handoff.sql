-- 047_iagents_to_gael_handoff.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-reasignación iAgents → Gael (Duke).
--
-- Regla: cuando un lead DE iAgents entra a 'Zoom Agendado' o se marca urgente
-- (priority='urgente', señal de "requiere humano" que setea fn_upsert_lead_from_chatwoot
-- con la etiqueta requiere-humano), se reasigna automáticamente a Gael G.
--
--   - Solo iAgents (77ec98b9-…) → Gael (941ad724-…). Ninguna otra dirección.
--   - Solo en la TRANSICIÓN hacia el estado (OLD no cumplía, NEW sí), o al
--     crearse ya en ese estado (INSERT). NO toca leads que ya estaban así.
--   - Solo cambia el dueño (asesor_id + asesor_name); no resetea etapa.
--   - Deja traza en expediente_items (cronograma del CRM) con el motivo.
--
-- Trigger AFTER (no BEFORE) por FK: en BEFORE INSERT el lead aún no existe y el
-- INSERT en expediente_items violaría la FK. El AFTER re-UPDATE del asesor no
-- entra en loop: al refire, NEW.asesor_id ya es Gael (≠ iAgents) → corta.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_iagents_to_gael_handoff()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_iagents uuid := '77ec98b9-25b0-48eb-8c37-7266c3971ef3';
  v_gael    uuid := '941ad724-dc5d-46a5-8487-fda87a297b31';
  v_gael_name text; v_reason text; v_fire boolean := false;
begin
  if NEW.asesor_id is distinct from v_iagents then return null; end if;
  if TG_OP='INSERT' then
    if NEW.stage='Zoom Agendado' then v_fire := true; v_reason := 'Zoom Agendado';
    elsif NEW.priority='urgente' then v_fire := true; v_reason := 'urgente (requiere humano)'; end if;
  else
    if NEW.stage='Zoom Agendado' and OLD.stage is distinct from 'Zoom Agendado' then v_fire := true; v_reason := 'Zoom Agendado';
    elsif NEW.priority='urgente' and OLD.priority is distinct from 'urgente' then v_fire := true; v_reason := 'urgente (requiere humano)'; end if;
  end if;
  if not v_fire then return null; end if;

  select name into v_gael_name from public.profiles where id=v_gael;
  update public.leads set asesor_id=v_gael, asesor_name=coalesce(v_gael_name,'Gael G'), updated_at=now()
    where id=NEW.id and asesor_id=v_iagents;
  insert into public.expediente_items (lead_id, organization_id, tipo, titulo, descripcion, asesor_id, metadata)
    values (NEW.id, NEW.organization_id, 'nota', 'Reasignación automática',
            'Reasignado de iAgents → '||coalesce(v_gael_name,'Gael G')||' (motivo: '||v_reason||').', v_gael,
            jsonb_build_object('source','iagents_to_gael_handoff','reason',v_reason,'from','iAgents','to','Gael G'));
  return null;
end; $fn$;

drop trigger if exists trg_iagents_to_gael_handoff on public.leads;
create trigger trg_iagents_to_gael_handoff
after insert or update of stage, priority, asesor_id on public.leads
for each row execute function public.fn_iagents_to_gael_handoff();
