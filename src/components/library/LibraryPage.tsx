import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { useGoodreads } from '../../hooks/useGoodreads'
import { useTbr } from '../../hooks/useTbr'
import { GoodreadsItemCard } from './GoodreadsItemCard'
import { TbrForm } from './TbrForm'
import { TbrList } from './TbrList'
import { CollapsibleSection } from './CollapsibleSection'
import type { GrItem, TbrPriority } from '../../lib/types'

interface LibraryPageProps {
  isLoggedIn: boolean
}

export interface LibraryPageHandle {
  refresh: () => Promise<void>
}

type PriorityFilter = 'all' | 1 | 2 | 3

const PRIORITY_FILTER_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: 'all', label: 'All priorities' },
  { value: 1, label: 'P1 only' },
  { value: 2, label: 'P1–P2' },
  { value: 3, label: 'P1–P3' },
]

export const LibraryPage = forwardRef<LibraryPageHandle, LibraryPageProps>(
  function LibraryPage({ isLoggedIn }, ref) {
    const {
      items: grItems,
      loading: grLoading,
      error: grError,
      refresh: grRefresh,
    } = useGoodreads(isLoggedIn)
    const {
      items: tbrItems,
      loading: tbrLoading,
      error: tbrError,
      add,
      remove,
      refetch: tbrRefetch,
    } = useTbr(isLoggedIn)
    const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')

    useImperativeHandle(ref, () => ({
      refresh: async () => {
        await Promise.all([grRefresh(), tbrRefetch()])
      },
    }))

    const byShelf = useMemo(() => {
      const currently: GrItem[] = []
      const read: GrItem[] = []
      for (const it of grItems) {
        if (it.shelf === 'currently-reading') currently.push(it)
        else if (it.shelf === 'read') read.push(it)
      }
      return { currently, read }
    }, [grItems])

    const filteredTbr = useMemo(() => {
      if (priorityFilter === 'all') return tbrItems
      const cap = priorityFilter as TbrPriority
      return tbrItems.filter((it) => it.priority <= cap)
    }, [tbrItems, priorityFilter])

    if (!isLoggedIn) {
      return (
        <div className="library-page">
          <p className="state-msg">Sign in to view your library.</p>
        </div>
      )
    }

    return (
      <div className="library-page">
        {grError && <p className="state-msg error">Goodreads error: {grError}</p>}

        <CollapsibleSection
          storageKey="lib-currently"
          title="Currently Reading"
          count={byShelf.currently.length}
        >
          {grLoading && byShelf.currently.length === 0 ? (
            <p className="state-msg">Loading...</p>
          ) : byShelf.currently.length === 0 ? (
            <p className="state-msg">Nothing here yet. Hit refresh.</p>
          ) : (
            <div className="gr-grid">
              {byShelf.currently.map((it) => (
                <GoodreadsItemCard key={it.id} item={it} />
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          storageKey="lib-tbr"
          title="To Be Read"
          count={filteredTbr.length}
        >
          {tbrError && <p className="state-msg error">{tbrError}</p>}
          <TbrForm onAdd={add} />
          <div className="tbr-controls">
            <label className="tbr-filter">
              Show:
              <select
                value={String(priorityFilter)}
                onChange={(e) => {
                  const v = e.target.value
                  setPriorityFilter(v === 'all' ? 'all' : (Number(v) as PriorityFilter))
                }}
              >
                {PRIORITY_FILTER_OPTIONS.map((o) => (
                  <option key={String(o.value)} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {tbrLoading ? (
            <p className="state-msg">Loading...</p>
          ) : (
            <TbrList items={filteredTbr} isLoggedIn={isLoggedIn} onRemove={remove} />
          )}
        </CollapsibleSection>

        <CollapsibleSection
          storageKey="lib-read"
          title="Read"
          count={byShelf.read.length}
          defaultCollapsed
        >
          {grLoading && byShelf.read.length === 0 ? (
            <p className="state-msg">Loading...</p>
          ) : byShelf.read.length === 0 ? (
            <p className="state-msg">Nothing here yet. Hit refresh.</p>
          ) : (
            <div className="gr-grid">
              {byShelf.read.map((it) => (
                <GoodreadsItemCard key={it.id} item={it} />
              ))}
            </div>
          )}
        </CollapsibleSection>
      </div>
    )
  },
)
