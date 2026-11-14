-- =====================================================================
-- 1) Correção: a busca não conseguia registrar o histórico
--    kb_search() roda com as permissões de quem pesquisa (security invoker) e grava em
--    kb_search_log, mas a tabela não tinha regra de INSERT. Com p_log = true a busca inteira
--    falhava ("new row violates row-level security policy"): a página /busca ficava vazia e
--    "Buscas sem resultado", sugestões populares e lembretes de lacunas nunca tinham dados.
--    Cada membro pode gravar apenas as próprias buscas (leitura continua só para moderação).
-- =====================================================================
drop policy if exists kb_search_log_insert on public.kb_search_log;
create policy kb_search_log_insert on public.kb_search_log for insert to authenticated
  with check (user_id = (select auth.uid()) and public.kb_is_member());

-- =====================================================================
-- 2) Desempenho das regras de acesso (mesma lógica de antes)
--    auth.uid() dentro de (select …) é calculado uma vez por consulta, não uma vez por linha.
-- =====================================================================
alter policy kb_attachments_delete on public.kb_attachments using ((kb_is_moderator() OR (EXISTS ( SELECT 1
   FROM kb_tutorials t
  WHERE ((t.id = kb_attachments.tutorial_id) AND (t.author_id = (select auth.uid())))))));
alter policy kb_autosaves_own on public.kb_autosaves using ((user_id = (select auth.uid()))) with check (((user_id = (select auth.uid())) AND kb_is_member()));
alter policy kb_comments_delete on public.kb_comments using (((user_id = (select auth.uid())) OR kb_is_moderator()));
alter policy kb_comments_insert on public.kb_comments with check ((kb_is_member() AND (user_id = (select auth.uid())) AND (resolved = false)));
alter policy kb_comments_update on public.kb_comments using ((kb_is_member() AND ((user_id = (select auth.uid())) OR kb_is_moderator() OR (EXISTS ( SELECT 1
   FROM kb_tutorials t
  WHERE ((t.id = kb_comments.tutorial_id) AND (t.author_id = (select auth.uid())))))))) with check (kb_is_member());
alter policy kb_favorites_own on public.kb_favorites using ((user_id = (select auth.uid()))) with check (((user_id = (select auth.uid())) AND kb_is_member()));
alter policy kb_feedback_write on public.kb_feedback using ((user_id = (select auth.uid()))) with check (((user_id = (select auth.uid())) AND kb_is_member()));
alter policy kb_follows_own on public.kb_follows using ((user_id = (select auth.uid()))) with check (((user_id = (select auth.uid())) AND kb_is_member()));
alter policy kb_prefs_own on public.kb_notification_prefs using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy kb_notifications_delete on public.kb_notifications using ((user_id = (select auth.uid())));
alter policy kb_notifications_own on public.kb_notifications using ((user_id = (select auth.uid())));
alter policy kb_notifications_update on public.kb_notifications using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy kb_profiles_delete_admin on public.kb_profiles using ((kb_is_admin() AND (id <> (select auth.uid()))));
alter policy kb_profiles_select on public.kb_profiles using (((id = (select auth.uid())) OR kb_is_member()));
alter policy kb_profiles_update_self on public.kb_profiles using (((id = (select auth.uid())) OR kb_is_admin())) with check (((id = (select auth.uid())) OR kb_is_admin()));
alter policy kb_push_own on public.kb_push_subscriptions using ((user_id = (select auth.uid()))) with check (((user_id = (select auth.uid())) AND kb_is_member()));
alter policy kb_request_votes_write on public.kb_request_votes using ((user_id = (select auth.uid()))) with check (((user_id = (select auth.uid())) AND kb_is_member()));
alter policy kb_requests_delete on public.kb_requests using ((kb_is_moderator() OR ((user_id = (select auth.uid())) AND kb_is_member())));
alter policy kb_requests_insert on public.kb_requests with check ((kb_is_member() AND (user_id = (select auth.uid()))));
alter policy kb_requests_update on public.kb_requests using ((kb_is_moderator() OR ((user_id = (select auth.uid())) AND kb_is_member()))) with check ((kb_is_moderator() OR ((user_id = (select auth.uid())) AND kb_is_member())));
alter policy kb_thanks_own on public.kb_thanks using ((user_id = (select auth.uid()))) with check (((user_id = (select auth.uid())) AND kb_is_member()));
alter policy kb_trail_progress_del on public.kb_trail_progress using ((user_id = (select auth.uid())));
alter policy kb_trail_progress_own on public.kb_trail_progress with check (((user_id = (select auth.uid())) AND kb_is_member()));
alter policy kb_tutorials_delete on public.kb_tutorials using ((kb_is_moderator() OR ((author_id = (select auth.uid())) AND kb_is_member())));
alter policy kb_tutorials_select on public.kb_tutorials using ((kb_is_member() AND ((status = 'published'::text) OR (author_id = (select auth.uid())) OR kb_is_moderator())));
alter policy kb_tutorials_update on public.kb_tutorials using ((kb_is_moderator() OR (kb_is_member() AND ((author_id = (select auth.uid())) OR (status = 'published'::text))))) with check ((kb_is_moderator() OR (kb_is_member() AND ((author_id = (select auth.uid())) OR (status = 'published'::text)))));

-- =====================================================================
-- 3) Índices nas ligações entre tabelas (joins e exclusões em cascata mais rápidos)
-- =====================================================================
create index if not exists kb_attachments_uploaded_by_idx on public.kb_attachments (uploaded_by);
create index if not exists kb_comments_parent_id_idx on public.kb_comments (parent_id);
create index if not exists kb_comments_resolved_by_idx on public.kb_comments (resolved_by);
create index if not exists kb_comments_user_id_idx on public.kb_comments (user_id);
create index if not exists kb_favorites_tutorial_id_idx on public.kb_favorites (tutorial_id);
create index if not exists kb_feedback_user_id_idx on public.kb_feedback (user_id);
create index if not exists kb_follows_author_id_idx on public.kb_follows (author_id);
create index if not exists kb_follows_category_id_idx on public.kb_follows (category_id);
create index if not exists kb_locations_created_by_idx on public.kb_locations (created_by);
create index if not exists kb_notifications_actor_id_idx on public.kb_notifications (actor_id);
create index if not exists kb_notifications_tutorial_id_idx on public.kb_notifications (tutorial_id);
create index if not exists kb_push_subscriptions_user_id_idx on public.kb_push_subscriptions (user_id);
create index if not exists kb_request_votes_user_id_idx on public.kb_request_votes (user_id);
create index if not exists kb_requests_answered_by_idx on public.kb_requests (answered_by);
create index if not exists kb_requests_category_id_idx on public.kb_requests (category_id);
create index if not exists kb_requests_tutorial_id_idx on public.kb_requests (tutorial_id);
create index if not exists kb_requests_user_id_idx on public.kb_requests (user_id);
create index if not exists kb_search_log_user_id_idx on public.kb_search_log (user_id);
create index if not exists kb_thanks_user_id_idx on public.kb_thanks (user_id);
create index if not exists kb_trail_items_tutorial_id_idx on public.kb_trail_items (tutorial_id);
create index if not exists kb_trail_progress_tutorial_id_idx on public.kb_trail_progress (tutorial_id);
create index if not exists kb_trail_progress_user_id_idx on public.kb_trail_progress (user_id);
create index if not exists kb_trails_created_by_idx on public.kb_trails (created_by);
create index if not exists kb_tutorial_versions_edited_by_idx on public.kb_tutorial_versions (edited_by);
create index if not exists kb_tutorials_reviewed_by_idx on public.kb_tutorials (reviewed_by);
create index if not exists kb_tutorials_updated_by_idx on public.kb_tutorials (updated_by);
create index if not exists kb_tutorials_verified_by_idx on public.kb_tutorials (verified_by);
