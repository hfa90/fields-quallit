import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, FolderTree, BarChart3, Search, Plus, Pencil, Trash2, Crown, Eye, BookOpen, UserCheck, Clock, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Category, Profile, Role } from '../lib/types'
import { ROLE_LABEL, ROLE_STYLE, cn, errMsg, fmtDate, timeAgo } from '../lib/utils'
import { Avatar, Button, CategoryIcon, Modal, Spinner, inputCls, labelCls } from '../components/ui'
import { CATEGORY_ICONS } from '../components/categoryIcons'

type Tab = 'users' | 'categories' | 'stats'
const OWNER = 'haydenfernandes.ti@gmail.com'

export default function Admin() {
  const [tab, setTab] = useState<Tab>('users')
  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Administração</h1>
        <p className="text-sm text-slate-500">Gerencie quem acessa a central, as categorias e acompanhe o uso.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 w-fit max-w-full">
        {([['users', Users, 'Usuários e acessos'], ['categories', FolderTree, 'Categorias'], ['stats', BarChart3, 'Estatísticas']] as const).map(([k, I, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn('inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
              tab === k ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800')}>
            <I className="size-4" />{l}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'stats' && <StatsTab />}
    </div>
  )
}

// ------------------------------------------------------------------ Usuários
type UserRow = Profile & { tutorials: number; views: number }

function UsersTab() {
  const { profile: me } = useAuth()
  const [rows, setRows] = useState<UserRow[] | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Role | ''>('')
  const [saving, setSaving] = useState<string | null>(null)

  const load = async () => {
    const [p, t, v] = await Promise.all([
      supabase.from('kb_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('kb_tutorials').select('author_id'),
      supabase.from('kb_views').select('user_id'),
    ])
    const tc: Record<string, number> = {}; t.data?.forEach(r => { tc[r.author_id] = (tc[r.author_id] ?? 0) + 1 })
    const vc: Record<string, number> = {}; v.data?.forEach(r => { vc[r.user_id] = (vc[r.user_id] ?? 0) + 1 })
    setRows((p.data ?? []).map(x => ({ ...(x as Profile), tutorials: tc[x.id] ?? 0, views: vc[x.id] ?? 0 })))
  }
  useEffect(() => { load() }, [])

  const setRole = async (u: UserRow, role: Role) => {
    setSaving(u.id)
    const { error } = await supabase.from('kb_profiles').update({ role }).eq('id', u.id)
    setSaving(null)
    if (error) return toast.error(errMsg(error))
    toast.success(`${u.full_name || u.email} agora é ${ROLE_LABEL[role]}`)
    setRows(rows!.map(r => r.id === u.id ? { ...r, role } : r))
  }

  const list = useMemo(() => {
    const term = q.toLowerCase()
    return (rows ?? []).filter(r => (!filter || r.role === filter) && (!term || r.email.toLowerCase().includes(term) || r.full_name?.toLowerCase().includes(term)))
  }, [rows, q, filter])

  if (!rows) return <Spinner />
  const counts = rows.reduce<Record<string, number>>((a, r) => { a[r.role] = (a[r.role] ?? 0) + 1; return a }, {})
  const pending = rows.filter(r => r.role === 'pending')

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <h3 className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300"><Clock className="size-4" />{pending.length} cadastro(s) aguardando aprovação</h3>
          <ul className="mt-3 space-y-2">
            {pending.map(u => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 dark:bg-slate-900">
                <Avatar name={u.full_name} email={u.email} url={u.avatar_url} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-800 dark:text-slate-200">{u.full_name}</div>
                  <div className="truncate text-xs text-slate-500">{u.email} · {timeAgo(u.created_at)}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" loading={saving === u.id} onClick={() => setRole(u, 'field')}><UserCheck className="size-4" />Aprovar como Field</Button>
                  <Button size="sm" variant="outline" disabled={saving === u.id} onClick={() => setRole(u, 'field_admin')}>Field Admin</Button>
                  <Button size="sm" variant="ghost" disabled={saving === u.id} onClick={() => setRole(u, 'blocked')} className="text-rose-600">Recusar</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className={cn(inputCls, 'pl-10')} placeholder="Buscar por nome ou e-mail" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className={cn(inputCls, 'w-auto')} value={filter} onChange={e => setFilter(e.target.value as Role | '')}>
          <option value="">Todos ({rows.length})</option>
          {(Object.keys(ROLE_LABEL) as Role[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]} ({counts[r] ?? 0})</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/50">
              <tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Nível de acesso</th><th className="px-4 py-3 text-center">Tutoriais</th><th className="px-4 py-3 text-center">Leituras</th><th className="px-4 py-3">Desde</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.map(u => {
                const locked = u.email.toLowerCase() === OWNER || u.id === me?.id
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.full_name} email={u.email} url={u.avatar_url} size={34} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                            {u.full_name}{u.email.toLowerCase() === OWNER && <Crown className="size-3.5 text-amber-500" aria-label="Administrador principal" />}
                          </div>
                          <div className="truncate text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {locked ? (
                        <span className={cn('inline-block rounded-lg px-2.5 py-1 text-xs font-semibold', ROLE_STYLE[u.role])}>{ROLE_LABEL[u.role]}</span>
                      ) : (
                        <select value={u.role} disabled={saving === u.id} onChange={e => setRole(u, e.target.value as Role)}
                          className={cn('rounded-lg border-0 px-2.5 py-1.5 text-xs font-semibold outline-none ring-1 ring-inset ring-black/5 cursor-pointer', ROLE_STYLE[u.role])}>
                          <option value="field">Field</option>
                          <option value="field_admin">Field Administrador</option>
                          <option value="admin">Administrador</option>
                          <option value="pending">Aguardando aprovação</option>
                          <option value="blocked">Bloqueado</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{u.tutorials}</td>
                    <td className="px-4 py-3 text-center font-medium">{u.views}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(u.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-3">
        {[
          ['Field', 'Lê tudo, cria tutoriais e edita/exclui apenas os próprios.'],
          ['Field Administrador', 'Tudo do Field + edita/exclui qualquer tutorial e gerencia categorias.'],
          ['Administrador', 'Acesso total, incluindo definir o nível de acesso de cada pessoa.'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <div className="font-semibold text-slate-800 dark:text-slate-200">{t}</div>
            <div className="mt-1 text-slate-500">{d}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Categorias
function CategoriesTab() {
  const [cats, setCats] = useState<Category[] | null>(null)
  const [edit, setEdit] = useState<Partial<Category> | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => supabase.from('kb_categories').select('*').order('sort_order').then(({ data }) => setCats(data ?? []))
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!edit?.name?.trim()) return toast.error('Informe o nome')
    setBusy(true)
    const payload = { name: edit.name.trim(), icon: edit.icon || 'folder', color: edit.color || '#6366f1', sort_order: edit.sort_order ?? (cats?.length ?? 0) + 1 }
    const { error } = edit.id
      ? await supabase.from('kb_categories').update(payload).eq('id', edit.id)
      : await supabase.from('kb_categories').insert(payload)
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    setEdit(null); load(); toast.success('Categoria salva')
  }
  const remove = async (c: Category) => {
    if (!confirm(`Excluir a categoria "${c.name}"? Os tutoriais dela ficarão sem categoria.`)) return
    const { error } = await supabase.from('kb_categories').delete().eq('id', c.id)
    if (error) return toast.error(errMsg(error))
    load()
  }

  if (!cats) return <Spinner />
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setEdit({ color: '#6366f1', icon: 'folder' })}><Plus className="size-4" />Nova categoria</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map(c => (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <span className="grid size-11 place-items-center rounded-xl text-white" style={{ background: c.color }}><CategoryIcon name={c.icon} className="size-5" /></span>
            <div className="min-w-0 flex-1 font-semibold text-slate-800 dark:text-slate-200">{c.name}</div>
            <button onClick={() => setEdit(c)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"><Pencil className="size-4" /></button>
            <button onClick={() => remove(c)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar categoria' : 'Nova categoria'}>
        {edit && (
          <div className="space-y-4">
            <div><label className={labelCls}>Nome</label><input autoFocus className={inputCls} value={edit.name ?? ''} onChange={e => setEdit({ ...edit, name: e.target.value })} /></div>
            <div>
              <label className={labelCls}>Cor</label>
              <div className="flex flex-wrap gap-2">
                {['#6366f1', '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#14b8a6', '#ec4899', '#64748b', '#0f172a'].map(c => (
                  <button key={c} type="button" onClick={() => setEdit({ ...edit, color: c })} className={cn('size-8 rounded-lg ring-offset-2 dark:ring-offset-slate-900', edit.color === c && 'ring-2 ring-indigo-500')} style={{ background: c }} />
                ))}
                <input type="color" value={edit.color} onChange={e => setEdit({ ...edit, color: e.target.value })} className="size-8 cursor-pointer rounded-lg" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Ícone</label>
              <div className="grid grid-cols-7 gap-1.5">
                {Object.keys(CATEGORY_ICONS).map(k => (
                  <button key={k} type="button" onClick={() => setEdit({ ...edit, icon: k })}
                    className={cn('grid aspect-square place-items-center rounded-lg border transition', edit.icon === k ? 'border-transparent text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800')}
                    style={edit.icon === k ? { background: edit.color } : undefined}>
                    <CategoryIcon name={k} className="size-4.5" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button loading={busy} onClick={save}>Salvar</Button></div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ------------------------------------------------------------------ Estatísticas
interface Top { id: string; short_code: string; title: string; view_count: number; viewer_count: number; author_name: string | null }
interface Recent { viewed_at: string; via_share: boolean; user: { full_name: string | null; email: string; avatar_url: string | null } | null; tutorial: { title: string; short_code: string } | null }

function StatsTab() {
  const [data, setData] = useState<{ tutorials: number; members: number; views: number; shared: number; top: Top[]; recent: Recent[] } | null>(null)
  useEffect(() => {
    (async () => {
      const [t, m, v, s, top, recent] = await Promise.all([
        supabase.from('kb_tutorials').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('kb_profiles').select('id', { count: 'exact', head: true }).in('role', ['admin', 'field_admin', 'field']),
        supabase.from('kb_views').select('id', { count: 'exact', head: true }),
        supabase.from('kb_views').select('id', { count: 'exact', head: true }).eq('via_share', true),
        supabase.from('kb_tutorials_list').select('id,short_code,title,view_count,viewer_count,author_name').eq('status', 'published').order('view_count', { ascending: false }).limit(8),
        supabase.from('kb_views').select('viewed_at,via_share,user:kb_profiles(full_name,email,avatar_url),tutorial:kb_tutorials(title,short_code)').order('viewed_at', { ascending: false }).limit(25),
      ])
      setData({ tutorials: t.count ?? 0, members: m.count ?? 0, views: v.count ?? 0, shared: s.count ?? 0, top: (top.data as Top[]) ?? [], recent: (recent.data as unknown as Recent[]) ?? [] })
    })()
  }, [])
  if (!data) return <Spinner />
  const max = Math.max(1, ...data.top.map(t => t.view_count))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {([[BookOpen, 'Tutoriais publicados', data.tutorials, '#6366f1'], [Users, 'Fields ativos', data.members, '#0ea5e9'], [Eye, 'Visualizações', data.views, '#10b981'], [Share2, 'Via link compartilhado', data.shared, '#f59e0b']] as const).map(([I, l, n, c]) => (
          <div key={l} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <span className="grid size-10 place-items-center rounded-xl" style={{ background: `${c}18`, color: c }}><I className="size-5" /></span>
            <div className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{n}</div>
            <div className="text-sm text-slate-500">{l}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <h3 className="mb-4 font-semibold text-slate-800 dark:text-slate-200">Mais vistos</h3>
          {data.top.length === 0 ? <p className="text-sm text-slate-400">Sem dados ainda.</p> : (
            <ul className="space-y-3">
              {data.top.map(t => (
                <li key={t.id}>
                  <Link to={`/t/${t.short_code}`} className="group block">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-slate-700 group-hover:text-indigo-600 dark:text-slate-300">{t.title}</span>
                      <span className="shrink-0 text-slate-500">{t.view_count} · {t.viewer_count} pessoas</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-sky-500" style={{ width: `${(t.view_count / max) * 100}%` }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <h3 className="mb-4 font-semibold text-slate-800 dark:text-slate-200">Atividade recente</h3>
          {data.recent.length === 0 ? <p className="text-sm text-slate-400">Sem dados ainda.</p> : (
            <ul className="space-y-1">
              {data.recent.map((r, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <Avatar name={r.user?.full_name} email={r.user?.email} url={r.user?.avatar_url} size={30} />
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{r.user?.full_name ?? r.user?.email}</span>
                    <span className="text-slate-500"> viu </span>
                    {r.tutorial && <Link to={`/t/${r.tutorial.short_code}`} className="font-medium text-indigo-600 hover:underline">{r.tutorial.title}</Link>}
                    <div className="text-xs text-slate-400">{timeAgo(r.viewed_at)}{r.via_share && ' · via link compartilhado'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
