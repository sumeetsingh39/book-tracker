import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'
import { AuthorForm } from './AuthorForm'
import { BookForm } from './BookForm'
import { ActionMenu } from './ActionMenu'
import { BookActions } from './BookActions'
import { LinkAuthors } from './LinkAuthors'
import { useErrorToast } from './Toast'
import { hardcoverAuthorUrl, hardcoverSeriesUrl } from '../lib/hardcover'
import { displayStatus, formatRelease, STATUS_LABEL } from '../lib/release'
import type { Author, Book } from '../lib/types'

interface AuthorCardProps {
  author: Author
  isLoggedIn: boolean
  onChanged: () => void
}

export function AuthorCard({ author, isLoggedIn, onChanged }: AuthorCardProps) {
  const [editingAuthor, setEditingAuthor] = useState(false)
  const [addingBook, setAddingBook] = useState(false)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [linking, setLinking] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const showError = useErrorToast()
  const bookCount = author.books.length

  // Deleting cascades to the author's books and suggestions, which an Undo
  // could not rebuild faithfully, so this one asks first.
  const deleteAuthor = async () => {
    setDeleting(true)
    const { error } = await supabase.from('authors').delete().eq('id', author.id)
    setDeleting(false)
    setConfirmingDelete(false)
    if (error) showError(`delete ${author.name}`, error)
    else onChanged()
  }

  return (
    <>
      <div className="author-card">
        <div className="author-header">
          <h3 className="author-name">{author.name}</h3>
          {isLoggedIn && (
            <ActionMenu
              label={`Actions for ${author.name}`}
              actions={[
                { label: 'Add book', onSelect: () => setAddingBook(true) },
                { label: 'Edit author', onSelect: () => setEditingAuthor(true) },
                {
                  label: author.hardcover_status === 'linked' ? 'Relink Hardcover' : 'Link to Hardcover',
                  onSelect: () => setLinking(true),
                },
                { label: 'Delete author', onSelect: () => setConfirmingDelete(true), danger: true },
              ]}
            />
          )}
          <div className="author-links">
            {author.goodreads_url && (
              <a
                href={author.goodreads_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Goodreads
              </a>
            )}
            {author.hardcover_slug && (
              <a
                href={hardcoverAuthorUrl(author.hardcover_slug)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Hardcover
              </a>
            )}
            {(author.hardcover_series ?? []).map((x) => (
              <a
                key={x.id}
                href={hardcoverSeriesUrl(x.slug)}
                target="_blank"
                rel="noopener noreferrer"
                title={`Following the Hardcover series “${x.name}”`}
              >
                {x.name}
              </a>
            ))}
            {author.extra_urls &&
              author.extra_urls.split('; ').map((entry, i) => {
                const colonIdx = entry.indexOf(': ')
                if (colonIdx === -1) return null
                const label = entry.slice(0, colonIdx)
                const url = entry.slice(colonIdx + 2)
                return (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={label}
                  >
                    {label}
                  </a>
                )
              })}
          </div>
        </div>

        {author.books.length > 0 ? (
          <ul className="book-list">
            {author.books.map((book) => (
              <li key={book.id} className="book-item">
                <div className="book-main">
                  <span className="book-title">{book.title}</span>
                  <span className={`book-meta status-${displayStatus(book)}`}>
                    <span className="status-dot" aria-hidden />
                    <span className="book-status">{STATUS_LABEL[displayStatus(book)]}</span>
                    <span className="book-date">
                      {formatRelease(book.release_date, book.date_precision)}
                    </span>
                  </span>
                </div>
                {isLoggedIn && (
                  <BookActions
                    book={book}
                    onEdit={() => setEditingBook(book)}
                    onChanged={onChanged}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-books">No upcoming books</p>
        )}

      </div>

      <Modal open={confirmingDelete} onClose={() => setConfirmingDelete(false)} title="Delete author?">
        <p className="confirm-text">
          <strong>{author.name}</strong>
          {bookCount > 0
            ? ` and ${bookCount === 1 ? 'their 1 tracked book' : `all ${bookCount} of their tracked books`} will be deleted.`
            : ' will be deleted.'}{' '}
          This can’t be undone.
        </p>
        <div className="form-actions">
          <button className="btn-secondary" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </button>
          <button className="btn-destructive" onClick={deleteAuthor} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete author'}
          </button>
        </div>
      </Modal>

      <Modal open={linking} onClose={() => setLinking(false)} title="Link to Hardcover">
        {linking && (
          <LinkAuthors
            authors={[author]}
            only={author}
            onChanged={onChanged}
            onDone={() => setLinking(false)}
          />
        )}
      </Modal>

      <Modal
        open={editingAuthor}
        onClose={() => setEditingAuthor(false)}
        title="Edit Author"
      >
        <AuthorForm
          author={author}
          onSaved={() => {
            setEditingAuthor(false)
            onChanged()
          }}
          onCancel={() => setEditingAuthor(false)}
        />
      </Modal>

      <Modal
        open={addingBook}
        onClose={() => setAddingBook(false)}
        title={`Add Book — ${author.name}`}
      >
        <BookForm
          authorId={author.id}
          onSaved={() => {
            setAddingBook(false)
            onChanged()
          }}
          onCancel={() => setAddingBook(false)}
        />
      </Modal>

      <Modal
        open={!!editingBook}
        onClose={() => setEditingBook(null)}
        title="Edit Book"
      >
        {editingBook && (
          <BookForm
            authorId={author.id}
            book={editingBook}
            onSaved={() => {
              setEditingBook(null)
              onChanged()
            }}
            onCancel={() => setEditingBook(null)}
          />
        )}
      </Modal>
    </>
  )
}
