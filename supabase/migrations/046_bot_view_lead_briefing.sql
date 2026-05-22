-- 046_bot_view_lead_briefing.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- "Ver ficha" del bot de Telegram devolvía reply.text VACÍO.
--
-- Causa: bot_view_lead_v2 leía (v_inner->>'lead_id'), pero bot_get_lead_by_phone
-- devuelve {found, lead:{id,...}} — no hay 'lead_id' top-level. El id real está
-- en lead->>'id'. Así v_lead quedaba NULL y _bot_fmt_lead_card formateaba vacío.
--
-- Fix + mejora: se reescribe bot_view_lead_v2 para armar un briefing COMPLETO:
--   - Datos generales: nombre, teléfono, correo, etapa, score, presupuesto,
--     proyecto, campaña/fuente, perfil (bio), última actividad, próxima acción.
--   - Perfilamiento Retell (si hay discovery, vía get_lead_ai_context -> 'discovery'):
--     zona, objetivo, recámaras, rango presupuesto, enganche, cita pactada,
--     duración de llamada, zoom link, propiedades de interés, posibles objeciones,
--     cómo resolverlas (asesor), resumen final.
-- Cada línea se omite si su valor está vacío. Se mantienen los botones de acción
-- (_bot_kb_lead_card). Validado: text no vacío con discovery (~937) y sin él (~328).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.bot_view_lead_v2(p_telegram_chat_id bigint, p_phone text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_inner jsonb; v_lead public.leads; v_phone_norm text;
  v_disc jsonb; v_lines text[]; v_t text; v_d int;
begin
  v_inner := public.bot_get_lead_by_phone(p_telegram_chat_id, p_phone);
  if v_inner ? 'error' then return public._bot_err_envelope(v_inner); end if;
  if not coalesce((v_inner->>'found')::boolean, false) then
    return jsonb_build_object('ok', true, 'data', v_inner,
      'reply', jsonb_build_object('text','No encontré ese cliente.','parse_mode',null,'inline_keyboard',public._bot_kb_back()));
  end if;

  v_phone_norm := regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  select * into v_lead from public.leads where id = (v_inner->'lead'->>'id')::uuid;

  -- ── Datos generales ──
  v_lines := array[ coalesce(v_lead.name,'(sin nombre)') || ' . ' || public._bot_fmt_phone(v_lead.phone) ];
  v_lines := v_lines || ('Etapa: ' || coalesce(v_lead.stage,'-') || ' . Score: ' || coalesce(v_lead.score::text,'-') ||
                         case when v_lead.hot then ' . caliente' else '' end);
  if coalesce(v_lead.email,'') <> '' then v_lines := v_lines || ('Correo: ' || v_lead.email); end if;
  v_t := public._bot_fmt_money(v_lead.presupuesto);
  if v_t = '' and coalesce(v_lead.budget,'') <> '' then v_t := v_lead.budget; end if;
  if v_t <> '' then v_lines := v_lines || ('Presupuesto: ' || v_t); end if;
  if coalesce(v_lead.project,'') <> '' then v_lines := v_lines || ('Proyecto: ' || v_lead.project); end if;
  if coalesce(v_lead.campaign,'') <> '' then v_lines := v_lines || ('Campaña/fuente: ' || v_lead.campaign); end if;
  if coalesce(v_lead.bio,'') <> '' then v_lines := v_lines || ('Perfil: ' || v_lead.bio); end if;
  if coalesce(v_lead.last_activity,'') <> '' then v_lines := v_lines || ('Última actividad: ' || v_lead.last_activity); end if;
  if coalesce(v_lead.next_action,'') <> '' then
    v_lines := v_lines || ('Próxima acción: ' || v_lead.next_action ||
      case when v_lead.next_action_at is not null then ' - ' || public._bot_fmt_when(v_lead.next_action_at) else '' end);
  end if;

  -- ── Perfilamiento Retell (discovery) ──
  v_disc := public.get_lead_ai_context(v_lead.id, 1)->'discovery';
  if v_disc is not null and jsonb_typeof(v_disc) = 'object' and v_disc <> '{}'::jsonb then
    v_lines := v_lines || ''::text;
    v_lines := v_lines || 'Perfilamiento (Retell):'::text;
    if coalesce(v_disc->>'zona','') <> ''                        then v_lines := v_lines || ('Zona de interés: ' || (v_disc->>'zona')); end if;
    if coalesce(v_disc->>'objetivo','') <> ''                    then v_lines := v_lines || ('Objetivo: ' || (v_disc->>'objetivo')); end if;
    if coalesce(v_disc->>'recamaras','') <> ''                   then v_lines := v_lines || ('Recámaras: ' || (v_disc->>'recamaras')); end if;
    if coalesce(v_disc->>'presupuesto','') <> ''                 then v_lines := v_lines || ('Rango de presupuesto: ' || (v_disc->>'presupuesto')); end if;
    if coalesce(v_disc->>'enganche_30','') <> ''                 then v_lines := v_lines || ('Enganche: ' || (v_disc->>'enganche_30')); end if;
    if coalesce(v_disc->>'cita_pactada','') <> ''                then v_lines := v_lines || ('Cita pactada: ' || (v_disc->>'cita_pactada')); end if;
    if coalesce(v_disc->>'duracion_segundos','') <> '' then
      v_d := (v_disc->>'duracion_segundos')::int;
      v_lines := v_lines || ('Duración de llamada: ' || case when v_d >= 60 then (v_d/60)||'m '||(v_d%60)||'s' else v_d||'s' end);
    end if;
    if coalesce(v_disc->>'zoom_link','') <> ''                   then v_lines := v_lines || ('Zoom: ' || (v_disc->>'zoom_link')); end if;
    if coalesce(v_disc->>'propiedades_interes','') <> ''         then v_lines := v_lines || ('Propiedades de interés: ' || (v_disc->>'propiedades_interes')); end if;
    if coalesce(v_disc->>'posibles_objeciones','') <> ''         then v_lines := v_lines || ('Posibles objeciones: ' || (v_disc->>'posibles_objeciones')); end if;
    if coalesce(v_disc->>'como_solucionarlas_asesor','') <> ''   then v_lines := v_lines || ('Cómo resolverlas (asesor): ' || (v_disc->>'como_solucionarlas_asesor')); end if;
    if coalesce(v_disc->>'anotaciones_finales_resumen','') <> '' then v_lines := v_lines || ('Resumen final: ' || (v_disc->>'anotaciones_finales_resumen')); end if;
  end if;

  return jsonb_build_object('ok', true, 'data', v_inner,
    'reply', jsonb_build_object('text', array_to_string(v_lines, E'\n'), 'parse_mode', null, 'inline_keyboard', public._bot_kb_lead_card(v_phone_norm)));
end; $function$;

revoke all on function public.bot_view_lead_v2(bigint,text) from public;
grant execute on function public.bot_view_lead_v2(bigint,text) to service_role;
