-- Funções auxiliares da central: visitante sem login não executa (aplicada no banco como seguranca_reforco_2)
do $$
declare r record;
begin
  for r in select p.oid::regprocedure f from pg_proc p where p.pronamespace = 'public'::regnamespace
           and p.proname in ('kb_random_code','kb_tags_text','kb_norm','kb_strip_html') loop
    execute format('revoke execute on function %s from public, anon', r.f);
    execute format('grant execute on function %s to authenticated', r.f);
  end loop;
end $$;
