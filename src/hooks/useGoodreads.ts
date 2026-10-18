import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { GrItem } from '../lib/types'

export function useGoodreads(enabled: boolean) {
  const [items, setItems] = useState<GrItem[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('gr_items')
      .select('*')
      .order('date_read', { ascending: false, nullsFirst: false })
    if (err) setError(err.message)
    else setItems((data ?? []) as GrItem[])
    setLoading(false)
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (enabled) load()
  }, [enabled, load])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    const { data, error: err } = await supabase.functions.invoke('fetch-goodreads')
    setRefreshing(false)
    if (err) {
      setError(err.message)
      return
    }
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      setError(String(data.error))
      return
    }
    await load()
  }, [load])

  // When the shelves were last copied from Goodreads (all rows share a sync).
  const lastSynced = useMemo(
    () =>
      items.reduce<string | null>(
        (max, it) => (max === null || it.fetched_at > max ? it.fetched_at : max),
        null,
      ),
    [items],
  )

  return { items, loading, loaded, refreshing, error, refresh, lastSynced }
}
