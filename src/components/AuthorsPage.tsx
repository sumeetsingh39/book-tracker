import { useImperativeHandle, useState, forwardRef } from 'react'
import { useAuthors } from '../hooks/useAuthors'
import { SearchBar } from './SearchBar'
import { AuthorCard } from './AuthorCard'
import { Modal } from './Modal'
import { AuthorForm } from './AuthorForm'
import { BookForm } from './BookForm'
import { CollapsibleSection } from './library/CollapsibleSection'
import { LinkAuthors } from './LinkAuthors'

interface AuthorsPageProps {
  isLoggedIn: boolean
}

export interface AuthorsPageHandle {
  openAddAuthor: () => void
  openAddBook: () => void
  focusSearch: () => void
  refresh: () => Promise<void>
}

export const AuthorsPage = forwardRef<AuthorsPageHandle, AuthorsPageProps>(
  function AuthorsPage({ isLoggedIn }, ref) {
    const {
      authors,
      allAuthors,
      loading,
      error,
      search,
      setSearch,
      sortField,
      setSortField,
      filterStatus,
      setFilterStatus,
      totalCount,
      filteredCount,
      refetch,
    } = useAuthors()
    const [showAddAuthor, setShowAddAuthor] = useState(false)
    const [showAddBook, setShowAddBook] = useState(false)
    const [openedId, setOpenedId] = useState<number | null>(null)
    const [linking, setLinking] = useState(false)
    const unlinked = allAuthors.filter((a) => a.hardcover_status === 'unlinked').length

    useImperativeHandle(ref, () => ({
      openAddAuthor: () => setShowAddAuthor(true),
      openAddBook: () => setShowAddBook(true),
      focusSearch: () => document.querySelector<HTMLInputElement>('#author-search')?.focus(),
      refresh: refetch,
    }))

    // Authors with something tracked get full entries; the rest are an index
    // of names, opened one at a time.
    const withBooks = authors.filter((a) => a.books.length > 0)
    const quiet = authors.filter((a) => a.books.length === 0)
    const opened = quiet.find((a) => a.id === openedId)

    return (
      <>
        <SearchBar
          search={search}
          onSearchChange={setSearch}
          sortField={sortField}
          onSortChange={setSortField}
          filterStatus={filterStatus}
          onFilterChange={setFilterStatus}
          totalCount={totalCount}
          filteredCount={filteredCount}
        />

        {isLoggedIn && unlinked > 0 && (
          <div className="link-banner">
            <span>
              <strong>{unlinked}</strong> {unlinked === 1 ? 'author isn’t' : 'authors aren’t'} linked
              to Hardcover, so they aren’t checked for new books.
            </span>
            <button className="btn-small" onClick={() => setLinking(true)}>
              Link authors
            </button>
          </div>
        )}

        {loading && authors.length === 0 && <p className="state-msg">Loading...</p>}
        {error && <p className="state-msg error">Error: {error}</p>}
        {!loading && !error && authors.length === 0 && (
          <p className="state-msg">No authors found.</p>
        )}

        {withBooks.length > 0 && (
          <main className="author-grid">
            {withBooks.map((author) => (
              <AuthorCard
                key={author.id}
                author={author}
                isLoggedIn={isLoggedIn}
                onChanged={refetch}
              />
            ))}
          </main>
        )}

        {quiet.length > 0 && (
          <CollapsibleSection
            storageKey="authors-quiet"
            title="Nothing announced"
            count={quiet.length}
            defaultCollapsed={withBooks.length > 0}
            forceOpen={search.trim() !== '' || filterStatus === 'no_books'}
          >
            {opened && (
              <div className="author-opened">
                <AuthorCard author={opened} isLoggedIn={isLoggedIn} onChanged={refetch} />
              </div>
            )}
            <ul className="author-index">
              {quiet.map((a) => (
                <li key={a.id}>
                  <button
                    className={`author-index-name ${a.id === openedId ? 'author-index-active' : ''}`}
                    aria-expanded={a.id === openedId}
                    onClick={() => setOpenedId((id) => (id === a.id ? null : a.id))}
                  >
                    {a.name}
                  </button>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        <Modal open={linking} onClose={() => setLinking(false)} title="Link authors to Hardcover">
          {linking && (
            <LinkAuthors
              authors={allAuthors}
              onChanged={refetch}
              onDone={() => setLinking(false)}
            />
          )}
        </Modal>

        <Modal
          open={showAddAuthor}
          onClose={() => setShowAddAuthor(false)}
          title="Add Author"
        >
          <AuthorForm
            onSaved={() => {
              setShowAddAuthor(false)
              refetch()
            }}
            onCancel={() => setShowAddAuthor(false)}
          />
        </Modal>

        <Modal open={showAddBook} onClose={() => setShowAddBook(false)} title="Add Book">
          <BookForm
            authors={allAuthors}
            onSaved={() => {
              setShowAddBook(false)
              refetch()
            }}
            onCancel={() => setShowAddBook(false)}
          />
        </Modal>
      </>
    )
  },
)
