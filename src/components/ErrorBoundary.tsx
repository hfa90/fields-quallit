import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw, Home, AlertTriangle } from 'lucide-react'

/** Erro típico de quando o site foi atualizado e o arquivo de uma tela antiga não existe mais */
export function isChunkError(e: unknown) {
  const m = String((e as { message?: string })?.message ?? e)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch|ChunkLoadError|Loading chunk|MIME type/i.test(m)
}

const KEY = 'fq-chunk-reload'
/** Recarrega uma única vez (evita laço) para buscar a versão nova do site */
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last < 15000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch { /* ignore */ }
  window.location.reload()
  return true
}

interface Props { children: ReactNode; resetKey?: string; full?: boolean }
interface State { error: unknown }

/**
 * Rede de segurança: se uma tela falhar ao abrir, mostra uma mensagem com opções
 * em vez de deixar a tela vazia/escura. Atualizações do site são aplicadas automaticamente.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State { return { error } }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Falha ao exibir tela:', error, info.componentStack)
    if (isChunkError(error)) reloadForNewVersion()
  }

  componentDidUpdate(prev: Props) {
    // trocar de tela limpa o erro
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    const chunk = isChunkError(this.state.error)
    const base = import.meta.env.BASE_URL
    return (
      <div className={this.props.full ? 'grid min-h-dvh place-items-center bg-neutral-50 p-6 dark:bg-neutral-950' : 'grid place-items-center px-4 py-16'}>
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-brand-orange/15 text-brand-orange">
            {chunk ? <RefreshCw className="size-7" /> : <AlertTriangle className="size-7" />}
          </div>
          <h2 className="text-[20px] font-bold tracking-tight text-neutral-900 dark:text-white">
            {chunk ? 'O Fields foi atualizado' : 'Não foi possível abrir esta tela'}
          </h2>
          <p className="mt-1.5 text-[15px] text-neutral-500">
            {chunk ? 'Recarregue para usar a versão mais nova.' : 'Tente recarregar. Se continuar, avise o administrador.'}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button onClick={() => { try { sessionStorage.removeItem(KEY) } catch { /* ignore */ } window.location.reload() }}
              className="press inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-accent-600 text-[15px] font-medium text-white">
              <RefreshCw className="size-4" />Recarregar
            </button>
            <button onClick={() => { window.location.href = base }}
              className="press inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-neutral-900/[.06] text-[15px] font-medium text-neutral-800 dark:bg-white/10 dark:text-neutral-200">
              <Home className="size-4" />Voltar ao início
            </button>
          </div>
        </div>
      </div>
    )
  }
}
