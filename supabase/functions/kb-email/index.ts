// Notificações por e-mail foram desativadas na central Fields.
// Esta função não acessa dados e pode ser excluída pelo painel do Supabase (Edge Functions → kb-email → Delete).
Deno.serve(() => new Response(JSON.stringify({ error: 'e-mail desativado' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))
