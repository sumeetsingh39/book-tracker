import { useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'
import { AuthorForm } from './AuthorForm'
import { BookForm } from './BookForm'
import { BookActions } from './BookActions'
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

  const deleteAuthor = async () => {
    if (!confirm(`Delete "${author.name}" and all their books?`)) return
    const { error } = await supabase.from('authors').delete().eq('id', author.id)
    if (error) alert(error.message)
    else onChanged()
  }

  return (
    <>
      <div className="author-card">
        <div className="author-header">
          <h3 className="author-name">{author.name}</h3>
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
                  <span className="book-meta">
                    <span className={`book-status status-${displayStatus(book)}`}>
                      {STATUS_LABEL[displayStatus(book)]}
                    </span>
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

        {isLoggedIn && (
          <div className="card-actions">
            <button className="btn-small" onClick={() => setAddingBook(true)}>
              <Plus weight="bold" aria-hidden /> Book
            </button>
            <button className="btn-small" onClick={() => setEditingAuthor(true)}>
              Edit
            </button>
            <button className="btn-small btn-danger" onClick={deleteAuthor}>
              Delete
            </button>
          </div>
        )}
      </div>

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
