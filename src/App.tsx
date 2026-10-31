import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { LoginForm } from "./components/LoginForm";
import { Modal } from "./components/Modal";
import { THEME_OPTIONS, ThemeToggle } from "./components/ThemeToggle";
import { useToast } from "./components/Toast";
import { useTheme } from "./hooks/useTheme";
import { ActionMenu } from "./components/ActionMenu";
import {
  CalendarBlank,
  Feather,
  Plus,
  UserCircle,
  type Icon,
} from "@phosphor-icons/react";
import { AuthorsPage, type AuthorsPageHandle } from "./components/AuthorsPage";
import {
  ReleasesPage,
  type ReleasesPageHandle,
} from "./components/ReleasesPage";
import "./App.css";

type Tab = "releases" | "authors";

const TAB_STORAGE_KEY = "activeTab";

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

const TABS: { value: Tab; label: string; tagline: string; Icon: Icon }[] = [
  {
    value: "releases",
    label: "Releases",
    tagline: "What’s coming from authors you follow.",
    Icon: CalendarBlank,
  },
  {
    value: "authors",
    label: "Authors",
    tagline: "Everyone you’re keeping an eye on.",
    Icon: Feather,
  },
];

function getInitialTab(): Tab {
  const stored = localStorage.getItem(TAB_STORAGE_KEY);
  return stored === "authors" ? stored : "releases";
}

function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [visited, setVisited] = useState<Record<Tab, boolean>>(() => ({
    // Always loaded: it supplies the Due count shown on its tab.
    releases: true,
    authors: getInitialTab() === "authors",
  }));
  const [showLogin, setShowLogin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { pref: themePref, setPref: setThemePref } = useTheme();
  const toast = useToast();
  const [dueCount, setDueCount] = useState(0);
  const onDueCount = useCallback((n: number) => setDueCount(n), []);
  const releasesRef = useRef<ReleasesPageHandle>(null);
  const authorsRef = useRef<AuthorsPageHandle>(null);

  const isLoggedIn = !!user;

  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  }, [tab]);

  useEffect(() => {
    document.title = dueCount ? `(${dueCount}) Book Tracker` : "Book Tracker";
  }, [dueCount]);

  const handleFor = (t: Tab) => (t === "releases" ? releasesRef.current : authorsRef.current);

  const switchTab = (next: Tab) => {
    setTab(next);
    setVisited((v) => (v[next] ? v : { ...v, [next]: true }));
    // Releases and Authors load the same books separately; reload on return
    // so an edit made on one shows on the other.
    if (visited[next]) handleFor(next)?.refresh();
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

  // Arrow keys, Home and End move between tabs (the usual tablist keys).
  const onTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.value === tab);
    const next =
      e.key === "ArrowRight" ? (i + 1) % TABS.length
      : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length
      : e.key === "Home" ? 0
      : e.key === "End" ? TABS.length - 1
      : -1;
    if (next === -1) return;
    e.preventDefault();
    switchTab(TABS[next].value);
    document.getElementById(`tab-${TABS[next].value}`)?.focus();
  };

  const handleRefresh = async () => {
    const handle = handleFor(tab);
    if (!handle || refreshing) return;
    setRefreshing(true);
    try {
      await handle.refresh();
    } finally {
      setRefreshing(false);
    }
    // A failed reload shows on the page instead.
    toast("Books reloaded");
  };

  const current = TABS.find((t) => t.value === tab)!;

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-top">
          <h1 className="masthead-title">{current.label}</h1>
          <div className="masthead-actions">
            {!authLoading && isLoggedIn && (
              <>
                {tab === "authors" ? (
                  <ActionMenu
                    label="Add"
                    buttonClassName="icon-btn"
                    icon={<Plus aria-hidden />}
                    actions={[
                      { label: "Add book", onSelect: () => authorsRef.current?.openAddBook() },
                      { label: "Add author", onSelect: () => authorsRef.current?.openAddAuthor() },
                    ]}
                  />
                ) : (
                  <button
                    className="icon-btn"
                    aria-label="Add book"
                    title="Add book"
                    onClick={() => releasesRef.current?.openAddBook()}
                  >
                    <Plus aria-hidden />
                  </button>
                )}
              </>
            )}
            {/* Signed in, reload and theme live in the account menu so the
                header fits a phone beside the title. */}
            {!authLoading &&
              (isLoggedIn ? (
                <ActionMenu
                  label="Account"
                  buttonClassName="icon-btn"
                  icon={<UserCircle aria-hidden />}
                  actions={[
                    {
                      label: refreshing ? "Reloading…" : "Reload books",
                      onSelect: handleRefresh,
                    },
                    ...THEME_OPTIONS.map((o, i) => ({
                      label: o.value === "system" ? "Match system theme" : `${o.label} theme`,
                      onSelect: () => setThemePref(o.value),
                      checked: themePref === o.value,
                      divider: i === 0,
                    })),
                    { label: "Sign out", onSelect: signOut, divider: true },
                  ]}
                />
              ) : (
                <>
                  <ThemeToggle pref={themePref} setPref={setThemePref} />
                  <button
                    className="icon-btn"
                    aria-label="Sign in"
                    title="Sign in"
                    onClick={() => setShowLogin(true)}
                  >
                    <UserCircle aria-hidden />
                  </button>
                </>
              ))}
          </div>
        </div>
        <p className="dateline">{today}</p>
        <p className="subtitle">{current.tagline}</p>
      </header>

      <nav className="tabbar" aria-label="Sections">
        <div className="tabs" role="tablist" onKeyDown={onTabKey}>
          {TABS.map(({ value, label, Icon }) => (
            <button
              key={value}
              id={`tab-${value}`}
              role="tab"
              aria-selected={tab === value}
              aria-controls={`panel-${value}`}
              aria-label={value === "releases" && dueCount > 0 ? `${label}, ${dueCount} due` : undefined}
              tabIndex={tab === value ? 0 : -1}
              className={`tab ${tab === value ? "tab-active" : ""}`}
              onClick={() => switchTab(value)}
            >
              <span className="tab-icon">
                <Icon weight={tab === value ? "fill" : "regular"} aria-hidden />
                {value === "releases" && dueCount > 0 && (
                  <span className="tab-badge" title={`${dueCount} due`}>
                    {dueCount}
                  </span>
                )}
              </span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {visited.releases && (
        <div
          id="panel-releases"
          role="tabpanel"
          aria-labelledby="tab-releases"
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
          id="panel-authors"
          role="tabpanel"
          aria-labelledby="tab-authors"
          className={`tab-pane ${tab === "authors" ? "tab-pane-active" : ""}`}
          hidden={tab !== "authors"}
        >
          <AuthorsPage ref={authorsRef} isLoggedIn={isLoggedIn} />
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
