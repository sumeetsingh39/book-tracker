import type { ReactNode } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import { useCollapsed } from '../../hooks/useCollapsed'

interface CollapsibleSectionProps {
  storageKey: string
  title: ReactNode
  count?: number
  level?: 'section' | 'group'
  defaultCollapsed?: boolean
  // Show the body regardless of the stored state (e.g. while searching).
  forceOpen?: boolean
  children: ReactNode
}

export function CollapsibleSection({
  storageKey,
  title,
  count,
  level = 'section',
  defaultCollapsed = false,
  forceOpen = false,
  children,
}: CollapsibleSectionProps) {
  const stored = useCollapsed(storageKey, defaultCollapsed)
  const collapsed = stored.collapsed && !forceOpen
  const toggle = stored.toggle
  const Header = level === 'section' ? 'h2' : 'h3'
  return (
    <section className={`collapsible collapsible-${level}`}>
      <button
        type="button"
        className="collapsible-header"
        aria-expanded={!collapsed}
        onClick={toggle}
      >
        <CaretRight
          weight="light"
          aria-hidden
          className={`collapsible-chevron ${collapsed ? '' : 'collapsible-chevron-open'}`}
        />
        <Header className="collapsible-title">
          {title}
          {count !== undefined && <span className="collapsible-count"> ({count})</span>}
        </Header>
      </button>
      {!collapsed && <div className="collapsible-body">{children}</div>}
    </section>
  )
}
