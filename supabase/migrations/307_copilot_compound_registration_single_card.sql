-- A compound registration has one evolving confirmation, never stale cards
-- followed by a second summary or a missing-input prompt for an unrelated task.
create or replace function public.bot_crm_conversation_multi(p_chat bigint,p_actions jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare a jsonb; r jsonb; staged jsonb; results jsonb:='[]'; text_out text:=''; all_ok boolean:=true;
begin
 if jsonb_typeof(p_actions) is distinct from 'array' or jsonb_array_length(p_actions) not between 1 and 10 then
  return jsonb_build_object('ok',false,'reply',jsonb_build_object('text','Divide el pedido en hasta diez acciones para revisarlas contigo.'));
 end if;
 for a in select value from jsonb_array_elements(p_actions) loop
  if coalesce(a->>'tool_name','') in ('multi','multi_task','multi_action','multi_tarea','multiple_tasks','') then
   r:=jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No identifiqué una de las acciones; esa parte no se guardó.'));
  else
   begin
    r:=public.bot_nlu_dispatch_gvintell(p_chat,a->>'tool_name',coalesce(a->'args','{}'));
   exception when others then
    r:=jsonb_build_object('ok',false,'reply',jsonb_build_object('text','No pude guardar una de las acciones. Esa parte no se completó.'));
   end;
  end if;
  results:=results||jsonb_build_array(r);
  all_ok:=all_ok and coalesce((r->>'ok')::boolean,false);
  if coalesce((r->>'staged')::boolean,false) then staged:=r;
  elsif position(coalesce(r#>>'{reply,text}','') in text_out)=0 then
   text_out:=concat_ws(E'\n\n',nullif(text_out,''),nullif(r#>>'{reply,text}',''));
  end if;
 end loop;
 if staged is not null and all_ok then return staged||jsonb_build_object('results',results); end if;
 return jsonb_build_object('ok',all_ok,'results',results,'reply',jsonb_build_object('text',concat_ws(E'\n\n',nullif(staged#>>'{reply,text}',''),nullif(text_out,''))));
end $fn$;
revoke all on function public.bot_crm_conversation_multi(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.bot_crm_conversation_multi(bigint,jsonb) to service_role;
