-- Salió otro «Decímelo» en el texto de ayuda genérico. Barrido global de la
-- forma acentuada (display-segura: los regex de entrada matchean texto sin
-- tildes) en todas las funciones bot_/fn_ del esquema, menos fn_mkt_*.
-- REVERTIR: re-ejecutar la versión anterior de cada función.
do $do$
declare v_oid oid; v_def text; v_new text;
begin
  for v_oid in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.prokind='f'
      and p.proname !~ '^fn_mkt_'
      and pg_get_functiondef(p.oid) like '%Decímelo%'
  loop
    v_def := pg_get_functiondef(v_oid);
    v_new := replace(v_def, 'Decímelo', 'Dímelo');
    if v_new <> v_def then execute v_new; end if;
  end loop;
end $do$;