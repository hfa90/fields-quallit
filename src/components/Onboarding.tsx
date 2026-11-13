import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, Zap, Mic, Award, Heart, HandHelping, ChevronRight, ChevronLeft, BookOpenText, Users, BadgeCheck } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { ANDROID_PREF, usePref } from '../lib/prefs'
import { isNative } from '../lib/native'
import { useCdUf, cdShort } from '../lib/cds'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import StateBadge from './StateBadge'
import { QuallitMark } from './QuallitLogo'

const NEW_DAYS = 30
const listeners = new Set<() => void>()
/** Abre o tour de boas-vindas de novo (ex.: pelo Perfil) */
export function openOnboarding() { listeners.forEach(l => l()) }

/** Quem é novo na central e ainda não viu as boas-vindas */
export function useOnboardingPending() {
  const { profile } = useAuth()
  const [state] = usePref('onboarding', ['pending', 'done'] as const, 'pending')
  if (!profile || !['field', 'field_admin', 'admin'].includes(profile.role)) return false
  const isNew = Date.now() - new Date(profile.created_at).getTime() < NEW_DAYS * 86400000
  return isNew && state !== 'done'
}

/** Ao abrir o app Android, marca na conta (o cartão "baixe o app" some também no site) */
export function MarkAndroidApp() {
  const { profile } = useAuth()
  const [v, set] = usePref('android_app', ANDROID_PREF, 'no')
  useEffect(() => { if (isNative && profile && v !== 'yes') set('yes') }, [profile?.id, v])
  return null
}

function Illus({ children, color }: { children: ReactNode; color: string }) {
  return (
    <div className="relative mx-auto grid size-[150px] place-items-center">
      <div className="absolute inset-0 rounded-full opacity-25 blur-2xl" style={{ background: color }} />
      <div className="absolute inset-3 rounded-full" style={{ background: `${color}1f` }} />
      <div className="relative">{children}</div>
    </div>
  )
}

function Bubble({ icon: I, color, className }: { icon: typeof Search; color: string; className?: string }) {
  return <span className={cn('absolute grid size-10 place-items-center rounded-full bg-white shadow-lg dark:bg-neutral-800', className)} style={{ color }}><I className="size-5" /></span>
}

/** Boas-vindas para o primeiro acesso de um Field */
export function Onboarding() {
  const { profile } = useAuth()
  const pending = useOnboardingPending()
  const [, setDone] = usePref('onboarding', ['pending', 'done'] as const, 'pending')
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [cd, setCd] = useState<string | null>(null)
  const ufOf = useCdUf()
  const nav = useNavigate()

  useEffect(() => { if (pending) setOpen(true) }, [pending])
  useEffect(() => {
    const l = () => { setStep(0); setOpen(true) }
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  useEffect(() => {
    if (!open || !profile) return
    supabase.rpc('kb_cd_of', { p_user: profile.id }).then(({ data }) => setCd((data as string) ?? null))
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open, profile])

  if (!open || !profile) return null
  const first = profile.full_name?.split(' ')[0] ?? ''
  const uf = ufOf(cd)

  const finish = (to?: string) => { setDone('done'); setOpen(false); if (to) nav(to) }

  const steps: { title: string; text: ReactNode; art: ReactNode }[] = [
    {
      title: `Bem-vindo(a), ${first}!`,
      text: <>Aqui fica tudo o que os Fields da Quallit já resolveram em campo — {cd ? <>e agora você faz parte dessa rede pelo <b>{cdShort(cd)}</b>.</> : 'e agora você faz parte dessa rede.'}</>,
      art: (
        <Illus color="#1a9ca9">
          {uf ? <span className="state-pop block"><StateBadge uf={uf} size={110} /></span> : <QuallitMark size={84} />}
          <Bubble icon={Users} color="#1a9ca9" className="-right-6 -top-2" />
        </Illus>
      ),
    },
    {
      title: 'Travou em algo? Busque primeiro',
      text: <>Escreva do jeito que você falaria: <i>“impressora zebra não imprime”</i>, <i>“coletor sem wi-fi”</i>. A busca entende sinônimos e erros de digitação. Não achou? Peça ajuda em <b>Comunidade</b> — os colegas são avisados.</>,
      art: (
        <Illus color="#0b5fb0">
          <span className="grid size-24 place-items-center rounded-[28px] bg-white text-[#0b5fb0] shadow-xl dark:bg-neutral-800"><Search className="size-11" strokeWidth={2.2} /></span>
          <Bubble icon={HandHelping} color="#fe811e" className="-bottom-3 -right-7" />
        </Illus>
      ),
    },
    {
      title: 'Resolveu? Conte em 30 segundos',
      text: <>Toque no botão laranja <b>+</b> e escolha <b>Dica rápida</b>. Dá para falar em vez de digitar: o Fields pergunta qual era o problema e depois como você resolveu.</>,
      art: (
        <Illus color="#fe811e">
          <span className="grid size-24 place-items-center rounded-full bg-brand-orange text-white shadow-xl"><Mic className="size-11" strokeWidth={2.2} /></span>
          <Bubble icon={Zap} color="#fe811e" className="-left-7 -top-1" />
        </Illus>
      ),
    },
    {
      title: 'Seu conhecimento vale pontos',
      text: <>Cada publicação, “Funcionou!” e “Obrigado” recebido soma pontos e sobe seu nível. Os melhores tutoriais ganham o selo <b>Verificado</b>, e você vê quantos colegas e CDs ajudou.</>,
      art: (
        <Illus color="#34c759">
          <span className="grid size-24 place-items-center rounded-[28px] bg-white text-[#248a3d] shadow-xl dark:bg-neutral-800"><Award className="size-11" strokeWidth={2.2} /></span>
          <Bubble icon={Heart} color="#ff2d55" className="-right-7 -top-2" />
          <Bubble icon={BadgeCheck} color="#1a9ca9" className="-bottom-3 -left-6" />
        </Illus>
      ),
    },
  ]
  const last = step === steps.length - 1
  const s = steps[step]

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Boas-vindas">
      <div className="absolute inset-0 bg-black/50 animate-in" />
      <div className="sheet-in relative w-full overflow-hidden rounded-t-[22px] bg-white shadow-2xl sm:max-w-md sm:rounded-[22px] dark:bg-neutral-900">
        <button onClick={() => finish()} className="absolute right-4 top-4 z-10 rounded-full px-3 py-1 text-[14px] font-medium text-neutral-500 hover:bg-neutral-900/5 dark:hover:bg-white/10">Pular</button>
        <div key={step} className="fade-up px-6 pb-2 pt-10 text-center">
          {s.art}
          <h2 className="mt-6 text-[23px] font-bold tracking-tight text-neutral-900 dark:text-white">{s.title}</h2>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">{s.text}</p>
        </div>
        <div className="flex justify-center gap-1.5 py-4" aria-hidden>
          {steps.map((_, i) => <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-accent-600' : 'w-1.5 bg-neutral-300 dark:bg-neutral-700')} />)}
        </div>
        <div className="pb-safe px-5 pb-5">
          {last ? (
            <div className="grid gap-2">
              <button onClick={() => finish('/dica')} className="press flex h-12 items-center justify-center gap-2 rounded-[14px] bg-brand-orange text-[16px] font-semibold text-white"><Zap className="size-5" />Publicar minha primeira dica</button>
              <button onClick={() => finish()} className="press flex h-12 items-center justify-center gap-2 rounded-[14px] bg-neutral-900/[.06] text-[16px] font-semibold text-neutral-800 dark:bg-white/10 dark:text-neutral-100"><BookOpenText className="size-5" />Explorar a biblioteca</button>
            </div>
          ) : (
            <div className="flex gap-2">
              {step > 0 && <button onClick={() => setStep(step - 1)} aria-label="Voltar" className="press grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-neutral-900/[.06] text-neutral-700 dark:bg-white/10 dark:text-neutral-200"><ChevronLeft className="size-5" /></button>}
              <button onClick={() => setStep(step + 1)} className="press flex h-12 flex-1 items-center justify-center gap-1 rounded-[14px] bg-accent-600 text-[16px] font-semibold text-white">Continuar<ChevronRight className="size-5" /></button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
