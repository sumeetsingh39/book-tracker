import { useEffect, useRef, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { LoginForm } from "./components/LoginForm";
import { Modal } from "./components/Modal";
import { AuthorsPage, type AuthorsPageHandle } from "./components/AuthorsPage";
import {
  LibraryPage,
  type LibraryPageHandle,
} from "./components/library/LibraryPage";
import "./App.css";

type Tab = "authors" | "library";

const TAB_STORAGE_KEY = "activeTab";

function getInitialTab(): Tab {
  const stored = localStorage.getItem(TAB_STORAGE_KEY);
  return stored === "library" ? "library" : "authors";
}

function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [visited, setVisited] = useState<Record<Tab, boolean>>(() => ({
    authors: getInitialTab() === "authors",
    library: getInitialTab() === "library",
  }));
  const [showLogin, setShowLogin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const authorsRef = useRef<AuthorsPageHandle>(null);
  const libraryRef = useRef<LibraryPageHandle>(null);

  const isLoggedIn = !!user;

  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  }, [tab]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setVisited((v) => (v[next] ? v : { ...v, [next]: true }));
  };

  const handleRefresh = async () => {
    const handle = tab === "authors" ? authorsRef.current : libraryRef.current;
    if (!handle) return;
    setRefreshing(true);
    try {
      await handle.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Book Tracker</h1>
        <p className="subtitle">Upcoming releases from authors you follow</p>
      </header>
      <div className="app-toolbar">
        <div className="auth-bar">
          {authLoading ? null : isLoggedIn ? (
            <>
              {tab === "authors" && (
                <button
                  className="btn-small"
                  onClick={() => authorsRef.current?.openAddAuthor()}
                >
                  + Author
                </button>
              )}
              <button
                className="btn-small"
                onClick={handleRefresh}
                disabled={refreshing}
                title={
                  tab === "library"
                    ? "Fetch latest from Goodreads"
                    : "Reload authors"
                }
              >
                {refreshing ? "Refreshing..." : "Refresh"}
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
        <nav className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "authors"}
            className={`tab ${tab === "authors" ? "tab-active" : ""}`}
            onClick={() => switchTab("authors")}
          >
            Authors
          </button>
          <button
            role="tab"
            aria-selected={tab === "library"}
            className={`tab ${tab === "library" ? "tab-active" : ""}`}
            onClick={() => switchTab("library")}
          >
            My Library
          </button>
        </nav>
      </div>

      {visited.authors && (
        <div
          className={`tab-pane ${tab === "authors" ? "tab-pane-active" : ""}`}
          hidden={tab !== "authors"}
        >
          <AuthorsPage ref={authorsRef} isLoggedIn={isLoggedIn} />
        </div>
      )}
      {visited.library && (
        <div
          className={`tab-pane ${tab === "library" ? "tab-pane-active" : ""}`}
          hidden={tab !== "library"}
        >
          <LibraryPage ref={libraryRef} isLoggedIn={isLoggedIn} />
        </div>
      )}

      <Modal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        title="Sign In"
      >
        <LoginForm
          onLogin={async (email, password) => {
            const err = await signIn(email, password);
            if (!err) setShowLogin(false);
            return err;
          }}
        />
      </Modal>
    </div>
  );
}

export default App;
