import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useGoodreads } from '../../hooks/useGoodreads'
import { useTbr, type TbrFields } from '../../hooks/useTbr'
import { GoodreadsItemCard } from './GoodreadsItemCard'
import { TbrForm } from './TbrForm'
import { TbrList } from './TbrList'
import { CollapsibleSection } from './CollapsibleSection'
import { Modal } from '../Modal'
import { useToast } from '../Toast'
import type { GrItem, TbrItem, TbrPriority } from '../../lib/types'

interface LibraryPageProps {
  isLoggedIn: boolean
}

export interface LibraryPageHandle {
  refresh: () => Promise<void>
  openAddTbr: () => void
}

type PriorityFilter = 'all' | 1 | 2 | 3

const PRIORITY_FILTER_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: 'all', label: 'All priorities' },
  { value: 1, label: 'P1 only' },
  { value: 2, label: 'P1–P2' },
  { value: 3, label: 'P1–P3' },
]

// Shelves older than this are re-synced from Goodreads when the tab opens.
const STALE_MS = 24 * 60 * 60 * 1000

function syncedAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export const LibraryPage = forwardRef<LibraryPageHandle, LibraryPageProps>(
  function LibraryPage({ isLoggedIn }, ref) {
    const {
      items: grItems,
      loading: grLoading,
      loaded: grLoaded,
      refreshing: grRefreshing,
      error: grError,
      refresh: grRefresh,
      lastSynced,
    } = useGoodreads(isLoggedIn)
    const {
      items: tbrItems,
      loading: tbrLoading,
      error: tbrError,
      save,
      remove,
      restore,
      refetch: tbrRefetch,
    } = useTbr(isLoggedIn)
    const toast = useToast()
    const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
    const [tbrEditing, setTbrEditing] = useState<TbrItem | 'new' | null>(null)
    const autoSynced = useRef(false)

    useImperativeHandle(ref, () => ({
      refresh: async () => {
        await Promise.all([grRefresh(), tbrRefetch()])
      },
      openAddTbr: () => setTbrEditing('new'),
    }))

    // Keep the shelves fresh without a manual Refresh: one sync per visit when
    // the copy is over a day old (or has never been made).
    useEffect(() => {
      if (!isLoggedIn || !grLoaded || autoSynced.current) return
      const stale = !lastSynced || Date.now() - new Date(lastSynced).getTime() > STALE_MS
      if (!stale) return
      autoSynced.current = true
      grRefresh()
    }, [isLoggedIn, grLoaded, lastSynced, grRefresh])

    const byShelf = useMemo(() => {
      const currently: GrItem[] = []
      const read: GrItem[] = []
      for (const it of grItems) {
        if (it.shelf === 'currently-reading') currently.push(it)
        else if (it.shelf === 'read') read.push(it)
      }
      return { currently, read }
    }, [grItems])

    // Read shelf by year read, newest first; undated reads last.
    const readByYear = useMemo(() => {
      const map = new Map<string, GrItem[]>()
      for (const it of byShelf.read) {
        const year = it.date_read?.slice(0, 4) ?? 'Undated'
        map.set(year, [...(map.get(year) ?? []), it])
      }
      return [...map.entries()].sort(([a], [b]) =>
        a === 'Undated' ? 1 : b === 'Undated' ? -1 : b.localeCompare(a),
      )
    }, [byShelf.read])

    const filteredTbr = useMemo(() => {
      if (priorityFilter === 'all') return tbrItems
      const cap = priorityFilter as TbrPriority
      return tbrItems.filter((it) => it.priority <= cap)
    }, [tbrItems, priorityFilter])

    const removeTbr = async (item: TbrItem) => {
      const err = await remove(item.id)
      if (err) return alert(err)
      toast(`Removed “${item.title}” from TBR`, async () => {
        const undoErr = await restore(item)
        if (undoErr) alert(undoErr)
      })
    }

    if (!isLoggedIn) {
      return (
        <div className="library-page">
          <p className="state-msg">Sign in to view your library.</p>
        </div>
      )
    }

    return (
      <div className="library-page">
        <p className="sync-line">
          {grRefreshing
            ? 'Syncing with Goodreads…'
            : lastSynced
              ? `Shelves synced from Goodreads ${syncedAgo(lastSynced)}`
              : grLoaded
                ? 'Not synced with Goodreads yet'
                : ''}
        </p>
        {grError && <p className="state-msg error">Goodreads error: {grError}</p>}

        {byShelf.currently.length > 0 && (
          <CollapsibleSection
            storageKey="lib-currently"
            title="Currently Reading"
            count={byShelf.currently.length}
          >
            <div className="gr-grid">
              {byShelf.currently.map((it) => (
                <GoodreadsItemCard key={it.id} item={it} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection storageKey="lib-tbr" title="To Be Read" count={filteredTbr.length}>
          {tbrError && <p className="state-msg error">{tbrError}</p>}
          <div className="tbr-controls">
            <label className="tbr-filter">
              Show
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
          {tbrLoading && tbrItems.length === 0 ? (
            <p className="state-msg">Loading...</p>
          ) : (
            <TbrList
              items={filteredTbr}
              isLoggedIn={isLoggedIn}
              onEdit={(item) => setTbrEditing(item)}
              onRemove={removeTbr}
            />
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
            <p className="state-msg">Nothing on your Read shelf yet.</p>
          ) : (
            readByYear.map(([year, items]) => (
              <section key={year} className="read-year">
                <h3 className="read-year-heading">
                  {year} <span className="collapsible-count">({items.length})</span>
                </h3>
                <div className="gr-grid">
                  {items.map((it) => (
                    <GoodreadsItemCard key={it.id} item={it} />
                  ))}
                </div>
              </section>
            ))
          )}
        </CollapsibleSection>

        <Modal
          open={tbrEditing !== null}
          onClose={() => setTbrEditing(null)}
          title={tbrEditing === 'new' ? 'Add to TBR' : 'Edit TBR book'}
        >
          {tbrEditing !== null && (
            <TbrForm
              item={tbrEditing === 'new' ? null : tbrEditing}
              onSave={async (fields: TbrFields) => {
                const err = await save(fields, tbrEditing === 'new' ? undefined : tbrEditing.id)
                if (!err) setTbrEditing(null)
                return err
              }}
              onCancel={() => setTbrEditing(null)}
            />
          )}
        </Modal>
      </div>
    )
  },
)
