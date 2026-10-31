import { useId, type ReactNode } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import { useCollapsed } from '../hooks/useCollapsed'

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
  const bodyId = useId()
  const Header = level === 'section' ? 'h2' : 'h3'
  // The heading wraps the button (not the reverse) so screen readers can
  // still jump between sections by heading.
  return (
    <section className={`collapsible collapsible-${level}`}>
      <Header className="collapsible-heading">
        <button
          type="button"
          className="collapsible-header"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={toggle}
        >
          <CaretRight
            weight="light"
            aria-hidden
            className={`collapsible-chevron ${collapsed ? '' : 'collapsible-chevron-open'}`}
          />
          <span className="collapsible-title">{title}</span>
          {count !== undefined && <span className="collapsible-count">{count}</span>}
        </button>
      </Header>
      {!collapsed && (
        <div className="collapsible-body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  )
}
