// Envia notificações push (Web Push) para celulares/navegadores inscritos.
//  GET              -> devolve a chave pública VAPID (gera o par na primeira vez; a privada nunca sai do banco)
//  POST {notification_id} com header x-kb-secret -> envia a notificação (chamado pelo gatilho do banco)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-kb-secret, authorization, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

async function config() {
  const { data, error } = await sb.from('kb_private').select('key,value')
  if (error) throw error
  const cfg = Object.fromEntries((data ?? []).map(r => [r.key, r.value])) as Record<string, string>
  if (!cfg.vapid_public || !cfg.vapid_private) {
    const k = webpush.generateVAPIDKeys()
    await sb.from('kb_private').upsert([
      { key: 'vapid_public', value: k.publicKey },
      { key: 'vapid_private', value: k.privateKey },
    ], { onConflict: 'key', ignoreDuplicates: true })
    // relê para usar o par que de fato ficou gravado (evita corrida)
    const again = await sb.from('kb_private').select('key,value').in('key', ['vapid_public', 'vapid_private'])
    for (const r of again.data ?? []) cfg[r.key] = r.value
  }
  return cfg
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const cfg = await config()
    if (req.method === 'GET') return json({ publicKey: cfg.vapid_public })

    if (req.headers.get('x-kb-secret') !== cfg.push_secret) return json({ error: 'unauthorized' }, 401)
    const { notification_id } = await req.json()
    const { data: n } = await sb.from('kb_notifications').select('*').eq('id', notification_id).maybeSingle()
    if (!n) return json({ sent: 0 })
    const { data: subs } = await sb.from('kb_push_subscriptions').select('*').eq('user_id', n.user_id)
    if (!subs?.length) return json({ sent: 0 })

    webpush.setVapidDetails(cfg.app_url || 'https://hfa90.github.io/fields-quallit', cfg.vapid_public, cfg.vapid_private)
    const { count } = await sb.from('kb_notifications').select('id', { count: 'exact', head: true }).eq('user_id', n.user_id).is('read_at', null)
    const payload = JSON.stringify({
      title: n.title,
      body: n.body ?? '',
      url: `${cfg.app_url}${n.link ?? '/'}`,
      tag: `kb-${n.type}-${n.tutorial_id ?? n.id}`,
      badge: count ?? 0,
    })

    let sent = 0
    await Promise.all(subs.map(async s => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'normal' })
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await sb.from('kb_push_subscriptions').delete().eq('id', s.id)
        else console.error('push falhou', code, (e as Error).message)
      }
    }))
    return json({ sent })
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
