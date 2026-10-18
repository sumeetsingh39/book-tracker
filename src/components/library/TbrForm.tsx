import { useState } from 'react'
import {
  TBR_CATEGORIES,
  TBR_PRIORITY_OPTIONS,
  type TbrCategory,
  type TbrItem,
  type TbrPriority,
} from '../../lib/types'
import type { TbrFields } from '../../hooks/useTbr'

interface TbrFormProps {
  item?: TbrItem | null
  onSave: (fields: TbrFields) => Promise<string | null>
  onCancel: () => void
}

export function TbrForm({ item, onSave, onCancel }: TbrFormProps) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [author, setAuthor] = useState(item?.author ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [category, setCategory] = useState<TbrCategory | ''>(item?.category ?? '')
  const [priority, setPriority] = useState<TbrPriority>(item?.priority ?? 3)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setError('')
    setSubmitting(true)
    const err = await onSave({ title, author, notes, category: category || null, priority })
    setSubmitting(false)
    if (err) setError(err)
  }

  return (
    <form className="crud-form" onSubmit={handleSubmit}>
      <label>
        Title *
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        Author
        <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>
      <div className="form-row form-row-even">
        <label>
          Category
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
        </label>
        <label>
          Priority
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
        </label>
      </div>
      <label>
        Notes
        <textarea
          rows={3}
          placeholder="Why it's on the list, who recommended it…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : item ? 'Update' : 'Add to TBR'}
        </button>
      </div>
    </form>
  )
}
