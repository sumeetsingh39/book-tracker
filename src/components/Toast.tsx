import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface ToastData {
  id: number
  message: string
  undo?: () => void | Promise<void>
  error?: boolean
}

type ShowToast = (message: string, undo?: ToastData['undo']) => void
type ShowError = (action: string, err: unknown) => void

const ToastContext = createContext<{ show: ShowToast; showError: ShowError }>({
  show: () => {},
  showError: () => {},
})

// Errors stay up longer: they ask the reader to do something.
const TIMEOUT_MS = 6000
const ERROR_TIMEOUT_MS = 12000

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String(err.message) : String(err)
}

// "Couldn't remove “Dune”." plus the likely fix; a dropped connection is the
// common case, and its raw message ("Failed to fetch") says nothing useful.
// eslint-disable-next-line react-refresh/only-export-components
export function describeError(action: string, err: unknown): string {
  const text = errorText(err)
  const offline = /failed to fetch|network|load failed/i.test(text)
  return `Couldn’t ${action}. ${offline ? 'Check your connection and try again.' : text}`
}

// One toast at a time: a quick action reports what it did and offers Undo.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const nextId = useRef(1)

  const show = useCallback<ShowToast>((message, undo) => {
    setToast({ id: nextId.current++, message, undo })
  }, [])

  const showError = useCallback<ShowError>((action, err) => {
    setToast({ id: nextId.current++, message: describeError(action, err), error: true })
  }, [])

  useEffect(() => {
    if (!toast) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), toast.error ? ERROR_TIMEOUT_MS : TIMEOUT_MS)
    return () => window.clearTimeout(timer.current)
  }, [toast])

  return (
    <ToastContext.Provider value={{ show, showError }}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className={`toast ${toast.error ? 'toast-error' : ''}`} key={toast.id} role={toast.error ? 'alert' : undefined}>
            <span>{toast.message}</span>
            {toast.undo && (
              <button
                className="toast-undo"
                onClick={async () => {
                  const undo = toast.undo!
                  setToast(null)
                  await undo()
                }}
              >
                Undo
              </button>
            )}
            {toast.error && (
              <button className="toast-undo" onClick={() => setToast(null)}>
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext).show
}

// eslint-disable-next-line react-refresh/only-export-components
export function useErrorToast() {
  return useContext(ToastContext).showError
}
