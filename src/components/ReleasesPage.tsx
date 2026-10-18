import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { useAuthors } from '../hooks/useAuthors'
import { useSuggestions } from '../hooks/useSuggestions'
import { supabase } from '../lib/supabase'
import { SuggestionsSection } from './SuggestionsSection'
import { CollapsibleSection } from './library/CollapsibleSection'
import { BookActions } from './BookActions'
import { BookForm } from './BookForm'
import { Modal } from './Modal'
import {
  BUCKETS,
  bucketOf,
  displayStatus,
  formatRelease,
  releaseEnd,
  releaseSortKey,
  today,
  STATUS_LABEL,
  type Bucket,
} from '../lib/release'
import type { Book, DatePrecision, Suggestion } from '../lib/types'

interface ReleasesPageProps {
  isLoggedIn: boolean
  // Books waiting on a decision (Due), for the tab badge and page title.
  onDueCount?: (count: number) => void
}

export interface ReleasesPageHandle {
  refresh: () => Promise<void>
  openAddBook: () => void
  focusSearch: () => void
}

const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

interface Entry {
  book: Book
  authorName: string
}

const HINTS: Partial<Record<Bucket, string>> = {
  due: 'The release date has passed. Remove it once you have it, or mark it overdue.',
  overdue: 'Released, but not available to you yet.',
}

const PRECISION_RANK: Record<DatePrecision, number> = { year: 1, month: 2, day: 3 }

// Worth mentioning when Hardcover's date moves the book, or pins it down more
// precisely than you have it; not when it is merely vaguer.
function hardcoverDiffers(book: Book, s: Suggestion | undefined): s is Suggestion {
  if (!s?.release_date) return false
  if (!book.release_date) return true
  if (s.release_date === book.release_date && s.date_precision === book.date_precision) return false
  const within =
    s.release_date <= book.release_date &&
    book.release_date <= releaseEnd(s.release_date, s.date_precision)
  return !within || PRECISION_RANK[s.date_precision] > PRECISION_RANK[book.date_precision]
}

// Sections that start collapsed until opened once.
const COLLAPSED_BY_DEFAULT: Bucket[] = ['later', 'unknown']

export const ReleasesPage = forwardRef<ReleasesPageHandle, ReleasesPageProps>(
  function ReleasesPage({ isLoggedIn, onDueCount }, ref) {
    const { allAuthors: authors, loading, error, refetch } = useAuthors()
    const [editing, setEditing] = useState<Book | null>(null)
    const [adding, setAdding] = useState(false)
    const [query, setQuery] = useState('')
    const suggestions = useSuggestions(isLoggedIn, refetch)

    const applyHardcoverDate = async (book: Book, s: Suggestion) => {
      const update: Partial<Book> = { release_date: s.release_date, date_precision: s.date_precision }
      if (book.status === 'overdue' && releaseEnd(s.release_date!, s.date_precision) >= today()) {
        update.status = 'upcoming'
      }
      const { error: err } = await supabase.from('books').update(update).eq('id', book.id)
      if (err) return alert(err.message)
      refetch()
    }

    useImperativeHandle(ref, () => ({
      refresh: refetch,
      openAddBook: () => setAdding(true),
      focusSearch: () => document.querySelector<HTMLInputElement>('#release-search')?.focus(),
    }))

    const dueCount = useMemo(
      () => authors.reduce((n, a) => n + a.books.filter((b) => bucketOf(b) === 'due').length, 0),
      [authors],
    )
    useEffect(() => {
      if (!loading) onDueCount?.(dueCount)
    }, [dueCount, loading, onDueCount])

    const groups = useMemo(() => {
      const q = fold(query.trim())
      const map = new Map<Bucket, Entry[]>()
      for (const author of authors) {
        const authorMatch = fold(author.name).includes(q)
        for (const book of author.books) {
          if (q && !authorMatch && !fold(book.title).includes(q)) continue
          const bucket = bucketOf(book)
          const list = map.get(bucket) ?? []
          list.push({ book, authorName: author.name })
          map.set(bucket, list)
        }
      }
      for (const list of map.values()) {
        list.sort(
          (a, b) =>
            releaseSortKey(a.book).localeCompare(releaseSortKey(b.book)) ||
            a.authorName.localeCompare(b.authorName),
        )
      }
      return BUCKETS.filter((b) => map.has(b.value)).map((b) => ({
        ...b,
        entries: map.get(b.value)!,
      }))
    }, [authors, query])

    if (loading && authors.length === 0) return <p className="state-msg">Loading...</p>
    if (error) return <p className="state-msg error">Error: {error}</p>

    return (
      <div className="releases-page">
        <div className="search-bar">
          <div className="search-row">
            <input
              id="release-search"
              type="search"
              className="search-input"
              placeholder="Search books or authors…"
              title="Shortcut: /"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoggedIn && (
          <SuggestionsSection
            inbox={suggestions.inbox}
            lastCheckedAt={suggestions.lastScan?.checkedAt ?? null}
            scanning={suggestions.scanning}
            error={suggestions.error}
            onCheck={suggestions.scan}
            setStatus={suggestions.setStatus}
            reload={suggestions.reload}
            onBooksChanged={refetch}
          />
        )}

        {groups.length === 0 && (
          <p className="state-msg">
            {query ? 'Nothing matches that search.' : 'No books tracked yet. Use + Book to add one.'}
          </p>
        )}

        {groups.map((group) => (
          <CollapsibleSection
            key={group.value}
            storageKey={`releases-${group.value}`}
            title={group.label}
            count={group.entries.length}
            defaultCollapsed={COLLAPSED_BY_DEFAULT.includes(group.value)}
            forceOpen={query.trim() !== ''}
          >
            {HINTS[group.value] && <p className="release-hint">{HINTS[group.value]}</p>}
            <ul className="release-list">
              {group.entries.map(({ book, authorName }) => {
                const status = displayStatus(book)
                const hc = book.hardcover_book_id
                  ? suggestions.byHardcoverBook.get(book.hardcover_book_id)
                  : undefined
                return (
                  <li key={book.id} className="release-item">
                    <span className="release-date">
                      {formatRelease(book.release_date, book.date_precision)}
                    </span>
                    <div className="release-main">
                      <span className="release-title">{book.title}</span>
                      <span className="release-author">{authorName}</span>
                      {isLoggedIn && hardcoverDiffers(book, hc) && (
                        <span className="hc-hint">
                          Hardcover says {formatRelease(hc.release_date, hc.date_precision)}
                          {' · '}
                          <button className="hc-hint-use" onClick={() => applyHardcoverDate(book, hc)}>
                            Use it
                          </button>
                        </span>
                      )}
                    </div>
                    <div className="release-side">
                      <span className={`book-status status-${status}`}>
                        {STATUS_LABEL[status]}
                      </span>
                      {isLoggedIn && (
                        <BookActions
                          book={book}
                          onEdit={() => setEditing(book)}
                          onChanged={refetch}
                        />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </CollapsibleSection>
        ))}

        <Modal open={adding} onClose={() => setAdding(false)} title="Add Book">
          <BookForm
            authors={authors}
            onSaved={() => {
              setAdding(false)
              refetch()
            }}
            onCancel={() => setAdding(false)}
          />
        </Modal>

        <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Book">
          {editing && (
            <BookForm
              authorId={editing.author_id}
              book={editing}
              onSaved={() => {
                setEditing(null)
                refetch()
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </Modal>
      </div>
    )
  },
)
