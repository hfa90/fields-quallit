import { useState } from 'react'
import { KeyRound, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button, inputCls, labelCls } from '../components/ui'
import { errMsg } from '../lib/utils'

/**
 * Definição de senha: usada no link "Esqueci minha senha" e no primeiro acesso
 * de quem foi cadastrado pelo administrador (senha temporária).
 */
export default function ResetPassword({ firstAccess }: { firstAccess?: boolean }) {
  const { finishRecovery, signOut, profile } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="pt-safe pb-safe grid min-h-dvh place-items-center p-6">
      <form className="w-full max-w-sm space-y-4 fade-up" onSubmit={async e => {
        e.preventDefault()
        if (pw.length < 8) return toast.error('A senha precisa ter pelo menos 8 caracteres')
        if (pw !== pw2) return toast.error('As senhas não conferem')
        setBusy(true)
        const { error } = await supabase.auth.updateUser({ password: pw, data: { must_change_password: false } })
        setBusy(false)
        if (error) return toast.error(errMsg(error).includes('different') ? 'Escolha uma senha diferente da temporária' : errMsg(error))
        toast.success('Senha definida!')
        finishRecovery()
      }}>
        <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-accent-100 text-accent-600 dark:bg-accent-500/15"><KeyRound className="size-7" /></div>
        <h1 className="text-[24px] font-bold tracking-tight text-neutral-900 dark:text-white">{firstAccess ? 'Crie sua senha' : 'Defina uma nova senha'}</h1>
        {firstAccess && <p className="text-[15px] text-neutral-500">Olá{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! Você entrou com uma senha temporária criada pelo administrador. Escolha uma senha pessoal para continuar.</p>}
        <div>
          <label className={labelCls}>Nova senha</label>
          <input type="password" autoFocus className={inputCls} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" minLength={8} required placeholder="Mínimo 8 caracteres" />
        </div>
        <div>
          <label className={labelCls}>Confirme a nova senha</label>
          <input type="password" className={inputCls} value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" minLength={8} required />
        </div>
        <Button type="submit" loading={busy} className="h-11 w-full">Salvar senha</Button>
        {firstAccess && <Button type="button" variant="ghost" className="w-full" onClick={signOut}><LogOut className="size-4" />Sair</Button>}
      </form>
    </div>
  )
}
