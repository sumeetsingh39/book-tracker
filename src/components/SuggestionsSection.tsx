import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatRelease } from '../lib/release'
import { hardcoverBookUrl } from '../lib/hardcover'
import { CollapsibleSection } from './library/CollapsibleSection'
import { useToast } from './Toast'
import type { Suggestion } from '../lib/types'

interface SuggestionsSectionProps {
  inbox: Suggestion[]
  lastCheckedAt: string | null
  scanning: boolean
  error: string | null
  onCheck: () => void
  setStatus: (id: number, status: Suggestion['status']) => Promise<void>
  reload: () => Promise<unknown>
  onBooksChanged: () => void
}

function checkedAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

export function SuggestionsSection({
  inbox,
  lastCheckedAt,
  scanning,
  error,
  onCheck,
  setStatus,
  reload,
  onBooksChanged,
}: SuggestionsSectionProps) {
  const toast = useToast()
  // Suggestions with a Track/Dismiss in flight: a second click must not add the book twice.
  const [busy, setBusy] = useState<Set<number>>(new Set())
  const dated = inbox.filter((s) => s.release_date)
  const undated = inbox.filter((s) => !s.release_date)

  const dismissAll = async (items: Suggestion[]) => {
    const ids = items.map((s) => s.id)
    const { error: err } = await supabase.from('book_suggestions').update({ status: 'dismissed' }).in('id', ids)
    if (err) return alert(err.message)
    await reload()
    toast(`Dismissed ${ids.length} suggestions`, async () => {
      await supabase.from('book_suggestions').update({ status: 'new' }).in('id', ids)
      await reload()
    })
  }

  const row = (s: Suggestion) => (
    <li key={s.id} className="release-item suggest-item">
      <span className="release-date">{formatRelease(s.release_date, s.date_precision)}</span>
      <div className="release-main">
        <span className="release-title">{s.title}</span>
        <span className="release-author">
          {s.authors?.name}
          {s.hardcover_slug && (
            <>
              {' · '}
              <a
                className="suggest-link"
                href={hardcoverBookUrl(s.hardcover_slug)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.readers} {s.readers === 1 ? 'reader' : 'readers'} on Hardcover
              </a>
            </>
          )}
        </span>
      </div>
      <div className="release-side">
        <button className="btn-small" disabled={busy.has(s.id)} onClick={() => accept(s)}>
          Track
        </button>
        <button className="btn-small btn-secondary" disabled={busy.has(s.id)} onClick={() => dismiss(s)}>
          Dismiss
        </button>
      </div>
    </li>
  )

  const guarded = (fn: (s: Suggestion) => Promise<unknown>) => async (s: Suggestion) => {
    if (busy.has(s.id)) return
    setBusy((b) => new Set(b).add(s.id))
    try {
      await fn(s)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy((b) => {
        const n = new Set(b)
        n.delete(s.id)
        return n
      })
    }
  }

  const accept = guarded(async (s: Suggestion) => {
    const { data, error: err } = await supabase
      .from('books')
      .insert({
        author_id: s.author_id,
        title: s.title,
        release_date: s.release_date,
        date_precision: s.date_precision,
        status: 'upcoming',
        hardcover_book_id: s.hardcover_book_id,
      })
      .select('id')
      .single()
    if (err) throw new Error(err.message)
    await setStatus(s.id, 'accepted')
    onBooksChanged()
    toast(`Tracking “${s.title}”`, async () => {
      await supabase.from('books').delete().eq('id', data.id)
      await setStatus(s.id, 'new')
      onBooksChanged()
    })
  })

  const dismiss = guarded(async (s: Suggestion) => {
    await setStatus(s.id, 'dismissed')
    toast(`Dismissed “${s.title}”`, () => setStatus(s.id, 'new'))
  })

  const status = scanning
    ? 'Checking Hardcover…'
    : lastCheckedAt
      ? `Checked Hardcover ${checkedAgo(lastCheckedAt)}`
      : 'Not checked yet'

  return (
    <CollapsibleSection
      storageKey="releases-suggestions"
      title="Suggestions"
      count={inbox.length}
    >
      <div className="suggest-bar">
        <span>{status}</span>
        <button className="btn-small" onClick={onCheck} disabled={scanning}>
          Check now
        </button>
      </div>
      {error && <p className="form-error">Hardcover: {error}</p>}
      {inbox.length === 0 ? (
        <p className="release-hint">Nothing new from your linked authors.</p>
      ) : (
        <>
          <p className="release-hint">
            New books Hardcover lists for authors you follow. Track one to add it to your list; dismissed
            books won't come back.
          </p>
          {dated.length > 0 && <ul className="release-list">{dated.map(row)}</ul>}
          {undated.length > 0 && (
            <CollapsibleSection
              storageKey="releases-suggestions-undated"
              level="group"
              title="Announced, no date yet"
              count={undated.length}
              defaultCollapsed
            >
              <p className="release-hint">
                Many readers are waiting on these and almost nobody has read them, which is how
                announced books look on Hardcover.{' '}
                <button className="hc-hint-use" onClick={() => dismissAll(undated)}>
                  Dismiss all
                </button>
              </p>
              <ul className="release-list">{undated.map(row)}</ul>
            </CollapsibleSection>
          )}
        </>
      )}
    </CollapsibleSection>
  )
}
