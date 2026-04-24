import { useImperativeHandle, useState, forwardRef } from 'react'
import { useAuthors } from '../hooks/useAuthors'
import { SearchBar } from './SearchBar'
import { AuthorCard } from './AuthorCard'
import { Modal } from './Modal'
import { AuthorForm } from './AuthorForm'

interface AuthorsPageProps {
  isLoggedIn: boolean
}

export interface AuthorsPageHandle {
  openAddAuthor: () => void
  refresh: () => Promise<void>
}

export const AuthorsPage = forwardRef<AuthorsPageHandle, AuthorsPageProps>(
  function AuthorsPage({ isLoggedIn }, ref) {
    const {
      authors,
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

    useImperativeHandle(ref, () => ({
      openAddAuthor: () => setShowAddAuthor(true),
      refresh: refetch,
    }))

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

        <main className="author-grid">
          {loading && <p className="state-msg">Loading...</p>}
          {error && <p className="state-msg error">Error: {error}</p>}
          {!loading && !error && authors.length === 0 && (
            <p className="state-msg">No authors found.</p>
          )}
          {authors.map((author) => (
            <AuthorCard
              key={author.id}
              author={author}
              isLoggedIn={isLoggedIn}
              onChanged={refetch}
            />
          ))}
        </main>

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
      </>
    )
  },
)
