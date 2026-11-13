/*
 * Teste de fumaça das telas (rodar no console do navegador com o app aberto em modo dev).
 * Simula uma sessão de administrador e respostas do servidor com dados de exemplo,
 * visita todas as rotas e lista as que mostrarem a tela de erro.
 * Uso: cole este arquivo no console em http://localhost:5173/ e chame await fieldsSmokeTest()
 */
window.fieldsSmokeSetup = function () {
  const uid = '00000000-0000-4000-8000-000000000001'
  const b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const exp = Math.floor(Date.now() / 1000) + 3600
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, exp, role: 'authenticated', aud: 'authenticated' })}.x`
  const now = new Date().toISOString()
  localStorage.setItem('fq-kb-auth', JSON.stringify({ access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'falso', user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'teste@exemplo.invalid', app_metadata: {}, user_metadata: {}, created_at: now } }))
  localStorage.setItem(`fq-profile:${uid}`, JSON.stringify({ id: uid, email: 'teste@exemplo.invalid', full_name: 'Teste Local', avatar_url: null, role: 'admin', created_at: now, updated_at: now }))
  localStorage.setItem('fq-install', JSON.stringify({ never: true }))
  localStorage.setItem('fq-seen-version', '0')
}

window.fieldsSmokeTest = async function () {
  const uid = '00000000-0000-4000-8000-000000000001'
  const now = new Date().toISOString()
  const author = { id: uid, full_name: 'Teste Local', email: 'teste@exemplo.invalid', avatar_url: null }
  const cat = { id: 'c1', name: 'Redes & VPN', icon: 'network', color: '#1a9ca9', sort_order: 1 }
  const listItem = (id, code, kind, verified) => ({ id, short_code: code, title: `Tutorial ${code}`, summary: 'Resumo', category_id: 'c1', tags: ['vpn'], difficulty: 'basico', status: 'published', author_id: uid, created_at: now, updated_at: now, author_name: 'Teste Local', author_avatar: null, category_name: 'Redes & VPN', category_color: '#1a9ca9', category_icon: 'network', viewer_count: 3, view_count: 5, attachment_count: 1, helpful_count: 2, not_helpful_count: 0, comment_count: 1, outdated_count: 0, review_due: false, reviewed_at: now, verified, verified_at: verified ? now : null, verified_by_name: verified ? 'Teste Local' : null, kind, thanks_count: 2, contributors_count: 1, author_cd: 'CD RIO DE JANEIRO' })
  const tut = { ...listItem('t1', 'TESTE1', 'quick', true), content_html: '<div data-callout="info"><p><strong>Problema:</strong> x</p></div><h2>Como resolver</h2><ol><li><p>Passo</p></li></ol><pre><code class="language-bash">ls</code></pre>', content_json: null, updated_by: 'u2', review_interval_months: 6, reviewed_by: uid, verified_by: uid, author, editor: { full_name: 'Colega Field' }, verifier: { full_name: 'Teste Local' }, category: cat }
  const stats = { user_id: uid, full_name: 'Teste Local', avatar_url: null, email: 'teste@exemplo.invalid', role: 'admin', created_at: now, tutorials: 2, helpful_received: 2, comments: 1, requests_answered: 0, views_received: 5, followers: 1, points: 42, cd_name: 'CD RIO DE JANEIRO' }
  const tables = {
    kb_tutorials_list: [listItem('t1', 'TESTE1', 'quick', true), listItem('t2', 'TESTE2', 'tutorial', false)],
    kb_tutorials: [tut], kb_categories: [cat], kb_user_stats: [stats, { ...stats, user_id: 'u2', full_name: 'Colega Field', tutorials: 0, points: 5, cd_name: 'CD MANAUS' }],
    kb_profiles: [{ ...author, role: 'admin', created_at: now, updated_at: now }, { id: 'u2', full_name: 'Colega Field', email: 'colega@exemplo.invalid', avatar_url: null, role: 'field', created_at: now, updated_at: now }],
    kb_comments: [{ id: 'm1', tutorial_id: 't1', request_id: null, parent_id: null, user_id: uid, kind: 'tip', body: 'Dica', resolved: false, created_at: now, updated_at: now, author }],
    kb_thanks: [{ user_id: 'u2', message: 'Salvou meu dia!', created_at: now, user: { full_name: 'Colega', email: 'c@exemplo.invalid', avatar_url: null }, tutorial: { title: 'Tutorial TESTE1', short_code: 'TESTE1', author_id: uid } }],
    kb_trails: [{ id: 'tr1', title: 'Onboarding', description: 'Primeiros passos', color: '#1a9ca9', icon: 'book-open', status: 'published', created_at: now, items: [{ count: 2 }] }],
  }
  const rpc = {
    kb_impact: { tutorials: 2, views: 5, people: 3, cds: ['CD RIO DE JANEIRO', 'CD MANAUS'], helpful: 2, thanks: 2, cd: 'CD RIO DE JANEIRO' },
    kb_search_gaps: [{ query: 'coletor não sincroniza', people: 3, searches: 4, last_at: now }],
    kb_search_suggestions: { popular: ['vpn'], tags: ['vpn'], missing: [] },
    kb_search: [{ kind: 'tutorial', id: 't1', short_code: 'TESTE1', title: 'Tutorial TESTE1', snippet: 'com [[vpn]]', category_name: 'Redes', category_color: '#1a9ca9', category_icon: 'network', author_name: 'Teste', author_avatar: null, matched_in: 'título', score: 1, created_at: now, verified: true }],
    kb_my_recent: [{ tutorial_id: 't1', last_viewed: now }], kb_tutorial_viewers: [], kb_email_config_status: {},
    kb_admin_user_info: { published: 2, drafts: 1, inventory: false, owner: false, me: false },
    kb_cd_of: 'CD RIO DE JANEIRO', kb_list_cds: [{ id: 'cd1', codigo: 'CD-RJ', nome: 'CD RIO DE JANEIRO', cidade: 'RIO DE JANEIRO', uf: 'RJ', origem: 'inventario' }, { id: 'cd2', codigo: 'CD-AM', nome: 'CD MANAUS', cidade: 'MANAUS', uf: 'AM', origem: 'inventario' }, { id: 'cd3', codigo: null, nome: 'CD RECIFE', cidade: 'Recife', uf: 'PE', origem: 'fields' }],
    kb_contributors: [{ user_id: 'u2', full_name: 'Colega Field', avatar_url: null, edits: 2, last_at: now }],
  }
  const orig = window.__origFetch || window.fetch
  window.__origFetch = orig
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url
    if (!url.includes('/rest/v1/') && !url.includes('/functions/v1/') && !url.includes('/storage/v1/')) return orig(input, init)
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined))
    const single = (headers.get('accept') || '').includes('vnd.pgrst.object')
    const json = (b, extra = {}) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': '0-1/2', ...extra } })
    if (url.includes('/storage/v1/')) return json([])
    if (url.includes('/functions/v1/')) return json({ ok: true })
    const m = url.match(/\/rest\/v1\/(rpc\/)?([a-z_]+)/)
    if (m?.[1]) return json(rpc[m[2]] ?? null)
    let rows = tables[m?.[2]] ?? []
    // filtros simples ?coluna=eq.valor
    for (const [k, v] of new URL(url).searchParams) if (v.startsWith('eq.') && rows.some(r => k in r)) rows = rows.filter(r => String(r[k]) === v.slice(3))
    if ((init.method || 'GET') === 'HEAD') return new Response(null, { status: 200, headers: { 'Content-Range': `0-${rows.length}/${rows.length}` } })
    return json(single ? (rows[0] ?? {}) : rows)
  }

  const routes = ['/', '/meus', '/meus?aba=favoritos', '/meus?aba=recentes', '/meus?aba=offline', '/busca?q=vpn', '/notificacoes',
    '/comunidade', '/comunidade?aba=ranking', '/comunidade?aba=atividade', '/trilhas', '/trilhas/tr1', `/pessoa/${uid}`, '/t/TESTE1',
    '/t/TESTE1/editar', '/novo', '/dica', '/dica?problema=coletor', '/perfil', '/admin', '/rota-inexistente']
  const results = []
  for (const r of routes) {
    history.pushState({}, '', r); dispatchEvent(new PopStateEvent('popstate'))
    await new Promise(res => setTimeout(res, 1800))
    const text = document.body.innerText
    const broken = text.includes('Não foi possível abrir esta tela') || text.includes('O Fields foi atualizado')
    const empty = (document.querySelector('main')?.innerText.trim().length ?? 0) < 5
    results.push({ rota: r, ok: !broken && !empty, ...(broken ? { erro: 'tela de erro' } : empty ? { erro: 'tela vazia' } : {}) })
  }
  // abas da Administração
  history.pushState({}, '', '/admin'); dispatchEvent(new PopStateEvent('popstate'))
  await new Promise(res => setTimeout(res, 1500))
  for (const label of ['Categorias', 'Estatísticas', 'Revisões', 'Backup', 'Usuários e acessos']) {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === label)
    btn?.click()
    await new Promise(res => setTimeout(res, 1200))
    const broken = document.body.innerText.includes('Não foi possível abrir esta tela')
    results.push({ rota: `/admin → ${label}`, ok: !!btn && !broken, ...(!btn ? { erro: 'aba não encontrada' } : broken ? { erro: 'tela de erro' } : {}) })
  }
  return results
}
