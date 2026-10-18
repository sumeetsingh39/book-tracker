import { supabase } from '../lib/supabase'
import { displayStatus } from '../lib/release'
import type { Book } from '../lib/types'

interface BookActionsProps {
  book: Book
  onEdit: () => void
  onChanged: () => void
}

async function setStatus(book: Book, status: Book['status'], onChanged: () => void) {
  const { error } = await supabase.from('books').update({ status }).eq('id', book.id)
  if (error) alert(error.message)
  else onChanged()
}

async function removeBook(book: Book, onChanged: () => void) {
  if (!confirm(`Remove "${book.title}"?`)) return
  const { error } = await supabase.from('books').delete().eq('id', book.id)
  if (error) alert(error.message)
  else onChanged()
}

// Due books get the decision the date can't make: overdue, or remove once you have it.
export function BookActions({ book, onEdit, onChanged }: BookActionsProps) {
  const status = displayStatus(book)
  return (
    <span className="book-actions">
      {status === 'due' && (
        <button className="text-action" onClick={() => setStatus(book, 'overdue', onChanged)}>
          Overdue
        </button>
      )}
      {status === 'overdue' && (
        <button
          className="text-action"
          title="Back to tracking by date"
          onClick={() => setStatus(book, 'upcoming', onChanged)}
        >
          Undo
        </button>
      )}
      <button className="text-action" onClick={onEdit}>
        Edit
      </button>
      <button className="text-action text-action-danger" onClick={() => removeBook(book, onChanged)}>
        Remove
      </button>
    </span>
  )
}
