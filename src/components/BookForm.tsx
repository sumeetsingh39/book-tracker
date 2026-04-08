import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Book } from '../lib/types'

interface BookFormProps {
  authorId: number
  book?: Book | null
  onSaved: () => void
  onCancel: () => void
}

export function BookForm({ authorId, book, onSaved, onCancel }: BookFormProps) {
  const [title, setTitle] = useState(book?.title ?? '')
  const [releaseDate, setReleaseDate] = useState(book?.release_date ?? '')
  const [status, setStatus] = useState<Book['status']>(book?.status ?? 'upcoming')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isEdit = !!book

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const payload = {
      author_id: authorId,
      title: title.trim(),
      release_date: releaseDate || null,
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
      <label>
        Title *
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <label>
        Release Date
        <input
          type="date"
          value={releaseDate}
          onChange={(e) => setReleaseDate(e.target.value)}
        />
      </label>
      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value as Book['status'])}>
          <option value="upcoming">Upcoming</option>
          <option value="overdue">Overdue</option>
          <option value="released">Released</option>
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
