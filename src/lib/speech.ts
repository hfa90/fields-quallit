import { Capacitor } from '@capacitor/core'

/**
 * Reconhecimento de voz em português.
 *  - App Android: reconhecimento nativo do Google (plugin @capacitor-community/speech-recognition)
 *  - Navegador (Chrome, Edge, Safari): Web Speech API
 * O texto passa por uma limpeza: pontuação falada, termos técnicos, passos numerados e maiúsculas.
 */
export type Engine = 'native' | 'web' | 'needs-app-update' | 'none'

type WebRec = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number
  start: () => void; stop: () => void; abort: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}
const webCtor = () => {
  const w = window as unknown as { SpeechRecognition?: new () => WebRec; webkitSpeechRecognition?: new () => WebRec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function speechEngine(): Engine {
  if (Capacitor.isNativePlatform()) return Capacitor.isPluginAvailable('SpeechRecognition') ? 'native' : 'needs-app-update'
  return webCtor() ? 'web' : 'none'
}

// ---------------------------------------------------------------- limpeza do texto
const NUM: Record<string, string> = { um: '1', uma: '1', primeiro: '1', dois: '2', duas: '2', segundo: '2', tres: '3', três: '3', terceiro: '3', quatro: '4', quarto: '4', cinco: '5', quinto: '5', seis: '6', sexto: '6', sete: '7', sétimo: '7', oito: '8', oitavo: '8', nove: '9', nono: '9', dez: '10', décimo: '10' }

// Termos de TI e de CD que o reconhecedor costuma escrever "do jeito que se fala"
const VOCAB: [RegExp, string | ((m: string) => string)][] = [
  [/\bv\s?p\s?n\b|\bv[eê] p[eê] (?:ene|n)\b/gi, 'VPN'],
  [/\b(?:wi[\s-]?fi|wai[\s-]?fai|uai[\s-]?fai)\b/gi, 'Wi-Fi'],
  [/\bblu[ e]?t[ou]{1,2}(?:th|fe|fi)\b/gi, 'Bluetooth'],
  [/\bwindows\b/gi, 'Windows'], [/\blinux\b/gi, 'Linux'], [/\bandroid\b/gi, 'Android'],
  [/\b(?:u[ ]?esse[ ]?b[eê]|usb)\b/gi, 'USB'], [/\bssd\b/gi, 'SSD'], [/\bhd\b/gi, 'HD'],
  [/\b(?:d[eê] ag[aá] c[eê] p[eê]|d h c p|dhcp)\b/gi, 'DHCP'], [/\b(?:d[eê] ene esse|d n s|dns)\b/gi, 'DNS'],
  [/\b(?:no|do|ao|o|nosso|pelo) cd\b/gi, m => m.slice(0, -2) + 'CD'],
  [/\b(?:i[ ]?p[eê]|endereço ip)\b/gi, m => m.toLowerCase().startsWith('endere') ? 'endereço IP' : 'IP'],
  [/\bwms\b/gi, 'WMS'], [/\bsap\b/gi, 'SAP'], [/\berp\b/gi, 'ERP'], [/\bbios\b/gi, 'BIOS'], [/\bpc\b/gi, 'PC'],
  [/\bzebra\b/gi, 'Zebra'], [/\bhoneywell\b/gi, 'Honeywell'], [/\bmotorola\b/gi, 'Motorola'], [/\bdatalogic\b/gi, 'Datalogic'],
  [/\bforti[ ]?client\b/gi, 'FortiClient'], [/\bnetskope\b/gi, 'Netskope'], [/\boffice\b/gi, 'Office'], [/\boutlook\b/gi, 'Outlook'],
  [/\bteams\b/gi, 'Teams'], [/\bchrome\b/gi, 'Chrome'], [/\bexcel\b/gi, 'Excel'],
  [/\bqr[ ]?code\b/gi, 'QR code'], [/\b(?:c[oó]digo de barras)\b/gi, 'código de barras'],
]
const vocabHits = (t: string) => VOCAB.reduce((n, [re]) => n + ((t.match(re) || []).length), 0)

/** Escolhe a melhor alternativa: confiança do reconhecedor + bônus para termos conhecidos */
export function pickBest(alts: { text: string; confidence?: number }[]) {
  return alts.slice().sort((a, b) => ((b.confidence ?? 0.5) + vocabHits(b.text) * 0.08) - ((a.confidence ?? 0.5) + vocabHits(a.text) * 0.08))[0]?.text ?? ''
}

export function cleanSpeech(raw: string) {
  let t = ` ${raw} `
  // comandos falados
  t = t.replace(/\s*\b(?:ponto de interroga[cç][aã]o|interroga[cç][aã]o)\b/gi, '?')
  t = t.replace(/\s*\bponto de exclama[cç][aã]o\b/gi, '!')
  t = t.replace(/\s*\bdois pontos\b/gi, ':')
  t = t.replace(/\s*\bponto e v[ií]rgula\b/gi, ';')
  t = t.replace(/\s*\bv[ií]rgula\b/gi, ',')
  t = t.replace(/\s*\bponto final\b/gi, '.')
  t = t.replace(/\s*\b(?:nova linha|pr[oó]xima linha|pula linha|par[aá]grafo)\b\s*/gi, '\n')
  // "passo um", "etapa dois", "primeiro passo" => lista numerada
  t = t.replace(/\b(?:passo|etapa)\s+(\d+|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\b[\s:,.-]*/gi, (_m, n) => `\n${NUM[n.toLowerCase()] ?? n}. `)
  t = t.replace(/\b(primeiro|segundo|terceiro|quarto|quinto|sexto|s[eé]timo|oitavo|nono|d[eé]cimo)\s+passo\b[\s:,.-]*/gi, (_m, n) => `\n${NUM[n.toLowerCase()] ?? ''}. `)
  // termos técnicos
  for (const [re, rep] of VOCAB) t = typeof rep === 'string' ? t.replace(re, rep) : t.replace(re, rep)
  // espaços e maiúsculas
  t = t.replace(/[ \t]+/g, ' ').replace(/ +([,.;:?!])/g, '$1').replace(/([,;:])(?=\S)/g, '$1 ')
  t = t.split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => l.replace(/(^|[.!?]\s+|^\d+\.\s+)(\p{Ll})/gu, (_m, p, c) => p + c.toUpperCase())).join('\n')
  return t.trim()
}

/** Junta um trecho novo ao texto existente com pontuação natural */
export function appendSentence(prev: string, next: string) {
  const n = next.trim()
  if (!n) return prev
  if (!prev.trim()) return n
  if (n.startsWith('\n') || /^\d+\.\s/.test(n)) return `${prev.trimEnd()}\n${n.trim()}`
  return `${prev.trimEnd()}${/[.!?:;\n]$/.test(prev.trimEnd()) ? ' ' : '. '}${n}`
}

// ---------------------------------------------------------------- escuta
export interface ListenOptions {
  /** texto parcial enquanto a pessoa fala (para mostrar ao vivo) */
  onPartial?: (text: string) => void
  /** continua ouvindo frases seguidas até stop() (no Android o reconhecedor para sozinho no silêncio) */
  continuous?: boolean
}
export interface Listening { done: Promise<string>; stop: () => void }

export type SpeechErrorCode = 'not-allowed' | 'no-speech' | 'unavailable' | 'needs-app-update' | 'network' | 'other'
export class SpeechError extends Error {
  code: SpeechErrorCode
  constructor(code: SpeechErrorCode, msg?: string) { super(msg ?? code); this.code = code }
}

/** Ouve uma fala e devolve o texto já limpo */
export function listen(opts: ListenOptions = {}): Listening {
  const engine = speechEngine()
  if (engine === 'needs-app-update') return failed(new SpeechError('needs-app-update'))
  if (engine === 'none') return failed(new SpeechError('unavailable'))
  return engine === 'native' ? listenNative(opts) : listenWeb(opts)
}

function failed(e: SpeechError): Listening {
  return { done: Promise.reject(e), stop: () => {} }
}

function listenWeb(opts: ListenOptions): Listening {
  const C = webCtor()!
  let finals = ''
  let stopped = false
  let current: WebRec | null = null
  let silentRounds = 0
  const done = new Promise<string>((resolve, reject) => {
    const round = () => {
      const r = new C()
      current = r
      r.lang = 'pt-BR'; r.continuous = !!opts.continuous; r.interimResults = true; r.maxAlternatives = 5
      let gotSomething = false
      let error: SpeechError | null = null
      r.onresult = e => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          const alts = Array.from({ length: res.length }, (_, k) => ({ text: res[k].transcript, confidence: res[k].confidence }))
          if (res.isFinal) { finals = appendSentence(finals, cleanSpeech(pickBest(alts))); gotSomething = true }
          else interim += res[0].transcript
        }
        opts.onPartial?.(appendSentence(finals, cleanSpeech(interim)))
      }
      r.onerror = e => {
        error = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? new SpeechError('not-allowed')
          : e.error === 'no-speech' ? new SpeechError('no-speech')
          : e.error === 'network' ? new SpeechError('network')
          : e.error === 'aborted' ? null : new SpeechError('other', e.error)
      }
      r.onend = () => {
        silentRounds = gotSomething ? 0 : silentRounds + 1
        const fatal = error && error.code !== 'no-speech'
        // no celular o navegador para a cada pausa: recomeça até a pessoa tocar em "Pronto"
        if (opts.continuous && !stopped && !fatal && silentRounds < 2) { setTimeout(round, 150); return }
        if (error && !finals) reject(error); else resolve(finals)
      }
      try { r.start() } catch { /* já iniciado */ }
    }
    round()
  })
  return { done, stop: () => { stopped = true; try { current?.stop() } catch { /* ignore */ } } }
}

function listenNative(opts: ListenOptions): Listening {
  let stopFn = () => {}
  let stopped = false
  const done = (async () => {
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
    let perm = await SpeechRecognition.checkPermissions()
    if (perm.speechRecognition !== 'granted') perm = await SpeechRecognition.requestPermissions()
    if (perm.speechRecognition !== 'granted') throw new SpeechError('not-allowed')
    const { available } = await SpeechRecognition.available()
    if (!available) throw new SpeechError('unavailable')

    let finals = ''
    let current: string[] = []
    const run = () => new Promise<void>(res => {
      let ended = false
      const finish = () => { if (ended) return; ended = true; res() }
      Promise.all([
        SpeechRecognition.addListener('partialResults', d => {
          current = d.matches ?? current
          opts.onPartial?.(appendSentence(finals, cleanSpeech(pickBest(current.map(text => ({ text }))))))
        }),
        SpeechRecognition.addListener('listeningState', s => { if (s.status === 'stopped') finish() }),
      ]).then(async () => {
        try { await SpeechRecognition.start({ language: 'pt-BR', partialResults: true, popup: false, maxResults: 5 }) }
        catch { finish() }
      })
    })
    stopFn = () => { stopped = true; SpeechRecognition.stop().catch(() => {}) }
    // No modo contínuo, recomeça a ouvir a cada pausa até a pessoa tocar em "Pronto"
    let silentRounds = 0
    do {
      current = []
      await run()
      await SpeechRecognition.removeAllListeners()
      const chunk = cleanSpeech(pickBest(current.map(text => ({ text }))))
      if (chunk) { finals = appendSentence(finals, chunk); silentRounds = 0 } else silentRounds++
      if (navigator.vibrate) navigator.vibrate(12)
    } while (opts.continuous && !stopped && silentRounds < 2)
    return finals
  })()
  return { done, stop: () => stopFn() }
}
