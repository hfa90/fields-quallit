import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bookmark, Clock, FileText, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { TutorialListItem } from '../lib/types'
import { LIST_COLS, fetchFavorites, fetchRecent, useFavorites } from '../lib/library'
import { listOffline, removeOffline, useOfflineIds, type OfflineBundle } from '../lib/offline'
import { CloudOff, Trash2 } from 'lucide-react'
import { fileSize, timeAgo } from '../lib/utils'
import TutorialCard from '../components/TutorialCard'
import { Empty, CardsSkeleton } from '../components/ui'
import { cn } from '../lib/utils'

type Tab = 'meus' | 'favoritos' | 'recentes' | 'offline'
const TABS: [Tab, string][] = [['meus', 'Meus tutoriais'], ['favoritos', 'Favoritos'], ['recentes', 'Vistos recentemente'], ['offline', 'Offline']]

export default function MyLibrary() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('aba') as Tab) || 'meus'
  const [items, setItems] = useState<TutorialListItem[] | null>(null)
  const { favs } = useFavorites()
  const offIds = useOfflineIds()
  const [bundles, setBundles] = useState<OfflineBundle[] | null>(null)
  useEffect(() => { if (tab === 'offline') listOffline().then(b => setBundles(b.sort((x, y) => y.savedAt.localeCompare(x.savedAt)))) }, [tab, offIds])

  useEffect(() => {
    let alive = true
    setItems(null)
    if (tab === 'offline') return
    const load = tab === 'favoritos' ? fetchFavorites()
      : tab === 'recentes' ? fetchRecent(50)
      : supabase.from('kb_tutorials_list').select(LIST_COLS).eq('author_id', profile!.id).order('updated_at', { ascending: false })
          .then(({ data }) => (data as unknown as TutorialListItem[]) ?? [])
    load.then(r => { if (alive) setItems(r) })
    return () => { alive = false }
  }, [tab, profile])

  const shown = tab === 'favoritos' && items ? items.filter(i => favs.has(i.id)) : items

  return (
    <div className="space-y-5 fade-up">
      <h1 className="pt-1 text-[32px] font-bold tracking-tight text-neutral-900 dark:text-white">Minha biblioteca</h1>
      <div className="no-scrollbar inline-flex max-w-full overflow-x-auto rounded-[9px] bg-neutral-900/[.06] p-0.5 dark:bg-white/10">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setParams(k === 'meus' ? {} : { aba: k }, { replace: true })}
            className={cn('h-8 shrink-0 rounded-[7px] px-3.5 text-[13px] font-medium transition',
              tab === k ? 'bg-surface text-neutral-900 shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-neutral-600 dark:text-white' : 'text-neutral-600 dark:text-neutral-300')}>{l}</button>
        ))}
      </div>
      {tab === 'offline' ? (
        !bundles ? <CardsSkeleton count={3} /> : bundles.length === 0 ? (
          <Empty icon={<CloudOff className="size-12" strokeWidth={1.4} />} title="Nenhum tutorial salvo offline">
            Abra um tutorial e toque no ícone de nuvem para usá-lo sem internet — ideal para subsolo, sala de servidor ou cliente sem Wi‑Fi.
          </Empty>
        ) : (
          <div className="card divide-y divide-neutral-200/70 overflow-hidden dark:divide-neutral-800">
            {bundles.map(b => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <Link to={`/t/${b.short_code}`} className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-neutral-900 dark:text-white">{b.title}</div>
                  <div className="text-[12px] text-neutral-500">Salvo {timeAgo(b.savedAt)} · {fileSize(b.bytes)} · {b.files.length} anexo{b.files.length === 1 ? '' : 's'}</div>
                </Link>
                <button onClick={() => removeOffline(b.id)} className="p-2 text-neutral-400 hover:text-[#ff3b30]" aria-label="Remover do offline"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        )
      ) : !shown ? <CardsSkeleton /> : shown.length === 0 ? (
        tab === 'meus' ? (
          <Empty icon={<FileText className="size-12" strokeWidth={1.4} />} title="Você ainda não publicou">
            Compartilhe o que você sabe — um procedimento simples já ajuda muita gente.
            <Link to="/novo" className="mt-3 flex items-center justify-center gap-1 font-medium text-accent-600"><Plus className="size-4" />Escrever tutorial</Link>
          </Empty>
        ) : tab === 'favoritos' ? (
          <Empty icon={<Bookmark className="size-12" strokeWidth={1.4} />} title="Nenhum favorito">Toque no marcador de um tutorial para guardá-lo aqui e ser avisado quando ele for atualizado.</Empty>
        ) : (
          <Empty icon={<Clock className="size-12" strokeWidth={1.4} />} title="Nada por aqui ainda">Os tutoriais que você abrir aparecem aqui.</Empty>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shown.map((t, i) => <TutorialCard key={t.id} t={t} i={i} />)}</div>
      )}
    </div>
  )
}
