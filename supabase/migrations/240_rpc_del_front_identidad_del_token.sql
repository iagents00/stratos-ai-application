-- ═══════════════════════════════════════════════════════════════════════════
-- LAS 17 QUE FALTABAN — 24-ago-2026
-- (aplicada como 20260824212755_rpc_del_front_identidad_del_token_no_del_navegador)
--
-- Estas funciones (Comando, Documentos, Informes, Chat del equipo, Caja,
-- Marketing, la llamada en curso) también estaban denegadas para la persona
-- logueada — es de donde salía el «permission denied for function
-- fn_comando_nsg» de la captura.
--
-- ⚠️ PERO NO SE PODÍAN ABRIR TAL CUAL, y por eso van aparte de las del Copilot:
-- todas reciben `p_profile_id` DESDE EL NAVEGADOR y derivan de ahí la empresa y
-- los permisos, sin comprobar nada. Devolverles el EXECUTE sin más habría hecho
-- que cualquier persona logueada de CUALQUIER empresa pudiera mandar el
-- identificador de otra y leerle la caja, la nómina, los documentos o el chat
-- interno. Quien las revocó en la auditoría de agosto tenía razón; lo que faltó
-- fue arreglarlas y volver a abrirlas, no dejarlas cerradas con la app usándolas.
--
-- EL ARREGLO, sin tocar una sola línea de la lógica de cada una:
--   1. La función original se renombra a `<nombre>_impl` — su cuerpo queda
--      intacto, con su historia y su comportamiento.
--   2. En su lugar queda una de paso, con la MISMA firma, que hace una sola
--      cosa antes de delegar: si quien llama trae token (una persona real),
--      `p_profile_id` se REEMPLAZA por su `auth.uid()`. Lo que mande el
--      navegador deja de importar: la identidad la pone el token.
--   3. Sin token (n8n, el operador y los cron entran con la llave de servicio)
--      el parámetro se respeta igual que siempre → nada de eso se rompe.
--
-- Es el mismo patrón que ya se le aplicó a `fn_team_users` el 3-ago
-- (mig 20260803231502): la empresa SIEMPRE sale de auth.uid(), el parámetro
-- solo se honra sin JWT. Acá se generaliza a las 17 hermanas que lo necesitaban.
--
-- VERIFICADO de las dos formas, contra fn_comando_nsg:
--   · token de Ángel (NSG) + id de otra empresa → devuelve NSG   (el guardia manda)
--   · sin token + id de otra empresa            → devuelve la otra (n8n sigue igual)
--
-- `anon` (la llave pública del JavaScript) NO recibe permiso en ninguna.
--
-- Reversa, por función:
--   drop function public.<nombre>(<args>);
--   alter function public.<nombre>_impl(<args>) rename to <nombre>;
--   grant execute on function public.<nombre>(<args>) to authenticated;
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Comando (la pantalla de la captura) ─────────────────────────────────
alter function public.fn_comando_nsg(uuid) rename to fn_comando_nsg_impl;
create or replace function public.fn_comando_nsg(p_profile_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_comando_nsg_impl(p_profile_id); end $$;

-- ── 2. Marketing / inteligencia ────────────────────────────────────────────
alter function public.fn_mkt_intel(uuid) rename to fn_mkt_intel_impl;
create or replace function public.fn_mkt_intel(p_profile_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_mkt_intel_impl(p_profile_id); end $$;

-- ── 3. La llamada en curso ─────────────────────────────────────────────────
alter function public.fn_llamada_en_curso(uuid) rename to fn_llamada_en_curso_impl;
create or replace function public.fn_llamada_en_curso(p_profile_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_llamada_en_curso_impl(p_profile_id); end $$;

-- ── 4-8. Chat del equipo ───────────────────────────────────────────────────
alter function public.fn_chat_channels(uuid) rename to fn_chat_channels_impl;
create or replace function public.fn_chat_channels(p_profile_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_chat_channels_impl(p_profile_id); end $$;

alter function public.fn_chat_create_channel(uuid, text, text) rename to fn_chat_create_channel_impl;
create or replace function public.fn_chat_create_channel(
  p_profile_id uuid, p_nombre text, p_descripcion text default null::text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_chat_create_channel_impl(p_profile_id, p_nombre, p_descripcion); end $$;

alter function public.fn_chat_messages(uuid, uuid, integer) rename to fn_chat_messages_impl;
create or replace function public.fn_chat_messages(
  p_profile_id uuid, p_channel_id uuid, p_limit integer default 120)
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_chat_messages_impl(p_profile_id, p_channel_id, p_limit); end $$;

alter function public.fn_chat_read(uuid, uuid) rename to fn_chat_read_impl;
create or replace function public.fn_chat_read(p_profile_id uuid, p_channel_id uuid)
returns void language plpgsql security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      perform public.fn_chat_read_impl(p_profile_id, p_channel_id); end $$;

alter function public.fn_chat_send(uuid, uuid, text, text, text, uuid) rename to fn_chat_send_impl;
create or replace function public.fn_chat_send(
  p_profile_id uuid, p_channel_id uuid, p_body text,
  p_attachment_path text default null::text, p_attachment_type text default null::text,
  p_reply_to uuid default null::uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_chat_send_impl(p_profile_id, p_channel_id, p_body,
                                      p_attachment_path, p_attachment_type, p_reply_to); end $$;

-- ── 9-11. Documentos ───────────────────────────────────────────────────────
alter function public.fn_docs_listar(uuid) rename to fn_docs_listar_impl;
create or replace function public.fn_docs_listar(p_profile_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_docs_listar_impl(p_profile_id); end $$;

alter function public.fn_doc_guardar(uuid, text, text, text, date, date) rename to fn_doc_guardar_impl;
create or replace function public.fn_doc_guardar(
  p_profile_id uuid, p_titulo text, p_contenido text,
  p_tipo text default 'informe'::text, p_desde date default null::date, p_hasta date default null::date)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_doc_guardar_impl(p_profile_id, p_titulo, p_contenido,
                                        p_tipo, p_desde, p_hasta); end $$;

alter function public.fn_doc_link_agregar(uuid, text, text) rename to fn_doc_link_agregar_impl;
create or replace function public.fn_doc_link_agregar(p_profile_id uuid, p_titulo text, p_url text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_doc_link_agregar_impl(p_profile_id, p_titulo, p_url); end $$;

-- ── 12-15. Informe de avances y sus notas ──────────────────────────────────
alter function public.fn_informe_avances(uuid, integer, date, date) rename to fn_informe_avances_impl;
create or replace function public.fn_informe_avances(
  p_profile_id uuid, p_dias integer default 15,
  p_desde date default null::date, p_hasta date default null::date)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_informe_avances_impl(p_profile_id, p_dias, p_desde, p_hasta); end $$;

alter function public.fn_informe_notas_listar(uuid, date, date) rename to fn_informe_notas_listar_impl;
create or replace function public.fn_informe_notas_listar(
  p_profile_id uuid, p_desde date default null::date, p_hasta date default null::date)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_informe_notas_listar_impl(p_profile_id, p_desde, p_hasta); end $$;

alter function public.fn_informe_nota_agregar(uuid, text, date, date) rename to fn_informe_nota_agregar_impl;
create or replace function public.fn_informe_nota_agregar(
  p_profile_id uuid, p_texto text, p_desde date default null::date, p_hasta date default null::date)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_informe_nota_agregar_impl(p_profile_id, p_texto, p_desde, p_hasta); end $$;

alter function public.fn_informe_nota_borrar(uuid, uuid) rename to fn_informe_nota_borrar_impl;
create or replace function public.fn_informe_nota_borrar(p_profile_id uuid, p_nota_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_informe_nota_borrar_impl(p_profile_id, p_nota_id); end $$;

-- ── 16-17. Caja ────────────────────────────────────────────────────────────
alter function public.fn_fin_cuenta_cobro_persona(uuid, text, numeric, date, date)
  rename to fn_fin_cuenta_cobro_persona_impl;
create or replace function public.fn_fin_cuenta_cobro_persona(
  p_profile_id uuid, p_persona text default null::text, p_monto numeric default null::numeric,
  p_desde date default null::date, p_hasta date default null::date)
returns text language plpgsql security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_fin_cuenta_cobro_persona_impl(p_profile_id, p_persona, p_monto,
                                                     p_desde, p_hasta); end $$;

alter function public.fn_fin_invoice_set_monto(uuid, uuid, numeric) rename to fn_fin_invoice_set_monto_impl;
create or replace function public.fn_fin_invoice_set_monto(
  p_profile_id uuid, p_invoice_id uuid, p_monto numeric)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $$ declare v uuid := auth.uid();
begin if v is not null then p_profile_id := v; end if;
      return public.fn_fin_invoice_set_monto_impl(p_profile_id, p_invoice_id, p_monto); end $$;

-- ── Permisos: la persona logueada SÍ, la llave pública NO ───────────────────
do $permisos$
declare f text; firma text;
begin
  foreach f in array array[
    'fn_comando_nsg(uuid)',
    'fn_mkt_intel(uuid)',
    'fn_llamada_en_curso(uuid)',
    'fn_chat_channels(uuid)',
    'fn_chat_create_channel(uuid,text,text)',
    'fn_chat_messages(uuid,uuid,integer)',
    'fn_chat_read(uuid,uuid)',
    'fn_chat_send(uuid,uuid,text,text,text,uuid)',
    'fn_docs_listar(uuid)',
    'fn_doc_guardar(uuid,text,text,text,date,date)',
    'fn_doc_link_agregar(uuid,text,text)',
    'fn_informe_avances(uuid,integer,date,date)',
    'fn_informe_notas_listar(uuid,date,date)',
    'fn_informe_nota_agregar(uuid,text,date,date)',
    'fn_informe_nota_borrar(uuid,uuid)',
    'fn_fin_cuenta_cobro_persona(uuid,text,numeric,date,date)',
    'fn_fin_invoice_set_monto(uuid,uuid,numeric)'
  ] loop
    firma := 'public.' || f;
    execute format('revoke all on function %s from public, anon', firma);
    execute format('grant execute on function %s to authenticated, service_role', firma);
    -- el cuerpo real queda alcanzable SOLO por dentro (la de paso lo llama):
    execute format('revoke all on function %s from public, anon, authenticated',
                   replace(firma, '(', '_impl('));
  end loop;
end $permisos$;
