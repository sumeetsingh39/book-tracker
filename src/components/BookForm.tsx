import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Book, DatePrecision } from '../lib/types'
import { releaseEnd, today } from '../lib/release'
import { AuthorPicker, type AuthorChoice } from './AuthorPicker'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Month and year dates are stored as the first day of the period.
function toPrecision(date: string, precision: DatePrecision): string {
  if (!date) return ''
  if (precision === 'year') return `${date.slice(0, 4)}-01-01`
  if (precision === 'month') return `${date.slice(0, 7)}-01`
  return date
}

interface BookFormProps {
  // Without an author (quick add), the form asks for one and can create it.
  authorId?: number
  authors?: { id: number; name: string }[]
  book?: Book | null
  onSaved: () => void
  onCancel: () => void
}

export function BookForm({ authorId, authors = [], book, onSaved, onCancel }: BookFormProps) {
  const [author, setAuthor] = useState<AuthorChoice | null>(null)
  const [title, setTitle] = useState(book?.title ?? '')
  const [releaseDate, setReleaseDate] = useState(book?.release_date ?? '')
  const [precision, setPrecision] = useState<DatePrecision>(book?.date_precision ?? 'day')
  // Month and year are picked separately (Firefox has no month input) and the
  // year is typed digit by digit, so keep both apart from the stored date.
  const [yearText, setYearText] = useState(book?.release_date?.slice(0, 4) ?? '')
  const [monthText, setMonthText] = useState(book?.release_date?.slice(5, 7) ?? '')
  const [status, setStatus] = useState<Book['status']>(book?.status ?? 'upcoming')

  // Moving an overdue book to a date that hasn't passed puts it back to
  // following its date; the status select shows the change before saving.
  const changeDate = (next: string, p: DatePrecision = precision) => {
    setReleaseDate(next)
    if (status === 'overdue' && next && releaseEnd(next, p) >= today()) {
      setStatus('upcoming')
    }
  }

  const changeParts = (year: string, month: string, p: DatePrecision = precision) => {
    setYearText(year)
    setMonthText(month)
    const validYear = /^\d{4}$/.test(year)
    if (p === 'year') changeDate(validYear ? `${year}-01-01` : '', p)
    else changeDate(validYear && month ? `${year}-${month}-01` : '', p)
  }

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isEdit = !!book

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    let targetAuthor = authorId
    if (targetAuthor === undefined) {
      if (!author) {
        setError('Pick an author from the list, or choose “New author”.')
        return
      }
      setSubmitting(true)
      if (author.id === null) {
        const { data, error: authorErr } = await supabase
          .from('authors')
          .insert({ name: author.name })
          .select('id')
          .single()
        if (authorErr) {
          setSubmitting(false)
          setError(authorErr.message)
          return
        }
        targetAuthor = data.id as number
      } else {
        targetAuthor = author.id
      }
    }
    setSubmitting(true)

    const payload = {
      author_id: targetAuthor,
      title: title.trim(),
      release_date: releaseDate || null,
      date_precision: precision,
      status,
    }

    let err
    if (isEdit) {
      ;({ error: err } = await supabase
        .from('books')
        .update(payload)
        .eq('id', book.id))
    } else {
      ;({ error: err } = await supabase.from('books').insert(payload))
    }

    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved()
  }

  return (
    <form className="crud-form" onSubmit={handleSubmit}>
      {authorId === undefined && (
        <label>
          Author *
          <AuthorPicker authors={authors} value={author} onChange={setAuthor} />
        </label>
      )}
      <label>
        Title *
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <div className="form-row">
        <label>
          Release date known to
          <select
            value={precision}
            onChange={(e) => {
              const next = e.target.value as DatePrecision
              setPrecision(next)
              setYearText(releaseDate.slice(0, 4))
              setMonthText(releaseDate.slice(5, 7))
              changeDate(toPrecision(releaseDate, next), next)
            }}
          >
            <option value="day">Exact day</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </label>
        <label>
          Release date
          {precision === 'day' ? (
            <input
              type="date"
              value={releaseDate}
              onChange={(e) => changeDate(e.target.value)}
            />
          ) : (
            <span className="date-parts">
              {precision === 'month' && (
                <select
                  aria-label="Month"
                  value={monthText}
                  onChange={(e) => changeParts(yearText, e.target.value)}
                >
                  <option value="">Month</option>
                  {MONTHS.map((name, i) => (
                    <option key={name} value={String(i + 1).padStart(2, '0')}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="number"
                aria-label="Year"
                min={1900}
                max={2200}
                placeholder="e.g. 2027"
                value={yearText}
                onChange={(e) => changeParts(e.target.value, monthText)}
              />
            </span>
          )}
        </label>
      </div>
      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value as Book['status'])}>
          <option value="upcoming">Upcoming (Due once the date passes)</option>
          <option value="overdue">Overdue (released, not available to me)</option>
        </select>
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : isEdit ? 'Update Book' : 'Add Book'}
        </button>
      </div>
    </form>
  )
}
