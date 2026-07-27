-- «Contestar también desde la app» (pedido de Ángel, 27-jul).
--
-- Hoy la pantalla de llamada entrante solo aparece si la app YA estaba abierta
-- cuando llegó el aviso. Si ves la notificación en el iPhone y abrís la app en
-- vez de tocar el aviso, la llamada es invisible: no hay a qué darle contestar.
--
-- Esto responde «¿me están llamando ahora mismo?». La app lo pregunta al abrir y
-- cada vez que volvés a ella, y si hay una llamada viva muestra la pantalla con
-- el botón Contestar. Ventana de 60s: lo que dura un teléfono sonando.
create or replace function public.fn_llamada_en_curso(p_profile_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_row record;
begin
  select r.payload, r.created_at into v_row
    from proactive_reminders r
   where r.asesor_id = p_profile_id
     and r.tipo = 'llamada_entrante'
     and r.created_at > now() - interval '60 seconds'
   order by r.created_at desc
   limit 1;

  if v_row.payload is null then return null; end if;

  return jsonb_build_object(
    'caller', coalesce(v_row.payload->>'caller', 'Alguien'),
    'meet',   coalesce(nullif(v_row.payload->>'meet',''), 'https://meet.google.com/mus-xsur-jdc'),
    'hace_segundos', floor(extract(epoch from (now() - v_row.created_at)))
  );
end $$;

grant execute on function public.fn_llamada_en_curso(uuid) to anon, authenticated;;
