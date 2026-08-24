-- ═══════════════════════════════════════════════════════════════════════════
-- EL CENTINELA — que esto no vuelva a romperse en silencio (24-ago-2026)
-- (aplicada como 20260824213217_qa_centinela_permisos_de_las_rpc_del_front)
--
-- La lección de hoy no es «faltaba un permiso». Es que **una función se puede
-- cerrar sin que nadie se entere de que la aplicación la usaba**: la pantalla
-- muere, nadie prueba esa pantalla, y el fallo vive semanas. Pasó con el
-- historial del Copilot y con 17 pantallas más al mismo tiempo.
--
-- Un comentario que diga «acordate de revisar los permisos» no sirve: la
-- seguridad —y esto— son LLAVES, no recordatorios. Así que queda una prueba que
-- se puede correr en un segundo, desde una sesión, desde el operador o desde el
-- propio Copilot:
--
--     select * from fn_qa_rpc_del_front();          -- todo
--     select * from fn_qa_rpc_del_front() where estado <> 'OK';   -- solo lo roto
--
-- Devuelve una fila por problema:
--   · CERRADA PARA LA APP → la persona logueada no puede ejecutarla (el bug de hoy)
--   · ABIERTA A ANONIMOS  → la llave pública del JavaScript puede ejecutarla (peor)
--   · NO EXISTE           → el front llama algo que ya no está en la base
--
-- La lista se llena con las RPC que el código del front llama de verdad
-- (`supabase.rpc('...')`). Del lado del repo, `npm run verificar-rpc` compara el
-- código contra esta lista y falla si alguien agrega una RPC nueva sin registrarla
-- — así el registro no envejece solo.
-- Reversa: drop function fn_qa_rpc_del_front(); drop table front_rpc_registry;
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.front_rpc_registry (
  nombre text primary key,
  nota   text,
  agregado_el timestamptz not null default now()
);
comment on table public.front_rpc_registry is
  'Las funciones que el CRM llama por supabase.rpc(). La prueba fn_qa_rpc_del_front() las cruza contra los permisos reales. Se refresca con: npm run verificar-rpc (repo stratos-ai-application).';

alter table public.front_rpc_registry enable row level security;  -- sin policies: tooling interno

insert into public.front_rpc_registry (nombre, nota) values
 ('add_expediente_item','expediente del cliente'),
 ('copilot_agenda_create_from_text','Copilot: crear en la agenda'),
 ('copilot_handle_callback','Copilot: botones'),
 ('copilot_handle_pending','Copilot: confirmaciones'),
 ('copilot_log_msg','Copilot: GUARDAR el mensaje en el historial'),
 ('copilot_log_msg_media','Copilot: guardar foto/video en el historial'),
 ('copilot_send','Copilot: enviar'),
 ('create_lead','CRM: alta de cliente'),
 ('create_portfolio_link','link de portafolio'),
 ('find_lead_duplicate','CRM: evitar duplicados'),
 ('fn_assign_team_action','equipo: asignar'),
 ('fn_bulk_reassign_leads','CRM: reasignar en lote'),
 ('fn_call_targets','llamadas: a quién'),
 ('fn_chat_channels','chat del equipo: canales'),
 ('fn_chat_create_channel','chat del equipo: crear canal'),
 ('fn_chat_messages','chat del equipo: mensajes'),
 ('fn_chat_read','chat del equipo: marcar leído'),
 ('fn_chat_send','chat del equipo: enviar'),
 ('fn_claim_lead','CRM: tomar un cliente'),
 ('fn_comando_nsg','pantalla Comando'),
 ('fn_doc_guardar','documentos: guardar'),
 ('fn_doc_link_agregar','documentos: agregar link'),
 ('fn_docs_listar','documentos: listar'),
 ('fn_fin_cuenta_cobro_cliente','caja: cuenta de cobro (cliente)'),
 ('fn_fin_cuenta_cobro_persona','caja: cuenta de cobro (persona)'),
 ('fn_fin_invoice_set_monto','caja: fijar monto'),
 ('fn_fin_invoices_list','caja: listado'),
 ('fn_fin_set_nomina','caja: nómina'),
 ('fn_get_my_recovery_email','perfil: correo de recuperación'),
 ('fn_get_my_timezone','perfil: zona horaria'),
 ('fn_informe_avances','informe de avances'),
 ('fn_informe_borrador','informe: borrador'),
 ('fn_informe_nota_agregar','informe: nota del equipo'),
 ('fn_informe_nota_borrar','informe: borrar nota'),
 ('fn_informe_notas_listar','informe: listar notas'),
 ('fn_llamada_en_curso','llamada en curso'),
 ('fn_mkt_intel','marketing: inteligencia'),
 ('fn_org_copilot_responder','Copilot: el cerebro que RESPONDE'),
 ('fn_org_team_members','equipo de la empresa'),
 ('fn_set_my_recovery_email','perfil: fijar correo de recuperación'),
 ('fn_set_my_timezone','perfil: fijar zona horaria'),
 ('fn_start_team_call','llamada al equipo'),
 ('fn_team_users','equipo: usuarios'),
 ('fn_wa_conversations','WhatsApp: bandeja'),
 ('fn_wa_mark_read','WhatsApp: marcar leído'),
 ('fn_wa_outbox_retry','WhatsApp: reintentar envío'),
 ('fn_wa_toggle_pin','WhatsApp: fijar conversación'),
 ('get_entity_history','historial de un registro'),
 ('get_my_copilot_activity','Copilot: LEER el historial'),
 ('get_my_telegram_activity','Telegram: actividad'),
 ('mkt_approve_evidence','marketing: aprobar evidencia'),
 ('mkt_attach_evidence_to','marketing: adjuntar evidencia'),
 ('mkt_comment_evidence','marketing: comentar evidencia'),
 ('mkt_evidence_candidates','marketing: candidatos de evidencia'),
 ('rails_agenda_hoy','agenda del día'),
 ('rails_marcar_accion','agenda: marcar acción'),
 ('request_telegram_pairing_code','vincular Telegram'),
 ('resolve_portfolio_link','abrir link de portafolio')
on conflict (nombre) do nothing;

create or replace function public.fn_qa_rpc_del_front()
returns table(estado text, rpc text, firma text, para_que text)
language sql stable security definer set search_path to 'public','pg_temp'
as $$
  select
    case
      when p.oid is null                                                then 'NO EXISTE'
      when has_function_privilege('anon', p.oid, 'EXECUTE')             then 'ABIERTA A ANONIMOS'
      when not has_function_privilege('authenticated', p.oid,'EXECUTE') then 'CERRADA PARA LA APP'
      else 'OK'
    end as estado,
    r.nombre,
    coalesce(pg_get_function_identity_arguments(p.oid), '—'),
    r.nota
  from public.front_rpc_registry r
  left join pg_proc p
    on p.proname = r.nombre and p.pronamespace = 'public'::regnamespace
  order by 1, 2;
$$;

comment on function public.fn_qa_rpc_del_front() is
  'Centinela: cruza las RPC que llama el CRM contra los permisos reales. Cualquier fila con estado <> OK es una pantalla rota (o un agujero). Nació el 24-ago-2026, cuando un permiso revocado dejó sin historial al Copilot y sin datos a 17 pantallas más, y nadie se enteró hasta que un usuario lo reportó.';

revoke all on function public.fn_qa_rpc_del_front() from public, anon;
grant execute on function public.fn_qa_rpc_del_front() to authenticated, service_role;
