-- Preserve existing codes; new links use a readable name plus 80 random bits.
-- Public access is only through the exact-code resolver, never table listing.
begin;
alter table public.portfolio_links enable row level security;
revoke all on public.portfolio_links from anon, authenticated;
create or replace function public.create_portfolio_link(p_payload text, p_slug text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_name text; v_base text; v_code text;
begin
  select p.organization_id, o.name into v_org, v_name
    from public.profiles p join public.organizations o on o.id=p.organization_id
    where p.id=auth.uid() and p.active is true and o.active is true
      and coalesce(p.crm_only,false)=false
      and p.role in ('super_admin','admin','director','ceo','asesor')
      and (o.meta_config #> '{features,landingPages}' = 'true'::jsonb
        or (o.id='00000000-0000-0000-0000-000000000001'::uuid
          and coalesce(o.meta_config #> '{features,landingPages}', 'true'::jsonb) <> 'false'::jsonb));
  if v_org is null then raise exception 'Create no está habilitado para tu cuenta' using errcode='42501'; end if;
  if p_payload is null or length(p_payload)<8 or length(p_payload)>60000 then
    raise exception 'Presentación inválida' using errcode='22023';
  end if;
  v_base := lower(coalesce(nullif(trim(p_slug),''),v_name,'portafolio'));
  v_base := translate(v_base,'áéíóúüñàèìòù','aeiouunaeiou');
  v_base := trim(both '-' from left(trim(both '-' from regexp_replace(v_base,'[^a-z0-9]+','-','g')),32));
  if v_base='' then v_base := 'portafolio'; end if;
  for i in 1..5 loop
    -- Skip the UUID version/variant positions: all 20 chosen hex digits are random.
    v_code := v_base || '-' || left(replace(gen_random_uuid()::text,'-',''),12)
      || right(replace(gen_random_uuid()::text,'-',''),8);
    begin
      insert into public.portfolio_links(code,payload,created_by,organization_id)
        values(v_code,p_payload,auth.uid(),v_org);
      return v_code;
    exception when unique_violation then null;
    end;
  end loop;
  raise exception 'No se pudo reservar el enlace; intenta de nuevo';
end $$;
create or replace function public.resolve_portfolio_link(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_payload text; v_clean text := lower(btrim(coalesce(p_code,'')));
begin
  if v_clean !~ '^[a-z0-9_-]{1,64}$' then return null; end if;
  update public.portfolio_links set hits=coalesce(hits,0)+1 where code=v_clean returning payload into v_payload;
  return v_payload;
end $$;
revoke all on function public.create_portfolio_link(text,text) from public,anon;
grant execute on function public.create_portfolio_link(text,text) to authenticated;
revoke all on function public.resolve_portfolio_link(text) from public;
grant execute on function public.resolve_portfolio_link(text) to anon,authenticated;
commit;
