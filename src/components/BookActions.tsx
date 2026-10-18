import { supabase } from '../lib/supabase'
import { displayStatus } from '../lib/release'
import { ActionMenu, type MenuAction } from './ActionMenu'
import { useToast } from './Toast'
import type { Book } from '../lib/types'

interface BookActionsProps {
  book: Book
  onEdit: () => void
  onChanged: () => void
}

// Changes happen at once and offer Undo instead of asking first.
export function BookActions({ book, onEdit, onChanged }: BookActionsProps) {
  const toast = useToast()
  const status = displayStatus(book)

  const setStatus = async (next: Book['status'], message: string) => {
    const { error } = await supabase.from('books').update({ status: next }).eq('id', book.id)
    if (error) return alert(error.message)
    onChanged()
    toast(message, async () => {
      const { error: undoErr } = await supabase
        .from('books')
        .update({ status: book.status })
        .eq('id', book.id)
      if (undoErr) alert(undoErr.message)
      onChanged()
    })
  }

  const remove = async () => {
    const { error } = await supabase.from('books').delete().eq('id', book.id)
    if (error) return alert(error.message)
    onChanged()
    toast(`Removed “${book.title}”`, async () => {
      const { id, author_id, title, release_date, date_precision, status: s, created_at } = book
      const { error: undoErr } = await supabase
        .from('books')
        .insert({ id, author_id, title, release_date, date_precision, status: s, created_at })
      if (undoErr) alert(undoErr.message)
      onChanged()
    })
  }

  const actions: MenuAction[] = []
  if (status === 'due') {
    actions.push({
      label: 'Mark overdue',
      onSelect: () => setStatus('overdue', `Marked “${book.title}” overdue`),
    })
  }
  if (status === 'overdue') {
    actions.push({
      label: 'Not overdue',
      onSelect: () => setStatus('upcoming', `“${book.title}” follows its date again`),
    })
  }
  actions.push({ label: 'Edit', onSelect: onEdit }, { label: 'Remove', onSelect: remove, danger: true })

  return <ActionMenu label={`Actions for ${book.title}`} actions={actions} />
}
