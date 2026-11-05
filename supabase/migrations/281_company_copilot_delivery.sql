-- Only console-created companies explicitly configured for the shared Copilot.
-- Existing Duke/Sales workflows continue to own their original organizations.
create or replace function public.fn_company_copilot_tick() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare o record; v_payload jsonb; v_result jsonb; v_item jsonb; v_escalation jsonb;
 v_recipient record; v_out jsonb:='[]'; v_synthetic int:=0; v_failures jsonb:='[]';
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Solo el servidor.' using errcode='42501'; end if;
 if not pg_try_advisory_xact_lock(794115026) then return jsonb_build_object('ok',true,'reminders','[]'::jsonb,'reason','busy'); end if;
 for o in select org.id,public.fn_org_appointment_stage(org.id) appointment_stage,c.timezone
  from public.organizations org join public.proactive_config c on c.organization_id=org.id
  where org.active is true and org.meta_config#>>'{crm,copilotReminders}'='true'
    and org.meta_config#>>'{onboarding,createdFrom}'='whatsapp_admin'
    and coalesce(org.meta_config#>>'{features,copilotModule}','true')<>'false' and c.enabled
 loop
  begin
   v_payload:=jsonb_build_object('organization_id',o.id);
   -- Cancel obsolete reminders, never delete history. Rescheduling gets a new dedupe key.
   update public.proactive_reminders r set status='cancelled'
   where r.organization_id=o.id and r.status='pending' and r.lead_id is not null
    and (r.tipo like 'zoom%' or r.tipo like 'next_action%' or r.tipo like 'visita%')
    and not exists(select 1 from public.leads l where l.organization_id=o.id and l.id=r.lead_id and l.deleted_at is null
      and (case when r.tipo like 'zoom%' then l.stage=o.appointment_stage
        and l.next_action_at=nullif(r.payload->>'zoom_at','')::timestamptz and l.next_action_at>now()
       when r.tipo like 'next_action%' then l.next_action_at=nullif(r.payload->>'next_action_at','')::timestamptz and l.next_action_at>now()
       else l.visita_at>now() end));
   perform public.fn_proactive_scan_zooms(v_payload);
   perform public.fn_proactive_next_action_reminders(v_payload);
   perform public.fn_proactive_scan_inactive(v_payload);
   perform public.fn_proactive_scan_insist(v_payload);
   -- The shared team-action worker already scans all enabled organizations.
   update public.proactive_reminders r set payload=r.payload||jsonb_build_object('appointment_stage',o.appointment_stage,'text',
    case when r.tipo='zoom_brief' then '▸ '||o.appointment_stage||' — '||public.fn_fmt_fecha_legible(l.next_action_at)
      ||chr(10)||coalesce(public.fn_lead_briefing_text(l.id),'')||chr(10)||'Prepara tu plan para la cita. Puedes enviarlo aquí o abrir la ficha del cliente.'
     when r.tipo in ('zoom_1h_ok','zoom_1h_missing') then
      '▸ '||o.appointment_stage||' en 1 hora con '||coalesce(l.name,'tu cliente')||chr(10)||
      case when exists(select 1 from public.proactive_pending_reports p where p.organization_id=o.id and p.lead_id=l.id
        and p.advisor_telegram_id=(select telegram_chat_id from public.profiles where id=r.asesor_id and organization_id=o.id)
        and p.status='open' and p.kind in ('zoom_brief','awaiting_plan')) then 'Todavía falta registrar el plan. Prepáralo antes de la cita.'
       else 'Repasa la información y el plan antes de la cita.' end
     when r.tipo='zoom_15min' then '▸ '||o.appointment_stage||' en 15 minutos con '||coalesce(l.name,'tu cliente')||chr(10)||'Revisa el lugar o enlace y ten listo tu plan.'
     else coalesce(r.payload->>'text','Recordatorio de cita') end)
    from public.leads l where r.organization_id=o.id and l.organization_id=o.id and r.lead_id=l.id and r.status='pending' and r.tipo like 'zoom%';
   v_result:=public.fn_proactive_scan_next_action_escalations(v_payload);
   for v_escalation in select value from jsonb_array_elements(v_result->'escalations') loop
    for v_recipient in select p.id,p.name,p.telegram_chat_id from public.profiles p where p.organization_id=o.id and p.active is true
      and (p.telegram_chat_id=(v_escalation->>'advisor_telegram_id')::bigint
       or p.telegram_chat_id in(select value::text::bigint from jsonb_array_elements_text(v_escalation->'manager_telegram_ids'))) loop
     insert into public.proactive_reminders(organization_id,lead_id,asesor_id,asesor_name,tipo,scheduled_at,dedupe_key,ignore_quiet,payload)
      values(o.id,(v_escalation->>'lead_id')::uuid,v_recipient.id,v_recipient.name,'admin_overdue',now(),
       'company_escalation:'||(v_escalation->>'report_id')||':'||v_recipient.id,true,
       jsonb_build_object('text','▸ Seguimiento pendiente con '||coalesce(v_escalation->>'lead_name','un cliente')||chr(10)||'No se recibió la respuesta o el plan solicitado. Revisa el cliente en el CRM.'))
      on conflict(dedupe_key) do nothing;
    end loop;
   end loop;
   v_result:=public.fn_proactive_get_pending(v_payload||jsonb_build_object('tipo_in',jsonb_build_array(
    'zoom_brief','zoom_1h_missing','zoom_1h_ok','zoom_15min','next_action_3h','next_action_10min','inactividad','inactividad_insist','personal','admin_overdue')));
   v_synthetic:=v_synthetic+coalesce((v_result->>'synthetic_logged')::int,0);
   for v_item in select value from jsonb_array_elements(v_result->'reminders') loop
    -- Telegram-positive identities need the same activity record as Copilot-only identities.
    perform public.fn_log_proactive_copilot((v_item->>'advisor_telegram_id')::bigint,
      coalesce(v_item#>>'{payload,text}',v_item#>>'{payload,message}',v_item#>>'{payload,next_action}','Recordatorio de seguimiento'),'ai');
    v_out:=v_out||jsonb_build_array(v_item||jsonb_build_object('organization_id',o.id));
   end loop;
  exception when others then
   -- Roll back this organization only; another tenant must keep receiving reminders.
   v_failures:=v_failures||jsonb_build_array(jsonb_build_object('organization_id',o.id,'code',sqlstate));
  end;
 end loop;
 return jsonb_build_object('ok',jsonb_array_length(v_failures)=0,'reminders',v_out,'count',jsonb_array_length(v_out),'synthetic_logged',v_synthetic,'failures',v_failures);
end $fn$;
revoke all on function public.fn_company_copilot_tick() from public,anon,authenticated;
grant execute on function public.fn_company_copilot_tick() to service_role;
