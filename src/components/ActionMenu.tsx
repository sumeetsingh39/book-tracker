import { useEffect, useRef, useState } from 'react'
import { DotsThree } from '@phosphor-icons/react'

export interface MenuAction {
  label: string
  onSelect: () => void
  danger?: boolean
}

interface ActionMenuProps {
  label: string // accessible name, e.g. "Actions for Dune"
  actions: MenuAction[]
}

// A row's actions behind one ⋯ button, so every row keeps the same footprint.
export function ActionMenu({ label, actions }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span className="book-menu" ref={root}>
      <button
        className="book-menu-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <DotsThree weight="bold" aria-hidden />
      </button>
      {open && (
        <span className="book-menu-list" role="menu">
          {actions.map((a) => (
            <button
              key={a.label}
              role="menuitem"
              className={a.danger ? 'book-menu-danger' : undefined}
              onClick={() => {
                setOpen(false)
                a.onSelect()
              }}
            >
              {a.label}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
