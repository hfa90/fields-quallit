-- Imagens e vídeos dos tutoriais só para membros logados da central.
-- O app continua gravando a URL /object/public/kb-images/<caminho> no HTML (identificador estável);
-- o service worker (public/sw.js) a troca por /object/authenticated/ com o login do usuário,
-- e src/lib/mediaAuth.ts assina o link quando a página não está sob o service worker.
drop policy if exists kb_images_select on storage.objects;
create policy kb_images_select on storage.objects for select to authenticated
  using (bucket_id = 'kb-images' and public.kb_is_member());

update storage.buckets set public = false where id = 'kb-images';
