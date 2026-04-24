import { useState } from 'react'
import {
  TBR_CATEGORIES,
  TBR_PRIORITY_OPTIONS,
  type TbrCategory,
  type TbrPriority,
} from '../../lib/types'

interface TbrFormProps {
  onAdd: (
    title: string,
    author: string,
    notes: string,
    category: TbrCategory | '',
    priority: TbrPriority,
  ) => Promise<string | null>
}

export function TbrForm({ onAdd }: TbrFormProps) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState<TbrCategory | ''>('')
  const [priority, setPriority] = useState<TbrPriority>(3)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setError('')
    setSubmitting(true)
    const err = await onAdd(title, author, notes, category, priority)
    setSubmitting(false)
    if (err) {
      setError(err)
      return
    }
    setTitle('')
    setAuthor('')
    setNotes('')
    setCategory('')
    setPriority(3)
  }

  return (
    <form className="tbr-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Title *"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Author"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as TbrCategory | '')}
      >
        <option value="">Uncategorized</option>
        {TBR_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <select
        value={priority}
        onChange={(e) => setPriority(Number(e.target.value) as TbrPriority)}
      >
        {TBR_PRIORITY_OPTIONS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Adding...' : 'Add'}
      </button>
      {error && <p className="form-error">{error}</p>}
    </form>
  )
}
