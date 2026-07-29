-- «¿Qué se hizo hoy?» — la respuesta directa, sin leerse el changelog entero.
--
-- Ángel (29-jul): preguntó tres veces en el Copilot de NSG y las tres devolvió
-- «No recibí la respuesta a tiempo», mientras el bot del AIOS por Telegram sí
-- contestaba. Reproducido contra el flujo real (`5YYDRgEQRMpj7NlE`): la
-- ejecución TERMINA BIEN pero tarda 33,7 segundos, contra un tope de 40 en el
-- navegador. Está al filo, y aunque entre, nadie mira un chat medio minuto sin
-- creer que se colgó.
--
-- La causa no era el modelo. Para contestar «qué se hizo», el agente pedía
-- `memory/changelog.md` por la herramienta del cerebro, que devuelve hasta
-- 45.000 caracteres. Leerlos y resumirlos es lo que se comía el tiempo.
--
-- Esta función devuelve lo mismo ya masticado: ~1.400 caracteres con el día a
-- día del periodo, el trabajo de otros clientes ya filtrado y el domingo contado
-- en el sábado. Medido después del cambio: 14,9 segundos.
--
-- Reusa `fn_informe_avances` a propósito, para que el Copilot y el informe
-- quincenal cuenten exactamente la misma historia. Si cada uno tuviera su propia
-- consulta, tendríamos dos versiones de la verdad y ninguna confiable.
--
-- Se conecta como la tool `avances` del flujo del Copilot NSG (credencial
-- Postgres Synergy → stratos-prod). Revertir: quitar esa tool del flujo; la
-- función puede quedarse, no la usa nadie más.
create or replace function public.fn_avances_resumen(
  p_chat_id bigint,
  p_dias    int default 1
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_profile uuid;
  v_j       jsonb;
begin
  -- ⚠️ El chat de una persona puede existir en MÁS de una organización (Ángel
  -- tiene su Telegram real en Duke y una identidad sintética en NSG). Acá se
  -- resuelve por el chat que MANDA el Copilot, que es el del tenant abierto —
  -- por eso el mismo texto contesta cosas distintas en NSG y en Duke, y está bien.
  select p.id into v_profile
  from profiles p
  where p.telegram_chat_id = p_chat_id
  limit 1;

  if v_profile is null then
    return 'No pude identificar tu usuario para leer los avances.';
  end if;

  v_j := public.fn_informe_avances(v_profile, greatest(coalesce(p_dias, 1), 0));

  if coalesce((v_j->>'ok')::boolean, false) is not true then
    return coalesce(v_j->>'error', 'No pude reunir los avances.');
  end if;

  if jsonb_array_length(v_j->'dias') = 0 then
    return 'En ese periodo no quedó nada registrado en el cerebro.';
  end if;

  return v_j->>'borrador';
end
$fn$;

grant execute on function public.fn_avances_resumen(bigint, int) to authenticated, anon, service_role;

comment on function public.fn_avances_resumen(bigint, int) is
  'Día a día de lo que se hizo, ya resumido, para el Copilot. Misma fuente que el informe quincenal.';


-- El alcance del informe de NSG, corregido. La lista por defecto de la función
-- traía palabras GENÉRICAS del producto (stratos, crm, asesor, marketing,
-- whatsapp) como señal de «esto es nuestro», y `stratos-prod` es la base de
-- TODOS los inquilinos: por eso las entradas de Constructora Vega pasaban el
-- filtro y se colaban en el reporte del cliente. Es la misma trampa que
-- `bot_nlu_dispatch_gvintell`, en el sentido contrario.
update organizations
   set meta_config = coalesce(meta_config,'{}'::jsonb) || jsonb_build_object(
     'informe_en_alcance', jsonb_build_array(
       'duke','duque','nsg','stratos capital','iagents',
       'brasa','mueble','mueblar','muebler[ií]a','legacy','nk23','casa lago'))
 where id = '4a17b181-35d2-41b3-b639-6e0bd4c38acc';
