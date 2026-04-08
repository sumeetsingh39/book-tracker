import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'
import { AuthorForm } from './AuthorForm'
import { BookForm } from './BookForm'
import type { Author, Book } from '../lib/types'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusClass(status: string): string {
  switch (status) {
    case 'overdue':
      return 'status-overdue'
    case 'released':
      return 'status-released'
    default:
      return 'status-upcoming'
  }
}

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

  const deleteBook = async (book: Book) => {
    if (!confirm(`Delete "${book.title}"?`)) return
    const { error } = await supabase.from('books').delete().eq('id', book.id)
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
                title="Goodreads"
              >
                GR
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
                <span className="book-title">{book.title}</span>
                <span className="book-meta">
                  <span className={`book-status ${statusClass(book.status)}`}>
                    {book.status}
                  </span>
                  <span className="book-date">
                    {formatDate(book.release_date)}
                  </span>
                  {isLoggedIn && (
                    <span className="book-actions">
                      <button
                        className="btn-icon"
                        title="Edit book"
                        onClick={() => setEditingBook(book)}
                      >
                        &#9998;
                      </button>
                      <button
                        className="btn-icon btn-danger"
                        title="Delete book"
                        onClick={() => deleteBook(book)}
                      >
                        &times;
                      </button>
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-books">No upcoming books</p>
        )}

        {isLoggedIn && (
          <div className="card-actions">
            <button className="btn-small" onClick={() => setAddingBook(true)}>
              + Book
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
