import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface ToastData {
  id: number
  message: string
  undo?: () => void | Promise<void>
}

type ShowToast = (message: string, undo?: ToastData['undo']) => void

const ToastContext = createContext<ShowToast>(() => {})

// One toast at a time: a quick action reports what it did and offers Undo.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const nextId = useRef(1)

  const show = useCallback<ShowToast>((message, undo) => {
    setToast({ id: nextId.current++, message, undo })
  }, [])

  useEffect(() => {
    if (!toast) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(timer.current)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
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
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}
