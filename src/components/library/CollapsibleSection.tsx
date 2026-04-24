import type { ReactNode } from 'react'
import { useCollapsed } from '../../hooks/useCollapsed'

interface CollapsibleSectionProps {
  storageKey: string
  title: ReactNode
  count?: number
  level?: 'section' | 'group'
  defaultCollapsed?: boolean
  children: ReactNode
}

export function CollapsibleSection({
  storageKey,
  title,
  count,
  level = 'section',
  defaultCollapsed = false,
  children,
}: CollapsibleSectionProps) {
  const { collapsed, toggle } = useCollapsed(storageKey, defaultCollapsed)
  const Header = level === 'section' ? 'h2' : 'h3'
  return (
    <section className={`collapsible collapsible-${level}`}>
      <button
        type="button"
        className="collapsible-header"
        aria-expanded={!collapsed}
        onClick={toggle}
      >
        <span className={`collapsible-chevron ${collapsed ? '' : 'collapsible-chevron-open'}`}>
          ▶
        </span>
        <Header className="collapsible-title">
          {title}
          {count !== undefined && <span className="collapsible-count"> ({count})</span>}
        </Header>
      </button>
      {!collapsed && <div className="collapsible-body">{children}</div>}
    </section>
  )
}
