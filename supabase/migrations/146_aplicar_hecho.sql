create or replace function public.fn_aplicar_hecho(p_fact_id uuid, p_profile_id uuid default null)
returns text language plpgsql
security definer set search_path to 'public' as $$
declare f record; v_actor uuid; v_res text;
begin
  select * into f from auto_facts where id = p_fact_id;
  if f.id is null then return 'No encontre ese hecho.'; end if;
  if f.estado = 'aplicado' then return 'Ya estaba aplicado.'; end if;
  v_actor := coalesce(p_profile_id,
    (select id from profiles where organization_id = f.organization_id
      and role in ('super_admin','admin') order by created_at limit 1));
  if v_actor is null then return 'No hay un usuario con permisos en esa organizacion.'; end if;
  begin
    case f.tipo
      when 'tarea_hecha'      then v_res := fn_mkt_complete_task(v_actor, f.referencia);
      when 'tarea_empezada'   then v_res := fn_mkt_start_task(v_actor, f.referencia);
      when 'tarea_nueva'      then v_res := fn_mkt_create_task(v_actor, f.referencia, nullif(f.valor,''), null, null, null);
      when 'progreso_cliente' then v_res := fn_client_progress(v_actor, f.referencia, null, coalesce(nullif(f.valor,'')::numeric, 0));
      when 'avance_cliente'   then v_res := fn_client_log(v_actor, f.referencia, f.evidencia, 'avance');
      when 'pago_hecho'       then
        update auto_facts set estado='propuesto', resultado='Requiere confirmacion humana (es dinero).' where id=f.id;
        return 'PENDIENTE DE CONFIRMAR: '||coalesce(f.referencia,'')||' '||coalesce(f.valor,'');
      else v_res := 'Tipo de hecho desconocido: '||f.tipo;
    end case;
    update auto_facts
       set estado = case when v_res like '✓%' then 'aplicado' else 'fallido' end,
           resultado = v_res, aplicado_at = now(), revisado_por = v_actor
     where id = f.id;
    return v_res;
  exception when others then
    update auto_facts set estado='fallido', resultado=sqlerrm where id=f.id;
    return 'No se pudo aplicar: '||sqlerrm;
  end;
end $$;;
