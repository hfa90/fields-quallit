import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, CalendarClock, ThumbsDown, Copy, UserPlus, KeyRound, RefreshCw, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { ROLE_LABEL, cn, errMsg, timeAgo } from '../lib/utils'
import { PUBLIC_URL } from '../lib/native'
import { useCds } from '../lib/cds'
import type { Role } from '../lib/types'
import { LIST_COLS } from '../lib/library'
import type { TutorialListItem } from '../lib/types'
import { Button, Modal, Spinner, inputCls, labelCls } from '../components/ui'

/** Tutoriais que precisam de atenção: revisão vencida, passo desatualizado ou avaliação ruim */
export function ReviewTab() {
  const [rows, setRows] = useState<TutorialListItem[] | null>(null)
  useEffect(() => {
    supabase.from('kb_tutorials_list').select(LIST_COLS).eq('status', 'published').order('reviewed_at', { ascending: true }).limit(300)
      .then(({ data }) => {
        const all = (data as unknown as TutorialListItem[]) ?? []
        setRows(all.filter(t => t.review_due || (t.outdated_count ?? 0) > 0 || ((t.not_helpful_count ?? 0) >= 2 && (t.not_helpful_count ?? 0) > (t.helpful_count ?? 0))))
      })
  }, [])
  if (!rows) return <Spinner />
  if (!rows.length) return (
    <div className="card flex flex-col items-center p-10 text-center">
      <CheckCircle2 className="size-12 text-[#34c759]" strokeWidth={1.4} />
      <p className="mt-3 text-[17px] font-semibold text-neutral-900 dark:text-white">Biblioteca em dia</p>
      <p className="text-[14px] text-neutral-500">Nenhum tutorial com revisão vencida ou relato de problema.</p>
    </div>
  )
  return (
    <div className="space-y-3">
      <p className="px-1 text-[14px] text-neutral-500">Os autores recebem lembrete automático às 8h quando a revisão vence. Aqui você acompanha tudo o que precisa de atenção.</p>
      <div className="card divide-y divide-neutral-200/70 overflow-hidden dark:divide-neutral-800">
        {rows.map(t => (
          <Link key={t.id} to={`/t/${t.short_code}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-900/[.02] dark:hover:bg-white/[.03]">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-neutral-900 dark:text-white">{t.title}</div>
              <div className="text-[12px] text-neutral-500">{t.author_name} · revisado {t.reviewed_at ? timeAgo(t.reviewed_at) : '—'}</div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5 text-[12px] font-medium">
              {t.review_due && <span className="inline-flex items-center gap-1 rounded-md bg-neutral-900/[.06] px-1.5 py-0.5 text-neutral-600 dark:bg-white/10 dark:text-neutral-300"><CalendarClock className="size-3" />Vencida</span>}
              {!!t.outdated_count && <span className="inline-flex items-center gap-1 rounded-md bg-brand-orange/10 px-1.5 py-0.5 text-brand-orange-dark"><AlertTriangle className="size-3" />{t.outdated_count}</span>}
              {(t.not_helpful_count ?? 0) > (t.helpful_count ?? 0) && <span className="inline-flex items-center gap-1 rounded-md bg-[#ff3b30]/10 px-1.5 py-0.5 text-[#d70015]"><ThumbsDown className="size-3" />{t.not_helpful_count}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Gestão de usuários
/** Senha temporária legível (sem caracteres ambíguos) */
export function tempPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const rnd = crypto.getRandomValues(new Uint32Array(10))
  const s = Array.from(rnd, n => chars[n % chars.length]).join('')
  return `${s.slice(0, 5)}-${s.slice(5)}`
}

async function callAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('kb-admin-users', { body })
  if (error) {
    let msg = error.message
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error } catch { /* ignore */ }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

function Credentials({ name, email, password }: { name: string; email: string; password: string }) {
  const appUrl = `${PUBLIC_URL}/`
  const text = `Olá, ${name.split(' ')[0]}! Seu acesso à central de tutoriais Fields foi criado.\n\nEndereço: ${appUrl}\nE-mail: ${email}\nSenha temporária: ${password}\n\nNo primeiro acesso você vai criar uma senha pessoal.`
  return (
    <div className="space-y-3">
      <div className="rounded-[12px] bg-neutral-100 p-4 font-mono text-[13px] leading-relaxed text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
        <div>E-mail: <b>{email}</b></div>
        <div>Senha temporária: <b className="select-all">{password}</b></div>
      </div>
      <p className="text-[13px] text-neutral-500">Envie estes dados à pessoa por um canal seguro. No primeiro acesso ela será obrigada a criar uma senha pessoal. Esta senha não será exibida novamente.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(text); toast.success('Mensagem copiada') }}><Copy className="size-4" />Copiar mensagem</Button>
        <a className="press inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-[#25d366] text-[15px] font-medium text-white"
          href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><Share2 className="size-4" />WhatsApp</a>
      </div>
    </div>
  )
}

export function NewUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('field')
  const [cdId, setCdId] = useState('')
  const cds = useCds()
  const [password, setPassword] = useState(tempPassword)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ existed: boolean } | null>(null)
  useEffect(() => { if (open) { setName(''); setEmail(''); setRole('field'); setCdId(''); setPassword(tempPassword()); setDone(null) } }, [open])

  const create = async () => {
    setBusy(true)
    try {
      const r = await callAdmin({ action: 'create', email, full_name: name, role, password, cd_id: cdId || null })
      setDone({ existed: !!r.existed }); onCreated()
      toast.success(r.existed ? 'Acesso liberado para usuário existente' : 'Usuário criado')
    } catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={done ? 'Usuário pronto' : 'Novo usuário'}>
      {done ? (
        done.existed ? (
          <div className="space-y-3 text-[15px] text-neutral-700 dark:text-neutral-300">
            <p><b>{email}</b> já tinha conta (por exemplo, no Inventário). O acesso à central foi liberado como <b>{ROLE_LABEL[role]}</b>.</p>
            <p className="text-neutral-500">A pessoa entra com a senha que já usa. Se ela não lembrar, use “Redefinir senha” na lista de usuários.</p>
            <Button className="w-full" onClick={onClose}>Concluir</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Credentials name={name} email={email} password={password} />
            <Button className="w-full" onClick={onClose}>Concluir</Button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div><label className={labelCls}>Nome completo</label><input autoFocus className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Nome do field" /></div>
          <div><label className={labelCls}>E-mail</label><input type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@empresa.com.br" autoCapitalize="none" /></div>
          <div>
            <label className={labelCls}>CD onde atua</label>
            <select className={inputCls} value={cdId} onChange={e => setCdId(e.target.value)}>
              <option value="">Não definido</option>
              {cds.map(c => <option key={c.id} value={c.id}>{c.nome}{c.uf ? ` · ${c.uf}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Nível de acesso</label>
            <div className="grid grid-cols-3 rounded-[9px] bg-neutral-900/[.06] p-0.5 dark:bg-white/10">
              {(['field', 'field_admin', 'admin'] as Role[]).map(r => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={cn('h-9 rounded-[7px] text-[13px] font-medium', role === r ? 'bg-white text-neutral-900 shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-neutral-600 dark:text-white' : 'text-neutral-600 dark:text-neutral-300')}>
                  {r === 'field' ? 'Field' : r === 'field_admin' ? 'Field Admin' : 'Admin'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Senha temporária</label>
            <div className="flex gap-2">
              <input className={cn(inputCls, 'font-mono')} value={password} onChange={e => setPassword(e.target.value)} />
              <Button type="button" variant="secondary" onClick={() => setPassword(tempPassword())} title="Gerar outra"><RefreshCw className="size-4" /></Button>
            </div>
            <p className="mt-1 text-[12px] text-neutral-500">A pessoa troca no primeiro acesso.</p>
          </div>
          <Button className="h-11 w-full" loading={busy} onClick={create} disabled={!name.trim() || !email.trim()}><UserPlus className="size-4" />Criar usuário</Button>
        </div>
      )}
    </Modal>
  )
}

export function ResetPasswordModal({ user, onClose }: { user: { id: string; full_name: string | null; email: string } | null; onClose: () => void }) {
  const [password, setPassword] = useState(tempPassword)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  useEffect(() => { if (user) { setPassword(tempPassword()); setDone(false) } }, [user])
  if (!user) return null
  const reset = async () => {
    setBusy(true)
    try { await callAdmin({ action: 'reset_password', user_id: user.id, password }); setDone(true); toast.success('Senha redefinida') }
    catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Redefinir senha · ${user.full_name ?? user.email}`}>
      {done ? (
        <div className="space-y-4"><Credentials name={user.full_name ?? ''} email={user.email} password={password} /><Button className="w-full" onClick={onClose}>Concluir</Button></div>
      ) : (
        <div className="space-y-4">
          <p className="text-[14px] text-neutral-500">A senha atual deixa de funcionar. A pessoa entra com a senha temporária abaixo e cria uma nova. Atenção: se ela também usa o Inventário, a senha muda lá também (é o mesmo login).</p>
          <div className="flex gap-2">
            <input className={cn(inputCls, 'font-mono')} value={password} onChange={e => setPassword(e.target.value)} />
            <Button type="button" variant="secondary" onClick={() => setPassword(tempPassword())}><RefreshCw className="size-4" /></Button>
          </div>
          <Button className="h-11 w-full" loading={busy} onClick={reset}><KeyRound className="size-4" />Redefinir senha</Button>
        </div>
      )}
    </Modal>
  )
}
