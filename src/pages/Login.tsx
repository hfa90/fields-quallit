import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { KeyRound, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, inputCls } from '../components/ui'
import { Logo } from '../components/Layout'
import { cn, errMsg } from '../lib/utils'
import { isNative } from '../lib/native'
import { VersionTag } from '../components/VersionInfo'
import Droid, { type DroidMood } from '../components/Droid'

type Stage = 'idle' | 'email' | 'password' | 'accept' | 'bye' | 'error'

const SCRIPT: Record<Stage, { mood: DroidMood; text: string; wave?: boolean; shake?: boolean }> = {
  idle: { mood: 'happy', wave: true, text: 'Psiu! 👋 Me baixa? No celular eu abro mais rápido e funciono até sem sinal.' },
  email: { mood: 'sad', text: 'Você vai entrar no modo web em vez de me baixar? 🥺' },
  password: { mood: 'desperate', shake: true, text: 'Nãããão! Espera… me baixa, vai! 😱' },
  accept: { mood: 'calm', text: 'Tá bom… eu entendo. Prometo não olhar sua senha 🙈' },
  bye: { mood: 'wink', wave: true, text: 'Está tudo bem, o modo web é tão bom quanto eu também! 😄' },
  error: { mood: 'sad', text: 'Ops… e-mail ou senha não conferem. Tenta de novo? 🤔' },
}

function useWide() {
  const q = '(min-width: 1024px)'
  const [wide, setWide] = useState(() => window.matchMedia?.(q).matches ?? false)
  useEffect(() => {
    const m = window.matchMedia(q)
    const h = () => setWide(m.matches)
    m.addEventListener('change', h)
    return () => m.removeEventListener('change', h)
  }, [])
  return wide
}

/**
 * Login da central. Não há cadastro nem recuperação de senha por e-mail:
 * o administrador cria os usuários e redefine senhas em Administração → Usuários.
 * No navegador, o robozinho do app Android acompanha (e comenta) o login.
 */
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const timer = useRef<number | undefined>(undefined)
  const wide = useWide()
  const droid = !isNative

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onEmailFocus = () => { if (stage !== 'bye') { window.clearTimeout(timer.current); setStage('email') } }
  const onPasswordFocus = () => {
    if (stage === 'bye' || stage === 'accept') return
    window.clearTimeout(timer.current)
    setStage('password')
    timer.current = window.setTimeout(() => setStage('accept'), 2600) // o desespero passa…
  }
  const onBlur = () => window.setTimeout(() => {
    const a = document.activeElement
    if (a?.tagName !== 'INPUT' && !email && !password) setStage(s => (s === 'bye' ? s : 'idle'))
  }, 50)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (droid) { // a despedida antes de entrar
        window.clearTimeout(timer.current)
        setStage('bye')
        await new Promise(r => setTimeout(r, 1700))
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error.message.includes('Invalid login') ? new Error('E-mail ou senha incorretos') : error
    } catch (err) {
      toast.error(errMsg(err))
      setStage('error')
    } finally {
      setBusy(false)
    }
  }

  const field = 'rounded-none shadow-none focus:shadow-none bg-transparent dark:bg-transparent dark:shadow-none h-12'
  const s = SCRIPT[stage]
  const near = stage !== 'idle'
  // para onde o robô olha: no computador ele está à direita do formulário; no celular, acima
  const look = wide ? -1 : -0.5
  const lookY = near ? (wide ? 0.4 : 1) : 0
  const tilt = stage === 'email' ? (email.length % 2 ? -7 : -11) : stage === 'password' ? 0 : near ? -4 : 0

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center overflow-x-hidden px-5 py-10">
      <div className="w-full max-w-[360px] fade-up">
        <div className="flex flex-col items-center text-center">
          <Logo size={64} />
          <h1 className="mt-5 text-[28px] font-bold tracking-tight text-neutral-900 dark:text-white">Fields</h1>
          <p className="mt-1 text-[15px] text-neutral-500">Central de tutoriais · Quallit Soluções em TI</p>
        </div>

        <form onSubmit={submit} className={cn('relative space-y-4', droid ? 'mt-[124px] lg:mt-8' : 'mt-8')}>
          {droid && (
            <div aria-live="polite" className={cn('pointer-events-none absolute z-10 w-max transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]',
              wide ? 'left-[calc(100%+44px)] top-[-30px]' : 'right-1 top-[-112px]')}
              style={{ transform: near ? (wide ? 'translateX(-30px) rotate(-3deg)' : 'translate(-6px, 14px)') : undefined }}>
              <div key={stage} className={cn('bubble-in pointer-events-auto absolute rounded-[16px] bg-white px-3.5 py-2.5 text-[13.5px] leading-snug text-neutral-800 shadow-[0_0_0_0.5px_rgb(0_0_0/0.1),0_10px_28px_-8px_rgb(0_0_0/0.3)] dark:bg-neutral-800 dark:text-neutral-100',
                wide ? 'bottom-[calc(100%+6px)] left-[-24px] w-[232px] rounded-bl-[6px]' : 'right-[82px] top-0 w-[min(220px,calc(100vw-130px))] rounded-tr-[6px]')}>
                {s.text}
                {stage === 'idle' && (
                  <Link to="/android" className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-[#3ddc84] px-3 py-1 text-[12.5px] font-semibold text-neutral-900"><Download className="size-3.5" />Baixar o app</Link>
                )}
              </div>
              <Droid size={wide ? 104 : 72} mood={s.mood} wave={s.wave} shake={s.shake} look={look} lookY={lookY} tilt={tilt} />
            </div>
          )}

          <div className="card divide-y divide-neutral-200 overflow-hidden dark:divide-neutral-800">
            <input required type="email" className={cn(inputCls, field)} value={email} onChange={e => setEmail(e.target.value)} onFocus={onEmailFocus} onBlur={onBlur}
              placeholder="E-mail" autoComplete="email" inputMode="email" autoCapitalize="none" />
            <input required type="password" className={cn(inputCls, field)} value={password} onChange={e => setPassword(e.target.value)} onFocus={onPasswordFocus} onBlur={onBlur}
              placeholder="Senha" autoComplete="current-password" />
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

        {droid && <Link to="/android" className="mx-auto mt-5 flex w-fit items-center gap-1.5 text-[13px] font-medium text-accent-600 dark:text-accent-400"><Download className="size-3.5" />Baixar o app para Android</Link>}
        <VersionTag className="mt-6" />
      </div>
    </div>
  )
}
