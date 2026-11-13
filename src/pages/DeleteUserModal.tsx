import { useEffect, useState } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { cn, errMsg } from '../lib/utils'
import { Button, Modal, Spinner, inputCls, labelCls } from '../components/ui'
import { callAdmin } from './AdminExtra'

type RemoveInfo = { published: number; drafts: number; inventory: boolean; owner: boolean; me: boolean }
export type DeletableUser = { id: string; full_name: string | null; email: string }

/** Confirmação para excluir um Field: decide o destino das publicações e explica o que acontece com a conta */
export default function DeleteUserModal({ user, onClose, onDeleted }: { user: DeletableUser | null; onClose: () => void; onDeleted: () => void }) {
  const { profile } = useAuth()
  const [info, setInfo] = useState<RemoveInfo | null>(null)
  const [people, setPeople] = useState<DeletableUser[]>([])
  const [mode, setMode] = useState<'transfer' | 'delete'>('transfer')
  const [to, setTo] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    setInfo(null); setMode('transfer'); setConfirm(false); setTo(profile?.id ?? '')
    supabase.rpc('kb_admin_user_info', { p_user: user.id }).then(({ data, error }) => {
      if (error) { toast.error(errMsg(error)); onClose(); return }
      setInfo(data as RemoveInfo)
    })
    supabase.from('kb_profiles').select('id,full_name,email').in('role', ['admin', 'field_admin', 'field']).neq('id', user.id).order('full_name')
      .then(({ data }) => setPeople((data as DeletableUser[]) ?? []))
  }, [user, profile?.id])

  if (!user) return null
  const name = user.full_name || user.email
  const total = info ? info.published + info.drafts : 0
  const blocked = !!info && (info.owner || info.me)
  const ready = !!info && !blocked && confirm && (total === 0 || mode === 'delete' || !!to)

  const run = async () => {
    setBusy(true)
    try {
      const r = await callAdmin({ action: 'delete_user', user_id: user.id, transfer_to: total && mode === 'transfer' ? to : null, delete_posts: total > 0 && mode === 'delete' })
      toast.success(r.inventory ? `${name} não tem mais acesso ao Fields` : `${name} foi excluído`)
      onDeleted(); onClose()
    } catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
  }

  const option = 'flex cursor-pointer gap-3 rounded-[12px] p-3 shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)] dark:shadow-[0_0_0_0.5px_rgb(255_255_255/0.15)]'

  return (
    <Modal open onClose={onClose} title="Excluir Field">
      {!info ? <Spinner /> : blocked ? (
        <div className="space-y-4">
          <p className="text-[15px] text-neutral-700 dark:text-neutral-300">{info.me ? 'Você não pode excluir a si mesmo.' : 'O administrador principal não pode ser excluído.'}</p>
          <Button className="w-full" variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-[12px] bg-[#ff3b30]/[.07] p-3.5">
            <Trash2 className="mt-0.5 size-5 shrink-0 text-[#ff3b30]" />
            <div className="text-[14px] leading-relaxed text-neutral-700 dark:text-neutral-300">
              <b className="text-neutral-900 dark:text-white">{name}</b> será removido da central: perde o acesso, sai da equipe e dos rankings{info.inventory ? '' : ', e os comentários e curtidas dele são apagados'}.
            </div>
          </div>

          <p className="rounded-[12px] bg-neutral-900/[.04] p-3 text-[13px] text-neutral-600 dark:bg-white/[.05] dark:text-neutral-400">
            {info.inventory
              ? <>Esta pessoa também usa o <b>Inventário</b>. A conta de login continua funcionando lá; só o acesso ao Fields é retirado. Para devolver, cadastre o e-mail de novo em “Novo usuário”.</>
              : <>A conta de login também será apagada. Para voltar, será preciso criar um novo usuário.</>}
          </p>

          {total > 0 && (
            <div>
              <label className={labelCls}>
                O que fazer com {total === 1 ? 'a publicação' : `as ${total} publicações`} ({info.published} publicada{info.published === 1 ? '' : 's'}{info.drafts ? `, ${info.drafts} rascunho${info.drafts === 1 ? '' : 's'}` : ''})?
              </label>
              <div className="space-y-2">
                <label className={cn(option, mode === 'transfer' && 'shadow-[0_0_0_2px_var(--color-accent-500)] dark:shadow-[0_0_0_2px_var(--color-accent-500)]')}>
                  <input type="radio" name="destino" className="mt-1" checked={mode === 'transfer'} onChange={() => setMode('transfer')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-neutral-900 dark:text-white">Manter e transferir (recomendado)</span>
                    <span className="block text-[12.5px] text-neutral-500">O conhecimento continua na biblioteca, com outro responsável.</span>
                    {mode === 'transfer' && (
                      <select className={cn(inputCls, 'mt-2')} value={to} onChange={e => setTo(e.target.value)} aria-label="Quem assume as publicações">
                        <option value="">Escolha quem assume…</option>
                        {people.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}{p.id === profile?.id ? ' (você)' : ''}</option>)}
                      </select>
                    )}
                  </span>
                </label>
                <label className={cn(option, mode === 'delete' && 'shadow-[0_0_0_2px_#ff3b30] dark:shadow-[0_0_0_2px_#ff3b30]')}>
                  <input type="radio" name="destino" className="mt-1" checked={mode === 'delete'} onChange={() => setMode('delete')} />
                  <span>
                    <span className="block text-[14px] font-semibold text-neutral-900 dark:text-white">Excluir as publicações também</span>
                    <span className="block text-[12.5px] text-neutral-500">Somem da biblioteca junto com anexos, comentários e histórico.</span>
                  </span>
                </label>
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px] text-neutral-700 dark:text-neutral-300">
            <input type="checkbox" className="mt-0.5 size-4" checked={confirm} onChange={e => setConfirm(e.target.checked)} />
            Entendo que esta ação não pode ser desfeita.
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <button disabled={!ready || busy} onClick={run}
              className="press inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-[#ff3b30] text-[15px] font-medium text-white disabled:opacity-40">
              {busy ? <RefreshCw className="size-4 animate-spin" /> : <Trash2 className="size-4" />}Excluir
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
