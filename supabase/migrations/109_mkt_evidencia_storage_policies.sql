-- 109: subir evidencia (foto/video) del módulo Marketing desde la web.
-- Bucket privado 'evidencia', carpeta acotada mkt/<organization_id>/... — solo rol marketing/admin.
-- Aditivo. Aplicada a stratos-prod el 21-jul-2026.
drop policy if exists evidencia_mkt_insert on storage.objects;
create policy evidencia_mkt_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = 'mkt'
    and (storage.foldername(name))[2] = (current_organization_id())::text
    and is_marketing_or_above());
drop policy if exists evidencia_mkt_select on storage.objects;
create policy evidencia_mkt_select on storage.objects for select to authenticated
  using (bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = 'mkt'
    and (storage.foldername(name))[2] = (current_organization_id())::text
    and is_marketing_or_above());
-- Rollback: drop policy evidencia_mkt_insert on storage.objects; drop policy evidencia_mkt_select on storage.objects;
