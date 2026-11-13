// Cadastro de usuários pelo administrador da central Fields.
//  POST { action: 'create', email, full_name, role, password, cd_id? }
//  POST { action: 'reset_password', user_id, password }
//  POST { action: 'delete_user', user_id, transfer_to?, delete_posts? }
// Só administradores da central (kb_profiles.role = 'admin') podem chamar.
// O usuário criado já entra com e-mail confirmado e precisa trocar a senha no primeiro acesso.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const URL_ = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const ROLES = ['admin', 'field_admin', 'field']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // 1) Quem está chamando é administrador?
    const auth = req.headers.get('Authorization') ?? ''
    const caller = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
    const { data: isAdmin, error: e1 } = await caller.rpc('kb_is_admin')
    if (e1 || !isAdmin) return json({ error: 'Apenas administradores podem gerenciar usuários.' }, 403)
    const { data: me } = await caller.auth.getUser()

    const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
    const body = await req.json()

    if (body.action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const full_name = String(body.full_name ?? '').trim()
      const role = String(body.role ?? 'field')
      const password = String(body.password ?? '')
      const cd_id = body.cd_id ? String(body.cd_id) : null
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'E-mail inválido' }, 400)
      if (full_name.length < 2) return json({ error: 'Informe o nome' }, 400)
      if (!ROLES.includes(role)) return json({ error: 'Nível de acesso inválido' }, 400)
      if (password.length < 8) return json({ error: 'A senha precisa ter pelo menos 8 caracteres' }, 400)

      let userId: string | null = null
      let existed = false
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name, must_change_password: true, created_by: me.user?.id },
      })
      if (created?.user) userId = created.user.id
      else if (error && /already|registered|exists/i.test(error.message)) {
        // Já existe no projeto (ex.: usuário do Inventário): só libera o acesso à central, sem mexer na senha
        existed = true
        for (let page = 1; page <= 20 && !userId; page++) {
          const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 })
          userId = list.users.find(u => u.email?.toLowerCase() === email)?.id ?? null
          if (list.users.length < 200) break
        }
        if (!userId) return json({ error: 'Usuário já existe, mas não foi encontrado' }, 409)
      } else if (error) return json({ error: error.message }, 400)

      // O administrador principal nunca é rebaixado
      const { data: owners } = await admin.from('kb_settings').select('value').eq('key', 'owner_emails').maybeSingle()
      const isOwner = ((owners?.value as string[] | undefined) ?? []).some(o => o.toLowerCase() === email)
      const { error: pe } = await admin.from('kb_profiles').upsert({ id: userId, email, full_name, role: isOwner ? 'admin' : role, cd_id }, { onConflict: 'id' })
      if (pe) return json({ error: pe.message }, 400)
      return json({ ok: true, user_id: userId, existed })
    }

    if (body.action === 'reset_password') {
      const password = String(body.password ?? '')
      if (password.length < 8) return json({ error: 'A senha precisa ter pelo menos 8 caracteres' }, 400)
      const { data: prof } = await admin.from('kb_profiles').select('id').eq('id', body.user_id).maybeSingle()
      if (!prof) return json({ error: 'Usuário não encontrado na central' }, 404)
      const { data: u } = await admin.auth.admin.getUserById(body.user_id)
      const { error } = await admin.auth.admin.updateUserById(body.user_id, {
        password, user_metadata: { ...(u.user?.user_metadata ?? {}), must_change_password: true },
      })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (body.action === 'delete_user') {
      const user_id = String(body.user_id ?? '')
      // Regras e transferência/exclusão das publicações ficam no banco (transação única)
      const { data: r, error } = await caller.rpc('kb_admin_remove_user', {
        p_user: user_id, p_transfer_to: body.transfer_to ? String(body.transfer_to) : null, p_delete_posts: !!body.delete_posts,
      })
      if (error) return json({ error: error.message }, 400)
      const res = r as { inventory: boolean; tutorials: number; deleted_posts: boolean; attachments: string[] }
      if (res.attachments?.length) await admin.storage.from('kb-attachments').remove(res.attachments)
      // Conta só do Fields: apaga o login. Quem usa o Inventário mantém a conta (só perde o acesso ao Fields).
      let account_deleted = false
      if (!res.inventory) {
        const { error: de } = await admin.auth.admin.deleteUser(user_id)
        account_deleted = !de
        if (de) console.error('deleteUser', de.message)
      }
      return json({ ok: true, ...res, attachments: res.attachments?.length ?? 0, account_deleted })
    }

    return json({ error: 'Ação inválida' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
