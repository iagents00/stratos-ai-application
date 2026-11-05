CREATE OR REPLACE FUNCTION public.fn_org_stage(p_org uuid, p_in text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_t   text := public.unaccent(lower(btrim(coalesce(p_in,''))));
  v_w   text;
  v_n   int;
  v_out text;
  v_has boolean;
  v_cnt int;
  v_grupo text;
begin
  if v_t = '' then return null; end if;

  select exists(select 1 from public.fn_effective_org_stages(p_org)
                 where organization_id = p_org and activo and deleted_at is null)
    into v_has;

  if not v_has then return null; end if;
  -- A configured appointment role takes precedence over an occupied historical
  -- Zoom column preserved by the editor. No records are moved or renamed.
  if v_t in ('zoom agendado','zoom') and public.fn_org_appointment_stage(p_org) is not null
    and exists(select 1 from public.organizations o where o.id=p_org
      and coalesce(o.meta_config->'crm','{}'::jsonb)?'appointmentStage') then
    return public.fn_org_appointment_stage(p_org);
  end if;
  -- Common old creation defaults mean the FIRST stage of this company only
  -- when they are not themselves an explicitly configured stage.
  if v_t in ('nuevo registro','contactame ya','primer contacto','nuevo','new','inbound') and not exists(
    select 1 from public.fn_effective_org_stages(p_org) s where public.unaccent(lower(s.nombre))=v_t
  ) then
    select nombre into v_out from public.fn_effective_org_stages(p_org) order by orden limit 1;
    return v_out;
  end if;

  if v_t in ('zoom agendado','cita agendada','reunion agendada','zoom') and not exists(
    select 1 from public.fn_effective_org_stages(p_org) where public.unaccent(lower(nombre))=v_t
  ) then return public.fn_org_appointment_stage(p_org); end if;

  -- ¿La pregunta nombra un SUB-TABLERO de esta org? («de taller», «de pacientes»)
  -- Basta una palabra significativa del nombre del grupo.
  select s.grupo into v_grupo
    from public.fn_effective_org_stages(p_org) s
   where s.organization_id = p_org and s.activo and s.deleted_at is null
     and s.grupo is not null
     and exists (
       select 1
         from unnest(regexp_split_to_array(public.unaccent(lower(s.grupo)), '[^a-z0-9]+')) gw
        where length(gw) >= 5 and v_t ~ ('(^|[^a-z])'||gw)
     )
   group by s.grupo
   order by min(s.orden)
   limit 1;

  -- «la última etapa» / «el final» → la de mayor orden (del grupo, si lo nombró)
  if v_t ~ '^(la\s+|el\s+)?(ultim[ao]|final)(\s+(etapa|fase|paso))?$'
     or (v_grupo is not null and v_t ~ '(ultim[ao]|final)') then
    select nombre into v_out from public.fn_effective_org_stages(p_org)
     where organization_id = p_org and activo and deleted_at is null
       and (v_grupo is null or grupo = v_grupo)
     order by orden desc limit 1;
    return v_out;
  end if;

  -- Ordinal: «etapa 3», «la tercera» → esa posición (DENTRO del grupo si lo nombró)
  v_w := (regexp_match(v_t,
    '(?:(?:la|el|etapa|fase|numero)\s+)*(primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|septim[oa]|octav[oa]|noven[oa]|decim[oa]|\d{1,2})(?:\s*(?:ra|da|ta|va|era|nda|°|ª))?(?:\s+(?:etapa|fase))?'))[1];
  -- Sin grupo nombrado la frase tiene que ser SOLO el ordinal (v3 byte a byte).
  if v_grupo is null then
    v_w := (regexp_match(v_t,
      '^(?:(?:la|el|etapa|fase|numero)\s+)*(primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|sext[oa]|septim[oa]|octav[oa]|noven[oa]|decim[oa]|\d{1,2})(?:\s*(?:ra|da|ta|va|era|nda|°|ª))?(?:\s+(?:etapa|fase))?$'))[1];
  end if;
  if v_w is not null then
    v_n := case
      when v_w ~ '^\d+$'       then v_w::int
      when v_w like 'primer%'  then 1
      when v_w like 'segund%'  then 2
      when v_w like 'tercer%'  then 3
      when v_w like 'cuart%'   then 4
      when v_w like 'quint%'   then 5
      when v_w like 'sext%'    then 6
      when v_w like 'septim%'  then 7
      when v_w like 'octav%'   then 8
      when v_w like 'noven%'   then 9
      when v_w like 'decim%'   then 10
    end;
    if v_n is not null then
      if v_grupo is not null then
        select nombre into v_out from (
          select nombre, row_number() over (order by orden) as pos
            from public.fn_effective_org_stages(p_org)
           where organization_id = p_org and activo and deleted_at is null and grupo = v_grupo
        ) q where q.pos = v_n;
      else
        select nombre into v_out from public.fn_effective_org_stages(p_org)
         where organization_id = p_org and activo and deleted_at is null and orden = v_n;
      end if;
      return v_out;  -- NULL si esa posición no existe: mejor preguntar que adivinar
    end if;
  end if;

  -- Por texto: exacta primero; después subcadena en ambas direcciones (gana la más corta)
  select nombre into v_out
    from public.fn_effective_org_stages(p_org)
   where organization_id = p_org and activo and deleted_at is null
     and ( public.unaccent(lower(nombre)) = v_t
        or public.unaccent(lower(nombre)) like '%'||v_t||'%'
        or v_t like '%'||public.unaccent(lower(nombre))||'%' )
   order by (case when public.unaccent(lower(nombre)) = v_t then 0 else 1 end), length(nombre)
   limit 1;
  if v_out is not null then return v_out; end if;

  -- Palabra parcial coloquial: alguna palabra significativa (≥4) del pedido es palabra
  -- de UNA SOLA etapa («los permisos», «el diseño»). Si varias la comparten → NULL.
  select count(distinct s.nombre), min(s.nombre) into v_cnt, v_out
    from public.fn_effective_org_stages(p_org) s
   where s.organization_id = p_org and s.activo and s.deleted_at is null
     and exists (
       select 1
         from unnest(regexp_split_to_array(v_t, '[^a-z0-9]+')) qw
         join unnest(regexp_split_to_array(public.unaccent(lower(s.nombre)), '[^a-z0-9]+')) sw on qw = sw
        where length(qw) >= 4
          and qw not in ('etapa','fase','paso','esta','este','para','donde','como','cuando')
     );
  if v_cnt = 1 then return v_out; end if;

  -- Typos de seseo/oído: c/z→s, v→b, sin h — frase entera y palabra por palabra.
  select count(distinct s.nombre), min(s.nombre) into v_cnt, v_out
    from public.fn_effective_org_stages(p_org) s
    cross join lateral (
      select translate(replace(public.unaccent(lower(s.nombre)),'h',''),'zcv','ssb') as sn
    ) n
   where s.organization_id = p_org and s.activo and s.deleted_at is null
     and (
       n.sn like '%'||translate(replace(v_t,'h',''),'zcv','ssb')||'%'
       or exists (
         select 1
           from unnest(regexp_split_to_array(translate(replace(v_t,'h',''),'zcv','ssb'), '[^a-z0-9]+')) qw
           join unnest(regexp_split_to_array(n.sn, '[^a-z0-9]+')) sw on qw = sw
          where length(qw) >= 5
       )
     );
  if v_cnt = 1 then return v_out; end if;

  return null;
end $function$;
