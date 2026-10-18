import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clearMatch,
  linkAuthor,
  linkByGoodreads,
  linkSeries,
  searchAuthors,
  searchSeries,
  skipAuthor,
  type Candidate,
  type SeriesCandidate,
} from '../lib/hardcover'
import type { Author, HardcoverSeries } from '../lib/types'

interface LinkAuthorsProps {
  authors: Author[]
  // One author (from its card) instead of the whole queue.
  only?: Author
  onChanged: () => void
  onDone: () => void
}

// Hardcover allows 60 requests a minute; stay under it when linking in bulk.
const BULK_DELAY_MS = 1100
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function LinkAuthors({ authors, only, onChanged, onDone }: LinkAuthorsProps) {
  // Authors with tracked books first: they matter most for discovery.
  const queue = useMemo(
    () =>
      only
        ? [only]
        : authors
            .filter((a) => a.hardcover_status === 'unlinked')
            .sort((a, b) => b.books.length - a.books.length || a.name.localeCompare(b.name)),
    [authors, only],
  )
  const counts = useMemo(
    () => ({
      linked: authors.filter((a) => a.hardcover_status === 'linked').length,
      unlinked: authors.filter((a) => a.hardcover_status === 'unlinked').length,
      skipped: authors.filter((a) => a.hardcover_status === 'skipped').length,
    }),
    [authors],
  )
  const [mode, setMode] = useState<'overview' | 'queue'>(only ? 'queue' : 'overview')

  if (mode === 'queue') {
    return <LinkQueue initial={queue} onChanged={onChanged} onDone={onDone} />
  }
  return (
    <Overview
      counts={counts}
      queue={queue}
      onChanged={onChanged}
      onStartQueue={() => setMode('queue')}
    />
  )
}

function Overview({
  counts,
  queue,
  onChanged,
  onStartQueue,
}: {
  counts: { linked: number; unlinked: number; skipped: number }
  queue: Author[]
  onChanged: () => void
  onStartQueue: () => void
}) {
  const [busy, setBusy] = useState<'goodreads' | 'names' | null>(null)
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState<{ done: number; linked: number } | null>(null)
  const stop = useRef(false)

  const byGoodreads = async () => {
    setBusy('goodreads')
    setMessage('')
    try {
      const r = await linkByGoodreads()
      setMessage(`Linked ${r.linked} by Goodreads ID.`)
      onChanged()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const byName = async () => {
    setBusy('names')
    setMessage('')
    stop.current = false
    let linked = 0
    for (let i = 0; i < queue.length && !stop.current; i++) {
      setProgress({ done: i, linked })
      try {
        const match = clearMatch(queue[i].name, await searchAuthors(queue[i].name))
        if (match) {
          await linkAuthor(queue[i].id, match)
          linked++
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : String(e))
        break
      }
      await sleep(BULK_DELAY_MS)
    }
    setProgress(null)
    setBusy(null)
    setMessage((m) => m || `Linked ${linked} clear name matches.`)
    onChanged()
  }

  return (
    <div className="link-overview">
      <p className="link-intro">
        Linked authors are checked on Hardcover for new books every day. Linking uses
        Hardcover's own author ID, so authors who share a name don't get mixed up.
      </p>
      <p className="link-counts">
        <strong>{counts.linked}</strong> linked · <strong>{counts.unlinked}</strong> not linked yet
        {counts.skipped > 0 && (
          <>
            {' '}
            · <strong>{counts.skipped}</strong> not on Hardcover
          </>
        )}
      </p>

      <ol className="link-steps">
        <li>
          <div>
            <strong>Match by Goodreads ID.</strong> Exact: uses the Goodreads author link you
            already saved.
          </div>
          <button className="btn-small" onClick={byGoodreads} disabled={!!busy || counts.unlinked === 0}>
            {busy === 'goodreads' ? 'Matching…' : 'Match'}
          </button>
        </li>
        <li>
          <div>
            <strong>Link clear name matches.</strong> Searches each author and links only when
            exactly one Hardcover author has that name. About a second per author.
          </div>
          {busy === 'names' ? (
            <button className="btn-small btn-secondary" onClick={() => (stop.current = true)}>
              Stop
            </button>
          ) : (
            <button className="btn-small" onClick={byName} disabled={!!busy || queue.length === 0}>
              Link
            </button>
          )}
        </li>
        <li>
          <div>
            <strong>Go through the rest.</strong> Pick the right author yourself, or mark them as
            not on Hardcover.
          </div>
          <button className="btn-small" onClick={onStartQueue} disabled={!!busy || queue.length === 0}>
            Start
          </button>
        </li>
      </ol>

      {progress && (
        <p className="link-progress">
          Checked {progress.done} of {queue.length} · linked {progress.linked}
        </p>
      )}
      {message && <p className="link-message">{message}</p>}
    </div>
  )
}

type LinkMode = 'author' | 'series'

// Entries named like a series ("Malazan series", "Black Tide Rising") or
// already following series open on the series search.
const defaultMode = (a: Author): LinkMode =>
  a.hardcover_series?.length || /\bseries\b/i.test(a.name) ? 'series' : 'author'

function LinkQueue({
  initial,
  onChanged,
  onDone,
}: {
  initial: Author[]
  onChanged: () => void
  onDone: () => void
}) {
  // Snapshot: linking refetches the authors, which must not reshuffle the queue.
  const [queue] = useState(initial)
  const [index, setIndex] = useState(0)
  const author = queue[index]
  const [mode, setMode] = useState<LinkMode>(author ? defaultMode(author) : 'author')
  const [query, setQuery] = useState(author?.name.replace(/\s+series$/i, '') ?? '')
  const [candidates, setCandidates] = useState<Candidate[] | SeriesCandidate[] | null>(null)
  const [selected, setSelected] = useState<Map<number, HardcoverSeries>>(new Map())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const run = useCallback(async (q: string, m: LinkMode) => {
    setCandidates(null)
    setError('')
    try {
      setCandidates(m === 'series' ? await searchSeries(q) : await searchAuthors(q))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setCandidates([])
    }
  }, [])

  useEffect(() => {
    if (!author) return
    const m = defaultMode(author)
    const q = author.name.replace(/\s+series$/i, '')
    setMode(m)
    setQuery(q)
    setSelected(new Map((author.hardcover_series ?? []).map((x) => [x.id, x])))
    run(q, m)
  }, [author, run])

  const switchMode = (m: LinkMode) => {
    setMode(m)
    if (query.trim()) run(query.trim(), m)
  }

  const toggleSeries = (c: SeriesCandidate) =>
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(c.id)) next.delete(c.id)
      else next.set(c.id, { id: c.id, name: c.name, slug: c.slug })
      return next
    })

  const next = () => {
    if (index + 1 >= queue.length) onDone()
    else setIndex(index + 1)
  }

  const act = async (action: () => Promise<unknown>) => {
    setSaving(true)
    setError('')
    try {
      await action()
      onChanged()
      next()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!author) return <p className="state-msg">Every author has been looked at.</p>

  return (
    <div className="link-queue">
      {queue.length > 1 && (
        <p className="link-progress">
          {index + 1} of {queue.length}
        </p>
      )}
      <h3 className="link-author">{author.name}</h3>
      {author.books.length > 0 && (
        <p className="link-tracked">Tracking: {author.books.map((b) => b.title).join(', ')}</p>
      )}

      <div className="link-mode" role="radiogroup" aria-label="Link to">
        {(['author', 'series'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={`theme-option ${mode === m ? 'theme-option-active' : ''}`}
            onClick={() => switchMode(m)}
          >
            {m === 'author' ? 'An author' : 'Series'}
          </button>
        ))}
      </div>
      {mode === 'series' && (
        <p className="release-hint">
          For entries that are a series or imprint. Hardcover often splits a series into several
          records (per author, per sub-series); follow every one that applies.
        </p>
      )}

      <form
        className="link-search"
        onSubmit={(e) => {
          e.preventDefault()
          if (query.trim()) run(query.trim(), mode)
        }}
      >
        <input
          type="search"
          value={query}
          aria-label={mode === 'series' ? 'Search Hardcover series' : 'Search Hardcover authors'}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn-small" type="submit">
          Search
        </button>
      </form>

      {mode === 'series' && selected.size > 0 && (
        <ul className="series-chips">
          {[...selected.values()].map((x) => (
            <li key={x.id}>
              {x.name}
              <button
                type="button"
                aria-label={`Stop following ${x.name}`}
                onClick={() =>
                  setSelected((prev) => {
                    const n = new Map(prev)
                    n.delete(x.id)
                    return n
                  })
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="form-error">{error}</p>}
      {candidates === null ? (
        <p className="release-hint">Searching Hardcover…</p>
      ) : candidates.length === 0 ? (
        <p className="release-hint">Nothing found on Hardcover. Try another spelling.</p>
      ) : mode === 'series' ? (
        <ul className="candidate-list">
          {(candidates as SeriesCandidate[]).map((c) => (
            <li key={c.id} className="candidate">
              <input
                type="checkbox"
                className="candidate-check"
                aria-label={`Follow ${c.name}`}
                checked={selected.has(c.id)}
                onChange={() => toggleSeries(c)}
              />
              <div className="candidate-main">
                <span className="candidate-name">
                  {c.name} <span className="candidate-count">{c.booksCount} books</span>
                </span>
                <span className="candidate-books">
                  {[c.authorName, ...c.books].filter(Boolean).join(' · ')}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="candidate-list">
          {(candidates as Candidate[]).map((c) => (
            <li key={c.id} className="candidate">
              {c.image ? (
                <img className="candidate-photo" src={c.image} alt="" loading="lazy" />
              ) : (
                <span className="candidate-photo candidate-photo-empty" />
              )}
              <div className="candidate-main">
                <span className="candidate-name">
                  {c.name} <span className="candidate-count">{c.booksCount} books</span>
                </span>
                {c.books.length > 0 && <span className="candidate-books">{c.books.join(' · ')}</span>}
              </div>
              <button
                className="btn-small"
                disabled={saving}
                onClick={() => act(() => linkAuthor(author.id, c))}
              >
                Link
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="link-footer">
        <button className="btn-small btn-secondary" disabled={saving} onClick={() => act(() => skipAuthor(author.id))}>
          Not on Hardcover
        </button>
        <span className="link-footer-right">
          {mode === 'series' && (
            <button
              className="btn-small"
              disabled={saving || (selected.size === 0 && !author.hardcover_series?.length)}
              onClick={() => act(() => linkSeries(author.id, [...selected.values()]))}
            >
              {selected.size === 0 ? 'Follow no series' : `Follow ${selected.size} series`}
            </button>
          )}
          <button className="btn-small btn-secondary" disabled={saving} onClick={next}>
            {queue.length > 1 ? 'Later' : 'Close'}
          </button>
        </span>
      </div>
    </div>
  )
}
