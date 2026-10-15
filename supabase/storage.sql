-- Fotos (tickets, checklists, incidencias) en un bucket privado.
-- Cada usuario solo sube a su carpeta (<su id>/...). Solo el administrador puede verlas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists fotos_subir_propias on storage.objects;
create policy fotos_subir_propias on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text
              and exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo));

drop policy if exists fotos_admin_ver on storage.objects;
create policy fotos_admin_ver on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.es_admin());
