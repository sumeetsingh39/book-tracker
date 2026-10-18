import { useMemo } from 'react'
import { TBR_CATEGORIES, type TbrCategory, type TbrItem } from '../../lib/types'
import { CollapsibleSection } from './CollapsibleSection'
import { ActionMenu } from '../ActionMenu'

interface TbrListProps {
  items: TbrItem[]
  isLoggedIn: boolean
  onEdit: (item: TbrItem) => void
  onRemove: (item: TbrItem) => void
}

const CATEGORY_ORDER: (TbrCategory | 'uncategorized')[] = [
  'investing',
  'trading',
  'economics',
  'personal-finance',
  'fun',
  'uncategorized',
]

const LABELS: Record<TbrCategory | 'uncategorized', string> = {
  ...Object.fromEntries(TBR_CATEGORIES.map((c) => [c.value, c.label])),
  uncategorized: 'Uncategorized',
} as Record<TbrCategory | 'uncategorized', string>

function TbrRow({
  item,
  isLoggedIn,
  onEdit,
  onRemove,
}: {
  item: TbrItem
  isLoggedIn: boolean
  onEdit: (item: TbrItem) => void
  onRemove: (item: TbrItem) => void
}) {
  return (
    <li className="tbr-item">
      <span className={`tbr-priority tbr-priority-p${item.priority}`} title={`Priority ${item.priority}`}>
        P{item.priority}
      </span>
      <div className="tbr-main">
        <span className="tbr-title">{item.title}</span>
        {item.author && <span className="tbr-author">{item.author}</span>}
        {item.notes && <div className="tbr-notes">{item.notes}</div>}
      </div>
      {isLoggedIn && (
        <ActionMenu
          label={`Actions for ${item.title}`}
          actions={[
            { label: 'Edit', onSelect: () => onEdit(item) },
            { label: 'Remove', onSelect: () => onRemove(item), danger: true },
          ]}
        />
      )}
    </li>
  )
}

export function TbrList({ items, isLoggedIn, onEdit, onRemove }: TbrListProps) {
  const grouped = useMemo(() => {
    const map = new Map<TbrCategory | 'uncategorized', TbrItem[]>()
    for (const it of items) {
      const key = (it.category ?? 'uncategorized') as TbrCategory | 'uncategorized'
      const arr = map.get(key) ?? []
      arr.push(it)
      map.set(key, arr)
    }
    // Already ordered by priority from the hook; keep that order.
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      items: map.get(c)!,
    }))
  }, [items])

  if (items.length === 0) {
    return <p className="state-msg">Your TBR is empty.</p>
  }

  return (
    <div className="tbr-groups">
      {grouped.map(({ category, items: rows }) => (
        <CollapsibleSection
          key={category}
          storageKey={`tbr-group-${category}`}
          level="group"
          title={LABELS[category]}
          count={rows.length}
        >
          <ul className="tbr-list">
            {rows.map((item) => (
              <TbrRow
                key={item.id}
                item={item}
                isLoggedIn={isLoggedIn}
                onEdit={onEdit}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </CollapsibleSection>
      ))}
    </div>
  )
}
