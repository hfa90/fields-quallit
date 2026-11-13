import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { greeting, recallUser } from '../lib/droidTalk'

/*
 * Roteiro do robozinho (só no navegador):
 *  arriving → entra andando devagar pela lateral
 *  idle     → chama atenção para o app
 *  running  → mouse/toque no e-mail: corre para perto do campo
 *  watching → olha o que está sendo digitado
 *  greet    → reconhece quem já entrou neste aparelho e fala uma gíria do estado
 *  leaving  → digitando a senha: tristonho, vai andando de volta; para quando a digitação para e olha para trás
 *  flee     → Entrar: sai correndo chorando
 *  back     → senha errada: volta, meio sem graça
 */
type Scene = 'arriving' | 'idle' | 'running' | 'watching' | 'greet' | 'leaving' | 'paused' | 'flee' | 'back'

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

const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const droid = !isNative
  const wide = useWide()

  // ---------- palco do robô
  const formRef = useRef<HTMLFormElement>(null)
  const [stageW, setStageW] = useState(0)     // espaço disponível (px) para o robô andar
  const [scene, setScene] = useState<Scene>('arriving')
  const [x, setX] = useState<number | null>(null)
  const [dur, setDur] = useState(0)
  const [ease, setEase] = useState('linear')
  const [line, setLine] = useState('')
  const typing = useRef<number | undefined>(undefined)
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; window.clearTimeout(typing.current) }
  useEffect(() => clearAll, [])

  const ROBOT = wide ? 104 : 70
  // posições (px a partir do ponto de apoio do robô)
  const pos = {
    near: wide ? 12 : 0,                                   // colado no campo de e-mail
    rest: wide ? Math.min(210, stageW - ROBOT - 20) : Math.max(0, stageW - ROBOT - 4),
    home: wide ? Math.max(260, stageW - ROBOT - 10) : Math.max(0, stageW - ROBOT),  // de onde ele veio (até onde volta)
    off: stageW + 60,                                      // fora da tela
  }

  useLayoutEffect(() => {
    if (!droid) return
    const measure = () => {
      const f = formRef.current?.getBoundingClientRect()
      if (!f) return
      setStageW(wide ? Math.max(0, window.innerWidth - f.right - 12) : f.width)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [droid, wide])

  const xRef = useRef<number | null>(null)
  const move = useCallback((to: number, ms: number, e = 'linear') => { xRef.current = to; setDur(ms); setEase(e); setX(to) }, [])

  // entrada: aparece na lateral e vem andando devagar
  useEffect(() => {
    if (!droid || !stageW || x !== null) return
    setDur(0); setX(pos.off); xRef.current = pos.off
    later(() => move(pos.rest, wide ? 4200 : 3200), 60)
    later(() => { setScene(s => (s === 'arriving' ? 'idle' : s)) ; setLine(l => l || 'Psiu! 👋 Me baixa? No celular eu abro mais rápido e funciono até sem sinal.') }, (wide ? 4200 : 3200) + 80)
  }, [droid, stageW])

  const goNear = () => {
    if (!droid || scene === 'flee' || scene === 'running' || scene === 'watching' || scene === 'greet') return
    clearAll()
    setScene('running'); setLine('Opa! Quem vem lá? 👀')
    move(pos.near, 650, 'cubic-bezier(.3,.7,.3,1)')
    later(() => { setScene('watching') }, 660)
    if (email && EMAIL_OK.test(email)) later(identify, 700)
  }

  const identify = () => {
    const known = recallUser(email)
    setScene('greet')
    setLine(known
      ? `${greeting(known.name, known.uf)} É um prazer ter você de volta aqui, mas que tal me ter no seu celular baixado? 😉`
      : 'Prazer! Ainda não te conheço por aqui… mas que tal me ter no seu celular baixado? 😉')
  }

  // reconhece a pessoa quando o e-mail fica completo (pausa na digitação)
  useEffect(() => {
    if (!droid || !EMAIL_OK.test(email) || !['watching', 'greet', 'running'].includes(scene)) return
    const t = window.setTimeout(identify, 600)
    return () => clearTimeout(t)
  }, [email])

  // digitando a senha: vai andando de volta, tristonho; parou de digitar → para e olha para trás
  const onPasswordKey = () => {
    if (!droid || scene === 'flee') return
    window.clearTimeout(typing.current)
    setScene('leaving')
    setLine('')
    move(Math.min(pos.home, (xRef.current ?? pos.near) + (wide ? 18 : 12)), 420)
    typing.current = window.setTimeout(() => { setScene('paused'); setLine('🥺') }, 650)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (droid) { // sai correndo chorando
        clearAll()
        setScene('flee'); setLine('Buáááá! 😭')
        move(pos.off, 1100, 'cubic-bezier(.5,0,.8,.4)')
        await new Promise(r => setTimeout(r, 1150))
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error.message.includes('Invalid login') ? new Error('E-mail ou senha incorretos') : error
    } catch (err) {
      toast.error(errMsg(err))
      if (droid) {
        setScene('back'); setLine('')
        move(pos.rest, 1600)
        later(() => { setScene('paused'); setLine('Ops… e-mail ou senha não conferem. Tenta de novo? 🤔') }, 1620)
      }
    } finally {
      setBusy(false)
    }
  }

  // ---------- aparência por cena
  const walking = scene === 'arriving' || scene === 'leaving' || scene === 'back'
  const gait: 'walk' | 'run' | undefined = scene === 'running' || scene === 'flee' ? 'run' : walking && dur > 0 ? 'walk' : undefined
  const toRight = scene === 'leaving' || scene === 'flee'
  const mood: DroidMood = scene === 'flee' ? 'cry' : scene === 'leaving' || scene === 'paused' || scene === 'back' ? 'sad' : scene === 'greet' ? 'wink' : 'happy'
  const look = toRight ? 1 : -1
  const lookY = scene === 'watching' || scene === 'greet' ? (wide ? 0.3 : 1) : 0
  const lean = gait === 'run' ? (toRight ? 10 : -10) : gait === 'walk' ? (toRight ? 3 : -3) : 0
  const tilt = scene === 'watching' ? (email.length % 2 ? -7 : -11) : scene === 'paused' ? -6 : 0
  const wave = scene === 'idle' || scene === 'greet'
  const bubbleLeft = !wide && x !== null && x < stageW / 2  // no celular o balão fica do lado com mais espaço

  const field = 'rounded-none shadow-none focus:shadow-none bg-transparent dark:bg-transparent dark:shadow-none h-12'

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center overflow-x-hidden px-5 py-10">
      <div className="w-full max-w-[360px] fade-up">
        <div className="flex flex-col items-center text-center">
          <Logo size={64} />
          <h1 className="mt-5 text-[28px] font-bold tracking-tight text-neutral-900 dark:text-white">Fields</h1>
          <p className="mt-1 text-[15px] text-neutral-500">Central de tutoriais · Quallit Soluções em TI</p>
        </div>

        <form ref={formRef} onSubmit={submit} className={cn('relative space-y-4', droid ? 'mt-[116px] lg:mt-8' : 'mt-8')}>
          {droid && x !== null && (
            <div aria-live="polite" className={cn('pointer-events-none absolute z-10 w-max', wide ? 'left-full top-[-34px]' : 'left-0 top-[-104px]')}
              style={{ transform: `translateX(${x}px)`, transition: `transform ${dur}ms ${ease}` }}>
              {line && (
                <div key={line} className={cn('bubble-in pointer-events-auto absolute rounded-[16px] bg-white px-3.5 py-2.5 text-[13.5px] leading-snug text-neutral-800 shadow-[0_0_0_0.5px_rgb(0_0_0/0.1),0_10px_28px_-8px_rgb(0_0_0/0.3)] dark:bg-neutral-800 dark:text-neutral-100',
                  wide ? 'bottom-[calc(100%+4px)] left-[-18px] w-[250px] rounded-bl-[6px]'
                    : bubbleLeft ? 'left-[78px] top-0 w-[min(240px,calc(100vw-130px))] rounded-tl-[6px]'
                      : 'right-[78px] top-0 w-[min(240px,calc(100vw-130px))] rounded-tr-[6px]',
                  line.length < 4 && 'w-auto px-3 text-[18px]')}>
                  {line}
                  {scene === 'idle' && (
                    <Link to="/android" className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-[#3ddc84] px-3 py-1 text-[12.5px] font-semibold text-neutral-900"><Download className="size-3.5" />Baixar o app</Link>
                  )}
                </div>
              )}
              <Droid size={ROBOT} mood={mood} gait={gait} lean={lean} look={look} lookY={lookY} tilt={tilt} wave={wave && !gait} />
            </div>
          )}

          <div className="card divide-y divide-neutral-200 overflow-hidden dark:divide-neutral-800">
            <input required type="email" className={cn(inputCls, field)} value={email} onChange={e => setEmail(e.target.value)}
              onMouseEnter={goNear} onFocus={goNear}
              placeholder="E-mail" autoComplete="email" inputMode="email" autoCapitalize="none" />
            <input required type="password" className={cn(inputCls, field)} value={password}
              onChange={e => { setPassword(e.target.value); onPasswordKey() }}
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
