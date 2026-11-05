-- One ordered source for the CRM assistant. Saved groups/flat pipeline win over
-- legacy org_stages; the platform fallback is used only without saved stages.
create or replace function public.fn_effective_org_stages(p_org uuid)
returns table(organization_id uuid, orden integer, nombre text, color text, activo boolean, deleted_at timestamptz, grupo text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_meta jsonb; v_groups jsonb; v_pipeline jsonb;
begin
  if auth.role()='anon' or (auth.role()='authenticated' and not exists (
    select 1 from public.profiles p where p.id=auth.uid() and p.organization_id=p_org and coalesce(p.active,true)
  )) then raise exception 'Empresa no autorizada.' using errcode='42501'; end if;
  select o.meta_config into v_meta from public.organizations o where o.id=p_org;
  if not found or v_meta->>'sin_pipeline'='true' then return; end if;
  v_groups := case when jsonb_typeof(v_meta#>'{crm,pipelines}')='array' then v_meta#>'{crm,pipelines}' else '[]'::jsonb end;
  if exists(select 1 from jsonb_array_elements(v_groups) g where jsonb_typeof(g->'stages')='array' and jsonb_array_length(g->'stages')>0) then
    return query select p_org, row_number() over(order by g.ord,s.ord)::integer, btrim(s.stage->>'name'),
      coalesce(s.stage->>'color','#64748B'),true,null::timestamptz,coalesce(g.grp->>'label',g.grp->>'id')
      from jsonb_array_elements(v_groups) with ordinality g(grp,ord)
      cross join lateral jsonb_array_elements(case when jsonb_typeof(g.grp->'stages')='array' then g.grp->'stages' else '[]'::jsonb end) with ordinality s(stage,ord)
      where nullif(btrim(s.stage->>'name'),'') is not null;
    return;
  end if;
  v_pipeline := case when jsonb_typeof(v_meta#>'{crm,pipeline}')='array' then v_meta#>'{crm,pipeline}' else '[]'::jsonb end;
  if jsonb_array_length(v_pipeline)>0 then
    return query select p_org,x.ord::integer,btrim(x.stage->>'name'),coalesce(x.stage->>'color','#64748B'),true,null::timestamptz,null::text
      from jsonb_array_elements(v_pipeline) with ordinality x(stage,ord) where nullif(btrim(x.stage->>'name'),'') is not null;
    return;
  end if;
  if exists(select 1 from public.org_stages s where s.organization_id=p_org and s.activo and s.deleted_at is null) then
    return query select s.organization_id,row_number() over(order by s.orden)::integer,s.nombre,s.color,s.activo,s.deleted_at,s.grupo
      from public.org_stages s where s.organization_id=p_org and s.activo and s.deleted_at is null order by s.orden;
    return;
  end if;
  v_pipeline:=public.fn_platform_crm_pipeline(p_org);
  return query select p_org,x.ord::integer,x.stage->>'name',x.stage->>'color',true,null::timestamptz,null::text
    from jsonb_array_elements(v_pipeline) with ordinality x(stage,ord);
end; $$;
revoke all on function public.fn_effective_org_stages(uuid) from public,anon;
grant execute on function public.fn_effective_org_stages(uuid) to authenticated,service_role;

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
  -- Common old creation defaults mean the FIRST stage of this company only
  -- when they are not themselves an explicitly configured stage.
  if v_t in ('nuevo registro','contactame ya','primer contacto','nuevo','new','inbound') and not exists(
    select 1 from public.fn_effective_org_stages(p_org) s where public.unaccent(lower(s.nombre))=v_t
  ) then
    select nombre into v_out from public.fn_effective_org_stages(p_org) order by orden limit 1;
    return v_out;
  end if;

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


create or replace function public.fn_org_stages_list(p_org uuid) returns text[] language sql stable set search_path=public,pg_temp as $$
select coalesce(array_agg(nombre order by orden),array[]::text[]) from public.fn_effective_org_stages(p_org); $$;

create or replace function public.fn_resolve_stage(p_org uuid,p_in text) returns text language sql stable set search_path=public,pg_temp as $$ select public.fn_org_stage(p_org,p_in); $$;

CREATE OR REPLACE FUNCTION public.fn_org_copilot_responder_core(p_org uuid, p_texto text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_doc_titulo text;
  v_t text := public.unaccent(lower(btrim(coalesce(p_texto,''))));
  v_doc record; v_manual text;
  v_docs jsonb; v_item jsonb; v_out text := '';
  v_temas text; v_gente text; v_n int;
  v_lead record; v_lista text; v_link text;
begin
  if p_org is null or v_t = '' then return null; end if;

  -- ⭐ v20 · SEÑAL 1: la frase trae un MOMENTO CONCRETO ⇒ es agenda, no
  -- conocimiento. Ningún documento guardado responde a «en un minuto».
  if v_t ~ '(en (un|una|dos|tres|media|[0-9]+) ?(minuto|min\M|hora|rato|ratito|dia|semana))'
     or v_t ~ '(^|[^a-z])(manana|pasado manana|hoy|esta (tarde|noche|manana))([^a-z]|$)'
     or v_t ~ '(a|para) las? [0-9]{1,2}(:[0-9]{2})?( ?(am|pm|a\.m|p\.m|de la (manana|tarde|noche)))?'
     or v_t ~ '(^|[^a-z])(el |este |proximo )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)([^a-z]|$)' then
    return null;
  end if;

  -- ⭐ v20 · SEÑAL 2: pregunta por lo que YA nos dijimos ⇒ es el historial,
  -- y el historial lo tiene el modelo, no este puente.
  if v_t ~ '(te (lo )?(habia |he |hab[ií]a )?(pedido|dicho|comente|mencione|solicite|pregunte|encargue))'
     or v_t ~ '(me (habias |has )?(dijiste|recordaste|avisaste|comentaste|dicho))'
     or v_t ~ '(que (te|me) (pedi|dije|comente)|cuando (te|me) (pedi|dije|pediste|dijiste))' then
    return null;
  end if;

  if v_t ~ '((^|[^a-z])(po|o)?nle a [a-z]|a mas tardar|antes de las? [0-9]|ponme|pon(le|eme|ga|gale|ganle)? (una|a )|po[rmn] una (tarea|actividad)|anota|apunta(me|le)|hazme una|crea|registra|asigna|mandale|manda(le)? una (tarea|actividad)|encarga|agenda|recuerd[aeo]|pospon|aplaza|muevele?|reprograma|cambia(le)? la fecha|cancela|necesito que|que .* (haga|revise|llame|envie|vaya|pase|lleve|compre|consiga|busque|prepare|pida|traiga|mande|cotice|limpie|entregue|termine|recoja|organice|arregle|suba|baje|apoye|ayude|coordine|confirme|agende|contrate))'
     or v_t ~ '(tarea|recordatorio|actividad|pendiente)s? (a|para) (mi\M|mim|mí|el |ella|[a-z]+)'
     or v_t ~ '(una|la) (tarea|actividad|recordatorio).{0,10}de (completar|hacer|llamar|enviar|revisar|pedir|comprar|pagar|terminar|ir)'
     or v_t ~ '(ya (quedo|esta list[oa]|hice|termine|termino|se hizo|se entrego)|listo,? ya|dal[oa] por|marca(l[oa])? como (hech|list))' then
    return null;
  end if;

  -- v11: saludo pelado → bienvenida con la oferta corta (que nunca haya silencio)
  if length(v_t) <= 28
     and v_t ~ '^(ola+|hola+|holi+|hey|oiga|oigame|disculpe|buenas+|buen(os)?\s+dias?|buenas\s+(tardes|noches)|que tal|que hubo|quiubo|saludos|que onda|como estas?|como esta)([!.,\s]+(ola|hola|buen(os|as)?\s*(dias?|tardes|noches)?|que tal|como estas?|mijo|mija|senor|senora|amigo|joven|don|dona))*[!.,\s]*$' then
    return 'Hola 👋 Dime qué necesitas: puedo crear tareas y recordatorios, repartir el trabajo, decirte qué tienes hoy, pasarte los documentos de tu empresa o contestar tus preguntas.';
  end if;

  -- v12: gracias pelado → calidez (sin pasar por el motor)
  if length(v_t) <= 30
     and v_t ~ '^((ok|okey|perfecto|listo|genial|super|excelente|muy bien|vale)[!.,\s]*)?(muchas\s+|muchisimas\s+|mil\s+)?(gracias|grasias)[!.,\s]*$' then
    return 'Con gusto 🙂 Aquí estoy para lo que necesites.';
  end if;

  -- v12: «¿estás ahí?» → presencia, no el fallback de conocimiento
  if v_t ~ '^(estas (ahi|ay|hay)|sigues (ahi|ay)|hay alguien( ahi)?|me escuchas|me lees|funcionas)[?!.,\s]*$' then
    return 'Aquí estoy 🙂 Dime qué necesitas y lo hago.';
  end if;

  -- v12: frustración corta → disculpa + cómo pedirme las cosas (solo el mensaje
  -- pelado; con más texto la frase sigue su camino)
  if length(v_t) <= 35
     and v_t ~ '^(esto no sirve|no sirves?|no me entiendes|no entiendes( nada)?|no me estas entendiendo|no funcionas?|no me ayudas|que mal servicio)[!.,\s]*$' then
    return 'Una disculpa, no me di a entender. Dime con tus palabras qué necesitas: puedo crear tareas y recordatorios, repartir el trabajo, decirte qué tienes hoy o pasarte los documentos de tu empresa. Si algo no me sale, también puedes pedirle ayuda al administrador.';
  end if;

  -- ⭐ v16: ¿esto es OPERACIÓN del sistema? Entonces NO es del puente: es del
  -- modelo, que entiende la intención. Se decide por los OBJETOS que nombra la
  -- frase, no por cómo esté redactada.
  if not (v_t ~ '((que|ke|qe) (es|son|significa|significan|quiere decir)|a (que|ke) le (dicen|llaman))')
     and (
       -- (a) sustantivos del dominio: los nombres de las cosas que el sistema maneja
       v_t ~ '(^|[^a-z])(tarea|tareas|actividad|actividades|pendiente|pendientes|agenda|agendas|recordatorio|recordatorios|encargo|encargos|mandado|mandados|quehacer|quehaceres|compromiso|compromisos|deberes|chamba)([^a-z]|$)'
       -- (b) el nombre que ESTE tenant le puso a su módulo de trabajo
       or exists (
         select 1 from public.organizations o
          where o.id = p_org
            and coalesce(o.meta_config->'mkt'->>'moduleLabel','') <> ''
            and v_t ~ ('(^|[^a-z])'||public.unaccent(lower(o.meta_config->'mkt'->>'moduleLabel'))||'([^a-z]|$)')
       )
       -- (c) el nombre real de alguien de su equipo (y no le están preguntando quién es)
       or ( v_t !~ '(quien|kien)(es)? (es|son)'
            and exists (
              select 1 from public.profiles pr
               where pr.organization_id = p_org and coalesce(pr.active,true)
                 and coalesce(btrim(pr.name),'') <> ''
                 and length(split_part(public.unaccent(lower(btrim(pr.name))),' ',1)) >= 4
                 and v_t ~ ('(^|[^a-z])'||split_part(public.unaccent(lower(btrim(pr.name))),' ',1)||'([^a-z]|$)')
                 -- una palabra que también nombra una etapa o un sub-tablero no
                 -- es «una persona»: gana el tablero (v17b)
                 and not exists (
                   select 1 from public.fn_effective_org_stages(p_org) st
                    where st.organization_id = p_org and st.activo and st.deleted_at is null
                      and ( public.unaccent(lower(st.nombre)) ~ ('(^|[^a-z])'||split_part(public.unaccent(lower(btrim(pr.name))),' ',1)||'([^a-z]|$)')
                         or public.unaccent(lower(coalesce(st.grupo,''))) ~ ('(^|[^a-z])'||split_part(public.unaccent(lower(btrim(pr.name))),' ',1)||'([^a-z]|$)') )
                 )
            ) )
     ) then
    return null;
  end if;

  if v_t ~ '(como va|como van|en (que|ke|qe|q) (etapa|paso|parte|va|anda)|en (que|ke|qe|q) va|cuando se (entrega|termina|acaba)|cuando (entregamos|entregan|entrego|terminamos|terminan|termina|acabamos|acaban|sale|esta list[oa])|para cuando|estado de|que sigue (con|de)|avance de|etapa (va|ba|esta|anda|lleva))'
     or (length(v_t) <= 45 and array_length(regexp_split_to_array(v_t, '\s+'), 1) <= 6) then
    v_n := 0; v_lista := ''; v_out := '';
    for v_lead in
      select l.name, l.stage, l.next_action, l.next_action_date
        from public.leads l
       where l.organization_id = p_org and l.deleted_at is null
         and exists (
           select 1
             from unnest(regexp_split_to_array(v_t, '[^a-z0-9]+')) qw
             join unnest(regexp_split_to_array(public.unaccent(lower(l.name)), '[^a-z0-9]+')) nw on qw = nw
            where length(qw) >= 4 and qw not in ('casa','casas','etapa','como','cuando','donde','entrega')
         )
       order by l.name
    loop
      v_n := v_n + 1;
      if v_n = 1 then
        v_out := v_lead.name||' va en la etapa «'||coalesce(v_lead.stage,'sin etapa')||'».'
          || case when v_lead.next_action is not null and btrim(v_lead.next_action) <> ''
                  then E'\nSiguiente paso: '||v_lead.next_action
                       || case when v_lead.next_action_date is not null and btrim(v_lead.next_action_date) <> ''
                               then ' ('||v_lead.next_action_date||')' else '' end
                  else '' end;
      end if;
      v_lista := v_lista || E'\n• ' || v_lead.name || ' · ' || coalesce(v_lead.stage,'sin etapa');
    end loop;
    if v_n = 1 then
      return v_out;
    elsif v_n > 1 then
      return 'Encontré '||v_n||' con ese nombre:'||v_lista||E'\n\n¿De cuál me preguntas?';
    end if;

    -- v15: preguntó CLARAMENTE por el estado de algo y no hay nada que coincida.
    -- (Solo con el patrón explícito: el atajo de «texto corto» sigue de largo.)
    -- v18b: el MISMO patrón de la puerta de entrada, no una copia que se despega
    if v_t ~ '(como va|como van|en (que|ke|qe|q) (etapa|paso|parte|va|anda)|en (que|ke|qe|q) va|cuando se (entrega|termina|acaba)|cuando (entregamos|entregan|entrego|terminamos|terminan|termina|acabamos|acaban|sale|esta list[oa])|para cuando|estado de|que sigue (con|de)|avance de|etapa (va|ba|esta|anda|lleva))' then
      if not exists (select 1 from public.leads l
                      where l.organization_id = p_org and l.deleted_at is null) then
        return 'Tu tablero todavía no tiene nada cargado. En cuanto se registre el primero, te digo en qué etapa va y qué sigue.';
      end if;
      return 'No encontré nada con ese nombre en tu tablero. ¿Lo escribiste completo? También puedes abrir el tablero y buscarlo ahí.';
    end if;
  end if;

  -- v11: el NOMBRE de una etapa («cuál es la última etapa», «cómo se llama la etapa 3»,
  -- «qué etapas hay») — solo si la org TIENE etapas propias; si no, sigue su camino.
  -- v17b: la empresa declaró que NO trabaja con etapas. La pregunta tiene
  -- respuesta, y no es un documento: es cómo funciona SU sistema.
  if v_t ~ '(^|[^a-z])(etapa|etapas|fase|fases|pipeline|embudo|tablero de (venta|clientes))([^a-z]|$)'
     and exists (select 1 from public.organizations o
                  where o.id = p_org and o.meta_config->>'sin_pipeline' = 'true') then
    return 'Acá no se trabaja con etapas: en tu empresa cada cosa por hacer es una ACTIVIDAD, con su responsable y su fecha, y se cierra cuando queda lista. Dime qué necesitas anotar y lo registro.';
  end if;

  if exists (select 1 from public.fn_effective_org_stages(p_org) s
              where s.organization_id = p_org and s.activo and s.deleted_at is null) then
    if v_t ~ '((que|ke|cuales|kuales|cuantas) etapas|etapas (hay|tiene|son|del tablero)|(que|cuales|cuantos) tableros)' then
      select count(*) into v_n from public.fn_effective_org_stages(p_org)
       where organization_id = p_org and activo and deleted_at is null;
      -- Con sub-tableros se listan agrupadas: mezclarlas confunde (son procesos
      -- distintos, con dueños distintos).
      if exists (select 1 from public.fn_effective_org_stages(p_org)
                  where organization_id = p_org and activo and deleted_at is null and grupo is not null) then
        select string_agg(bloque, E'\n\n') into v_lista from (
          select coalesce(g.grupo,'Otras')||':'||E'\n'||
                 string_agg('• '||g.nombre, E'\n' order by g.orden) as bloque, min(g.orden) as ord
            from public.fn_effective_org_stages(p_org) g
           where g.organization_id = p_org and g.activo and g.deleted_at is null
           group by g.grupo order by min(g.orden)
        ) q;
        return 'Tu tablero tiene '||v_n||' etapas, repartidas así:'||E'\n\n'||v_lista;
      end if;
      select string_agg('• '||nombre, E'\n' order by orden) into v_lista
        from public.fn_effective_org_stages(p_org)
       where organization_id = p_org and activo and deleted_at is null;
      return 'El tablero tiene '||v_n||' etapas:'||E'\n'||v_lista;
    end if;
    if v_t ~ '((cual|kual) es|como se (llama|yama)|(que|ke) es|dime|digame|cual seria).{0,25}(etapa|fase)'
       or v_t ~ '(la |el )?(primera?|segunda|tercera?|cuarta|quinta|sexta|septima|octava|novena|decima|ultima|final)\s+(etapa|fase)'
       or v_t ~ '(etapa|fase)\s+(numero\s+)?[0-9]{1,2}' then
      -- Si la frase nombra un SUB-TABLERO («la última etapa de taller»), va el texto
      -- ENTERO: fn_org_stage v4 sabe de grupos. Si no, el trozo ordinal de siempre.
      if exists (
        select 1 from public.fn_effective_org_stages(p_org) s
         where s.organization_id = p_org and s.activo and s.deleted_at is null and s.grupo is not null
           and exists (select 1 from unnest(regexp_split_to_array(public.unaccent(lower(s.grupo)), '[^a-z0-9]+')) gw
                        where length(gw) >= 5 and v_t ~ ('(^|[^a-z])'||gw))
      ) then
        v_lista := public.fn_org_stage(p_org, v_t);
        if v_lista is not null then return 'Esa etapa se llama «'||v_lista||'».'; end if;
      end if;
      -- Apellido que NO es un sub-tablero conocido: no se adivina, se muestra el orden
      if v_t ~ '(etapa|fase)s?\s+del?\s+[a-z]' then
        select count(*), string_agg('• '||nombre, E'\n' order by orden) into v_n, v_lista
          from public.fn_effective_org_stages(p_org)
         where organization_id = p_org and activo and deleted_at is null;
        return 'Estas son las '||v_n||' etapas del tablero, en orden:'||E'\n'||v_lista||E'\n\n¿Cuál de estas te interesa?';
      end if;
      v_lista := public.fn_org_stage(p_org, coalesce(
        (regexp_match(v_t, '(((la|el)\s+)?(primera?|segunda|tercera?|cuarta|quinta|sexta|septima|octava|novena|decima|ultima|final)(\s+(etapa|fase))?)'))[1],
        (regexp_match(v_t, '((etapa|fase)\s+(numero\s+)?[0-9]{1,2})'))[1], v_t));
      if v_lista is not null then
        return 'Esa etapa se llama «'||v_lista||'».';
      end if;
    end if;
  end if;

  if v_t ~ '(que tengo|que hay para hoy|mi dia|mi agenda|como va|como van|que tiene|que tareas|que le toca|avance de|al dia con|que pendientes)' then
    return null;
  end if;

  if v_t ~ '(quien(es)?|que|cuales|cuantos).{0,40}(cuenta|usuario|acceso|registrad|dad[oa]s de alta)'
     or v_t ~ '(tienen|hay) (cuenta|usuario|acceso)'
     or v_t ~ '(quien|kien) (es )?(el |la )?(admin(istrador|istradora)?\y|encargad[oa] del sistema)' then
    select count(*), string_agg('• '||p.name||' · '||
             case p.role when 'admin' then 'administrador' when 'asesor' then 'miembro del equipo' else p.role end ||
             case when p.active then '' else ' (inactivo)' end, E'\n' order by p.role, p.name)
      into v_n, v_gente
      from public.profiles p where p.organization_id = p_org;
    if v_n > 0 then
      return 'Estas son las cuentas de tu empresa hoy ('||v_n||'):'||E'\n'||v_gente||E'\n\nPara dar de alta a alguien más: módulo Usuarios (o pídele al administrador).';
    end if;
  end if;

  if v_t ~ '(pasame|mandame|enviame|dame|comparteme|busca(me)?|quiero|necesito|donde esta|tienes|hay).*(documento|docs?|archivo|reporte|informe|contrato|poliza|licencia|plano)'
     or v_t ~ '(que|ke|q|cuales|kuales) documentos'
     or v_t ~ 'documentos?.{0,15}(hay|ay|existen|tenemos|cargados)' then
    select meta_config->'documents' into v_docs from public.organizations where id = p_org;
    select string_agg('«'||titulo||'»', ', ' order by titulo) into v_temas
      from public.org_brain_docs where organization_id = p_org and deleted_at is null;
    if v_docs is null or jsonb_array_length(v_docs) = 0 then
      return 'Todavía no hay documentos cargados para tu empresa. Se agregan en Mi Espacio → Documentos, y desde ese momento me los puedes pedir por nombre.'
        || case when v_temas is not null then E'\n\nLo que sí me sé de tu empresa y me puedes preguntar: '||v_temas||'.' else '' end;
    end if;
    for v_item in select * from jsonb_array_elements(v_docs) loop
      if v_t like '%'||public.unaccent(lower(coalesce(v_item->>'title','')))||'%'
         or exists (select 1 from unnest(regexp_split_to_array(public.unaccent(lower(coalesce(v_item->>'title',''))),'[^a-z0-9]+')) tw
                     where length(tw)>=5 and v_t like '%'||tw||'%') then
        return 'Aquí tienes '||(v_item->>'title')||E':\n'||(v_item->>'url');
      end if;
    end loop;
    v_out := 'Estos son los documentos de tu empresa:'||E'\n';
    for v_item in select * from jsonb_array_elements(v_docs) loop
      v_out := v_out||E'\n• '||(v_item->>'title')||E'\n  '||(v_item->>'url');
    end loop;
    return v_out
      || case when v_temas is not null then E'\n\nAdemás me sé estos temas de tu empresa (pregúntame directo): '||v_temas||'.' else '' end
      || E'\n\nPídeme cualquiera por su nombre y te paso el enlace.';
  end if;

  -- v19: pedir ayuda a secas. Es lo que escribe quien nunca usó esto.
  if length(v_t) <= 40
     and v_t ~ '^(me )?(puede |podes |podrias )?(ayud(a|e|ame|eme|arme|as)|auxilio|socorro|(ke|que) (ago|hago)( aqui| aca| aki)?|(y )?(ahora )?(ke|que)( hago| ago)?|no se( que hacer| como| usar)?|estoy perdid[oa])([\s,]+(por favor|porfavor|porfa|please|si puede|si podes))?[\s!.,¿?]*$' then
    return 'Claro, yo te ayudo. Dime con tus palabras qué necesitas y yo lo hago. Por ejemplo: «¿qué tengo hoy?», «ponme una tarea: llamar al proveedor mañana a las 10», «ya terminé lo del comedor», o pídeme el manual y te paso la guía completa.';
  end if;

  -- v18: pedir EL MANUAL no es preguntar qué puede hacer. Se responde el manual.
  if v_t ~ '(^|[^a-z])(manual|amnual|manaul|manul|mnual|instructivo|guia)([^a-z]|$)' then
    select d->>'title', d->>'url' into v_doc_titulo, v_link
      from public.organizations o, jsonb_array_elements(coalesce(o.meta_config->'documents','[]'::jsonb)) d
     where o.id = p_org and public.unaccent(lower(coalesce(d->>'title',''))) like '%manual%'
     limit 1;
    if v_link is not null then
      return 'Aquí tienes el manual de tu empresa, con todo explicado paso a paso:'||E'\n\n'||
             coalesce(v_doc_titulo,'Manual de uso')||E'\n'||v_link||
             E'\n\nSe abre desde el celular o la computadora, sin contraseña. Y si prefieres, pregúntame directo lo que necesites hacer.';
    end if;
  end if;

  if v_t ~ '(que (tanto |cosas )?(me )?(puedes?|peudes?|pudes?|podes|sabes) (hacer|aser)|que haces|que funciones|para que (sirves?|es esto|es este)|quesirve|que sirve|de que sirve|ayudar|ayuda|manual|amnual|manaul|manul|mnual|instructivo|guia|como (se usa|te uso|lo uso|funciona|le hago|se maneja)|que sabes|no (le |lo )?entiendo|no se usar|no se como|papel .*(usar|dice|diga)|donde (apunto|anoto|escribo)|(en que|donde) (parte )?(le )?pico|este aparato|que hace est[oe])' then
    select d->>'url' into v_link
      from organizations o, jsonb_array_elements(coalesce(o.meta_config->'documents','[]'::jsonb)) d
     where o.id = p_org and public.unaccent(lower(coalesce(d->>'title',''))) like '%manual%'
     limit 1;
    return 'Esto es lo que puedo hacer por ti:'
      || E'\n\n• Crear tareas y recordatorios: «ponme una tarea: … mañana a las 10» o «recuérdame a las 5 …»'
      || E'\n• Repartir el trabajo: «que <nombre> haga … el jueves» (le llega el aviso y lo persigo yo)'
      || E'\n• Tu día: «¿qué tengo hoy?» o «¿qué pendientes tiene el equipo?»'
      || E'\n• Los documentos de tu empresa: «¿qué documentos hay?» o pídeme uno por su nombre'
      || E'\n• Preguntas de tu empresa: pregúntame con tus palabras y te contesto con lo que sé'
      || E'\n\nTodo por texto o por voz. Los avisos llegan 1 hora y 10 minutos antes, solo en tu jornada.'
      || case when v_link is not null
              then E'\n\nEl manual completo, paso a paso: '||v_link
              else '' end;
  end if;

  -- 5a) PRECIOS → el doc de precios/tarifas de la empresa   [v15]
  if v_t ~ '((cuanto|kuanto|kuato|quanto) (cuesta|questa|sale|vale|cobran|es|seria|saldria)|(que|ke) precio|precio de|lista de precios|cuanto me (sale|cuesta)|presupuesto de)' then
    select d.titulo, d.contenido into v_doc
      from public.org_brain_docs d
     where d.organization_id = p_org and d.deleted_at is null
       and ( public.unaccent(lower(d.titulo)) ~ '(precio|costo|tarifa|cuanto cuesta|cotiza)'
          or exists (select 1 from unnest(d.tags) t
                      where public.unaccent(lower(t)) ~ '(precio|costo|tarifa|cotiza)') )
     order by d.updated_at desc
     limit 1;
    if v_doc.contenido is not null then
      return v_doc.titulo||':'||E'\n\n'||v_doc.contenido;
    end if;
  end if;

  -- 5b) DEFINICIONES → el doc de vocabulario de la empresa   [v14]
  -- Solo si el doc EXISTE y además contiene la palabra preguntada: si no, la
  -- pregunta sigue su camino normal (nunca secuestra).
  if v_t ~ '((que|ke|qe) (es|son|significa|significan|quiere decir|quieren decir)|a (que|ke) le (dicen|llaman)|(que|ke) es eso de)' then
    select d.titulo, d.contenido into v_doc
      from public.org_brain_docs d
     where d.organization_id = p_org and d.deleted_at is null
       and ( public.unaccent(lower(d.titulo)) ~ '(vocabulario|glosario|palabras|diccionario)'
          or exists (select 1 from unnest(d.tags) t
                      where public.unaccent(lower(t)) ~ '(vocabulario|glosario|palabras|jerga)') )
     order by d.updated_at desc
     limit 1;
    if v_doc.contenido is not null
       and exists (
         select 1 from unnest(regexp_split_to_array(v_t, '[^a-z0-9]+')) qw
          where length(qw) >= 4
            and qw not in ('que','ke','significa','significan','quiere','decir','dicen','llaman','eso','esto','esta','este','cual','como')
            and translate(replace(public.unaccent(lower(v_doc.contenido)),'h',''),'zcv','ssb')
                like '%'||translate(replace(qw,'h',''),'zcv','ssb')||'%'
       ) then
      return v_doc.titulo||':'||E'\n\n'||v_doc.contenido;
    end if;
  end if;

  -- 6) PERSONAS y PERMISOS → el doc de quién es quién   [v7b]
  if v_t ~ '(quien|kien|quienes)'
     or v_t ~ '(pued[oe]|podemos|pueden).{0,40}(escribir|editar|cambiar|modificar|capturar|borrar|meter)'
     or v_t ~ 'nomas (los|las)' then
    select d.titulo, d.contenido into v_doc
      from public.org_brain_docs d
      cross join lateral (
        select (case when public.unaccent(lower(d.titulo)) ~ '(quien es quien|equipo|permis|persona|quienes somos)' then 3 else 0 end)
             + (case when exists (select 1 from unnest(d.tags) t
                                   where public.unaccent(lower(t)) ~ '(quien es quien|equipo|permis|persona)') then 2 else 0 end)
             + (case when public.unaccent(lower(d.titulo)) ~ '(quien|kien)' then 1 else 0 end)
             as sc
      ) s
     where d.organization_id = p_org and d.deleted_at is null and s.sc > 0
     order by s.sc desc, d.updated_at desc
     limit 1;
    if v_doc.contenido is not null
       and not public.fn_org_copilot_personas_secuestra(p_org, v_t, v_doc.titulo, v_doc.contenido)
       and (
         v_t ~ '((quien|kien)(es)? (es|son|somos|trabaja|trabajan|atiende|atienden|esta|estan|hay|integra|labura)|quien es quien|kien es kien|el equipo|mi equipo|la gente|el personal)'
         or v_t ~ '(manda|jefe|encargad|lidera|dirige|edita|escrib|cambia|captura|borra|permis|autoriza|nomas|arquitect|responsable)'
         or exists (select 1 from unnest(regexp_split_to_array(public.unaccent(lower(v_doc.titulo||' '||v_doc.contenido)),'[^a-z0-9]+')) cw
                     where length(cw)>=5 and v_t like '%'||cw||'%'
                       and cw not in ('todos','todas','unicos','unicas','puede','pueden','lectura','direccion',
                                      'proyectos','sistema','empresa','quien','kien','quienes','equipo','gente','personal','trabaja'))
       ) then
      return v_doc.titulo||':'||E'\n\n'||v_doc.contenido;
    end if;
  end if;

  select d.titulo, d.contenido into v_doc
    from public.org_brain_docs d
    cross join lateral (
      select coalesce(sum(
        case when translate(replace(public.unaccent(lower(d.titulo)),'h',''),'zcv','ssb') like '%'||translate(replace(w,'h',''),'zcv','ssb')||'%' then 3 else 0 end
        + case when exists (select 1 from unnest(d.tags) t where translate(replace(public.unaccent(lower(t)),'h',''),'zcv','ssb') like '%'||translate(replace(w,'h',''),'zcv','ssb')||'%') then 2 else 0 end
        + case when translate(replace(public.unaccent(lower(d.contenido)),'h',''),'zcv','ssb') like '%'||translate(replace(w,'h',''),'zcv','ssb')||'%' then 1 else 0 end
      ),0) as score,
      coalesce(sum(
        case when translate(replace(public.unaccent(lower(d.titulo)),'h',''),'zcv','ssb') like '%'||translate(replace(w,'h',''),'zcv','ssb')||'%'
               or exists (select 1 from unnest(d.tags) t where translate(replace(public.unaccent(lower(t)),'h',''),'zcv','ssb') like '%'||translate(replace(w,'h',''),'zcv','ssb')||'%')
             then 1 else 0 end
      ),0) as fuertes,
      coalesce(count(distinct w) filter (where
        translate(replace(public.unaccent(lower(d.titulo||' '||coalesce(array_to_string(d.tags,' '),'')||' '||d.contenido)),'h',''),'zcv','ssb')
          like '%'||translate(replace(w,'h',''),'zcv','ssb')||'%'
      ),0) as coincidencias
      from unnest(regexp_split_to_array(v_t, '[^a-z0-9]+')) w
      where length(w) >= 4
        and w not in ('para','este','esta','esto','pero','porque','cuando','donde','como','tiene','tienen','tengo','sobre','entre','hacer','aser','estan','dime','dame','digame','decime','mija','mijo','oiga','porfavor','favor','esque','nada','algo','aqui','alla','ella','ellos','usted','ustedes','quien','kien','cual','cuales','cosa','cosas','todas','todos','siempre','nunca','ahora','luego','sirve','saber','puede','pueden','puedo','quiero','necesito','tienes','dice','dicen','sabes','ese','esa','pues','vaya','bueno','buenas','buenos','hola','gracias','señor','senor','señora','senora','casa','casas','equipo','antes','despues','seccion','espacio',
                       'unos','unas','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez',
                       'primera','primero','segunda','segundo','tercera','tercero','varios','varias','otro','otra') and w not in (select onw from unnest(regexp_split_to_array(public.unaccent(lower(coalesce((select o2.name from public.organizations o2 where o2.id = p_org),''))), '[^a-z0-9]+')) onw)
        and ( (select count(*) from public.org_brain_docs d4
                where d4.organization_id = p_org and d4.deleted_at is null) < 4
           or 2 * (select count(*) from public.org_brain_docs d3
                    where d3.organization_id = p_org and d3.deleted_at is null
                      and translate(replace(public.unaccent(lower(d3.titulo||' '||d3.contenido)),'h',''),'zcv','ssb')
                          like '%'||translate(replace(w,'h',''),'zcv','ssb')||'%')
              <= (select count(*) from public.org_brain_docs d5
                   where d5.organization_id = p_org and d5.deleted_at is null) )
    ) s
   where d.organization_id = p_org and d.deleted_at is null
     and s.score >= case when 'manual' = any(d.tags) then 2 else 1 end
     -- v17: certeza. Una palabra suelta dentro del CONTENIDO no alcanza para
     -- soltar un documento entero: o pega en el título/tags, o pegan dos.
     and (s.fuertes > 0 or s.coincidencias >= 2)
   order by s.score desc, d.updated_at desc
   limit 1;
  if v_doc.contenido is not null then
    return v_doc.titulo||':'||E'\n\n'||v_doc.contenido;
  end if;

  if v_t like '%?%'
     or v_t ~ '^(que|cual|cuales|quien|kien|quienes|como|donde|cuando|cuanto|cuanta|por que|porque|hay |sera |sabes|digame|dime|explica|cuentame|me puedes decir)'
     or v_t ~ '(digame|explicame|cuentame|sabes si|me puedes decir)' then
    -- v17: acá NO se responde «no lo tengo». El modelo entiende la intención y
    -- tiene los datos del tablero y de la agenda: que conteste él.
    return null;
  end if;

  return null;
end $function$;


CREATE OR REPLACE FUNCTION public.fn_org_mover_etapa(p_profile_id uuid, p_nombre text, p_etapa text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid; v_etapa text; v_n int; v_lead record; v_lista text; v_etapas text;
  v_cosa text; v_cosas text; v_total int;
begin
  select organization_id into v_org from public.profiles where id = p_profile_id;
  if v_org is null then return 'No encontré tu perfil.'; end if;

  -- Cómo le dice ESTA empresa a lo que hay en su tablero.
  select coalesce(nullif(btrim(i.registro_singular),''), 'registro'),
         coalesce(nullif(btrim(i.registro_plural),''), 'registros')
    into v_cosa, v_cosas
    from public.org_copilot_identidad i
   where i.organization_id = v_org and i.activo
   limit 1;
  v_cosa  := coalesce(v_cosa, 'registro');
  v_cosas := coalesce(v_cosas, 'registros');

  if coalesce(btrim(p_nombre),'') = '' then
    return 'Dime cuál quieres mover y a qué paso.';
  end if;

  -- La etapa, en las palabras de ESTA empresa (acepta typos y ordinales)
  v_etapa := public.fn_org_stage(v_org, p_etapa);
  if v_etapa is null then
    select string_agg(nombre, ' · ' order by orden) into v_etapas
      from public.fn_effective_org_stages(v_org)
     where organization_id = v_org and activo and deleted_at is null;
    if v_etapas is null then
      return 'Tu empresa no maneja etapas: acá cada cosa por hacer es una actividad con su responsable y su fecha.';
    end if;
    return 'No reconocí «'||coalesce(p_etapa,'')||'». Los pasos de tu tablero son: '||v_etapas||'.';
  end if;

  -- El registro, dentro de SU empresa
  select count(*) into v_n from public.leads
   where organization_id = v_org and deleted_at is null
     and public.unaccent(lower(name)) like '%'||public.unaccent(lower(btrim(p_nombre)))||'%';

  if v_n = 0 then
    -- ⭐ Antes de mandarla a revisar cómo lo escribió: ¿hay algo cargado?
    select count(*) into v_total from public.leads
     where organization_id = v_org and deleted_at is null;

    if v_total = 0 then
      return 'Todavía no hay ningún '||v_cosa||' cargado en tu tablero, así que no tengo qué mover. '
          || 'Cuando entre el primero y lo registres, me dices y yo lo voy pasando de paso en paso.';
    end if;

    return 'No encontré ningún '||v_cosa||' que se llame «'||p_nombre||'». '
        || 'Hoy tienes '||v_total||' '||case when v_total = 1 then v_cosa else v_cosas end
        || ' en el tablero. ¿Lo escribiste completo?';
  end if;

  if v_n > 1 then
    select string_agg(name, ' · ') into v_lista from (
      select name from public.leads
       where organization_id = v_org and deleted_at is null
         and public.unaccent(lower(name)) like '%'||public.unaccent(lower(btrim(p_nombre)))||'%'
       order by name limit 5) s;
    return 'Hay varios que coinciden: '||v_lista||'. ¿Cuál exactamente?';
  end if;

  select * into v_lead from public.leads
   where organization_id = v_org and deleted_at is null
     and public.unaccent(lower(name)) like '%'||public.unaccent(lower(btrim(p_nombre)))||'%'
   limit 1;

  if v_lead.stage = v_etapa then
    return '«'||v_lead.name||'» ya estaba en '||v_etapa||'.';
  end if;

  update public.leads
     set stage = v_etapa, updated_at = now()
   where id = v_lead.id;

  return '«'||v_lead.name||'» pasó de '||coalesce(v_lead.stage,'sin paso')||' a '||v_etapa||'.';
end $function$;


CREATE OR REPLACE FUNCTION public.bot_upsert_lead(p_telegram_chat_id bigint, p_phone text, p_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_stage text DEFAULT NULL::text, p_budget_text text DEFAULT NULL::text, p_budget_numeric bigint DEFAULT NULL::bigint, p_project text DEFAULT NULL::text, p_campaign text DEFAULT NULL::text, p_bio text DEFAULT NULL::text, p_score integer DEFAULT NULL::integer, p_hot boolean DEFAULT NULL::boolean, p_next_action text DEFAULT NULL::text, p_next_action_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_new_asesor_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_asesor record;
  v_phone_norm text;
  v_lead record;
  v_was_created boolean := false;
  v_new_id uuid;
  v_target_asesor_id uuid;
  v_target_asesor_name text;
  v_can_reassign boolean := false;
begin
  select id, name, role, organization_id
    into v_asesor
  from public.profiles
  where telegram_chat_id = p_telegram_chat_id and active = true;

  if not found then
    return jsonb_build_object('error', 'asesor_not_paired');
  end if;

  if nullif(btrim(p_stage),'') is not null then
    p_stage := public.fn_org_stage(v_asesor.organization_id,p_stage);
    if p_stage is null then return jsonb_build_object('success',false,'error','invalid_stage','stages',public.fn_org_stages_list(v_asesor.organization_id)); end if;
  end if;
  v_can_reassign := v_asesor.role in ('super_admin','admin','ceo','director');

  -- Normaliza la campaña a la forma canónica del tenant (alias en meta_config). White-label.
  p_campaign := public.fn_resolve_campaign(v_asesor.organization_id, p_campaign);

  v_phone_norm := nullif(regexp_replace(p_phone, '[^0-9]', '', 'g'), '');
  if v_phone_norm is null then
    return jsonb_build_object('error', 'invalid_phone');
  end if;

  -- asesor destino opcional para admin
  if p_new_asesor_name is not null and trim(p_new_asesor_name) <> '' then
    if not v_can_reassign then
      return jsonb_build_object('error','reassign_forbidden');
    end if;

    select p2.id, p2.name
      into v_target_asesor_id, v_target_asesor_name
    from public.profiles p2
    where p2.organization_id = v_asesor.organization_id
      and p2.active = true
      and (
        lower(trim(p2.name)) = lower(trim(p_new_asesor_name))
        or p2.name ilike '%' || trim(p_new_asesor_name) || '%'
      )
    order by case when lower(trim(p2.name)) = lower(trim(p_new_asesor_name)) then 0 else 1 end,
             length(p2.name)
    limit 1;

    if v_target_asesor_id is null then
      return jsonb_build_object('error','new_asesor_not_found');
    end if;
  end if;

  select id, asesor_id, asesor_name, name
    into v_lead
  from public.leads
  where organization_id = v_asesor.organization_id
    and phone_normalized = v_phone_norm
    and deleted_at is null
  for update
  limit 1;

  if found then
    if v_lead.asesor_id is not null and v_lead.asesor_id <> v_asesor.id
       and not v_can_reassign then
      return jsonb_build_object('error', 'lead_assigned_to_other_asesor', 'lead_id', v_lead.id, 'lead_name', v_lead.name);
    end if;

    update public.leads set
      name = coalesce(nullif(p_name, ''), name),
      email = coalesce(nullif(p_email, ''), email),
      stage = coalesce(nullif(p_stage, ''), stage),
      budget = coalesce(nullif(p_budget_text, ''), budget),
      presupuesto = coalesce(p_budget_numeric, presupuesto),
      project = coalesce(nullif(p_project, ''), project),
      campaign = coalesce(nullif(p_campaign, ''), campaign),
      bio = coalesce(nullif(p_bio, ''), bio),
      score = coalesce(p_score, score),
      hot = coalesce(p_hot, hot),
      next_action = coalesce(nullif(p_next_action, ''), next_action),
      next_action_at = coalesce(p_next_action_at, next_action_at),
      asesor_id = coalesce(v_target_asesor_id, asesor_id),
      asesor_name = coalesce(v_target_asesor_name, asesor_name),
      last_activity = 'Telegram · ' || coalesce(nullif(p_next_action, ''), nullif(p_stage, ''), 'actualización'),
      updated_at = now()
    where id = v_lead.id;

    v_new_id := v_lead.id;
  else
    begin
      insert into public.leads (
        organization_id, asesor_id, asesor_name, name, phone, email,
        stage, budget, presupuesto, project, campaign, bio, score, hot,
        next_action, next_action_at, last_activity, source
      ) values (
        v_asesor.organization_id,
        coalesce(v_target_asesor_id, v_asesor.id),
        coalesce(v_target_asesor_name, v_asesor.name),
        coalesce(nullif(p_name, ''), 'Sin nombre'),
        p_phone,
        nullif(p_email, ''),
        coalesce(nullif(p_stage, ''), public.fn_org_stage(v_asesor.organization_id,'primera etapa')),
        nullif(p_budget_text, ''),
        p_budget_numeric,
        nullif(p_project, ''),
        nullif(p_campaign, ''),
        nullif(p_bio, ''),
        coalesce(p_score, 50),
        coalesce(p_hot, false),
        nullif(p_next_action, ''),
        p_next_action_at,
        'Creado vía Telegram',
        'telegram'
      ) returning id into v_new_id;

      v_was_created := true;
    exception when unique_violation then
      select id, asesor_id, name
        into v_lead
      from public.leads
      where organization_id = v_asesor.organization_id
        and phone_normalized = v_phone_norm
        and deleted_at is null
      for update
      limit 1;

      if not found then
        return jsonb_build_object('error', 'unexpected_state');
      end if;

      if v_lead.asesor_id is not null and v_lead.asesor_id <> v_asesor.id
         and not v_can_reassign then
        return jsonb_build_object('error', 'lead_assigned_to_other_asesor', 'lead_id', v_lead.id);
      end if;

      update public.leads set
        name = coalesce(nullif(p_name, ''), name),
        email = coalesce(nullif(p_email, ''), email),
        stage = coalesce(nullif(p_stage, ''), stage),
        budget = coalesce(nullif(p_budget_text, ''), budget),
        presupuesto = coalesce(p_budget_numeric, presupuesto),
        project = coalesce(nullif(p_project, ''), project),
        campaign = coalesce(nullif(p_campaign, ''), campaign),
        bio = coalesce(nullif(p_bio, ''), bio),
        score = coalesce(p_score, score),
        hot = coalesce(p_hot, hot),
        next_action = coalesce(nullif(p_next_action, ''), next_action),
        next_action_at = coalesce(p_next_action_at, next_action_at),
        asesor_id = coalesce(v_target_asesor_id, asesor_id),
        asesor_name = coalesce(v_target_asesor_name, asesor_name),
        last_activity = 'Telegram · ' || coalesce(nullif(p_next_action, ''), nullif(p_stage, ''), 'actualización'),
        updated_at = now()
      where id = v_lead.id;

      v_new_id := v_lead.id;
    end;
  end if;

  -- NUEVO cliente -> prioridad 1 automática en la lista del asesor dueño (crm_prefs.order/pinned).
  -- Best-effort: si algo falla, nunca rompe la creación del lead.
  if v_was_created then
    begin
      declare
        v_owner  uuid := coalesce(v_target_asesor_id, v_asesor.id);
        v_prefs  jsonb;
        v_pinned text[];
        v_order  text[];
      begin
        select coalesce(crm_prefs,'{}'::jsonb) into v_prefs from public.profiles where id = v_owner;
        v_pinned := array(select jsonb_array_elements_text(coalesce(v_prefs->'pinned','[]'::jsonb)));
        v_order  := array(select jsonb_array_elements_text(coalesce(v_prefs->'order','[]'::jsonb)));
        if not (v_new_id::text = any(v_pinned)) then v_pinned := v_pinned || v_new_id::text; end if;
        v_order := array_remove(v_order, v_new_id::text);
        v_order := array[v_new_id::text] || v_order;  -- posición 1
        update public.profiles
           set crm_prefs = coalesce(crm_prefs,'{}'::jsonb)
                           || jsonb_build_object('pinned', to_jsonb(v_pinned), 'order', to_jsonb(v_order))
         where id = v_owner;
      end;
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object(
    'success', true,
    'lead_id', v_new_id,
    'created', v_was_created,
    'assigned_to', coalesce(v_target_asesor_name, v_asesor.name)
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.bot_create_lead_smart(p_telegram_chat_id bigint, p_args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_args jsonb := coalesce(p_args,'{}'::jsonb);
  v_text text := trim(coalesce(v_args->>'input_text', v_args->>'text',''));
  v_name text := nullif(trim(coalesce(v_args->>'name', v_args->>'client_name', v_args->>'nombre','')),'');
  v_phone text := nullif(trim(coalesce(v_args->>'phone', v_args->>'telefono','')),'');
  v_stage text := nullif(trim(coalesce(v_args->>'stage', v_args->>'etapa','')),'');
  v_next text := nullif(trim(coalesce(v_args->>'next_action', v_args->>'proxima_accion', v_args->>'accion','')),'');
  v_when text := nullif(trim(coalesce(v_args->>'next_action_at', v_args->>'fecha','')),'');
  v_asesor text := nullif(trim(coalesce(v_args->>'asesor_name', v_args->>'advisor_name', v_args->>'new_asesor_name','')),'');
  v_m text[]; v_at timestamptz; v_res jsonb; v_msg text; v_implies boolean; v_org uuid; v_tz text;
begin
  select organization_id into v_org from public.profiles
    where telegram_chat_id=p_telegram_chat_id and coalesce(active,true)=true
    order by updated_at desc nulls last limit 1;
  v_tz := public.fn_user_tz(v_org, p_telegram_chat_id);
  if v_phone is null and v_text <> '' then
    v_m := regexp_match(regexp_replace(v_text,'[\s\-\(\)]','','g'), '(\+?\d{7,15})');
    if v_m is not null then v_phone := regexp_replace(v_m[1],'\D','','g'); end if;
  end if;
  if v_phone is null then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text','Para crear el cliente necesito su teléfono. ¿Cuál es el número?','inline_keyboard','[]'::jsonb));
  end if;
  v_at := coalesce(public.parse_relative_or_abs_es(v_when, v_tz), public.parse_relative_or_abs_es(v_next, v_tz), public.parse_relative_or_abs_es(v_text, v_tz));
  -- 15 args (incluye p_new_asesor_name) para desambiguar el overload de Stratos
  v_res := public.bot_upsert_lead(
    p_telegram_chat_id, v_phone, v_name, null::text, v_stage::text,
    null::text, null::bigint, null::text, null::text, null::text, null::integer, null::boolean,
    coalesce(v_next, case when v_at is not null then 'Llamar' else null end)::text, v_at, v_asesor::text);
  if not coalesce((v_res->>'success')::boolean,false) then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No pude crear el cliente: '||coalesce(v_res->>'error','error_desconocido'),'inline_keyboard','[]'::jsonb));
  end if;
  v_implies := (v_next is not null) or (v_text ~* '(pr[oó]xima\s+acci[oó]n|llamar|llamarlo|agendar|seguimiento|zoom|en\s+\d|mañana|hoy)');
  if v_at is not null then
    v_msg := 'Listo. Creé a '||coalesce(v_name,'el cliente')||'. Próxima acción: '||coalesce(v_next,'Llamar')||' — '||public.fn_fecha_humana(v_at,v_tz,true)||'.'
             || case when v_asesor is not null then ' Asignado a '||v_asesor||'.' else '' end;
  elsif v_implies then
    v_msg := 'Creé a '||coalesce(v_name,'el cliente')||' con la acción "'||coalesce(v_next,'llamar')||'", pero no me quedó clara la fecha/hora. ¿Para cuándo la agendo? (ej: "mañana 10am" o "en 3 horas")';
  else
    v_msg := 'Listo. Creé a '||coalesce(v_name,'el cliente')||'.'||case when v_asesor is not null then ' Asignado a '||v_asesor||'.' else '' end;
  end if;
  return jsonb_build_object('ok',true,'reply',jsonb_build_object('text',v_msg,'inline_keyboard','[]'::jsonb));
end; $function$;


CREATE OR REPLACE FUNCTION public.bot_nlu_dispatch_gvintell_v2(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_tool text := lower(coalesce(p_tool_name,''));
  v_args jsonb := coalesce(p_args,'{}'::jsonb);
  v_text text := trim(coalesce(v_args->>'input_text', v_args->>'text', v_args->>'query', ''));
  v_org_id uuid; v_profile_id uuid; v_view_all boolean := false; v_role text;
  v_name text; v_stage text; v_stage_in text; v_next_action text; v_zoom_at_text text; v_zoom_at timestamptz;
  v_lead record; m_name text[]; v_client_name text; v_advisor_name text;
  v_advisor_id uuid; v_advisor_label text; v_lead_id uuid; v_lead_name text; v_tz text;
begin
  if jsonb_typeof(v_args->'query') = 'object' then
    if v_tool = '' then v_tool := lower(coalesce(v_args#>>'{query,tool_name}','')); end if;
    if jsonb_typeof(v_args#>'{query,args}') = 'object' then v_args := v_args#>'{query,args}'; end if;
    v_text := trim(coalesce(v_args->>'input_text', v_args->>'text', v_args->>'query', v_text));
  end if;
  select p.organization_id, p.id, coalesce(p.view_all_leads,false), coalesce(p.role,'asesor')
    into v_org_id, v_profile_id, v_view_all, v_role
  from public.profiles p where p.telegram_chat_id = p_telegram_chat_id and coalesce(p.active,true)=true
  order by p.updated_at desc nulls last limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No estas conectado al CRM. Usa /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;
  v_tz := public.fn_user_tz(v_org_id, p_telegram_chat_id);

  if v_tool in ('assign_client','reassign_client','assign_lead') then
    if v_role not in ('super_admin','admin','ceo','director') then
      return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No tienes permisos para asignar clientes.','inline_keyboard','[]'::jsonb));
    end if;
    v_client_name := nullif(trim(coalesce(v_args->>'client_name', v_args->>'name', '')), '');
    v_advisor_name := nullif(trim(coalesce(v_args->>'advisor_name', v_args->>'asesor_name', '')), '');
    if v_client_name is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Indica el nombre o teléfono del cliente a asignar.','inline_keyboard','[]'::jsonb)); end if;
    if v_advisor_name is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Indica el asesor destino. Ejemplo: asesor 2.','inline_keyboard','[]'::jsonb)); end if;
    select p2.id, p2.name into v_advisor_id, v_advisor_label from public.profiles p2
    where p2.organization_id = v_org_id and coalesce(p2.active,true)=true
      -- mig 228: cualquiera del lado VENTAS puede recibir un cliente (incluidos los
      -- directivos); solo se excluye el lado marketing (regla marketing ≠ ventas).
      and coalesce(p2.role,'asesor') <> 'marketing' and coalesce(p2.is_marketing_admin,false) = false
      and (public.fn_norm_nombre(p2.name) like '%'||public.fn_norm_nombre(v_advisor_name)||'%'
           or public.fn_obj_matchea(v_advisor_name, p2.name)
           or (regexp_replace(v_advisor_name,'[^0-9]','','g') <> '' and regexp_replace(coalesce(p2.name,''),'[^0-9]','','g') = regexp_replace(v_advisor_name,'[^0-9]','','g')))
    order by length(p2.name) asc limit 1;
    if v_advisor_id is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré al asesor destino "'||v_advisor_name||'".','inline_keyboard','[]'::jsonb)); end if;
    -- mig 232: elige por calidad de coincidencia y pregunta si hay empate.
    return public._bot_assign_client_safe(v_org_id, v_client_name, v_advisor_id, v_advisor_label);
    if v_lead_id is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré cliente con referencia "'||v_client_name||'".','inline_keyboard','[]'::jsonb)); end if;
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Listo. Asigné a '||coalesce(v_lead_name,'cliente')||' con '||coalesce(v_advisor_label,'asesor')||' y lo puse en Contáctame Ya (prioridad 1).','inline_keyboard','[]'::jsonb));
  end if;

  if public.unaccent(lower(v_text)) ~ '^(¿)?(que|cuales|cuantas) (son las |son mis |son |hay de |hay |son )?etapas' then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text',
      'Las etapas de tu empresa son: '||coalesce(array_to_string(public.fn_org_stages_list(v_org_id), ' · '),'sin etapas')||'.','inline_keyboard','[]'::jsonb));
  end if;

  if v_text ~* '(^|\s)(/clientes|mis\s+clientes|dame\s+el\s+nombre\s+de\s+mis\s+clientes|nombre\s+de\s+mis\s+clientes)(\s|$)' then v_tool := 'agenda';
  elsif v_text ~* '(^|\s)(/pipeline|pipeline|embudo)(\s|$)' then v_tool := 'pipeline'; end if;

  if v_tool in ('', 'auto') then
    if v_text ~* '(fecha.*zoom|zoom.*(mañana|manana|hoy|\d{1,2}|am|pm|:))' then v_tool := 'set_zoom_datetime';
    elsif v_text ~* '(cambia|mueve|actualiza).*(etapa)' then v_tool := 'change_stage';
    elsif v_text ~* '(cambia|actualiza).*(pr[oó]xima acci[oó]n)' then v_tool := 'update_next_action'; end if;
  end if;

  if v_tool in ('change_stage','update_stage','move_stage') then
    v_name := coalesce(v_args->>'client_name', v_args->>'name', v_args->>'nombre', null);
    v_stage := coalesce(v_args->>'stage', v_args->>'new_stage', v_args->>'etapa', null);
    v_zoom_at_text := coalesce(v_args->>'zoom_at', v_args->>'next_action_at', v_args->>'fecha_zoom', null);
    -- Copilot can send raw text without an LLM-provided stage. Parse both
    -- parts together, then resolve the target against THIS company's stages.
    m_name := regexp_match(v_text, '(?i)^(?:cambia|cambiar|actualiza|actualizar)\s+(?:la\s+)?etapa\s+(?:de|del)\s+(.+?)\s+(?:a|al)\s+(.+?)[.!]?$');
    if m_name is not null then
      v_name := coalesce(nullif(btrim(v_name),''),btrim(m_name[1]));
      v_stage := coalesce(nullif(btrim(v_stage),''),btrim(m_name[2]));
    end if;

    if v_name is null or trim(v_name)='' then m_name := regexp_match(v_text, '(?i)a\s+([A-Za-zÁÉÍÓÚáéíóúÑñ ]+)$'); if m_name is not null then v_name := trim(m_name[1]); end if; end if;
    if v_name is null or trim(v_name)='' then v_name := nullif(trim(regexp_replace(v_text, '(?i)\b(cambia|cambiar|actualiza|etapa|a|de|del|la|el|cliente|mueve|pasar|stage|zoom|agendado|concretado|mañana|manana|hoy|am|pm|\d{1,2}:?\d{0,2})\b',' ','g')), ''); end if;
    if v_name is null or trim(v_name)='' then v_name := (regexp_match(v_text, '(\+?[0-9][0-9 ().\-]{6,}[0-9])'))[1]; end if;
    if v_stage is null or trim(v_stage)='' then
      if v_text ~* 'zoom\s+agendado' then v_stage := 'Zoom Agendado';
      elsif v_text ~* 'zoom\s+concretado' then v_stage := 'Zoom Concretado';
      elsif v_text ~* 'seguimiento' then v_stage := 'Seguimiento';
      elsif v_text ~* 'nuevo\s+registro' then v_stage := 'Nuevo Registro'; end if;
    end if;
    if v_name is null or v_stage is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Indica cliente y etapa destino.','inline_keyboard','[]'::jsonb)); end if;
    v_stage_in := v_stage;
    v_stage := public.fn_org_stage(v_org_id,v_stage_in);
    if v_stage is null then
      return jsonb_build_object('ok', true, 'reply', jsonb_build_object(
        'text','No reconozco la etapa "'||v_stage_in||'". Las etapas de tu CRM son: '||
               array_to_string(public.fn_org_stages_list(v_org_id), ', ')||
               '. ¿A cuál lo muevo?','inline_keyboard','[]'::jsonb));
    end if;
    if lower(v_stage) in (lower('Zoom Agendado'), lower('Visita Agendada')) and (v_zoom_at_text is null or trim(v_zoom_at_text)='') then
      v_zoom_at := public.parse_relative_or_abs_es(v_text, v_tz);
      if v_zoom_at is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Para pasar a "'||v_stage||'" necesito la fecha y hora. Ejemplo: "cambia etapa a '||v_stage||' mañana 9am".','inline_keyboard','[]'::jsonb)); end if;
    else v_zoom_at := public.parse_relative_or_abs_es(v_zoom_at_text, v_tz); end if;
    update public.leads l set stage = v_stage,
           next_action_at = case when lower(v_stage)=lower('Zoom Agendado') and v_zoom_at is not null then v_zoom_at else l.next_action_at end,
           next_action_date = case when lower(v_stage)=lower('Zoom Agendado') and v_zoom_at is not null then to_char(v_zoom_at at time zone v_tz,'YYYY-MM-DD HH24:MI') else l.next_action_date end,
           visita_at = case when lower(v_stage)=lower('Visita Agendada') and v_zoom_at is not null then v_zoom_at else l.visita_at end,
           updated_at = now()
     where l.id = (select l2.id from public.leads l2 where l2.organization_id = v_org_id and l2.deleted_at is null and (v_view_all or l2.asesor_id = v_profile_id)
         and (public.fn_norm_nombre(l2.name) like '%'||public.fn_norm_nombre(v_name)||'%' or (length(regexp_replace(v_name,'[^0-9]','','g')) >= 7 and l2.phone_normalized = regexp_replace(v_name,'[^0-9]','','g')))
         order by l2.updated_at desc nulls last limit 1)
    returning l.id, l.name, l.stage, l.next_action_at into v_lead;
    if not found then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré cliente con nombre o teléfono parecido a "'||v_name||'".','inline_keyboard','[]'::jsonb)); end if;
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text',
      'Listo. Etapa de '||v_lead.name||' actualizada a "'||v_lead.stage||'".' ||
      case when lower(v_lead.stage)=lower('Zoom Agendado') and v_zoom_at is not null then E'\nFecha Zoom: '||public.fn_fmt_fecha_legible(v_zoom_at, v_tz) when lower(v_lead.stage)=lower('Visita Agendada') and v_zoom_at is not null then E'\nFecha visita: '||public.fn_fmt_fecha_legible(v_zoom_at, v_tz) else '' end
    ,'inline_keyboard','[]'::jsonb));
  end if;

  if v_tool in ('set_zoom_datetime','update_zoom_datetime','zoom_date','set_zoom_date') then
    v_name := coalesce(v_args->>'client_name', v_args->>'name', v_args->>'nombre', null);
    v_zoom_at_text := coalesce(v_args->>'zoom_at', v_args->>'next_action_at', v_args->>'fecha_zoom', null);
    if v_name is null or trim(v_name)='' then m_name := regexp_match(v_text, '(?i)a\s+([A-Za-zÁÉÍÓÚáéíóúÑñ ]+)$'); if m_name is not null then v_name := trim(m_name[1]); end if; end if;
    if v_name is null or trim(v_name)='' then v_name := nullif(trim(regexp_replace(v_text, '(?i)\b(pon|poner|fecha|zoom|agendado|a|de|del|la|el|cliente|mañana|manana|hoy|pasado|en|las|pm|am|\d{1,2}:?\d{0,2})\b',' ','g')), ''); end if;
    if v_name is null or trim(v_name)='' then v_name := (regexp_match(v_text, '(\+?[0-9][0-9 ().\-]{6,}[0-9])'))[1]; end if;
    if v_name is null or trim(v_name)='' then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Dime el cliente para actualizar la fecha del Zoom.','inline_keyboard','[]'::jsonb)); end if;
    v_zoom_at := public.parse_relative_or_abs_es(coalesce(v_zoom_at_text, v_text), v_tz);
    if v_zoom_at is null then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No pude interpretar la fecha/hora. Ejemplo: mañana 9am o en 3 horas','inline_keyboard','[]'::jsonb)); end if;
    update public.leads l set next_action_at = v_zoom_at, next_action_date = to_char(v_zoom_at at time zone v_tz,'YYYY-MM-DD HH24:MI'), stage = case when lower(coalesce(l.stage,'')) in ('zoom concretado','seguimiento','cierre','perdido','visita agendada')              then l.stage else coalesce(public.fn_org_stage(v_org_id,'Zoom Agendado'),l.stage) end, next_action = case when coalesce(l.next_action,'') ~* 'zoom' then l.next_action else 'Zoom' end, updated_at = now()
     where l.id = (select l2.id from public.leads l2 where l2.organization_id = v_org_id and l2.deleted_at is null and (v_view_all or l2.asesor_id = v_profile_id)
         and (public.fn_norm_nombre(l2.name) like '%'||public.fn_norm_nombre(v_name)||'%' or (length(regexp_replace(v_name,'[^0-9]','','g')) >= 7 and l2.phone_normalized = regexp_replace(v_name,'[^0-9]','','g')))
         order by l2.updated_at desc nulls last limit 1)
    returning l.id, l.name, l.stage, l.next_action_at into v_lead;
    if not found then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré cliente con nombre o teléfono parecido a "'||v_name||'".','inline_keyboard','[]'::jsonb)); end if;
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Listo. Fecha del Zoom de '||v_lead.name||' actualizada a '||to_char(v_lead.next_action_at at time zone v_tz,'YYYY-MM-DD HH24:MI')||'.','inline_keyboard','[]'::jsonb));
  end if;

  if v_tool in ('update_next_action','next_action_update','set_next_action') then
    v_name := coalesce(v_args->>'client_name', v_args->>'name', v_args->>'nombre', null);
    v_next_action := coalesce(v_args->>'next_action', v_args->>'accion', v_args->>'proxima_accion', null);
    v_zoom_at_text := coalesce(v_args->>'next_action_at', v_args->>'zoom_at', v_args->>'fecha_zoom', null);
    if v_name is null or trim(v_name)='' then m_name := regexp_match(v_text, '(?i)a\s+([A-Za-zÁÉÍÓÚáéíóúÑñ ]+)$'); if m_name is not null then v_name := trim(m_name[1]); end if; end if;
    if v_name is null or trim(v_name)='' then v_name := nullif(trim(regexp_replace(v_text, '(?i)\b(cambia|actualiza|proxima|pr[oó]xima|accion|acci[oó]n|a|de|del|la|el|cliente|para)\b',' ','g')), ''); end if;
    if v_name is null or trim(v_name)='' then v_name := (regexp_match(v_text, '(\+?[0-9][0-9 ().\-]{6,}[0-9])'))[1]; end if;
    if v_name is null or trim(v_name)='' then return public.bot_nlu_dispatch(p_telegram_chat_id, v_tool, v_args); end if;
    if v_next_action is null or trim(v_next_action)='' then v_next_action := v_text; end if;
    v_zoom_at := public.parse_relative_or_abs_es(coalesce(v_zoom_at_text, case when v_text ~* '(mañana|manana|hoy|en\s+\d|\d{1,2}(:\d{2})?\s*(am|pm)?)' then v_text else null end), v_tz);
    update public.leads l set next_action = v_next_action, next_action_at = coalesce(v_zoom_at, l.next_action_at),
           next_action_date = case when v_zoom_at is not null then to_char(v_zoom_at at time zone v_tz,'YYYY-MM-DD HH24:MI') else l.next_action_date end, updated_at = now()
     where l.id = (select l2.id from public.leads l2 where l2.organization_id = v_org_id and l2.deleted_at is null and (v_view_all or l2.asesor_id = v_profile_id)
         and (public.fn_norm_nombre(l2.name) like '%'||public.fn_norm_nombre(v_name)||'%' or (length(regexp_replace(v_name,'[^0-9]','','g')) >= 7 and l2.phone_normalized = regexp_replace(v_name,'[^0-9]','','g')))
         order by l2.updated_at desc nulls last limit 1)
    returning l.id, l.name, l.next_action, l.next_action_at into v_lead;
    if not found then return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','No encontré cliente con nombre o teléfono parecido a "'||v_name||'" para actualizar la próxima acción.','inline_keyboard','[]'::jsonb)); end if;
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text',
      'La próxima acción para '||v_lead.name||' ha sido actualizada a "'||v_lead.next_action||'".' ||
      case when v_lead.next_action_at is not null then E'\nFecha: '||to_char(v_lead.next_action_at at time zone v_tz,'YYYY-MM-DD HH24:MI') else '' end
    ,'inline_keyboard','[]'::jsonb));
  end if;

  return public.bot_nlu_dispatch(p_telegram_chat_id, v_tool, v_args);
end; $function$;


CREATE OR REPLACE FUNCTION public.bot_bulk_change_stage(p_telegram_chat_id bigint, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_args jsonb := coalesce(p_args,'{}'::jsonb);
  v_text text;
  v_org uuid; v_profile uuid; v_view_all boolean := false; v_role text; v_tz text;
  v_stage_in text; v_stage text;
  v_needs_date boolean := false;
  v_zoom_text text; v_zoom_at timestamptz;
  v_refs text[]; v_str text; v_ref text; v_digits text;
  v_total int; v_exact int; v_pick_id uuid; v_pick_name text;
  v_moved text[]    := '{}'::text[];
  v_notfound text[] := '{}'::text[];
  v_ambig text[]    := '{}'::text[];
  v_dry boolean := false;
  v_reply text;
  v_cap int := 40;
begin
  if jsonb_typeof(v_args->'query') = 'object' then
    if jsonb_typeof(v_args#>'{query,args}') = 'object' then v_args := v_args#>'{query,args}'; end if;
  end if;
  v_text := trim(coalesce(v_args->>'input_text', v_args->>'text', v_args->>'query', ''));
  v_dry  := coalesce((v_args->>'dry_run')::boolean, false);

  select p.organization_id, p.id, coalesce(p.view_all_leads,false), coalesce(p.role,'asesor')
    into v_org, v_profile, v_view_all, v_role
  from public.profiles p
  where p.telegram_chat_id = p_telegram_chat_id and coalesce(p.active,true)=true
  order by p.updated_at desc nulls last limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reply', jsonb_build_object('text','No estas conectado al CRM. Usa /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;
  v_tz := public.fn_user_tz(v_org, p_telegram_chat_id);

  v_stage_in := nullif(trim(coalesce(v_args->>'stage', v_args->>'new_stage', v_args->>'etapa','')),'');
  if v_stage_in is null then
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Dime la etapa destino y los clientes. Ej: "mueve a Juan, Pedro y Maria a Seguimiento".','inline_keyboard','[]'::jsonb));
  end if;
  v_stage := public.fn_org_stage(v_org,v_stage_in);
  if v_stage is null then
    select l.stage into v_stage
    from public.leads l
    where l.organization_id = v_org and l.deleted_at is null and l.stage is not null
      and (public.unaccent(lower(l.stage)) = public.unaccent(lower(v_stage_in))
           or public.unaccent(lower(l.stage)) like '%'||public.unaccent(lower(v_stage_in))||'%')
    group by l.stage
    order by (case when public.unaccent(lower(l.stage)) = public.unaccent(lower(v_stage_in)) then 0 else 1 end), count(*) desc
    limit 1;
  end if;
  if v_stage is null then
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object(
      'text','No reconozco la etapa "'||v_stage_in||'". Las etapas de tu CRM son: '||array_to_string(public.fn_org_stages_list(v_org), ', ')||'. ¿A cuál los muevo?',
      'inline_keyboard','[]'::jsonb));
  end if;

  if jsonb_typeof(v_args->'clients') = 'array' then
    select array_agg(t.x) into v_refs from (select nullif(btrim(value),'') x from jsonb_array_elements_text(v_args->'clients')) t where t.x is not null;
  elsif jsonb_typeof(v_args->'client_names') = 'array' then
    select array_agg(t.x) into v_refs from (select nullif(btrim(value),'') x from jsonb_array_elements_text(v_args->'client_names')) t where t.x is not null;
  else
    v_str := nullif(trim(coalesce(v_args->>'clients', v_args->>'client_names', v_args->>'names','')),'');
    if v_str is not null then
      select array_agg(t.x) into v_refs
      from (select nullif(btrim(tok),'') x
            from regexp_split_to_table(regexp_replace(v_str, '(?i)\s+y\s+|;|\n', ',', 'g'), '\s*,\s*') tok) t
      where t.x is not null;
    end if;
  end if;

  if v_refs is null or array_length(v_refs,1) is null then
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Dime qué clientes mover. Ej: "mueve a Juan, Pedro y Maria a '||v_stage||'".','inline_keyboard','[]'::jsonb));
  end if;
  if array_length(v_refs,1) > v_cap then
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text','Son demasiados de una vez (máx '||v_cap||'). Divídelo en tandas.','inline_keyboard','[]'::jsonb));
  end if;

  v_needs_date := lower(v_stage) in (lower('Zoom Agendado'), lower('Visita Agendada'));
  if v_needs_date then
    v_zoom_text := nullif(trim(coalesce(v_args->>'zoom_at', v_args->>'next_action_at', v_args->>'fecha_zoom','')),'');
    v_zoom_at := public.parse_relative_or_abs_es(coalesce(v_zoom_text, v_text), v_tz);
    if v_zoom_at is null then
      return jsonb_build_object('ok', true, 'reply', jsonb_build_object(
        'text','Para mover varios a "'||v_stage||'" necesito UNA fecha y hora para todos. Ej: "mueve a ... a '||v_stage||' mañana 9am".',
        'inline_keyboard','[]'::jsonb));
    end if;
  end if;

  foreach v_ref in array v_refs loop
    v_digits := nullif(regexp_replace(v_ref,'[^0-9]','','g'),'');
    v_total := 0; v_exact := 0; v_pick_id := null; v_pick_name := null;

    with cand as (
      select l.id, l.name,
             (public.unaccent(lower(coalesce(l.name,''))) = public.unaccent(lower(v_ref))) as exactm
      from public.leads l
      where l.organization_id = v_org and l.deleted_at is null and (v_view_all or l.asesor_id = v_profile)
        and ( (v_digits is not null and length(v_digits) >= 7 and l.phone_normalized = v_digits)
           or (v_digits is null and public.unaccent(lower(coalesce(l.name,''))) ilike '%'||public.unaccent(lower(v_ref))||'%') )
    )
    select count(*)::int, count(*) filter (where exactm)::int,
           (array_agg(id   order by exactm desc, name asc))[1],
           (array_agg(name order by exactm desc, name asc))[1]
      into v_total, v_exact, v_pick_id, v_pick_name
    from cand;

    if v_total = 0 then
      v_notfound := v_notfound || v_ref;
      continue;
    elsif v_total > 1 and v_exact <> 1 then
      v_ambig := v_ambig || v_ref;
      continue;
    end if;

    if v_dry then
      v_moved := v_moved || coalesce(v_pick_name, v_ref);
      continue;
    end if;

    update public.leads l set
      stage = v_stage,
      next_action_at   = case when v_needs_date and lower(v_stage)=lower('Zoom Agendado')  then v_zoom_at else l.next_action_at end,
      next_action_date = case when v_needs_date and lower(v_stage)=lower('Zoom Agendado')  then to_char(v_zoom_at at time zone v_tz,'YYYY-MM-DD HH24:MI') else l.next_action_date end,
      visita_at        = case when v_needs_date and lower(v_stage)=lower('Visita Agendada') then v_zoom_at else l.visita_at end,
      updated_at = now()
    where l.id = v_pick_id;
    v_moved := v_moved || coalesce(v_pick_name, v_ref);
  end loop;

  if array_length(v_moved,1) is not null then
    v_reply := (case when v_dry then 'DRY-RUN — moverían ' else 'Listo. Moví ' end)
               || array_length(v_moved,1) || ' cliente(s) a "'||v_stage||'": ' || array_to_string(v_moved, ', ') || '.';
    if v_needs_date and v_zoom_at is not null then
      v_reply := v_reply || E'\n' || (case when lower(v_stage)=lower('Visita Agendada') then 'Fecha visita: ' else 'Fecha Zoom: ' end)
                 || public.fn_fmt_fecha_legible(v_zoom_at, v_tz);
    end if;
  else
    v_reply := 'No moví a ningún cliente.';
  end if;
  if array_length(v_notfound,1) is not null then
    v_reply := v_reply || E'\n\nNo encontré: ' || array_to_string(v_notfound, ', ') || '.';
  end if;
  if array_length(v_ambig,1) is not null then
    v_reply := v_reply || E'\n\nHay varios con ese nombre, hazlos individual: ' || array_to_string(v_ambig, ', ') || '.';
  end if;

  return jsonb_build_object('ok', true, 'reply', jsonb_build_object('text', v_reply, 'inline_keyboard','[]'::jsonb));
end;
$function$;


CREATE OR REPLACE FUNCTION public.bot_add_expediente_note_bulk(p_telegram_chat_id bigint, p_stage_text text, p_contenido text, p_input_text text DEFAULT NULL::text, p_source text DEFAULT 'telegram'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid; v_profile uuid; v_tz text;
  v_stage_raw text; v_stage text; v_norm_stage text; v_prefix text;
  v_content text := nullif(btrim(coalesce(p_contenido,'')),'');
  v_count int := 0; v_preview text; v_ts text; v_flat text;
  v_all_intent boolean; v_scope_cue boolean;
begin
  -- 1) Identificar asesor
  select p.organization_id, p.id into v_org, v_profile
  from public.profiles p
  where p.telegram_chat_id = p_telegram_chat_id and coalesce(p.active,true)=true
  order by p.updated_at desc nulls last limit 1;
  if not found then
    return jsonb_build_object('ok',false,'reply',jsonb_build_object(
      'text','No estás conectado al CRM. Usá /conectar ########.','inline_keyboard','[]'::jsonb));
  end if;
  v_tz := public.fn_user_tz(v_org, p_telegram_chat_id);

  -- 2) Contenido: arg -> fallback extraido del input_text
  if v_content is null and nullif(btrim(coalesce(p_input_text,'')),'') is not null then
    v_content := nullif(btrim(substring(p_input_text from
      '(?i)(?:una\s+)?(?:nota|apunte|observaci[oó]n)s?\s*(?:que\s+diga\s+que|que\s+diga|que\s+dice|:|diciendo|de\s+que|que)?\s*(.+)$')), '');
  end if;
  if v_content is null or coalesce(trim(regexp_replace(v_content,'[[:punct:][:space:]]+','','g')),'') = '' then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object(
      'text','¿Qué nota agrego? Dícta­mela o escríbeme el texto de la nota.','inline_keyboard','[]'::jsonb));
  end if;

  -- 3) Resolver etapa: arg (normalizado + des-pluralizado) o, si no vino, del prefijo del input_text
  v_stage_raw := nullif(btrim(coalesce(p_stage_text,'')),'');
  if v_stage_raw is not null then
    v_norm_stage := btrim(regexp_replace(public.unaccent(lower(v_stage_raw)),
                     '^(en\s+|a\s+|de\s+|del\s+|la\s+|el\s+|los\s+|las\s+|mis\s+|para\s+|todos\s+|toda\s+|gente\s+|que\s+|tengo\s+)+','','g'));
    v_stage := public.fn_org_stage(v_org,v_stage_raw);
    if v_stage is null then v_stage := public.fn_org_stage(v_org,v_norm_stage); end if;
    if v_stage is null then v_stage := public.fn_org_stage(v_org,regexp_replace(v_norm_stage,'s\y','','g')); end if;
    if v_stage is null then
      return jsonb_build_object('ok',true,'reply',jsonb_build_object(
        'text','No reconozco la etapa "'||v_stage_raw||'". Las etapas de tu CRM son: '||
               array_to_string(public.fn_org_stages_list(v_org), ', ')||'. ¿A cuál le agrego la nota?','inline_keyboard','[]'::jsonb));
    end if;
  elsif nullif(btrim(coalesce(p_input_text,'')),'') is not null then
    v_prefix := coalesce(substring(p_input_text from '(?i)^(.*?)\y(?:nota|apunte|observaci[oó]n)s?\y'), '');
    if btrim(v_prefix) <> '' then
      select c.stage into v_stage
      from (values ('Contáctame Ya'),('Segundo Intento'),('Tercer Intento'),('Rotación'),('Remarketing IA'),
                   ('Zoom Agendado'),('Reactivar Zoom'),('Zoom Concretado'),('Seguimiento'),('Largo Plazo'),
                   ('Apartó'),('Visita Agendada'),('Cierre'),('Postventa')) c(stage)
      where public.unaccent(lower(regexp_replace(v_prefix,'s\y','','g'))) like '%'||public.unaccent(lower(c.stage))||'%'
      order by length(c.stage) desc
      limit 1;
    end if;
  end if;

  -- 3b) GUARD de alcance cuando NO se resolvio etapa:
  --     Escribir a TODOS solo si el pedido es EXPLICITO ("a todos mis clientes"/"toda mi cartera").
  --     Si se menciono un scope ("en/los de/etapa/que estan en...") pero no resolvio -> PREGUNTAR.
  if v_stage is null then
    v_all_intent := coalesce(p_input_text,'') ~* '(todos\s+mis\s+clientes|toda\s+mi\s+cartera|todos\s+mis\s+leads|toda\s+mi\s+base|toda\s+mi\s+lista|a\s+todos\s+mis\s+clientes|a\s+todas?\s+mis)';
    v_scope_cue  := coalesce(p_input_text,'') ~* '(\yen\s+[a-záéíóúñ]|los\s+de\s|las\s+de\s|que\s+est[aá]n\s+en|de\s+la\s+etapa|en\s+etapa|del?\s+segmento|\yetapa\y)';
    if not v_all_intent then
      return jsonb_build_object('ok',true,'reply',jsonb_build_object(
        'text', case when v_scope_cue
                 then 'No me quedó clara la etapa. ¿A cuál le agrego la nota? Etapas: '||array_to_string(public.fn_org_stages_list(v_org), ', ')||'. (O decí "a todos mis clientes".)'
                 else '¿A qué etapa le agrego la nota, o a todos tus clientes? Etapas: '||array_to_string(public.fn_org_stages_list(v_org), ', ')||'.' end,
        'inline_keyboard','[]'::jsonb));
    end if;
  end if;

  -- 4) Escritura SET-BASED sobre los leads PROPIOS del asesor (org-scoped)
  v_ts := public.fn_fecha_humana(now(),v_tz,true);

  with tgt as materialized (
    select l.id
    from public.leads l
    where l.organization_id = v_org and l.deleted_at is null and l.asesor_id = v_profile
      and (v_stage is null or l.stage = v_stage)
  ), ins as (
    insert into public.expediente_items (lead_id, asesor_id, organization_id, tipo, titulo, descripcion, metadata)
    select t.id, v_profile, v_org, 'texto', 'Nota desde Telegram', v_content,
           jsonb_build_object('source', coalesce(p_source,'telegram'), 'bulk', true, 'stage', v_stage)
    from tgt t
    returning 1
  ), upd as (
    update public.leads l
       set notas = case when l.notas is null or btrim(l.notas)=''
                        then v_ts||' . '||coalesce(p_source,'telegram')||E'\n'||v_content
                        else l.notas||E'\n---- '||v_ts||' . '||coalesce(p_source,'telegram')||E' ----\n'||v_content end,
           last_activity = 'Nota agregada . '||v_ts,
           updated_at = now()
      where l.id in (select id from tgt)
    returning 1
  )
  select count(*) into v_count from ins;

  if v_count = 0 then
    return jsonb_build_object('ok',true,'reply',jsonb_build_object('text',
      case when v_stage is null then 'No tienes clientes activos para agregarles la nota.'
           else 'No tienes clientes en la etapa "'||v_stage||'" para agregarles la nota.' end,
      'inline_keyboard','[]'::jsonb));
  end if;

  v_flat := btrim(regexp_replace(v_content, '\s+', ' ', 'g'));
  v_preview := left(v_flat, 80);
  return jsonb_build_object('ok',true,'reply',jsonb_build_object('text',
    'Listo. Agregué la nota a '||v_count||' cliente'||case when v_count=1 then '' else 's' end||
    case when v_stage is not null then ' en "'||v_stage||'"' else ' (todos)' end||': “'||v_preview||
    case when length(v_flat) > 80 then '…”' else '”' end,
    'inline_keyboard','[]'::jsonb));
end;
$function$;


CREATE OR REPLACE FUNCTION public.bot_clientes_de_asesor(p_chat bigint, p_name text, p_context text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid; v_pid uuid; v_role text; v_view_all boolean; v_tz text;
  v_n int; v_aid uuid; v_aname text; v_names text; v_total int; v_lines text; v_shown int;
  v_ctx text := public.unaccent(lower(coalesce(p_context,'')));
  v_stage text; v_limit int; v_scope text := '';
begin
  select org,pid,role,view_all into v_org,v_pid,v_role,v_view_all from public._bot_requester(p_chat);
  if v_org is null then return public._bot_smart_reask('No estás conectado al CRM. Usá /conectar ########.'); end if;
  v_tz := public.fn_user_tz(v_org, p_chat);

  select count(*) into v_n from public.fn_bot_find_asesores(v_org, p_name);
  if v_n = 0 then
    return public._bot_smart_reask('No encontré un asesor llamado "'||p_name||'". ¿Lo escribiste bien? (Si "'||p_name||'" es un cliente, pedime "la ficha de '||p_name||'".)');
  elsif v_n > 1 then
    select string_agg(asesor_name, ', ') into v_names from public.fn_bot_find_asesores(v_org, p_name);
    return public._bot_smart_reask('Tengo varios asesores que coinciden con "'||p_name||'": '||v_names||'. ¿De cuál quieres los clientes?');
  end if;
  select asesor_id, asesor_name into v_aid, v_aname from public.fn_bot_find_asesores(v_org, p_name);

  if not v_view_all and v_aid <> v_pid then
    return public._bot_smart_reask('Solo puedes ver tu propia cartera. Para ver los clientes de '||v_aname||' necesitas permisos de coordinador.');
  end if;

  -- etapa pedida (ordinales + nombres de etapa)
  v_stage := case
    when v_ctx ~ '(segund|2da|2a|(^| )2 )' and v_ctx ~ 'etapa|intento' then 'Segundo Intento'
    when v_ctx ~ '(primer|1ra|1a|(^| )1 )' and v_ctx ~ 'etapa|intento' then 'Contáctame Ya'
    when v_ctx ~ '(tercer|3ra|3a|(^| )3 )' and v_ctx ~ 'etapa|intento' then 'Tercer Intento'
    when v_ctx ~ 'contactame ya|primer contacto' then 'Contáctame Ya'
    when v_ctx ~ 'zoom agendad' then 'Zoom Agendado'
    when v_ctx ~ 'zoom concretad' then 'Zoom Concretado'
    when v_ctx ~ 'reactivar zoom|no show' then 'Reactivar Zoom'
    when v_ctx ~ 'seguimiento' then 'Seguimiento'
    when v_ctx ~ 'largo plazo' then 'Largo Plazo'
    when v_ctx ~ 'rotacion' then 'Rotación'
    when v_ctx ~ 'remarketing' then 'Remarketing IA'
    when v_ctx ~ 'apartad|aparto' then 'Apartó'
    when v_ctx ~ 'cierre|cerrad' then 'Cierre'
    when v_ctx ~ 'visita' then 'Visita Agendada'
    else null end;

  -- cantidad pedida ("ultimos 2", "3 clientes")
  v_limit := coalesce((regexp_match(v_ctx,'ultim[oa]s?\s+(\d+)'))[1]::int,
                      (regexp_match(v_ctx,'(\d+)\s+(client|lead|prospect)'))[1]::int, 30);
  if v_limit < 1 then v_limit := 30; end if;
  if v_limit > 50 then v_limit := 50; end if;

  select count(*) into v_total from public.leads
   where organization_id=v_org and deleted_at is null and asesor_id=v_aid
     and (v_stage is null or public.fn_org_stage(v_org,stage) = v_stage or stage = v_stage);
  if coalesce(v_total,0)=0 then
    return public._bot_smart_reask(v_aname||' no tiene clientes'||coalesce(' en '||v_stage,'')||' por ahora.');
  end if;
  if v_stage is not null then v_scope := ' en '||v_stage; end if;

  select string_agg(line, E'\n'), count(*) into v_lines, v_shown from (
    select '• '||coalesce(l.name,'(sin nombre)')
           ||' — '||coalesce(nullif(l.phone,''),'sin teléfono')
           ||' — '||coalesce(nullif(l.stage,''),'sin etapa')
           ||case when l.next_action_at is not null then ' — próx: '||public.fn_fecha_humana(l.next_action_at,v_tz,true) else '' end as line
    from public.leads l
    where l.organization_id=v_org and l.deleted_at is null and l.asesor_id=v_aid
      and (v_stage is null or public.fn_org_stage(v_org,l.stage) = v_stage or l.stage = v_stage)
    order by l.updated_at desc nulls last limit v_limit
  ) s;

  return jsonb_build_object('ok',true,'reply',jsonb_build_object(
    'text','Clientes de '||v_aname||v_scope||' ('||v_total||
           case when v_total>v_shown then ', muestro los '||v_shown||' más recientes' else '' end||'):'||E'\n'||v_lines||
           case when v_total>v_shown then E'\n\nPara verlos todos, abre el CRM web.' else '' end,
    'parse_mode',null,'inline_keyboard','[]'::jsonb));
end;
$function$;


CREATE OR REPLACE FUNCTION public.bot_update_lead_fields(p_telegram_chat_id bigint, p_phone text, p_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_stage text DEFAULT NULL::text, p_budget_text text DEFAULT NULL::text, p_budget_numeric bigint DEFAULT NULL::bigint, p_project text DEFAULT NULL::text, p_campaign text DEFAULT NULL::text, p_bio text DEFAULT NULL::text, p_score integer DEFAULT NULL::integer, p_hot boolean DEFAULT NULL::boolean, p_next_action text DEFAULT NULL::text, p_next_action_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_new_asesor_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_asesor record;
  v_lead record;
  v_phone_norm text;
  v_new_asesor_id uuid;
  v_new_asesor_name text;
  v_can_reassign boolean;
  v_created jsonb;
begin
  select id, role, name, organization_id into v_asesor
  from public.profiles
  where telegram_chat_id = p_telegram_chat_id and active = true;

  if not found then
    return jsonb_build_object('error','asesor_not_paired');
  end if;

  if nullif(btrim(p_stage),'') is not null then
    p_stage := public.fn_org_stage(v_asesor.organization_id,p_stage);
    if p_stage is null then return jsonb_build_object('success',false,'error','invalid_stage','stages',public.fn_org_stages_list(v_asesor.organization_id)); end if;
  end if;
  v_can_reassign := v_asesor.role in ('super_admin','admin','ceo','director');
  v_phone_norm := nullif(regexp_replace(p_phone,'[^0-9]','','g'),'');
  if v_phone_norm is null then
    return jsonb_build_object('error','invalid_phone');
  end if;

  select * into v_lead
  from public.leads
  where organization_id = v_asesor.organization_id
    and phone_normalized = v_phone_norm
    and deleted_at is null
  for update
  limit 1;

  if not found then
    select l.* into v_lead
    from public.leads l
    where l.organization_id = v_asesor.organization_id
      and l.deleted_at is null
      and right(regexp_replace(coalesce(l.phone_normalized,''),'[^0-9]','','g'),10) = right(v_phone_norm,10)
    order by l.updated_at desc nulls last
    for update
    limit 1;
  end if;

  if not found then
    if coalesce(trim(p_new_asesor_name),'') <> '' and coalesce(trim(p_name),'') <> '' then
      if not v_can_reassign then
        return jsonb_build_object('error','reassign_forbidden');
      end if;

      v_created := public.bot_upsert_lead(
        p_telegram_chat_id, v_phone_norm, p_name, p_email, p_stage, p_budget_text, p_budget_numeric,
        p_project, p_campaign, p_bio, p_score, p_hot, p_next_action, p_next_action_at, p_new_asesor_name);

      if v_created ? 'error' then
        return v_created;
      end if;

      return jsonb_build_object('success', true, 'lead_id', nullif(v_created->>'lead_id','')::uuid,
        'created', true, 'assigned_to', coalesce(v_created->>'assigned_to', p_new_asesor_name),
        'via', 'update_fields_fallback_upsert');
    end if;

    return jsonb_build_object('error','lead_not_found');
  end if;

  if v_lead.asesor_id is not null and v_lead.asesor_id <> v_asesor.id and not v_can_reassign then
    return jsonb_build_object('error','forbidden');
  end if;

  if p_new_asesor_name is not null and trim(p_new_asesor_name) <> '' then
    if not v_can_reassign then
      return jsonb_build_object('error','reassign_forbidden');
    end if;

    select p2.id, p2.name
      into v_new_asesor_id, v_new_asesor_name
    from public.profiles p2
    where p2.organization_id = v_asesor.organization_id
      and p2.active = true
      and (
        lower(trim(p2.name)) = lower(trim(p_new_asesor_name))
        or p2.name ilike '%' || trim(p_new_asesor_name) || '%'
      )
    order by case when lower(trim(p2.name)) = lower(trim(p_new_asesor_name)) then 0 else 1 end,
             length(p2.name)
    limit 1;

    if v_new_asesor_id is null then
      return jsonb_build_object('error','new_asesor_not_found');
    end if;
  end if;

  update public.leads set
    name = coalesce(nullif(p_name,''), name),
    email = coalesce(nullif(p_email,''), email),
    stage = coalesce(nullif(p_stage,''), stage),
    budget = coalesce(nullif(p_budget_text,''), budget),
    presupuesto = coalesce(p_budget_numeric, presupuesto),
    project = coalesce(nullif(p_project,''), project),
    campaign = coalesce(nullif(p_campaign,''), campaign),
    bio = coalesce(nullif(p_bio,''), bio),
    score = coalesce(p_score, score),
    hot = coalesce(p_hot, hot),
    next_action = coalesce(nullif(p_next_action,''), next_action),
    next_action_at = coalesce(p_next_action_at, next_action_at),
    asesor_id = case when v_new_asesor_id is not null then v_new_asesor_id else asesor_id end,
    asesor_name = case when v_new_asesor_id is not null then v_new_asesor_name else asesor_name end,
    last_activity = 'Telegram · update', updated_at = now()
  where id = v_lead.id;

  -- Reasignación: los recordatorios pendientes siguen al nuevo asesor (evita que queden en el viejo).
  if v_new_asesor_id is not null then
    update public.proactive_reminders
       set asesor_id = v_new_asesor_id, asesor_name = v_new_asesor_name
     where lead_id = v_lead.id and status = 'pending';
  end if;

  return jsonb_build_object('success', true, 'lead_id', v_lead.id,
    'reassigned_to', case when v_new_asesor_id is not null then v_new_asesor_name else null end);
end;
$function$;

