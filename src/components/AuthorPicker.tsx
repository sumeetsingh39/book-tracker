import { useId, useMemo, useState } from 'react'

export interface AuthorChoice {
  id: number | null // null: a new author to create under `name`
  name: string
}

interface AuthorPickerProps {
  authors: { id: number; name: string }[]
  value: AuthorChoice | null
  onChange: (choice: AuthorChoice | null) => void
}

// Case- and accent-insensitive, so "mieville" finds "China Miéville".
const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

export function AuthorPicker({ authors, value, onChange }: AuthorPickerProps) {
  const [text, setText] = useState(value?.name ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()

  const options = useMemo<AuthorChoice[]>(() => {
    const q = fold(text)
    if (!q) return []
    const matches = authors
      .filter((a) => fold(a.name).includes(q))
      .sort((a, b) => Number(!fold(a.name).startsWith(q)) - Number(!fold(b.name).startsWith(q)))
      .slice(0, 6)
      .map((a) => ({ id: a.id, name: a.name }))
    const exact = authors.some((a) => fold(a.name) === q)
    return exact ? matches : [...matches, { id: null, name: text.trim() }]
  }, [authors, text])

  const choose = (choice: AuthorChoice) => {
    onChange(choice)
    setText(choice.name)
    setOpen(false)
  }

  return (
    <div className="author-picker">
      <input
        type="text"
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        placeholder="Start typing a name…"
        value={text}
        required
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
          setActive(0)
          onChange(null)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open || options.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, options.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            choose(options[active])
          }
        }}
      />
      {open && options.length > 0 && (
        <ul className="author-options" id={listId} role="listbox">
          {options.map((o, i) => (
            <li
              key={o.id ?? 'new'}
              role="option"
              aria-selected={i === active}
              className={`author-option ${i === active ? 'author-option-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(o)
              }}
              onMouseEnter={() => setActive(i)}
            >
              {o.id === null ? (
                <>
                  <span className="author-option-new">New author</span> {o.name}
                </>
              ) : (
                o.name
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
