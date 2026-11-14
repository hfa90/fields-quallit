import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { KeyRound, Download, MonitorDown, PlusSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, inputCls } from '../components/ui'
import { Logo } from '../components/Layout'
import { cn, errMsg } from '../lib/utils'
import { APK_URL, isNative } from '../lib/native'
import { VersionTag } from '../components/VersionInfo'
import Mascot, { type MascotAnim, type MascotHands, type MascotMood } from '../components/Mascot'
import { IosInstallGuide, canPitch, detectPlatform, snoozePitch } from '../components/InstallGuide'
import { useInstallPrompt } from '../components/InstallApp'
import { greeting, recallUser } from '../lib/droidTalk'

/*
 * Mascote do login (só no navegador; no app Android não aparece):
 *  sobe de trás do cartão e segura na borda → acena → mostra o app na mão e faz o convite certo:
 *    Android  → baixar o app (APK)
 *    iPhone   → guia de "Adicionar à Tela de Início" (o iOS não deixa um site se instalar sozinho)
 *    Computador (Chrome/Edge) → instala como app em um clique; Safari do Mac → "Adicionar ao Dock"
 *  e-mail: olha o que você digita e reconhece quem já entrou neste aparelho
 *  senha: tapa os olhos (e de vez em quando dá uma espiadinha)
 *  senha errada: balança a cabeça · "Agora não": fica tristinho e afunda um pouco
 */
const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

const PITCH = {
  android: 'Psiu! 📲 No Android eu abro num toque, até sem sinal. Me leva no bolso?',
  ios: 'Sou do time Android, mas abro uma exceção pro seu iPhone 😅 Me coloca na Tela de Início?',
  desktop: 'Que tal me ter como app no computador? Um clique e eu abro direto, sem caçar aba 🖥️',
  'mac-safari': 'Que tal me ter como app no Mac? Eu fico no Dock e abro direto, sem caçar aba 🖥️',
} as const

type Bubble = { kind: 'text'; text: string } | { kind: 'pitch' } | { kind: 'android-done' } | { kind: 'mac-howto' } | null

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

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const buddy = !isNative
  const wide = useWide()

  // ---------- mascote
  const [platform] = useState(detectPlatform)
  const install = useInstallPrompt()
  const [mood, setMood] = useState<MascotMood>('happy')
  const [hands, setHands] = useState<MascotHands>('grip')
  const [anim, setAnim] = useState<{ a: MascotAnim; k: number }>({ a: 'rise', k: 0 })
  const [look, setLook] = useState<{ x: number; y: number } | null>(null)
  const [sunk, setSunk] = useState(false)
  const [bubble, setBubble] = useState<Bubble>(null)
  const [guide, setGuide] = useState(false)
  const [pwFocus, setPwFocus] = useState(false)
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => clearAll, [])
  const play = (a: MascotAnim) => setAnim(s => ({ a, k: s.k + 1 }))
  const say = (text: string) => setBubble({ kind: 'text', text })
  const eligible = () => canPitch(platform, install.canPrompt)
  const deviceKind = platform === 'desktop' || platform === 'mac-safari' ? 'desktop' : 'phone'
  const pitching = bubble?.kind === 'pitch' || bubble?.kind === 'mac-howto'

  const pitch = () => {
    clearAll(); setSunk(false); setMood('happy'); setHands('hold'); setLook({ x: 0.7, y: -0.5 }); setBubble({ kind: 'pitch' })
    later(() => setLook(null), 1400)
  }

  // chegada: sobe, acena e (se fizer sentido) mostra o app
  useEffect(() => {
    if (!buddy) return
    later(() => { setHands('wave'); say('Oi! 👋') }, 950)
    later(() => {
      setHands('grip')
      if (eligible()) pitch()
      else say('Bora entrar? Eu seguro o cartão pra você 😄')
    }, 2500)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // no Chrome/Edge do computador o convite de instalação chega alguns instantes depois
  const pitchedLate = useRef(false)
  useEffect(() => {
    if (!buddy || platform !== 'desktop' || !install.canPrompt || pitchedLate.current) return
    pitchedLate.current = true
    if (bubble?.kind === 'text' && !email && !password && !pwFocus && eligible()) later(pitch, 400)
  }, [install.canPrompt]) // eslint-disable-line react-hooks/exhaustive-deps

  const notNow = () => {
    snoozePitch(3)
    clearAll(); setHands('grip'); setMood('sad'); setSunk(true); setLook({ x: 0, y: 0.8 })
    say('Tudo bem… 🥲 Se mudar de ideia, é só tocar em mim.')
    later(() => { setMood('happy'); setSunk(false); setLook(null) }, 3800)
  }

  const celebrate = (text: string) => {
    clearAll(); setHands('grip'); setMood('love'); setSunk(false); play('jump'); say(text)
    later(() => setMood('happy'), 3200)
  }

  const accept = async () => {
    if (platform === 'android') {
      clearAll(); setHands('grip'); setMood('love'); play('jump'); setBubble({ kind: 'android-done' })
      snoozePitch(30)
      later(() => setMood('happy'), 3200)
      return
    }
    if (platform === 'ios') { setGuide(true); setMood('curious'); setHands('grip'); return }
    if (platform === 'mac-safari') { setBubble({ kind: 'mac-howto' }); return }
    const r = await install.prompt()
    if (r === 'accepted') { snoozePitch(365); celebrate('Pronto! Agora eu moro no seu computador 🏠💚') }
    else if (r === 'dismissed') notNow()
  }

  const closeGuide = () => {
    setGuide(false); snoozePitch(7)
    celebrate('Valeu! Te espero na Tela de Início 😉')
  }

  const FUN = ['Ei, faz cócegas! 😆', 'Tô aqui firme segurando o cartão 💪', 'Psiu… a senha eu não olho, prometo 🙈']
  const funIdx = useRef(0)
  const tapBuddy = () => {
    if (pwFocus) return
    if (eligible() && !pitching) { play('giggle'); pitch(); return }
    clearAll(); play('giggle'); setMood('wink'); say(FUN[funIdx.current++ % FUN.length])
    later(() => setMood('happy'), 1800)
  }

  // ---------- e-mail: olha o que está sendo digitado e reconhece quem já entrou aqui
  const lookAtEmail = (len: number) => setLook({ x: Math.min(0.9, -0.3 + len / 26), y: 1 })
  const onEmailFocus = () => {
    if (!buddy) return
    if (!pitching) { setHands('grip'); setMood('curious') }
    lookAtEmail(email.length)
  }
  useEffect(() => {
    if (!buddy || !EMAIL_OK.test(email)) return
    const t = window.setTimeout(() => {
      const known = recallUser(email)
      clearAll(); setHands('grip'); setMood('wink'); play('giggle')
      say(known ? `${greeting(known.name, known.uf)} 💚` : 'Prazer! 😊 Ainda não te conheço por aqui.')
    }, 700)
    return () => clearTimeout(t)
  }, [email]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- senha: tapa os olhos; às vezes dá uma espiadinha
  const shownShy = useRef(false)
  const onPwFocus = () => {
    if (!buddy) return
    setPwFocus(true); clearAll(); setSunk(false)
    setHands('cover'); setMood('shy'); setLook({ x: 0, y: 0.2 })
    if (!shownShy.current) { shownShy.current = true; say('Não tô olhando! 🙈') } else setBubble(null)
  }
  const onPwBlur = () => {
    if (!buddy) return
    setPwFocus(false); clearAll(); setHands('grip'); setMood('happy'); setLook(null)
  }
  const onPwKey = (len: number) => {
    if (!buddy || len < 3 || Math.random() > 0.22) return
    clearAll()
    setHands('peek'); setMood('curious'); setLook({ x: 0.5, y: 1 }); say('…só uma espiadinha 👀')
    later(() => { setHands('cover'); setMood('shy'); setLook({ x: 0, y: 0.2 }); say('Brincadeira! 🙈') }, 750)
    later(() => setBubble(null), 2200)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    if (buddy) { clearAll(); setHands('grip'); setMood('happy'); setLook({ x: 0.2, y: 1 }); say('Cruzando os dedos… 🤞') }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error.message.includes('Invalid login') ? new Error('E-mail ou senha incorretos') : error
      if (buddy) { setMood('love'); play('jump'); say('Entrando! 🚀') }
    } catch (err) {
      toast.error(errMsg(err))
      if (buddy) {
        setMood('oops'); play('shake'); setLook(null); say('Hmm… e-mail ou senha não bateram. Tenta de novo? 🤔')
        later(() => setMood('happy'), 2600)
      }
    } finally {
      setBusy(false)
    }
  }

  const field = 'rounded-none shadow-none focus:shadow-none bg-transparent dark:bg-transparent dark:shadow-none h-12'
  const SIZE = wide ? 132 : 112
  const pill = 'press inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold'

  const bubbleBody = (() => {
    if (!bubble) return null
    if (bubble.kind === 'text') return <p>{bubble.text}</p>
    if (bubble.kind === 'android-done') return (
      <>
        <p>Ebaaa! 💚 Quando o download terminar, toque no arquivo para instalar.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a href={APK_URL} download className={cn(pill, 'bg-[#3ddc84] text-neutral-900')}><Download className="size-3.5" />Baixar de novo</a>
          <Link to="/android" className="text-[12.5px] font-medium text-accent-600 dark:text-accent-400">Como instalar</Link>
        </div>
      </>
    )
    if (bubble.kind === 'mac-howto') return (
      <>
        <p>É rapidinho: no menu <b>Arquivo</b> do Safari, escolha <b>Adicionar ao Dock</b> e depois <b>Adicionar</b>. 😉</p>
        <button type="button" onClick={() => { snoozePitch(30); celebrate('Valeu! Te vejo no Dock 💚') }} className={cn(pill, 'mt-2 bg-accent-600 text-white')}>Pronto, adicionei</button>
      </>
    )
    const p = platform as keyof typeof PITCH
    return (
      <>
        <p>{PITCH[p] ?? PITCH.desktop}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {platform === 'android'
            ? <a href={APK_URL} download onClick={() => { accept() }} className={cn(pill, 'bg-[#3ddc84] text-neutral-900')}><Download className="size-3.5" />Baixar o app</a>
            : <button type="button" onClick={accept} className={cn(pill, 'bg-accent-600 text-white')}>
              {platform === 'ios' ? <><PlusSquare className="size-3.5" />Instalar</> : platform === 'mac-safari' ? <><MonitorDown className="size-3.5" />Mostrar como</> : <><MonitorDown className="size-3.5" />Instalar em 1 clique</>}
            </button>}
          <button type="button" onClick={notNow} className="text-[12.5px] font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">Agora não</button>
        </div>
      </>
    )
  })()

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center overflow-x-hidden px-5 py-10">
      <div className="w-full max-w-[360px] fade-up">
        <div className="flex flex-col items-center text-center">
          <Logo size={buddy ? 56 : 64} />
          <h1 className="mt-4 text-[28px] font-bold tracking-tight text-neutral-900 dark:text-white">Fields</h1>
          <p className="mt-1 text-[15px] text-neutral-500">Central de tutoriais · Quallit Soluções em TI</p>
        </div>

        <form onSubmit={submit} className={cn('relative space-y-4', buddy ? 'mt-[150px] lg:mt-[140px]' : 'mt-8')}>
          <div className="relative">
          {buddy && (
            <>
              <button type="button" onClick={tapBuddy} aria-label="Mascote do Fields" tabIndex={-1}
                className="absolute left-0 z-10 block outline-none [-webkit-tap-highlight-color:transparent]" style={{ bottom: `calc(100% - ${SIZE * (8 / 124)}px)` }}>
                <Mascot size={SIZE} mood={mood} hands={hands} anim={anim.a} animKey={anim.k} look={look} sunk={sunk} device={deviceKind} />
              </button>
              {bubbleBody && (
                <div aria-live="polite" key={bubble?.kind === 'text' ? bubble.text : bubble?.kind}
                  className="bubble-in absolute bottom-[calc(100%+12px)] right-0 z-10 rounded-[16px] rounded-bl-[5px] bg-surface px-3.5 py-2.5 text-[13.5px] leading-snug text-neutral-800 shadow-[0_0_0_0.5px_rgb(0_0_0/0.1),0_10px_28px_-8px_rgb(0_0_0/0.3)] dark:bg-neutral-800 dark:text-neutral-100"
                  style={{ left: SIZE + 2, transformOrigin: '0% 100%' }}>
                  {bubbleBody}
                </div>
              )}
            </>
          )}

          <div className="card divide-y divide-neutral-200 overflow-hidden dark:divide-neutral-800">
            <input required type="email" className={cn(inputCls, field)} value={email}
              onChange={e => { setEmail(e.target.value); if (buddy) lookAtEmail(e.target.value.length) }}
              onFocus={onEmailFocus} onBlur={() => { if (buddy) setLook(null) }}
              placeholder="E-mail" autoComplete="email" inputMode="email" autoCapitalize="none" />
            <input required type="password" className={cn(inputCls, field)} value={password}
              onChange={e => { setPassword(e.target.value); onPwKey(e.target.value.length) }}
              onFocus={onPwFocus} onBlur={onPwBlur}
              placeholder="Senha" autoComplete="current-password" />
          </div>
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

        {buddy && platform !== 'android' && <Link to="/android" className="mx-auto mt-5 flex w-fit items-center gap-1.5 text-[13px] font-medium text-accent-600 dark:text-accent-400"><Download className="size-3.5" />Tem Android? Baixe o app</Link>}
        <VersionTag className="mt-6" />
      </div>
      {guide && <IosInstallGuide onClose={closeGuide} />}
    </div>
  )
}
