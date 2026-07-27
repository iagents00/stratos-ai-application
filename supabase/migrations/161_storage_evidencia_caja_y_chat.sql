-- BUG que reportó Ángel (27-jul): «registré un comprobante, lo adjunté y no se
-- está guardando».
--
-- Causa: el bucket `evidencia` solo tenía permiso para la carpeta `mkt/<org>/`
-- (marketing de Duke). La Caja sube a `caja/<org>/` y el chat del equipo a
-- `chat/<org>/`: las dos rutas quedaban BLOQUEADAS por RLS, así que la subida
-- fallaba en silencio y el botón «Agregar soporte» no dejaba nada.
--
-- Se agregan permisos por carpeta, siempre acotados a la organización de quien
-- sube (`current_organization_id()`), igual que las que ya existían. Nadie puede
-- ver ni escribir en la carpeta de otra empresa.

-- ── Caja: comprobantes de pagos y gastos ──────────────────────────────────────
drop policy if exists evidencia_caja_insert on storage.objects;
create policy evidencia_caja_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = 'caja'
    and (storage.foldername(name))[2] = (current_organization_id())::text
  );

drop policy if exists evidencia_caja_select on storage.objects;
create policy evidencia_caja_select on storage.objects for select to authenticated
  using (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = 'caja'
    and (storage.foldername(name))[2] = (current_organization_id())::text
  );

-- Poder REEMPLAZAR el comprobante (subir uno mejor encima del anterior).
drop policy if exists evidencia_caja_update on storage.objects;
create policy evidencia_caja_update on storage.objects for update to authenticated
  using (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = 'caja'
    and (storage.foldername(name))[2] = (current_organization_id())::text
  )
  with check (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = 'caja'
    and (storage.foldername(name))[2] = (current_organization_id())::text
  );

-- ── Chat del equipo: los adjuntos de los mensajes ─────────────────────────────
drop policy if exists evidencia_chat_insert on storage.objects;
create policy evidencia_chat_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = 'chat'
    and (storage.foldername(name))[2] = (current_organization_id())::text
  );

drop policy if exists evidencia_chat_select on storage.objects;
create policy evidencia_chat_select on storage.objects for select to authenticated
  using (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = 'chat'
    and (storage.foldername(name))[2] = (current_organization_id())::text
  );;
