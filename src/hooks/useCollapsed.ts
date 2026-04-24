import { useCallback, useEffect, useState } from 'react'

const PREFIX = 'collapsed:'

export function useCollapsed(key: string, defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem(PREFIX + key)
    if (stored === 'true') return true
    if (stored === 'false') return false
    return defaultCollapsed
  })

  useEffect(() => {
    localStorage.setItem(PREFIX + key, String(collapsed))
  }, [key, collapsed])

  const toggle = useCallback(() => setCollapsed((c) => !c), [])

  return { collapsed, toggle }
}
