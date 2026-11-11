import { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, inputCls } from '../components/ui'
import { Logo } from '../components/Layout'
import { cn, errMsg } from '../lib/utils'

/**
 * Login da central. Não há cadastro nem recuperação de senha por e-mail:
 * o administrador cria os usuários e redefine senhas em Administração → Usuários.
 */
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error.message.includes('Invalid login') ? new Error('E-mail ou senha incorretos') : error
    } catch (err) {
      toast.error(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  const field = 'rounded-none shadow-none focus:shadow-none bg-transparent dark:bg-transparent dark:shadow-none h-12'

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[360px] fade-up">
        <div className="flex flex-col items-center text-center">
          <Logo size={64} />
          <h1 className="mt-5 text-[28px] font-bold tracking-tight text-neutral-900 dark:text-white">Fields</h1>
          <p className="mt-1 text-[15px] text-neutral-500">Central de tutoriais · Quallit Soluções em TI</p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="card divide-y divide-neutral-200 overflow-hidden dark:divide-neutral-800">
            <input required type="email" className={cn(inputCls, field)} value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" autoComplete="email" inputMode="email" autoCapitalize="none" />
            <input required type="password" className={cn(inputCls, field)} value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" autoComplete="current-password" />
          </div>
          <Button type="submit" loading={busy} className="h-12 w-full text-[17px] font-semibold">Entrar</Button>
          <p className="text-center text-[13px] leading-relaxed text-neutral-500">
            Acesso restrito a usuários cadastrados pelo administrador.<br />Usuários do Inventário Quallit entram com o mesmo e-mail e senha.
          </p>
        </form>

        <div className="mt-8 flex items-start gap-2.5 rounded-[12px] bg-neutral-900/[.04] px-4 py-3 text-[13px] leading-relaxed text-neutral-600 dark:bg-white/5 dark:text-neutral-400">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-neutral-400" />
          <span>Esqueceu a senha? Peça ao administrador da central para redefinir o seu acesso.</span>
        </div>
      </div>
    </div>
  )
}
