import { useCallback, useEffect, useRef, useState } from 'react'

type Rec = {
  lang: string; continuous: boolean; interimResults: boolean
  start: () => void; stop: () => void; abort: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

function ctor(): (new () => Rec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** O navegador permite ditar direto na página? (Chrome/Edge sim; no app Android usa-se o microfone do teclado) */
export const speechSupported = () => !!ctor()

/**
 * Ditado por voz em português. Chama onText com cada trecho final reconhecido.
 */
export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Rec | null>(null)
  const cb = useRef(onText)
  useEffect(() => { cb.current = onText }, [onText])

  const stop = useCallback(() => { rec.current?.stop(); setListening(false) }, [])

  const start = useCallback(() => {
    const C = ctor()
    if (!C) { setError('unsupported'); return }
    setError(null)
    const r = new C()
    r.lang = 'pt-BR'; r.continuous = true; r.interimResults = false
    r.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) cb.current(res[0].transcript.trim())
      }
    }
    r.onerror = e => { setError(e.error); setListening(false) }
    r.onend = () => setListening(false)
    rec.current = r
    try { r.start(); setListening(true) } catch { setListening(false) }
  }, [])

  useEffect(() => () => rec.current?.abort(), [])
  return { listening, error, start, stop, supported: speechSupported() }
}
