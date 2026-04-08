import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Author } from '../lib/types'

interface AuthorFormProps {
  author?: Author | null
  onSaved: () => void
  onCancel: () => void
}

export function AuthorForm({ author, onSaved, onCancel }: AuthorFormProps) {
  const [name, setName] = useState(author?.name ?? '')
  const [goodreadsUrl, setGoodreadsUrl] = useState(author?.goodreads_url ?? '')
  const [extraUrls, setExtraUrls] = useState(author?.extra_urls ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isEdit = !!author

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const payload = {
      name: name.trim(),
      goodreads_url: goodreadsUrl.trim() || null,
      extra_urls: extraUrls.trim() || null,
    }

    let err
    if (isEdit) {
      ;({ error: err } = await supabase
        .from('authors')
        .update(payload)
        .eq('id', author.id))
    } else {
      ;({ error: err } = await supabase.from('authors').insert(payload))
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
        Name *
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label>
        Goodreads URL
        <input
          type="url"
          value={goodreadsUrl}
          onChange={(e) => setGoodreadsUrl(e.target.value)}
          placeholder="https://www.goodreads.com/author/..."
        />
      </label>
      <label>
        Extra URLs
        <input
          type="text"
          value={extraUrls}
          onChange={(e) => setExtraUrls(e.target.value)}
          placeholder="Wiki: https://...; Series: https://..."
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : isEdit ? 'Update Author' : 'Add Author'}
        </button>
      </div>
    </form>
  )
}
