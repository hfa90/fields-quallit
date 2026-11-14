import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Check, RotateCcw, Download, Keyboard } from 'lucide-react'
import { APK_URL, openExternal } from '../lib/native'
import { SpeechError, appendSentence, listen, speechEngine, type Listening } from '../lib/speech'
import { cn } from '../lib/utils'
import { QuallitMark } from './QuallitLogo'
import { Button, Modal } from './ui'

type Field = 'problem' | 'solution'
type Stage = 'idle' | 'problem' | 'between' | 'solution' | 'done'

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)]
const first = (n?: string | null) => (n ?? '').trim().split(/\s+/)[0] || ''

const SAY = {
  askProblem: (n: string) => pick([
    `Bora registrar isso${n ? `, ${n}` : ''}! Primeiro me conta: qual foi o problema?`,
    `Vamos lá${n ? `, ${n}` : ''}. O que estava acontecendo aí?`,
    `Oi${n ? `, ${n}` : ''}! Me conta rapidinho qual problema apareceu.`,
  ]),
  gotProblem: (p: string) => pick([
    `Entendi — “${short(p)}”. Agora me conta como você resolveu. Pode ir passo a passo, com calma.`,
    `Anotado! E como você resolveu? Fala do seu jeito que eu vou escrevendo.`,
    `Beleza. Agora a parte boa: o que você fez para resolver?`,
  ]),
  askSolution: () => pick([
    'Agora me conta como você resolveu. Pode falar com calma, passo a passo.',
    'Pode falar como resolveu — eu vou anotando.',
  ]),
  askMore: () => pick(['Quer acrescentar mais alguma coisa à solução? Pode falar.', 'Tem mais algum detalhe? Estou ouvindo.']),
  done: () => pick([
    'Ficou ótimo! Dá uma conferida no texto e, se quiser, coloca uma foto. Depois é só publicar. 🙌',
    'Perfeito! Revisa rapidinho, adiciona uma foto se tiver, e publica. Vai ajudar muita gente. 💪',
  ]),
  noHear: () => pick(['Não consegui te ouvir direito… tenta de novo, um pouco mais perto do microfone?', 'Hmm, não peguei. Pode repetir?']),
}
const short = (t: string) => (t.length > 60 ? `${t.slice(0, 57)}…` : t)

interface Props {
  name?: string | null
  problem: string
  solution: string
  setProblem: (v: string) => void
  setSolution: (v: string) => void
  /** campo que está recebendo a fala (para destacar na tela) */
  onActive: (f: Field | null) => void
}

/** Assistente que conduz o ditado: primeiro o problema, depois a solução */
export default function VoiceGuide({ name, problem, solution, setProblem, setSolution, onActive }: Props) {
  const engine = speechEngine()
  const [stage, setStage] = useState<Stage>('idle')
  const [msg, setMsg] = useState('')
  const [live, setLive] = useState('')
  const [help, setHelp] = useState<null | 'update' | 'unsupported' | 'denied'>(null)
  const session = useRef<Listening | null>(null)
  const alive = useRef(true)
  const latest = useRef({ problem, solution })
  useEffect(() => { latest.current = { problem, solution } }, [problem, solution])
  useEffect(() => () => { alive.current = false; session.current?.stop() }, [])

  const vibrate = (ms = 20) => { try { navigator.vibrate?.(ms) } catch { /* ignore */ } }

  const handleError = (e: unknown) => {
    const code = e instanceof SpeechError ? e.code : 'other'
    if (code === 'needs-app-update') setHelp('update')
    else if (code === 'unavailable') setHelp('unsupported')
    else if (code === 'not-allowed') setHelp('denied')
    else { setMsg(SAY.noHear()); setStage('idle'); onActive(null); return }
    setStage('idle'); onActive(null); setMsg('')
  }

  const askSolution = async (intro: string) => {
    setStage('solution'); onActive('solution'); setMsg(intro); setLive(''); vibrate()
    const base = latest.current.solution
    const s = listen({ continuous: true, onPartial: t => setLive(t) })
    session.current = s
    try {
      const text = await s.done
      if (!alive.current) return
      if (text) setSolution(appendSentence(base, text))
      setLive('')
      setStage('done'); onActive(null); setMsg(text || base ? SAY.done() : SAY.noHear()); vibrate(30)
    } catch (e) { setLive(''); handleError(e) }
  }

  const start = async () => {
    if (engine === 'needs-app-update') { setHelp('update'); return }
    if (engine === 'none') { setHelp('unsupported'); return }
    const { problem: p, solution: sol } = latest.current
    if (!p.trim()) {
      setStage('problem'); onActive('problem'); setMsg(SAY.askProblem(first(name))); setLive(''); vibrate()
      const s = listen({ onPartial: t => setLive(t) })
      session.current = s
      try {
        const text = (await s.done).replace(/[.!]$/, '')
        if (!alive.current) return
        setLive('')
        if (!text) { setStage('idle'); onActive(null); setMsg(SAY.noHear()); return }
        setProblem(text)
        const next = SAY.gotProblem(text)
        setStage('between'); setMsg(next); onActive('solution')
        await new Promise(r => setTimeout(r, 1600)) // tempo para ler a mensagem, como numa conversa
        if (!alive.current) return
        await askSolution(next)
      } catch (e) { setLive(''); handleError(e) }
      return
    }
    await askSolution(sol.trim() ? SAY.askMore() : SAY.askSolution())
  }

  const finish = () => { session.current?.stop() }
  const listening = stage === 'problem' || stage === 'solution'

  return (
    <div className="space-y-3">
      {stage === 'idle' || stage === 'done' ? (
        <button type="button" onClick={start}
          className="press group relative flex w-full items-center gap-4 overflow-hidden rounded-[18px] bg-brand-orange p-4 text-left text-white shadow-lg shadow-brand-orange/35">
          <span className="relative grid size-14 shrink-0 place-items-center rounded-full bg-white/20">
            <span className="absolute inset-0 animate-ping rounded-full bg-white/25 [animation-duration:2.4s]" />
            <Mic className="relative size-7" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-bold leading-tight">{stage === 'done' ? 'Falar mais' : 'Contar por voz'}</span>
            <span className="block text-[13px] text-white/85">{!problem.trim() ? 'Eu te guio: primeiro o problema, depois a solução' : 'Fale como você resolveu'}</span>
          </span>
        </button>
      ) : null}

      {(msg || listening || stage === 'between') && (
        <div className="flex items-start gap-3 fade-up">
          <QuallitMark size={34} />
          <div className="min-w-0 flex-1">
            <div className="rounded-[18px] rounded-tl-[6px] bg-surface px-4 py-3 text-[15px] leading-relaxed text-neutral-800 shadow-[0_0_0_0.5px_rgb(0_0_0/0.08)] dark:bg-neutral-800 dark:text-neutral-100">
              {msg}
            </div>
            {listening && (
              <div className="mt-2 rounded-[14px] border border-brand-orange/40 bg-brand-orange/[.06] px-4 py-3">
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-brand-orange-dark">
                  <span className="flex h-4 items-end gap-[3px]">
                    {[0, 1, 2, 3, 4].map(i => <span key={i} className="w-[3px] animate-pulse rounded-full bg-brand-orange" style={{ height: `${6 + ((i * 7) % 10)}px`, animationDelay: `${i * 120}ms` }} />)}
                  </span>
                  {stage === 'problem' ? 'Ouvindo · Qual era o problema?' : 'Ouvindo · Como você resolveu?'}
                </div>
                <p className={cn('mt-1.5 min-h-[1.5em] whitespace-pre-wrap text-[15px]', live ? 'text-neutral-900 dark:text-white' : 'italic text-neutral-400')}>
                  {live || 'Pode falar…'}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={finish} className="bg-brand-orange hover:bg-brand-orange-dark dark:bg-brand-orange">
                    {stage === 'solution' ? <><Check className="size-4" />Pronto</> : <><Square className="size-3.5" />Parar</>}
                  </Button>
                  {stage === 'solution' && <span className="self-center text-[12px] text-neutral-500">Pode fazer pausas; toque em “Pronto” quando terminar.</span>}
                </div>
              </div>
            )}
            {stage === 'done' && (
              <button type="button" onClick={() => { setProblem(''); setSolution(''); setStage('idle'); setMsg('') }}
                className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-neutral-500">
                <RotateCcw className="size-3.5" />Recomeçar do zero
              </button>
            )}
          </div>
        </div>
      )}

      <Modal open={!!help} onClose={() => setHelp(null)} title={help === 'update' ? 'Atualize o app para falar' : help === 'denied' ? 'Permita o microfone' : 'Ditado por voz'}>
        <div className="space-y-4 text-[15px] text-neutral-700 dark:text-neutral-300">
          {help === 'update' && <>
            <p>O ditado por voz precisa da <b>nova versão do app Android</b>. Baixe e instale por cima da atual — seus dados continuam.</p>
            <Button className="h-11 w-full" onClick={() => openExternal(APK_URL)}><Download className="size-4" />Baixar nova versão do app</Button>
            <p className="flex gap-2 text-[13px] text-neutral-500"><Keyboard className="mt-0.5 size-4 shrink-0" />Enquanto isso, toque no campo e use o <b>microfone do teclado</b> para ditar.</p>
          </>}
          {help === 'denied' && <>
            <p>O Fields precisa de permissão para usar o microfone.</p>
            <p className="text-[14px] text-neutral-500">No celular: <b>Configurações → Apps → Fields → Permissões → Microfone → Permitir</b>. No navegador: toque no cadeado da barra de endereço e libere o microfone.</p>
          </>}
          {help === 'unsupported' && <>
            <p>Este navegador não oferece ditado por voz.</p>
            <p className="flex gap-2 text-[14px] text-neutral-500"><Keyboard className="mt-0.5 size-4 shrink-0" />Toque no campo de texto e use o <b>microfone do teclado</b> do celular, ou abra no Chrome / no app Android.</p>
          </>}
        </div>
      </Modal>
    </div>
  )
}
