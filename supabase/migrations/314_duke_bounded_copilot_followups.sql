-- Duke explicitly adopts the same finite reminder policy as Gerardo.
-- Keep agenda/history intact and never restart an exhausted delivery cycle.
update public.organizations set meta_config=jsonb_set(coalesce(meta_config,'{}'),'{crm}',
 coalesce(meta_config->'crm','{}')||jsonb_build_object('copilotFollowupScheduleMinutes',jsonb_build_array(3,30,60)))
where id='00000000-0000-0000-0000-000000000001';

update public.copilot_reminder_followups f
set next_followup_at=public.fn_copilot_followup_next(f.started_at,f.repeat_count,p.copilot_insistence_enabled,now())
from public.profiles p
where f.organization_id='00000000-0000-0000-0000-000000000001'
 and p.id=f.profile_id and p.organization_id=f.organization_id and f.status='pending';
