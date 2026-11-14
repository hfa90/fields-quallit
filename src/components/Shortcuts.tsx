import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Modal } from './ui'
import { openNewChooser } from './Engagement'
import { openSearch } from './Search'

const openers = new Set<() => void>()
/** Abre a lista de atalhos de teclado */
export function openShortcuts() { openers.forEach(o => o()) }

/** Tecla apertada "solta": sem Ctrl/⌘/Alt, fora de campos de texto e sem janela aberta */
export function isPlainKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || e.repeat) return false
  const el = e.target as HTMLElement | null
  if (el?.closest?.('input,textarea,select,[contenteditable=""],[contenteditable=true]')) return false
  if (document.body.style.overflow === 'hidden') return false // alguma janela/modal aberta
  return true
}

const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const GROUPS: { title: string; items: [string[], string][] }[] = [
  {
    title: 'Em qualquer tela',
    items: [
      [['/'], 'Buscar'],
      [[mac ? '⌘' : 'Ctrl', 'K'], 'Buscar'],
      [['N'], 'Novo (dica rápida ou tutorial)'],
      [['D'], 'Dica rápida'],
      [['B'], 'Ir para a Biblioteca'],
      [['C'], 'Ir para a Comunidade'],
      [['?'], 'Mostrar estes atalhos'],
    ],
  },
  {
    title: 'Em um tutorial',
    items: [
      [['P'], 'Seguir passo a passo (tela cheia)'],
      [['F'], 'Favoritar / desfavoritar'],
    ],
  },
  {
    title: 'No modo passo a passo',
    items: [
      [['→'], 'Próximo passo'],
      [['←'], 'Passo anterior'],
      [['Espaço'], 'Marcar como feito e avançar'],
      [['Esc'], 'Sair'],
    ],
  },
]

/** Atalhos globais de teclado (computador) + janela de ajuda */
export default function Shortcuts() {
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const editing = loc.pathname === '/novo' || loc.pathname === '/dica' || loc.pathname.endsWith('/editar')

  useEffect(() => { const o = () => setOpen(true); openers.add(o); return () => { openers.delete(o) } }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!isPlainKey(e)) return
      if (e.key === '?') { e.preventDefault(); setOpen(true); return }
      if (editing) return // não sair de uma edição por engano
      const k = e.key.toLowerCase()
      if (k === 'n') { e.preventDefault(); openNewChooser() }
      else if (k === 'd') { e.preventDefault(); nav('/dica') }
      else if (k === 'b') { e.preventDefault(); nav('/') }
      else if (k === 'c') { e.preventDefault(); nav('/comunidade') }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [editing, nav])

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Atalhos de teclado">
      <div className="space-y-5">
        {GROUPS.map(g => (
          <section key={g.title}>
            <h4 className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-neutral-500">{g.title}</h4>
            <ul className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
              {g.items.map(([keys, label], i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-[14px] text-neutral-700 dark:text-neutral-300">
                  {label}
                  <span className="flex shrink-0 gap-1">
                    {keys.map(k => <kbd key={k} className="min-w-[26px] rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-center font-sans text-[12px] font-medium text-neutral-600 shadow-[0_1px_0_rgb(0_0_0/0.08)] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{k}</kbd>)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <button onClick={() => { setOpen(false); openSearch() }} className="w-full rounded-[10px] bg-neutral-900/[.05] py-2.5 text-[14px] font-medium text-accent-700 dark:bg-white/10 dark:text-accent-300">Abrir a busca</button>
      </div>
    </Modal>
  )
}
