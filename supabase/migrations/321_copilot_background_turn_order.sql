-- An acknowledgement must not let a follow-up overtake the action it refers to.
create or replace function public.copilot_delivery_waiting(p_id uuid) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare d public.copilot_deliveries%rowtype;
begin
 select c.* into d from public.copilot_deliveries c join public.profiles p
  on p.id=auth.uid() and p.active is true and p.organization_id=c.organization_id
 where c.id=p_id and c.profile_id=p.id;
 if not found then raise exception 'Request does not belong to this session' using errcode='42501'; end if;
 return exists(select 1 from public.copilot_deliveries c where c.organization_id=d.organization_id
  and c.profile_id=d.profile_id and c.status='processing' and c.created_at<d.created_at);
end $fn$;
revoke all on function public.copilot_delivery_waiting(uuid) from public,anon;
grant execute on function public.copilot_delivery_waiting(uuid) to authenticated;
