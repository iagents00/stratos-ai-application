-- mig 223c — El chat del Copilot mostraba cada respuesta DOS veces y burbujas fantasma.
-- Evidencia (feed de Ángel 30-jul 12:51-12:54): cada respuesta aparece duplicada porque
-- la escriben DOS manos (el guardado garantizado del motor n8n y el front al recibirla),
-- y el multi además escribía un turno user+ai por cada sub-acción (eso ya lo corta la
-- mig 223 con _sub). Este trigger deja UNA sola voz: un insert idéntico (mismo chat,
-- mismo rol, mismo contenido) dentro de la ventana corta se descarta en silencio.
-- Ventanas: user 20 s (un doble-envío accidental), ai/assistant 90 s (motor vs front).
-- El aviso proactivo real no se ve afectado (contenidos distintos o fuera de ventana).
-- Revertir: drop trigger trg_tg_bot_activity_dedupe on public.tg_bot_activity
-- (con OK humano; es un trigger nuestro, no toca datos).

create or replace function public.tg_bot_activity_dedupe()
returns trigger
language plpgsql
as $fn$
begin
  if exists (
    select 1 from public.tg_bot_activity
     where telegram_chat_id = new.telegram_chat_id
       and role = new.role
       and content = new.content
       and created_at > now() - case when new.role = 'user'
                                     then interval '20 seconds'
                                     else interval '90 seconds' end
  ) then
    return null;  -- misma voz, misma frase, recién dicha: no se repite
  end if;
  return new;
end;
$fn$;

do $do$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tg_bot_activity_dedupe') then
    create trigger trg_tg_bot_activity_dedupe
      before insert on public.tg_bot_activity
      for each row execute function public.tg_bot_activity_dedupe();
  end if;
end
$do$;

-- apoyo del exists (chat + fecha ya suele estar; este cubre el chequeo exacto)
create index if not exists idx_tg_bot_activity_dedupe
  on public.tg_bot_activity (telegram_chat_id, role, created_at desc);