import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { LoginForm } from "./components/LoginForm";
import { Modal } from "./components/Modal";
import { ThemeToggle } from "./components/ThemeToggle";
import { Plus } from "@phosphor-icons/react";
import { AuthorsPage, type AuthorsPageHandle } from "./components/AuthorsPage";
import {
  ReleasesPage,
  type ReleasesPageHandle,
} from "./components/ReleasesPage";
import {
  LibraryPage,
  type LibraryPageHandle,
} from "./components/library/LibraryPage";
import "./App.css";

type Tab = "releases" | "authors" | "library";

const TAB_STORAGE_KEY = "activeTab";

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function getInitialTab(): Tab {
  const stored = localStorage.getItem(TAB_STORAGE_KEY);
  return stored === "authors" || stored === "library" ? stored : "releases";
}

function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [visited, setVisited] = useState<Record<Tab, boolean>>(() => ({
    // Always loaded: it supplies the Due count shown on its tab.
    releases: true,
    authors: getInitialTab() === "authors",
    library: getInitialTab() === "library",
  }));
  const [showLogin, setShowLogin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const onDueCount = useCallback((n: number) => setDueCount(n), []);
  const releasesRef = useRef<ReleasesPageHandle>(null);
  const authorsRef = useRef<AuthorsPageHandle>(null);
  const libraryRef = useRef<LibraryPageHandle>(null);

  const isLoggedIn = !!user;

  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  }, [tab]);

  useEffect(() => {
    document.title = dueCount ? `(${dueCount}) Book Tracker` : "Book Tracker";
  }, [dueCount]);

  const handleFor = (t: Tab) =>
    t === "releases"
      ? releasesRef.current
      : t === "authors"
        ? authorsRef.current
        : libraryRef.current;

  const switchTab = (next: Tab) => {
    setTab(next);
    setVisited((v) => (v[next] ? v : { ...v, [next]: true }));
    // Releases and Authors load the same books separately; reload on return
    // so an edit made on one shows on the other.
    if (next !== "library" && visited[next]) handleFor(next)?.refresh();
  };

  // "/" jumps to the current tab's search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      if (document.querySelector(".modal-backdrop")) return;
      const handle = tab === "releases" ? releasesRef.current : tab === "authors" ? authorsRef.current : null;
      if (!handle) return;
      e.preventDefault();
      handle.focusSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab]);

  const handleRefresh = async () => {
    const handle = handleFor(tab);
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
      <header className="masthead">
        <div className="masthead-bar">
          <span className="dateline">{today}</span>
          <ThemeToggle />
        </div>
        <h1 className="masthead-title">Book Tracker</h1>
        <p className="subtitle">Upcoming releases from authors you follow</p>
      </header>
      <div className="app-toolbar">
        <nav className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "releases"}
            className={`tab ${tab === "releases" ? "tab-active" : ""}`}
            onClick={() => switchTab("releases")}
          >
            Releases
            {dueCount > 0 && (
              <span className="tab-badge" title={`${dueCount} due`}>
                {dueCount}
              </span>
            )}
          </button>
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
        <div className="auth-bar">
          {authLoading ? null : isLoggedIn ? (
            <>
              {tab !== "library" && (
                <button
                  className="btn-small"
                  onClick={() =>
                    (tab === "releases" ? releasesRef.current : authorsRef.current)?.openAddBook()
                  }
                >
                  <Plus weight="bold" aria-hidden /> Book
                </button>
              )}
              {tab === "library" && (
                <button
                  className="btn-small"
                  onClick={() => libraryRef.current?.openAddTbr()}
                >
                  <Plus weight="bold" aria-hidden /> TBR
                </button>
              )}
              {tab === "authors" && (
                <button
                  className="btn-small"
                  onClick={() => authorsRef.current?.openAddAuthor()}
                >
                  <Plus weight="bold" aria-hidden /> Author
                </button>
              )}
              <button
                className="btn-small"
                onClick={handleRefresh}
                disabled={refreshing}
                title={
                  tab === "library"
                    ? "Fetch latest from Goodreads"
                    : "Reload books"
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
      </div>

      {visited.releases && (
        <div
          className={`tab-pane ${tab === "releases" ? "tab-pane-active" : ""}`}
          hidden={tab !== "releases"}
        >
          <ReleasesPage
            ref={releasesRef}
            isLoggedIn={isLoggedIn}
            onDueCount={onDueCount}
          />
        </div>
      )}
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
