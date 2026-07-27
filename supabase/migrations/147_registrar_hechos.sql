-- Guarda los hechos detectados y aplica SOLO los de confianza alta.
-- Lo dudoso y todo lo de dinero queda para que un humano lo confirme.
create or replace function public.fn_registrar_hechos(
  p_org uuid, p_fuente text, p_fuente_ref text, p_hechos jsonb)
returns text language plpgsql
security definer set search_path to 'public' as $$
declare h jsonb; v_id uuid; v_res text; v_ok text := ''; v_pend text := ''; v_n int := 0;
begin
  if p_hechos is null or jsonb_typeof(p_hechos) <> 'array' then return 'No detecte nada que aplicar.'; end if;
  for h in select * from jsonb_array_elements(p_hechos) loop
    insert into auto_facts (organization_id, fuente, fuente_ref, tipo, referencia, valor, evidencia, confianza)
    values (p_org, p_fuente, p_fuente_ref, h->>'tipo', h->>'referencia', h->>'valor',
            coalesce(h->>'evidencia','(sin cita)'), coalesce(h->>'confianza','media'))
    returning id into v_id;
    if coalesce(h->>'confianza','media') = 'alta' then
      v_res := fn_aplicar_hecho(v_id, null);
      if v_res like '✓%' then v_ok := v_ok || E'\n' || v_res; v_n := v_n + 1;
      else v_pend := v_pend || E'\n• ' || coalesce(h->>'referencia','') || ' — ' || coalesce(v_res,''); end if;
    else
      v_pend := v_pend || E'\n• ' || coalesce(h->>'tipo','') || ': ' || coalesce(h->>'referencia','')
             || ' («' || left(coalesce(h->>'evidencia',''), 80) || '»)';
    end if;
  end loop;
  return case when v_n > 0 then 'Actualice esto solo, por lo que se hablo:'||v_ok else 'No aplique nada automaticamente.' end
      || case when v_pend <> '' then E'\n\n'||'Esto lo dejo para que lo confirmes:'||v_pend else '' end;
end $$;;
