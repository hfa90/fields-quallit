// Cópia de segurança da central Fields.
// Chamada toda semana pelo pg_cron (header x-kb-secret) ou por um administrador ("Fazer cópia agora").
// Gera um .zip com todos os dados (JSON) em kb-backups/snapshots/ e copia anexos e imagens
// para kb-backups/files/ (incremental). Mantém as 8 cópias mais recentes.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { zipSync, strToU8 } from 'npm:fflate@0.8.2'

const URL_ = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const KEEP = 8
const BUCKET = 'kb-backups'

// Tabelas exportadas (segredos, inscrições push e rascunhos pessoais ficam de fora)
const TABLES: Record<string, string> = {
  kb_profiles: '*',
  kb_settings: '*',
  kb_categories: '*',
  kb_tutorials: 'id,short_code,title,summary,content_html,content_json,category_id,tags,difficulty,status,author_id,updated_by,created_at,updated_at,review_interval_months,reviewed_at,reviewed_by,verified_at,verified_by',
  kb_tutorial_versions: '*',
  kb_links: '*',
  kb_attachments: '*',
  kb_comments: '*',
  kb_feedback: '*',
  kb_favorites: '*',
  kb_follows: '*',
  kb_requests: '*',
  kb_request_votes: '*',
  kb_trails: '*',
  kb_trail_items: '*',
  kb_trail_progress: '*',
  kb_views: '*',
  kb_notification_prefs: '*',
  kb_search_log: '*',
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-kb-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
  try {
    // Autorização: agendamento (segredo) ou administrador logado
    const { data: priv } = await admin.from('kb_private').select('value').eq('key', 'push_secret').maybeSingle()
    let by = 'agendamento semanal'
    if (req.headers.get('x-kb-secret') !== priv?.value) {
      const caller = createClient(URL_, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } })
      const { data: isAdmin } = await caller.rpc('kb_is_admin')
      if (!isAdmin) return json({ error: 'Apenas administradores' }, 403)
      const { data: me } = await caller.auth.getUser()
      by = `manual (${me.user?.email ?? 'admin'})`
    }

    // 1) Dados
    const files: Record<string, Uint8Array> = {}
    const counts: Record<string, number> = {}
    for (const [table, cols] of Object.entries(TABLES)) {
      const rows: unknown[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await admin.from(table).select(cols).range(from, from + 999)
        if (error) throw new Error(`${table}: ${error.message}`)
        rows.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }
      counts[table] = rows.length
      files[`dados/${table}.json`] = strToU8(JSON.stringify(rows, null, 1))
    }

    // 2) Arquivos: anexos + imagens/vídeos usados nos tutoriais e fotos de perfil (cópia incremental)
    const tutorials = JSON.parse(new TextDecoder().decode(files['dados/kb_tutorials.json'])) as { content_html: string }[]
    const profiles = JSON.parse(new TextDecoder().decode(files['dados/kb_profiles.json'])) as { avatar_url: string | null }[]
    const attachments = JSON.parse(new TextDecoder().decode(files['dados/kb_attachments.json'])) as { storage_path: string }[]
    const media = new Set<string>()
    const pub = `${URL_}/storage/v1/object/public/kb-images/`
    for (const t of tutorials) for (const m of t.content_html.matchAll(/(?:src)="([^"]+)"/g)) if (m[1].startsWith(pub)) media.add(decodeURIComponent(m[1].slice(pub.length)))
    for (const p of profiles) if (p.avatar_url?.startsWith(pub)) media.add(decodeURIComponent(p.avatar_url.slice(pub.length)))

    const existing = new Set<string>()
    const listAll = async (prefix: string) => {
      const { data } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 })
      for (const it of data ?? []) {
        const p = `${prefix}/${it.name}`
        if (it.id) existing.add(p); else await listAll(p)
      }
    }
    await listAll('files')

    let copied = 0, failed = 0
    const copy = async (bucket: string, path: string) => {
      const dest = `files/${bucket}/${path}`
      if (existing.has(dest)) return
      const { data: blob, error } = await admin.storage.from(bucket).download(path)
      if (error || !blob) { failed++; return }
      const up = await admin.storage.from(BUCKET).upload(dest, blob, { contentType: blob.type || 'application/octet-stream', upsert: true })
      if (up.error) failed++; else copied++
    }
    for (const a of attachments) await copy('kb-attachments', a.storage_path)
    for (const m of media) await copy('kb-images', m)

    // 3) Manifesto + zip
    const now = new Date()
    const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, '-')
    const manifest = {
      sistema: 'Fields · Quallit Soluções em TI', gerado_em: now.toISOString(), origem: by, tabelas: counts,
      arquivos: { anexos: attachments.length, midias: media.size, copiados_nesta_execucao: copied, falhas: failed, pasta: `${BUCKET}/files/` },
      observacao: 'Os anexos e imagens ficam em kb-backups/files/<bucket>/<caminho>. Para restaurar, importe os JSON na mesma estrutura de tabelas kb_.',
    }
    files['manifesto.json'] = strToU8(JSON.stringify(manifest, null, 2))
    const zip = zipSync(files, { level: 6 })
    const name = `snapshots/fields-backup-${stamp}.zip`
    const up = await admin.storage.from(BUCKET).upload(name, zip, { contentType: 'application/zip', upsert: true })
    if (up.error) throw new Error(up.error.message)

    // 4) Retenção: mantém as mais recentes
    const { data: snaps } = await admin.storage.from(BUCKET).list('snapshots', { limit: 1000, sortBy: { column: 'name', order: 'desc' } })
    const old = (snaps ?? []).filter(s => s.name.endsWith('.zip')).slice(KEEP).map(s => `snapshots/${s.name}`)
    if (old.length) await admin.storage.from(BUCKET).remove(old)

    return json({ ok: true, file: name, size: zip.byteLength, counts, copied, failed, removed: old.length })
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
