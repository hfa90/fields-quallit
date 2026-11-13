import { useState } from 'react'
import { MapPin, Plus, Building2 } from 'lucide-react'
import { matchUf, resolveUf, useCds } from '../lib/cds'
import { UF_NAME } from '../lib/brStates'
import { cn } from '../lib/utils'
import { inputCls, labelCls } from './ui'
import StateBadge from './StateBadge'

/** Novo local digitado pelo administrador (estado + cidade/nome do CD) */
export interface NewLocation { estado: string; uf: string | null; cidade: string; nome: string; nomeEditado: boolean }
export const emptyLocation = (): NewLocation => ({ estado: '', uf: null, cidade: '', nome: '', nomeEditado: false })
export const locationReady = (l: NewLocation) => !!l.uf && l.nome.trim().length >= 2

const autoName = (l: NewLocation) => `CD ${(l.cidade.trim() || (l.uf ? UF_NAME[l.uf] : '')).toUpperCase()}`.trim()

/**
 * "Onde atua": escolhe um CD já cadastrado ou cria um novo estado/CD.
 * Ao digitar o nome ou a sigla do estado o desenho aparece na hora.
 */
export default function LocationPicker({ mode, setMode, cdId, setCdId, loc, setLoc }: {
  mode: 'existing' | 'new'; setMode: (m: 'existing' | 'new') => void
  cdId: string; setCdId: (v: string) => void
  loc: NewLocation; setLoc: (l: NewLocation) => void
}) {
  const cds = useCds()
  const [focus, setFocus] = useState(false)
  const selected = cds.find(c => c.id === cdId)
  const matches = matchUf(loc.estado).slice(0, 5)

  const update = (patch: Partial<NewLocation>) => {
    const next = { ...loc, ...patch }
    if (!next.nomeEditado) next.nome = next.uf ? autoName(next) : ''
    setLoc(next)
  }
  const setEstado = (estado: string) => update({ estado, uf: resolveUf(estado) })
  const pick = (uf: string) => update({ estado: UF_NAME[uf], uf })

  return (
    <div>
      <label className={labelCls}>Onde atua</label>
      <div className="mb-2.5 grid grid-cols-2 rounded-[9px] bg-neutral-900/[.06] p-0.5 dark:bg-white/10">
        {([['existing', 'CD cadastrado', Building2], ['new', 'Novo estado', Plus]] as const).map(([m, label, I]) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={cn('inline-flex h-9 items-center justify-center gap-1.5 rounded-[7px] text-[13px] font-medium', mode === m ? 'bg-white text-neutral-900 shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:bg-neutral-600 dark:text-white' : 'text-neutral-600 dark:text-neutral-300')}>
            <I className="size-3.5" />{label}
          </button>
        ))}
      </div>

      {mode === 'existing' ? (
        <div className="flex items-center gap-3">
          <select className={cn(inputCls, 'flex-1')} value={cdId} onChange={e => setCdId(e.target.value)}>
            <option value="">Não definido</option>
            {cds.map(c => <option key={c.id} value={c.id}>{c.nome}{c.uf ? ` · ${c.uf}` : ''}</option>)}
          </select>
          {selected?.uf && <span key={selected.uf} className="state-pop"><StateBadge uf={selected.uf} size={44} /></span>}
        </div>
      ) : (
        <div className="rounded-[14px] bg-neutral-900/[.03] p-3 dark:bg-white/[.04]">
          <div className="flex gap-3">
            <div className="grid size-[104px] shrink-0 place-items-center rounded-[12px] bg-[radial-gradient(circle_at_50%_40%,rgb(26_156_169/0.14),transparent_70%)]">
              {loc.uf ? (
                <span key={loc.uf} className="state-pop"><StateBadge uf={loc.uf} size={96} /></span>
              ) : (
                <span className="flex flex-col items-center gap-1 px-2 text-center text-[11px] leading-tight text-neutral-400">
                  <MapPin className="size-6" strokeWidth={1.5} />O desenho do estado aparece aqui
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="relative">
                <input className={inputCls} value={loc.estado} placeholder="Estado: nome ou sigla (ex.: PE)"
                  onChange={e => setEstado(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
                  aria-label="Estado" autoComplete="off" />
                {loc.uf && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-accent-600 px-1.5 py-px text-[11px] font-bold text-white">{loc.uf}</span>}
              </div>
              {focus && !loc.uf && matches.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {matches.map(m => (
                    <button key={m.uf} type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(m.uf)}
                      className="press inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[12px] font-medium text-neutral-700 shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)] dark:bg-neutral-800 dark:text-neutral-200">
                      <StateBadge uf={m.uf} size={18} />{m.nome}
                    </button>
                  ))}
                </div>
              )}
              {loc.estado && !loc.uf && matches.length === 0 && <p className="text-[12px] text-[#d70015]">Estado não encontrado</p>}
              <input className={inputCls} value={loc.cidade} placeholder="Cidade (opcional)" aria-label="Cidade" onChange={e => update({ cidade: e.target.value })} />
            </div>
          </div>
          <div className="mt-2.5">
            <label className="mb-1 block text-[12px] font-medium text-neutral-500">Nome do CD</label>
            <input className={inputCls} value={loc.nome} placeholder="CD RECIFE" aria-label="Nome do CD"
              onChange={e => setLoc({ ...loc, nome: e.target.value.toUpperCase(), nomeEditado: e.target.value.trim() !== '' })} />
            <p className="mt-1 text-[11.5px] text-neutral-500">Fica disponível para os próximos cadastros. Não altera os CDs do Inventário.</p>
          </div>
        </div>
      )}
    </div>
  )
}
