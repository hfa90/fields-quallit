// Envia notificações por e-mail via Resend (https://resend.com).
//  POST {notification_id}  -> e-mail imediato (preferência "instant")
//  POST {digest: true}     -> resumo diário (preferência "daily"), chamado pelo pg_cron
//  POST {test_user_id}     -> e-mail de teste para o administrador
// Todas as chamadas exigem o header x-kb-secret (gerado no banco).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

interface N { id: number; user_id: string; type: string; title: string; body: string | null; link: string | null; created_at: string }

function layout(appUrl: string, heading: string, inner: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;color:#1c1c1e">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#1a9ca9;padding:20px 24px">
  <table cellpadding="0" cellspacing="0"><tr>
    <td><img src="${appUrl}/icons/icon-192.png" width="36" height="36" alt="Quallit" style="display:block;border-radius:9px" /></td>
    <td style="padding-left:12px;color:#fff"><div style="font-size:16px;font-weight:700">Fields</div><div style="font-size:12px;opacity:.85">Quallit Soluções em TI</div></td>
  </tr></table>
</td></tr>
<tr><td style="padding:24px">
  <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${esc(heading)}</h1>
  ${inner}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #ededf0;font-size:12px;color:#8e8e93">
  Você recebe este e-mail porque usa a central de tutoriais Fields.
  <a href="${appUrl}/notificacoes" style="color:#15828d">Alterar preferências de e-mail</a>
</td></tr>
</table></td></tr></table></body></html>`
}

function item(appUrl: string, n: N) {
  const url = `${appUrl}${n.link ?? '/'}`
  return `<a href="${url}" style="display:block;text-decoration:none;color:inherit;padding:14px 16px;margin-bottom:10px;border-radius:12px;background:#f5f5f7">
  <div style="font-size:15px;font-weight:600;color:#1c1c1e">${esc(n.title)}</div>
  ${n.body ? `<div style="font-size:14px;color:#636366;margin-top:4px">${esc(n.body)}</div>` : ''}
  <div style="font-size:13px;color:#15828d;margin-top:6px;font-weight:600">Abrir →</div></a>`
}

async function send(cfg: Record<string, string>, to: string, subject: string, html: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.resend_api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: cfg.email_from || 'Fields <onboarding@resend.dev>', to: [to], subject, html }),
  })
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`)
}

Deno.serve(async req => {
  try {
    const { data } = await sb.from('kb_private').select('key,value')
    const cfg = Object.fromEntries((data ?? []).map(r => [r.key, r.value])) as Record<string, string>
    if (req.headers.get('x-kb-secret') !== cfg.push_secret) return json({ error: 'unauthorized' }, 401)
    if (!cfg.resend_api_key) return json({ skipped: 'email não configurado' })
    const appUrl = cfg.app_url || 'https://hfa90.github.io/fields-quallit'
    const body = await req.json()

    const emailOf = async (uid: string) => {
      const { data: p } = await sb.from('kb_profiles').select('email, full_name, role').eq('id', uid).maybeSingle()
      return p && ['admin', 'field_admin', 'field'].includes(p.role) ? p : null
    }

    if (body.test_user_id) {
      const p = await emailOf(body.test_user_id)
      if (!p) return json({ error: 'usuário não encontrado' }, 404)
      await send(cfg, p.email, 'Teste de e-mail · Fields',
        layout(appUrl, 'O e-mail está funcionando ✅', `<p style="font-size:15px;color:#3a3a3c">Olá, ${esc(p.full_name ?? '')}. As notificações por e-mail da central Fields estão configuradas corretamente.</p>`))
      return json({ sent: 1 })
    }

    if (body.notification_id) {
      const { data: n } = await sb.from('kb_notifications').select('*').eq('id', body.notification_id).is('emailed_at', null).maybeSingle()
      if (!n) return json({ sent: 0 })
      const p = await emailOf(n.user_id)
      if (!p) return json({ sent: 0 })
      await send(cfg, p.email, n.title, layout(appUrl, n.title, item(appUrl, n as N)))
      await sb.from('kb_notifications').update({ emailed_at: new Date().toISOString() }).eq('id', n.id)
      return json({ sent: 1 })
    }

    if (body.digest) {
      const since = new Date(Date.now() - 7 * 864e5).toISOString()
      const { data: rows } = await sb.from('kb_notifications').select('*').is('read_at', null).is('emailed_at', null).gte('created_at', since).order('created_at', { ascending: false }).limit(2000)
      const { data: prefs } = await sb.from('kb_notification_prefs').select('user_id, email_mode')
      const mode = new Map((prefs ?? []).map(p => [p.user_id, p.email_mode]))
      const byUser = new Map<string, N[]>()
      for (const n of (rows ?? []) as N[]) {
        if ((mode.get(n.user_id) ?? 'daily') !== 'daily') continue
        byUser.set(n.user_id, [...(byUser.get(n.user_id) ?? []), n])
      }
      let sent = 0
      for (const [uid, list] of byUser) {
        const p = await emailOf(uid)
        if (!p) continue
        const top = list.slice(0, 15)
        const extra = list.length - top.length
        const html = layout(appUrl, `Você tem ${list.length} novidade${list.length > 1 ? 's' : ''} na central`,
          top.map(n => item(appUrl, n)).join('') +
          (extra > 0 ? `<p style="font-size:14px;color:#636366">E mais ${extra}…</p>` : '') +
          `<p style="margin-top:20px"><a href="${appUrl}/notificacoes" style="display:inline-block;background:#15828d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:15px">Ver todas as notificações</a></p>`)
        try {
          await send(cfg, p.email, `Resumo do dia · ${list.length} novidade${list.length > 1 ? 's' : ''} no Fields`, html)
          await sb.from('kb_notifications').update({ emailed_at: new Date().toISOString() }).in('id', list.map(n => n.id))
          sent++
        } catch (e) { console.error('falha para', uid, (e as Error).message) }
      }
      return json({ sent })
    }
    return json({ error: 'requisição inválida' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
