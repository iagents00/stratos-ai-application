-- Duke's default pipeline: distinguish failed closings from won sales.
-- No lead is moved and no other organization's saved pipeline is changed.
BEGIN;
DO $$
DECLARE
  v_org constant uuid := '00000000-0000-0000-0000-000000000001';
  v_pipeline jsonb;
  v_meta jsonb;
BEGIN
  SELECT coalesce(meta_config,'{}') INTO v_meta FROM public.organizations WHERE id=v_org FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.org_stages(organization_id,orden,nombre,color,activo)
    SELECT v_org,coalesce(max(orden),0)+1,'Cierres Caídos','#D97757',true FROM public.org_stages WHERE organization_id=v_org
    ON CONFLICT (organization_id,nombre) DO UPDATE SET activo=true,deleted_at=NULL,color=excluded.color;
  -- This org currently has no custom crm configuration. Preserve any later
  -- customization and append only when a flat pipeline has been saved.
  v_pipeline := v_meta#>'{crm,pipeline}';
  IF jsonb_typeof(v_pipeline)='array' AND jsonb_array_length(v_pipeline)>0
     AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_pipeline) d WHERE d->>'name'='Cierres Caídos') THEN
    UPDATE public.organizations SET meta_config=jsonb_set(v_meta,'{crm,pipeline}',
      v_pipeline||jsonb_build_array(jsonb_build_object('name','Cierres Caídos','color','#D97757'))),updated_at=now()
      WHERE id=v_org;
  END IF;
END; $$;
-- Refresh only the Duke entry in the server fallback; saved tenant pipelines still win.
create or replace function public.fn_platform_crm_pipeline(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_meta jsonb; v_pipeline jsonb; v_static jsonb := '{"ea74b69a-6904-4c65-a0ca-e0af58f1473a":[{"name":"Contáctame Ya","color":"#94A3B8"},{"name":"Segundo Intento","color":"#38BDF8"},{"name":"Tercer Intento","color":"#7EB8F0"},{"name":"Rotación","color":"#A8A29E"},{"name":"Remarketing IA","color":"#FB923C"},{"name":"Zoom Agendado","color":"#3B82F6"},{"name":"Reactivar Zoom","color":"#EA580C"},{"name":"Zoom Concretado","color":"#2DD4BF"},{"name":"Seguimiento","color":"#FBBF24"},{"name":"Largo Plazo","color":"#818CF8"},{"name":"Apartó","color":"#4ADE80"},{"name":"Visita Agendada","color":"#06B6D4"},{"name":"Cierre","color":"#34D399"},{"name":"Postventa","color":"#64748B"}],"6c5cf32a-3db4-477d-bbed-26d90231bc9a":[{"name":"Sin contactar","color":"#94A3B8"},{"name":"Buscando cita","color":"#38BDF8"},{"name":"Cita sin confirmar","color":"#818CF8"},{"name":"Cita confirmada","color":"#22D3EE"},{"name":"Faltó a la cita","color":"#FBBF24"},{"name":"No continuó","color":"#F87171"},{"name":"Ya vino a consulta","color":"#38BDF8"},{"name":"Pensando el presupuesto","color":"#FB923C"},{"name":"Listo para empezar","color":"#22D3EE"},{"name":"En tratamiento","color":"#34D399"},{"name":"Tratamiento terminado","color":"#4ADE80"},{"name":"Vuelve a control","color":"#10B981"}],"deded000-0000-4000-a000-000000000001":[{"name":"Contáctame Ya","color":"#94A3B8"},{"name":"Segundo Intento","color":"#38BDF8"},{"name":"Tercer Intento","color":"#7EB8F0"},{"name":"Rotación","color":"#A8A29E"},{"name":"Remarketing IA","color":"#FB923C"},{"name":"Zoom Agendado","color":"#3B82F6"},{"name":"Reactivar Zoom","color":"#EA580C"},{"name":"Zoom Concretado","color":"#2DD4BF"},{"name":"Seguimiento","color":"#FBBF24"},{"name":"Largo Plazo","color":"#818CF8"},{"name":"Apartó","color":"#4ADE80"},{"name":"Visita Agendada","color":"#06B6D4"},{"name":"Cierre","color":"#34D399"},{"name":"Postventa","color":"#64748B"}],"00000000-0000-0000-0000-000000000001":[{"name":"Contáctame Ya","color":"#94A3B8"},{"name":"Segundo Intento","color":"#38BDF8"},{"name":"Tercer Intento","color":"#7EB8F0"},{"name":"Rotación","color":"#A8A29E"},{"name":"Remarketing IA","color":"#FB923C"},{"name":"Zoom Agendado","color":"#3B82F6"},{"name":"Reactivar Zoom","color":"#EA580C"},{"name":"Zoom Concretado","color":"#2DD4BF"},{"name":"Seguimiento","color":"#FBBF24"},{"name":"Largo Plazo","color":"#818CF8"},{"name":"Apartó","color":"#4ADE80"},{"name":"Visita Agendada","color":"#06B6D4"},{"name":"Cierre","color":"#34D399"},{"name":"Postventa","color":"#64748B"},{"name":"Cierres Caídos","color":"#D97757"}],"72e827f9-4d40-4197-bde6-3e4359f09591":[{"name":"Mensaje nuevo","color":"#94A3B8"},{"name":"Ya se le informó","color":"#38BDF8"},{"name":"Cita agendada","color":"#818CF8"},{"name":"Preparación enviada","color":"#A78BFA"},{"name":"No se presentó","color":"#FBBF24"},{"name":"No agendó","color":"#F87171"},{"name":"Estudio realizado","color":"#22D3EE"},{"name":"Esperando interpretación","color":"#FB923C"},{"name":"Resultados entregados","color":"#4ADE80"},{"name":"Toca control","color":"#10B981"},{"name":"Médico por visitar","color":"#94A3B8"},{"name":"Visita hecha","color":"#818CF8"},{"name":"Ya nos mandó pacientes","color":"#22D3EE"},{"name":"Nos manda seguido","color":"#4ADE80"},{"name":"Dejó de mandar","color":"#F87171"}],"9afe40d2-7163-4407-a4cd-5346799ecd3c":[{"name":"Contáctame Ya","color":"#94A3B8"},{"name":"Segundo Intento","color":"#38BDF8"},{"name":"Tercer Intento","color":"#7EB8F0"},{"name":"Rotación","color":"#A8A29E"},{"name":"Remarketing IA","color":"#FB923C"},{"name":"Zoom Agendado","color":"#3B82F6"},{"name":"Reactivar Zoom","color":"#EA580C"},{"name":"Zoom Concretado","color":"#2DD4BF"},{"name":"Seguimiento","color":"#FBBF24"},{"name":"Largo Plazo","color":"#818CF8"},{"name":"Apartó","color":"#4ADE80"},{"name":"Visita Agendada","color":"#06B6D4"},{"name":"Cierre","color":"#34D399"},{"name":"Postventa","color":"#64748B"}],"cd478b82-d2ff-4543-981d-fb9d7aa1583e":[{"name":"Prospecto","color":"#94A3B8"},{"name":"Contactado","color":"#38BDF8"},{"name":"En conversación","color":"#FBBF24"},{"name":"Reunión","color":"#A78BFA"},{"name":"Propuesta","color":"#FB923C"},{"name":"Ganado","color":"#34D399"},{"name":"Perdido","color":"#F87171"}],"281caa01-7414-4eef-b3b6-afa1e7623ab3":[{"name":"Terreno y contrato","color":"#A8A29E"},{"name":"Diseño y proyecto ejecutivo","color":"#94A3B8"},{"name":"Licencias y permisos","color":"#38BDF8"},{"name":"Cimientos","color":"#FBBF24"},{"name":"Obra gris","color":"#FB923C"},{"name":"Acabados","color":"#A78BFA"},{"name":"Entrega","color":"#34D399"},{"name":"Postventa","color":"#64748B"}],"e583eb98-ff00-4920-a69c-db39f3841b31":[{"name":"Pidió cotización","color":"#94A3B8"},{"name":"Cotización enviada","color":"#CBD5E1"},{"name":"Anticipo recibido","color":"#4ADE80"},{"name":"No cerró","color":"#F87171"},{"name":"Corte","color":"#38BDF8"},{"name":"Armado","color":"#FBBF24"},{"name":"Laca","color":"#A78BFA"},{"name":"Terminado, listo para entregar","color":"#2DD4BF"},{"name":"Entregado","color":"#34D399"},{"name":"Ajustes y garantía","color":"#64748B"}],"4a17b181-35d2-41b3-b639-6e0bd4c38acc":[{"name":"Prospecto","color":"#94A3B8"},{"name":"Contactado","color":"#38BDF8"},{"name":"En conversación","color":"#FBBF24"},{"name":"Diagnóstico","color":"#A78BFA"},{"name":"Propuesta","color":"#FB923C"},{"name":"Cierre","color":"#F472B6"},{"name":"Onboarding","color":"#22D3EE"},{"name":"Activa","color":"#34D399"},{"name":"Descartada","color":"#F87171"}],"b1145073-434c-4779-a243-d5e8f5ff3617":[{"name":"Contáctame Ya","color":"#94A3B8"},{"name":"Segundo Intento","color":"#38BDF8"},{"name":"Tercer Intento","color":"#7EB8F0"},{"name":"Rotación","color":"#A8A29E"},{"name":"Remarketing IA","color":"#FB923C"},{"name":"Zoom Agendado","color":"#3B82F6"},{"name":"Reactivar Zoom","color":"#EA580C"},{"name":"Zoom Concretado","color":"#2DD4BF"},{"name":"Seguimiento","color":"#FBBF24"},{"name":"Largo Plazo","color":"#818CF8"},{"name":"Apartó","color":"#4ADE80"},{"name":"Visita Agendada","color":"#06B6D4"},{"name":"Cierre","color":"#34D399"},{"name":"Postventa","color":"#64748B"}],"c1d2e3f4-a5b6-47c8-9d0e-1f2a3b4c5d6e":[{"name":"Contáctame Ya","color":"#94A3B8"},{"name":"Segundo Intento","color":"#38BDF8"},{"name":"Tercer Intento","color":"#7EB8F0"},{"name":"Rotación","color":"#A8A29E"},{"name":"Remarketing IA","color":"#FB923C"},{"name":"Zoom Agendado","color":"#3B82F6"},{"name":"Reactivar Zoom","color":"#EA580C"},{"name":"Zoom Concretado","color":"#2DD4BF"},{"name":"Seguimiento","color":"#FBBF24"},{"name":"Largo Plazo","color":"#818CF8"},{"name":"Apartó","color":"#4ADE80"},{"name":"Visita Agendada","color":"#06B6D4"},{"name":"Cierre","color":"#34D399"},{"name":"Postventa","color":"#64748B"}],"065e12c5-56e2-440d-8f82-cd6c1ca612b7":[{"name":"Detectada","color":"#94A3B8"},{"name":"En Análisis","color":"#38BDF8"},{"name":"Presentada","color":"#FBBF24"},{"name":"Adjudicada","color":"#A78BFA"},{"name":"En Ejecución","color":"#06B6D4"},{"name":"Finalizada","color":"#34D399"},{"name":"Descartada","color":"#F87171"}]}'::jsonb;
  v_defaults jsonb := '[{"name":"Prospecto","color":"#94A3B8"},{"name":"Contactado","color":"#38BDF8"},{"name":"En conversación","color":"#FBBF24"},{"name":"Reunión","color":"#A78BFA"},{"name":"Propuesta","color":"#FB923C"},{"name":"Ganado","color":"#34D399"},{"name":"Perdido","color":"#F87171"}]'::jsonb;
begin
  select meta_config into v_meta from public.organizations where id=p_organization_id;
  if jsonb_typeof(v_meta#>'{crm,pipeline}')='array' and jsonb_array_length(v_meta#>'{crm,pipeline}')>0 then
    v_pipeline:=v_meta#>'{crm,pipeline}';
  elsif jsonb_typeof(v_meta#>'{crm,pipelines}')='array' then
    select jsonb_agg(s) into v_pipeline from jsonb_array_elements(v_meta#>'{crm,pipelines}') g
      cross join lateral jsonb_array_elements(case when jsonb_typeof(g->'stages')='array' then g->'stages' else '[]'::jsonb end) s;
  end if;
  -- Historical companies still keep their pipeline in org_stages. Its legacy
  -- column names vary; read JSON keys without altering that table or its rows.
  if v_pipeline is null and to_regclass('public.org_stages') is not null then
    execute $q$ select jsonb_agg(jsonb_build_object('name',coalesce(j->>'nombre',j->>'name',j->>'stage_name',j->>'stage'),
      'color',coalesce(j->>'color','#64748B')) order by
      case when coalesce(j->>'sort_order',j->>'position',j->>'orden',j->>'stage_order','') ~ '^\d+$'
        then coalesce(j->>'sort_order',j->>'position',j->>'orden',j->>'stage_order')::integer else 999 end,
      coalesce(j->>'nombre',j->>'name',j->>'stage_name',j->>'stage'))
      from (select to_jsonb(s) j from public.org_stages s) x
      where j->>'organization_id'=$1 and j->>'deleted_at' is null and coalesce(j->>'activo','true')<>'false'
        and coalesce(j->>'nombre',j->>'name',j->>'stage_name',j->>'stage','')<>'' $q$
      into v_pipeline using p_organization_id::text;
  end if;
  -- Server fallback mirrors repository-only client configurations at this
  -- release. Saved database configuration always takes precedence. No seed or
  -- update is applied to historical organizations or their leads.
  v_pipeline:=coalesce(v_pipeline,v_static->p_organization_id::text,v_defaults);
  select coalesce(jsonb_agg(jsonb_build_object('name',s->>'name','color',
      case when s->>'color' ~ '^#[0-9A-Fa-f]{6}$' then s->>'color' else '#64748B' end) order by ord),'[]'::jsonb)
    into v_pipeline from jsonb_array_elements(v_pipeline) with ordinality x(s,ord)
    where nullif(btrim(s->>'name'),'') is not null;
  -- Keep occupied legacy stages visible; never relabel a company's clients.
  select v_pipeline||coalesce(jsonb_agg(jsonb_build_object('name',stage,'color','#64748B') order by stage),'[]'::jsonb)
    into v_pipeline from (select distinct stage from public.leads where organization_id=p_organization_id
      and deleted_at is null and nullif(btrim(stage),'') is not null
      and not exists(select 1 from jsonb_array_elements(v_pipeline) s where s->>'name'=stage)) legacy;
  return v_pipeline;
end $$;
REVOKE ALL ON FUNCTION public.fn_platform_crm_pipeline(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_platform_crm_pipeline(uuid) TO service_role;
COMMIT;
