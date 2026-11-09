-- Archiving one business entry must not break the other active entries.
-- The remaining entry assumes the canonical phone key; IDs and history stay put.
create or replace function public.fn_lead_business_archive_sync() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare promoted uuid;
begin
 if old.business_entry_of is null and old.deleted_at is null and new.deleted_at is not null then
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text||':'||new.id::text,0));
  select id into promoted from public.leads where organization_id=new.organization_id and business_entry_of=new.id and deleted_at is null
   order by created_at,id limit 1 for update;
  if promoted is not null then
   update public.leads set business_entry_of=null,phone_normalized=old.phone_normalized
    where organization_id=new.organization_id and id=promoted;
   update public.leads set business_entry_of=promoted where organization_id=new.organization_id and business_entry_of=new.id;
   update public.leads set business_entry_of=promoted,business_line_id=public.fn_crm_business_for_stage(new.organization_id,new.stage)->>'id'
    where organization_id=new.organization_id and id=new.id;
  end if;
 end if;
 return null;
end $fn$;
revoke all on function public.fn_lead_business_archive_sync() from public,anon,authenticated;
create or replace trigger zzz_business_archive_sync after update of deleted_at on public.leads
 for each row execute function public.fn_lead_business_archive_sync();

-- Only trusted nested triggers may move the canonical relationship while
-- servicing a normal archive operation. Direct authenticated relationship edits stay denied.
do $patch$
declare source text;
begin
 select pg_get_functiondef('public.fn_lead_business_identity_guard()'::regprocedure) into source;
 if position($old$if coalesce(auth.role(),'')='authenticated' and$old$ in source)=0 then raise exception 'Business guard changed; inspect first.'; end if;
 execute replace(source,$old$if coalesce(auth.role(),'')='authenticated' and$old$,$new$if coalesce(auth.role(),'')='authenticated' and pg_trigger_depth()<=1 and$new$);
end $patch$;
