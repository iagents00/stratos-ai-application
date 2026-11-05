-- Space links and generated documents share the caller's organization.
create or replace function public.fn_space_document_read(p_document_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $f$
 select jsonb_build_object('id',d.id,'titulo',d.titulo,'tipo',d.tipo,'contenido',d.contenido,
   'fecha',to_char(d.created_at,'YYYY-MM-DD'))
 from public.team_documents d
 join public.profiles p on p.id=auth.uid() and p.organization_id=d.organization_id and p.active is true
 join public.organizations o on o.id=d.organization_id and o.active is true
 where d.id=p_document_id and d.deleted_at is null
$f$;
revoke all on function public.fn_space_document_read(uuid) from public,anon,service_role;
grant execute on function public.fn_space_document_read(uuid) to authenticated;
insert into public.front_rpc_registry(nombre,nota) values
 ('fn_space_document_read','Documentos de Space: abrir uno con la identidad del token')
 on conflict(nombre) do update set nota=excluded.nota;

create or replace function public._bot_space_request_text(p_args jsonb) returns text
language sql immutable set search_path=public,pg_temp as $f$
 select coalesce(nullif(btrim(p_args->>'input_text'),''),
   nullif(btrim(p_args->>'text'),''),nullif(btrim(p_args->>'texto'),''),
   nullif(btrim(p_args->>'raw_text'),''),nullif(btrim(p_args->>'message'),''),
   nullif(btrim(p_args#>>'{query,args,input_text}'),''),
   nullif(btrim(p_args#>>'{query,args,text}'),''),
   case when jsonb_typeof(p_args->'query')='string' then nullif(btrim(p_args->>'query'),'') end,'')
$f$;

create or replace function public._bot_is_space_document_request(p_norm text) returns boolean
language sql immutable set search_path=public,pg_temp as $f$
 select coalesce(public.unaccent(lower(p_norm)) ~
   '(mi[[:space:]]*espa|mi[[:space:]]+space|docu[a-z]*|archivos?|contratos?|informes?|reportes?|presentacion|manual|notion|figma|hoja de calculo|planilla|spreadsheet|excel|\ysop\y|\yenlaces?\y|\ylinks?\y)'
 and public.unaccent(lower(p_norm)) !~
   '^[[:space:]]*(no[[:space:]]+|recuerda[a-z]*|recorda[a-z]*|agend[a-z]*|crea[a-z]*|genera[a-z]*|agrega[a-z]*|guarda[a-z]*|sube|elimina[a-z]*|borra[a-z]*|mueve|cambia[a-z]*|anota[a-z]*|asigna[a-z]*)\y',false)
$f$;

create or replace function public.bot_documentos_espacio(p_chat bigint,p_args jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $f$
declare
 v_org uuid; v_links jsonb; v_norm text; v_terms text[]; v_count int; v_all int;
 v_rows jsonb; v_max int; v_text text; v_doc jsonb; v_line text; v_more boolean;
begin
 select p.organization_id,case when jsonb_typeof(o.meta_config->'documents')='array' then o.meta_config->'documents' else '[]'::jsonb end
 into v_org,v_links from public.profiles p join public.organizations o on o.id=p.organization_id
 where p.telegram_chat_id=p_chat and p.active is true and o.active is true
 order by p.updated_at desc nulls last limit 1;
 if v_org is null then
  return jsonb_build_object('ok',false,'found',false,'reply',jsonb_build_object('text','No tienes una cuenta activa conectada al CRM.','inline_keyboard','[]'::jsonb));
 end if;
 v_norm:=regexp_replace(public.unaccent(lower(public._bot_space_request_text(p_args))),'[^a-z0-9]+',' ','g');
 select coalesce(array_agg(w order by ord),'{}'::text[]) into v_terms
 from regexp_split_to_table(btrim(v_norm),'[[:space:]]+') with ordinality x(w,ord)
 where length(w)>1 and w<>all(array['pasame','pasa','mandame','manda','enviame','envia','dame','muestrame','muestra','mostrame','mostra',
 'comparteme','comparte','buscame','busca','buscar','encuentra','necesito','quiero','ver','abre','abrir','abrime','abri','tienes','tenes','donde','esta','estan',
 'el','la','los','las','un','una','unos','unas','de','del','mi','mis','tu','tus','su','sus','en','por','favor','que','me',
 'espacio','espaico','espasio','space','equipo','documento','documentos','docuemnto','docuemntos','doc','docs','archivo','archivos','link','links','enlace','enlaces',
 'pdf','word','carpeta','carpetas','folder','drive','google']);
 v_count:=coalesce(array_length(v_terms,1),0);
 with candidates as (
  select coalesce(nullif(btrim(d->>'title'),''),'Documento del equipo') title,
    btrim(d->>'url') url,'link' source,null::uuid id
  from jsonb_array_elements(v_links) d
  where d->>'url' ~ '^https?://[^[:space:]<>"]+$'
  union all
  select d.titulo,'https://app.getstratosai.com/login?space_document='||d.id,'generated',d.id
  from public.team_documents d where d.organization_id=v_org and d.deleted_at is null
  union all
  select 'Manual de Stratos AI','https://app.getstratosai.com/manual-asistente-telegram','manual',null::uuid
 ), normalized as (
  select *,btrim(regexp_replace(public.unaccent(lower(title)),'[^a-z0-9]+',' ','g')) nt from candidates
 ), ranked as (
  select *,case when v_count=0 then 1
   when nt=array_to_string(v_terms,' ') then 1000
   when (' '||v_norm||' ') like '% '||nt||' %' and length(nt)>=3 then 800
   when not exists(select 1 from unnest(v_terms) w where (' '||nt||' ') not like '% '||w||' %') then 500
   else 10*(select count(*) from unnest(v_terms) w where length(w)>=3 and (' '||nt||' ') like '% '||w||' %') end::int score
  from normalized
 ), dedup as (
  select distinct on(url) title,url,source,id,score from ranked
  order by url,score desc,(nt in ('google drive','drive','documento del equipo')),length(title) desc,title
 )
 select coalesce(jsonb_agg(jsonb_build_object('title',title,'url',url,'source',source,'id',id,'score',score) order by score desc,title),'[]'::jsonb),
 coalesce(max(score),0),count(*) into v_rows,v_max,v_all from dedup;
 if v_count>0 then
  select coalesce(jsonb_agg(d order by d->>'title'),'[]'::jsonb) into v_rows from jsonb_array_elements(v_rows) d where (d->>'score')::int=v_max and v_max>0;
 end if;
 v_more:=jsonb_array_length(v_rows)>20;
 select coalesce(jsonb_agg(d),'[]'::jsonb) into v_rows from (select d from jsonb_array_elements(v_rows) d limit 20) limited;
 if jsonb_array_length(v_rows)=0 then
  v_text:='No encontré ese documento en Space de tu empresa. Puedes agregar su enlace en Space → Documentos o decirme su nombre exacto.';
 elsif jsonb_array_length(v_rows)=1 and v_count>0 then
  v_doc:=v_rows->0;
  v_text:=regexp_replace(v_doc->>'title','[][()*_~]',' ','g')||chr(10)||'[Abrir documento]('||replace(replace(v_doc->>'url','(','%28'),')','%29')||')';
  if v_doc->>'source'='generated' then v_text:=v_text||chr(10)||'Inicia sesión con tu cuenta para leerlo o descargarlo en Word.'; end if;
 else
  v_text:=case when v_count=0 then 'Documentos de Space de tu empresa:' else 'Encontré varios documentos que coinciden. Elige el que necesitas:' end;
  for v_doc in select d from jsonb_array_elements(v_rows) d loop
   v_line:=regexp_replace(v_doc->>'title','[][()*_~]',' ','g');
   v_text:=v_text||chr(10)||'• '||v_line||': [Abrir]('||replace(replace(v_doc->>'url','(','%28'),')','%29')||')';
  end loop;
  if v_more then v_text:=v_text||chr(10)||'Hay más documentos. Dime un nombre para afinar la búsqueda.'; end if;
 end if;
 return jsonb_build_object('ok',true,'found',jsonb_array_length(v_rows)>0,'documents',v_rows,'reply',jsonb_build_object('text',v_text,'parse_mode',null,'inline_keyboard','[]'::jsonb));
end $f$;
revoke all on function public._bot_space_request_text(jsonb),public._bot_is_space_document_request(text),public.bot_documentos_espacio(bigint,jsonb) from public,anon,authenticated;
grant execute on function public._bot_space_request_text(jsonb),public._bot_is_space_document_request(text),public.bot_documentos_espacio(bigint,jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.bot_nlu_dispatch_gvintell(p_telegram_chat_id bigint, p_tool_name text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_tool text := lower(coalesce(p_tool_name, ''));
  v_args jsonb := coalesce(p_args, '{}'::jsonb);
  v_stage text; v_zoom_when text; v_next_when text; v_has_next_action boolean;
  -- mig 245: el plan de la llamada · mig 255: la nota al expediente
  v_txt text; v_norm text; v_nota jsonb;
  v_plan_report uuid; v_plan_lead uuid; v_plan_org uuid;
  v_lead_name text; v_asesor_name text; v_zoom_at timestamptz;
  v_res jsonb; v_mgr bigint;
begin
  -- Space requests precede catalog routing and pending-plan consumption.
  v_txt:=public._bot_space_request_text(p_args);
  v_norm:=public.unaccent(lower(v_txt));
  if v_tool in ('space_documents','get_document','buscar_documentos','documents')
     or (public._bot_is_space_document_request(v_norm) and v_tool not in
       ('create_lead','upsert_lead','change_stage','update_fields','add_expediente_note','add_expediente_voice','add_seguimiento','add_comunicacion','multi','multi_task','create_team_actions','create_team_action','create_personal_reminder','create_task','add_task','assign_task','delete_task','soft_delete')) then
    v_res:=public.bot_documentos_espacio(p_telegram_chat_id,coalesce(p_args,'{}'::jsonb)||jsonb_build_object('input_text',v_txt));
    if coalesce((v_res->>'found')::boolean,false)
      or v_tool in ('space_documents','get_document','buscar_documentos','documents')
      or v_norm ~ '(mi[[:space:]]*espa|mi[[:space:]]+space|docu[a-z]*|archivos?|contratos?|informes?|reportes?|presentacion|manual|notion|figma|excel|planilla|spreadsheet)' then
      return v_res;
    end if;
  end if;
  -- mig 318: repartir la cartera de un asesor (solo dirección) y deshacerlo.
  -- Se activa SOLO por tool_name exacto, nunca por el texto.
  if lower(coalesce(p_tool_name,'')) in ('redistribuir_leads','repartir_cartera','distribuir_leads') then
    -- mig 300: el detector del flujo manda solo origen/destinos, asi que
    -- «los mas antiguos» y «de segunda etapa» se perdian. Si la frase trae
    -- filtros (o no trae destino), la lee el parser de la base. Con DOS o mas
    -- destinos NO se toca: ese reparto lo arma bien el flujo.
    v_res := null;
    if coalesce(nullif(btrim(p_args->>'input_text'), ''), '') <> ''
       and (case when jsonb_typeof(p_args->'destinos') = 'array'
                 then jsonb_array_length(p_args->'destinos') else 0 end) <= 1
       and coalesce(p_args->>'etapa','') = ''
    then
      v_res := public.bot_reasignar_desde_texto(p_telegram_chat_id, p_args->>'input_text');
    end if;
    if v_res is not null then return v_res; end if;
    return public.bot_redistribuir_leads(p_telegram_chat_id, coalesce(p_args, '{}'::jsonb));
  end if;
  if lower(coalesce(p_tool_name,'')) in ('deshacer_redistribucion','undo_redistribucion') then
    return public.bot_deshacer_redistribucion(p_telegram_chat_id, coalesce(p_args, '{}'::jsonb));
  end if;

  -- mig 298: la misma orden, dicha en palabras («mueve los 50 clientes más
  -- antiguos de Gael de segunda etapa a Carlos»). Solo arma el PLAN y pide
  -- confirmación: por texto NUNCA se mueve una cartera. Devuelve null si la
  -- frase no era una reasignación, y el asistente sigue su curso.
  if v_tool in ('','menu') and coalesce(p_args->>'interpreted','') <> 'true' then
    v_res := public.bot_reasignar_desde_texto(p_telegram_chat_id,
               coalesce(nullif(btrim(p_args->>'input_text'), ''), ''));
    if v_res is not null then return v_res; end if;
  end if;

  -- mig 300: el desglose del intérprete manda. Va derecho al plural, que
  -- respeta responsable y hora de cada tarea. Nada de regex sobre el crudo.
  if lower(coalesce(p_tool_name,'')) in ('create_team_actions','create_team_action')
     and jsonb_typeof(p_args->'tareas') = 'array'
     and jsonb_array_length(p_args->'tareas') > 0 then
    v_res := public.bot_create_team_actions(p_telegram_chat_id, p_args->'tareas', false);
    -- Si quedó como plan a confirmar, se recuerda para que el «sí» lo aplique.
    if coalesce(v_res#>>'{reply,text}','') like 'Entendí%' then
      delete from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id;
      insert into public.bot_pending_confirm (telegram_chat_id, action, organization_id, payload)
      values (p_telegram_chat_id, 'team_plan',
              (select organization_id from public.profiles
                where telegram_chat_id = p_telegram_chat_id and coalesce(active,true)
                order by updated_at desc nulls last limit 1),
              jsonb_build_object('tareas', p_args->'tareas'));
    end if;
    return v_res;
  end if;

  -- mig 296: un ENCARGO a otra persona se reconoce al entrar.
  -- Exige responsable Y verbo: una pregunta nunca cumple las dos.
  if jsonb_typeof(p_args->'tareas') is distinct from 'array'
     and coalesce(p_args->>'interpreted','') <> 'true'
     and coalesce(lower(p_tool_name),'') in ('','menu')
     and coalesce(jsonb_array_length(public.fn_ventas_split_dictado(
           (select organization_id from public.profiles
             where telegram_chat_id = p_telegram_chat_id and coalesce(active,true)
             order by updated_at desc nulls last limit 1),
           coalesce(nullif(btrim(p_args->>'input_text'),''),
                    nullif(btrim(p_args->>'text'),''), ''))), 0) < 2
     and public._bot_responsable_del_texto(coalesce(
         nullif(btrim(p_args->>'input_text'),''),
         nullif(btrim(p_args->>'text'),''), '')) is not null
     and exists (select 1 from public._ventas_find_profile(
           (select organization_id from public.profiles
             where telegram_chat_id = p_telegram_chat_id and coalesce(active,true)
             order by updated_at desc nulls last limit 1),
           public._bot_responsable_del_texto(coalesce(
             nullif(btrim(p_args->>'input_text'),''),
             nullif(btrim(p_args->>'text'),''), ''))))
     and lower(coalesce(p_args->>'input_text', p_args->>'text', ''))
         ~ '(?i)\y(as[ií]gnale|asignar|asigna|ponle|d[ií]le|enc[aá]rgale|p[ií]dele|pedirle|solic[ií]tale)\y' then
    return public.bot_create_team_action(p_telegram_chat_id,
      coalesce(public._bot_tarea_del_texto(coalesce(p_args->>'input_text', p_args->>'text')),
               p_args->>'input_text'),
      coalesce(p_args->>'input_text', p_args->>'text'),
      public._bot_responsable_del_texto(coalesce(p_args->>'input_text', p_args->>'text')));
  end if;
  if jsonb_typeof(v_args->'query') = 'object' then
    if v_tool = '' then v_tool := lower(coalesce(v_args#>>'{query,tool_name}', '')); end if;
    if jsonb_typeof(v_args#>'{query,args}') = 'object' then v_args := v_args#>'{query,args}'; end if;
  end if;



  /* ── EL PLAN DE LA LLAMADA (mig 245) ──────────────────────────────────────
     Al tocar «Ya estudié, este es mi plan» queda un reporte `awaiting_plan`
     abierto y el asistente pide el plan. En Telegram el flujo de n8n atrapa esa
     respuesta ANTES del cerebro; el Copilot NO tiene esa rama, así que el plan
     caía como una nota suelta al expediente. Se resuelve donde vive la causa —el
     cerebro—: si hay un plan pendiente, lo que la persona escribe ES el plan. */
  v_txt := btrim(coalesce(v_args->>'input_text', v_args->>'texto', v_args->>'raw_text',
                          v_args->>'message', v_args->>'contenido', v_args->>'nota', ''));
  -- mig 268: agendar un Zoom o una visita CON UN CLIENTE no es una tarea de equipo.
  if v_txt <> '' and v_tool in ('add_task','create_task','team_action','add_team_action','crear_tarea','asignar_tarea','agenda_personal') then
    v_norm := public.unaccent(lower(v_txt));
    if v_norm ~ '\y(agend\w*|program\w*|reagend\w*|mueve|cambia)\y' then
      null;
    end if;
    -- mig 282: varias tareas en una frase, cada una con su hora.
    if v_tool in ('create_personal_reminder','add_task','create_team_action')
       and jsonb_array_length(public.fn_partir_tareas(v_txt)) > 1 then
      return public.bot_create_team_actions(p_telegram_chat_id,
               public.fn_partir_tareas(v_txt), true);
    end if;
    -- mig 274: «asignale a Fulano …» es una tarea PARA Fulano.
    -- mig 294: hace falta un VERBO de encargo. Sin eso, una pregunta
    -- («¿cuáles son mis actividades?») se convertía en tarea.
    if public._bot_responsable_del_texto(v_txt) is not null
       and v_norm ~ '\y(asigna\w*|asignale|ponle|dile|encargale|encargarle|pidele|pedirle|solicitale|solicitarle|recuerdale|recordarle|comentale|avisale|mandale|escribele)\y' then
      v_tool := 'create_team_action';
      v_args := v_args || jsonb_build_object('responsable', public._bot_responsable_del_texto(v_txt));
      if coalesce(btrim(v_args->>'text'),'') = '' and public._bot_tarea_del_texto(v_txt) is not null then
        v_args := v_args || jsonb_build_object('text', public._bot_tarea_del_texto(v_txt));
      end if;
    end if;
    if v_tool = 'create_team_action' then
      null;
    elsif v_norm ~ '\y(agend\w*|program\w*|reagend\w*|mueve|cambia)\y' then
      if v_norm ~ '\y(zoom|reunion|videollamada)\y' then
        v_tool := 'set_zoom_datetime';
      elsif v_norm ~ '\y(visita|recorrido|showing)\y' then
        v_tool := 'agendar_visita';
      end if;
      if v_tool in ('set_zoom_datetime','agendar_visita') then
        if coalesce(btrim(v_args->>'client_name'),'') = '' then
          v_args := v_args || jsonb_build_object('client_name', public._bot_cliente_del_texto(v_txt));
        end if;
        if coalesce(btrim(v_args->>'fecha'),'') = '' then
          v_args := v_args || jsonb_build_object('fecha', v_txt);
        end if;
      end if;
    end if;
    v_norm := null;
  end if;

  if v_txt <> '' then
    select r.id, r.lead_id, r.organization_id
      into v_plan_report, v_plan_lead, v_plan_org
    from public.proactive_pending_reports r
    where r.advisor_telegram_id = p_telegram_chat_id
      and r.status = 'open' and r.kind = 'awaiting_plan'
      and (r.expires_at is null or r.expires_at > now())
    order by r.created_at desc limit 1;
  end if;

  if v_plan_report is not null then
    v_norm := public.unaccent(lower(v_txt));

    if v_norm ~ '^/'
       or v_norm ~ '^(menu|inicio|start|home|ayuda|hola|buenas|buenos dias|buenas tardes|buenas noches)($|\s)'
       or v_norm ~ '^(si|no|ok|okay|dale|listo|cancelar|cancela|confirmar|confirmo)[.!]?$'
       or v_norm ~ '(mis clientes|lista de clientes|mis leads|mi agenda|mis pendientes|que tengo hoy|proximas acciones|kpis|indicadores|como voy|mis numeros|pipeline|embudo)' then
      null;  -- Es un comando: pasa, y el plan sigue pendiente (mismo escape que Telegram).

    elsif v_norm ~ '(no tengo (un |el )?plan|sin plan|no lo prepare|no alcance a|no pude preparar|no se que decirle|necesito (apoyo|ayuda))' then
      select l.name into v_lead_name from public.leads l where l.id = v_plan_lead;
      v_res := public.fn_proactive_plan_giveup(jsonb_build_object(
        'organization_id', v_plan_org, 'advisor_telegram_id', p_telegram_chat_id,
        'lead_id', v_plan_lead, 'report_id', v_plan_report, 'raw_text', v_txt));
      for v_mgr in
        select x::bigint from jsonb_array_elements_text(coalesce(v_res->'manager_telegram_ids','[]'::jsonb)) as t(x)
      loop
        begin
          perform public.fn_log_proactive_copilot(v_mgr,
            '▸ Un asesor necesita apoyo' || chr(10) || '· ' || coalesce(v_res->>'admin_text',''), 'ai');
        exception when others then null; end;
      end loop;
      return jsonb_build_object('ok', true,
        'reply', jsonb_build_object(
          'text', '▸ Sin problema, te apoyamos' || chr(10)
                || '· Lo dejé anotado en el expediente de «' || coalesce(v_lead_name,'este cliente') || '».' || chr(10)
                || '· Tu coordinador ya está avisado para prepararlo contigo.' || chr(10)
                || '· Puedes seguir usando el asistente con normalidad.',
          'parse_mode', null, 'inline_keyboard', '[]'::jsonb));

    else
      select l.name, coalesce(l.selected_time, l.next_action_at) into v_lead_name, v_zoom_at
        from public.leads l where l.id = v_plan_lead;
      select p.name into v_asesor_name from public.profiles p
        where p.telegram_chat_id = p_telegram_chat_id and coalesce(p.active,true)=true limit 1;

      v_res := public.fn_proactive_log_plan(jsonb_build_object(
        'lead_id', v_plan_lead, 'report_id', v_plan_report,
        'asesor_name', coalesce(v_asesor_name,'(sin asesor)'), 'plan', v_txt));

      if coalesce((v_res->>'ok')::boolean, false) then
        return jsonb_build_object('ok', true,
          'reply', jsonb_build_object(
            'text', '▸ Plan guardado' || coalesce(' — ' || v_lead_name, '') || chr(10)
                  || '· Quedó en el expediente del cliente; tu coordinador ya lo puede ver.'
                  || coalesce(chr(10) || '· Zoom: «' || public.fn_fmt_fecha_legible(v_zoom_at) || '»', '')
                  || chr(10) || '· Al terminar la llamada dime cómo te fue y actualizo la ficha.',
            'parse_mode', null, 'inline_keyboard', '[]'::jsonb));
      end if;
      perform public.fn_proactive_close_report(jsonb_build_object('id', v_plan_report, 'outcome', 'plan_no_guardado'));
    end if;
  end if;

  /* ── AÑADIR AL EXPEDIENTE (mig 255) ───────────────────────────────────────
     «Añade en el expediente de Angel G, que es una persona muy puntual» se iba a
     VER LA FICHA solo porque decía «expediente», y tomaba la frase entera como
     nombre del cliente. Acá se mira el VERBO: si es escribir, y el nombre resuelve
     a un cliente único de TU cartera, va por el camino de agregar nota —con el
     teléfono ya resuelto, para que nadie lo vuelva a adivinar—. Si no resuelve,
     no se toca nada y el asistente pregunta como siempre. */
  if v_txt <> ''
     and v_tool not in ('add_expediente_note','add_expediente_voice','add_seguimiento','add_comunicacion',
                        'upsert_lead','create_lead','update_fields','add_task','create_deal','soft_delete')
     and not exists (select 1 from public.bot_pending_confirm where telegram_chat_id = p_telegram_chat_id)
  then
    begin
      v_nota := public._bot_nota_expediente_ref(p_telegram_chat_id, v_txt);
    exception when others then v_nota := jsonb_build_object('ok', false); end;

    if coalesce((v_nota->>'ok')::boolean, false) then
      return public.bot_nlu_dispatch_gvintell_required_fields_orig(
        p_telegram_chat_id, 'add_expediente_note',
        jsonb_build_object('phone', v_nota->>'phone', 'titulo', 'Nota del asesor',
                           'contenido', v_nota->>'contenido'));
    end if;
  end if;

  v_stage := nullif(btrim(coalesce(v_args->>'stage', v_args->>'st', v_args->>'etapa', '')), '');

  -- mig 239: «clientes sin movimiento» es una pregunta, no la lista de la cartera.
  if translate(lower(coalesce(v_args->>'input_text', v_args->>'texto', '')), 'áéíóú', 'aeiou')
     ~ '\y(sin\s+movimiento|sin\s+mover|sin\s+tocar|sin\s+actividad|inactivos?|abandonados?|enfriad)\y'
     and coalesce(v_tool,'') not in ('create_lead','upsert_lead','change_stage') then
    return public.bot_clientes_sin_movimiento(p_telegram_chat_id,
             coalesce(v_args->>'input_text', v_args->>'texto', ''));
  end if;

  -- mig 231: se suma lo que ESCRIBIÓ la persona (si no, el Zoom entraba en bucle).
  v_zoom_when := concat_ws(' ',
    v_args->>'zoom_at', v_args->>'zoom_datetime', v_args->>'selected_time', v_args->>'fecha_zoom',
    v_args->>'next_action_at', v_args->>'next_action_date',
    v_args->>'input_text', v_args->>'texto', v_args->>'raw_text');

  if v_stage = 'Zoom Agendado' and v_tool in ('change_stage', 'upsert_lead')
     and not public._bot_has_datetime_hint(v_zoom_when) then
    return jsonb_build_object('ok', false, 'needs_input', 'zoom_at',
      'reply', jsonb_build_object(
        'text', 'Perfecto. Para moverlo a Zoom Agendado necesito la fecha y hora exacta del Zoom. Ej: "mañana 5 pm" o "viernes 19 de julio 11 am".',
        'parse_mode', null, 'inline_keyboard', '[]'::jsonb));
  end if;

  v_has_next_action := nullif(btrim(coalesce(v_args->>'next_action', '')), '') is not null;
  v_next_when := concat_ws(' ',
    v_args->>'next_action_at', v_args->>'next_action_at_iso', v_args->>'next_action_date',
    v_args->>'when', v_args->>'due_at');

  if v_tool in ('update_next_action', 'add_task') and v_has_next_action
     and not public._bot_has_datetime_hint(v_next_when) then
    return jsonb_build_object('ok', false, 'needs_input', 'next_action_at',
      'reply', jsonb_build_object(
        'text', 'Listo, entiendo la próxima acción. ¿Para qué fecha y hora la programo? Ej: "hoy 4:30 pm", "mañana 10 am" o "en 3 horas".',
        'parse_mode', null, 'inline_keyboard', '[]'::jsonb));
  end if;

  return public.bot_nlu_dispatch_gvintell_required_fields_orig(p_telegram_chat_id, v_tool, v_args);
end;
$function$;

revoke all on function public.bot_nlu_dispatch_gvintell(bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.bot_nlu_dispatch_gvintell(bigint,text,jsonb) to service_role;
