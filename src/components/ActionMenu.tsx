import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Check, DotsThree } from '@phosphor-icons/react'

export interface MenuAction {
  label: string
  onSelect: () => void
  danger?: boolean
  checked?: boolean // set (true or false) for a choice; shows a tick when true
  divider?: boolean // rule above this item, to group the menu
}

interface ActionMenuProps {
  label: string // accessible name, e.g. "Actions for Dune"
  actions: MenuAction[]
  icon?: ReactNode // defaults to ⋯
  buttonClassName?: string
}

// A row's actions behind one ⋯ button, so every row keeps the same footprint.
export function ActionMenu({ label, actions, icon, buttonClassName = 'book-menu-button' }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const list = useRef<HTMLSpanElement>(null)
  const [placement, setPlacement] = useState({ up: false, alignLeft: false })

  // Opens down and leftward by default; flip up when the screen's bottom (or
  // the phone's floating tab bar) is too close, and anchor left when the menu
  // would run off the left edge.
  useLayoutEffect(() => {
    if (!open || !list.current || !root.current) return
    const menu = list.current.getBoundingClientRect()
    const button = root.current.getBoundingClientRect()
    const tabs = document.querySelector('.tabbar .tabs')?.getBoundingClientRect()
    const floor = tabs && tabs.top > innerHeight / 2 ? tabs.top : innerHeight
    const up = button.bottom + 6 + menu.height > floor - 8 && button.top - 6 - menu.height > 8
    const alignLeft = button.right - menu.width < 8
    setPlacement({ up, alignLeft })
  }, [open])

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
        className={buttonClassName}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setPlacement({ up: false, alignLeft: false })
          setOpen((o) => !o)
        }}
      >
        {icon ?? <DotsThree weight="bold" aria-hidden />}
      </button>
      {open && (
        <span
          ref={list}
          className={`book-menu-list ${placement.up ? 'book-menu-up' : ''} ${placement.alignLeft ? 'book-menu-left' : ''}`}
          role="menu"
        >
          {actions.map((a) => (
            <button
              key={a.label}
              role={a.checked === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={a.checked}
              className={[a.danger && 'book-menu-danger', a.divider && 'book-menu-divider']
                .filter(Boolean)
                .join(' ') || undefined}
              onClick={() => {
                setOpen(false)
                a.onSelect()
              }}
            >
              {a.label}
              {a.checked && <Check weight="bold" className="book-menu-check" aria-hidden />}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
