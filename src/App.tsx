import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useAuthors } from './hooks/useAuthors'
import { useTheme } from './hooks/useTheme'
import { SearchBar } from './components/SearchBar'
import { AuthorCard } from './components/AuthorCard'
import { LoginForm } from './components/LoginForm'
import { Modal } from './components/Modal'
import { AuthorForm } from './components/AuthorForm'
import './App.css'

function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth()
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

  const { theme, toggle: toggleTheme } = useTheme()
  const [showLogin, setShowLogin] = useState(false)
  const [showAddAuthor, setShowAddAuthor] = useState(false)

  const isLoggedIn = !!user

  return (
    <div className="app">
      <header className="app-header">
        <h1>Book Tracker</h1>
        <p className="subtitle">Upcoming releases from authors you follow</p>
        <div className="auth-bar">
          <button
            className="btn-small theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          {authLoading ? null : isLoggedIn ? (
            <>
              <button className="btn-small" onClick={() => setShowAddAuthor(true)}>
                + Author
              </button>
              <button className="btn-small btn-secondary" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <button className="btn-small" onClick={() => setShowLogin(true)}>
              Sign in
            </button>
          )}
        </div>
      </header>

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
        open={showLogin}
        onClose={() => setShowLogin(false)}
        title="Sign In"
      >
        <LoginForm
          onLogin={async (email, password) => {
            const err = await signIn(email, password)
            if (!err) setShowLogin(false)
            return err
          }}
        />
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
    </div>
  )
}

export default App
