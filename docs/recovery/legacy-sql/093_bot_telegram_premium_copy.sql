-- 093_bot_telegram_premium_copy.sql
-- Capa de copy premium para el Telegram de Stratos/Duke.
-- Reversible: bot_buscar_proyectos original queda como bot_buscar_proyectos_premium_orig.

create or replace function public.bot_render_menu()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'ok', true,
    'reply', jsonb_build_object(
      'text', '✨ Stratos Assist' || E'\n\n' ||
              'Elige una opción o escríbeme libremente.',
      'parse_mode', null,
      'inline_keyboard', public._bot_kb_root_menu()
    )
  );
$$;

create or replace function public.bot_render_menu(p_chat bigint)
returns jsonb
language plpgsql
stable
as $$
declare
  v_org uuid;
  v_obra boolean;
begin
  select organization_id into v_org
  from public.profiles
  where telegram_chat_id = p_chat
  limit 1;

  if v_org is null then
    return jsonb_build_object('ok', true, 'reply', jsonb_build_object(
      'text', '🔐 Conecta tu Telegram' || E'\n\n' ||
              'Abre tu perfil en el CRM, toca “Conectar Telegram” y envíame el código.',
      'parse_mode', null,
      'inline_keyboard', '[]'::jsonb
    ));
  end if;

  v_obra := coalesce((
    select team_requires_evidence
    from public.proactive_config
    where organization_id = v_org
  ), false);

  return jsonb_build_object('ok', true, 'reply', jsonb_build_object(
    'text', case when v_obra then
      '✅ Tareas de hoy' || E'\n\n' ||
      'Cuando termines una actividad, toca “Ya la hice” y adjunta la evidencia.'
    else
      '✨ Stratos Assist' || E'\n\n' ||
      'Elige una opción o escríbeme libremente.'
    end,
    'parse_mode', null,
    'inline_keyboard', public._bot_kb_root_menu(v_org)
  ));
end;
$$;

do $$
begin
  if to_regprocedure('public.bot_buscar_proyectos_premium_orig(bigint,jsonb)') is null then
    alter function public.bot_buscar_proyectos(bigint, jsonb) rename to bot_buscar_proyectos_premium_orig;
  end if;
end $$;

create or replace function public.bot_buscar_proyectos(
  p_telegram_chat_id bigint,
  p_args jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_res jsonb;
  v_reply jsonb;
  v_text text;
begin
  v_res := public.bot_buscar_proyectos_premium_orig(p_telegram_chat_id, p_args);
  v_reply := coalesce(v_res->'reply', '{}'::jsonb);
  v_text := coalesce(v_reply->>'text', '');

  if v_text <> '' then
    v_text := regexp_replace(
      v_text,
      '🏗️ Catálogo Duke · ([^—\n]+) — ([0-9]+ resultado[s]?)',
      E'🏗️ Catálogo Duke · \\1\n\\2',
      'g'
    );
    v_text := regexp_replace(
      v_text,
      '🏗️ Catálogo Duke — top ([0-9]+)',
      E'🏗️ Catálogo Duke\n\\1 opciones',
      'g'
    );
    v_text := replace(v_text, E'\n   🏢 ', E'\n   🏢 Broker: ');
    v_text := replace(v_text, E'\n   ☎ ', E'\n   ☎ Contacto: ');
    v_text := replace(v_text, '   📁 Detalle en Drive: pendiente de cargar (pídeselo al equipo)', '   📁 Ficha en Drive pendiente.');
    v_text := regexp_replace(
      v_text,
      E'\n\n📂 Tocá "Ver detalle en Drive" en cada propiedad para ver fotos, planos y más info\\.',
      E'\n\n📁 Abre el Drive para fotos, planos y ficha técnica.',
      'g'
    );
    v_text := replace(
      v_text,
      E'\n\n💡 Ojo: no todas las propiedades tienen precio cargado, así que el filtro por presupuesto es orientativo.',
      E'\n\nℹ️ Algunos desarrollos aún no tienen precio cargado; el presupuesto se usa como referencia.'
    );
    v_text := replace(
      v_text,
      E'\n\nNo encontré algo que cuadre exacto con eso, pero acá van las mejores opciones del catálogo 👇',
      ''
    );
    v_text := replace(
      v_text,
      'Todavía no hay propiedades cargadas en el catálogo. Avisá al equipo para publicarlas.',
      'Aún no hay desarrollos publicados en el catálogo. Avísale al equipo para cargar las fichas.'
    );
    v_text := replace(
      v_text,
      'Aún no te reconozco. Conectá tu Telegram desde el CRM (Perfil → Conectar Telegram) y volvé a preguntar por el catálogo.',
      '🔐 Conecta tu Telegram desde el CRM y vuelve a intentarlo.'
    );
  end if;

  v_reply := v_reply || jsonb_build_object('text', v_text, 'parse_mode', null);
  return v_res || jsonb_build_object('reply', v_reply);
end;
$$;

grant execute on function public.bot_render_menu() to service_role;
grant execute on function public.bot_render_menu(bigint) to service_role;
grant execute on function public.bot_buscar_proyectos(bigint,jsonb) to service_role;
revoke all on function public.bot_render_menu() from public, anon;
revoke all on function public.bot_render_menu(bigint) from public, anon;
revoke all on function public.bot_buscar_proyectos(bigint,jsonb) from public, anon;

notify pgrst, 'reload schema';
