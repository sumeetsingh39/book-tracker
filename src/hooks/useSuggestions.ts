import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { scanHardcover, type ScanResult } from '../lib/hardcover'
import type { Suggestion } from '../lib/types'

// Hardcover is checked at most this often on its own; "Check now" forces it.
const SCAN_EVERY_MS = 24 * 60 * 60 * 1000

export function useSuggestions(enabled: boolean, onScanned?: () => void) {
  const [items, setItems] = useState<Suggestion[]>([])
  const [lastScan, setLastScan] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoScanned = useRef(false)

  const load = useCallback(async () => {
    const [sug, state, linked] = await Promise.all([
      supabase
        .from('book_suggestions')
        .select('*, authors(name)')
        .in('status', ['new', 'accepted']),
      supabase.from('app_state').select('value').eq('key', 'hardcover_scan').maybeSingle(),
      supabase
        .from('authors')
        .select('id', { count: 'exact', head: true })
        .eq('hardcover_status', 'linked'),
    ])
    if (sug.error) {
      setError(sug.error.message)
      return null
    }
    setItems((sug.data ?? []) as Suggestion[])
    const scan = (state.data?.value as ScanResult | undefined) ?? null
    setLastScan(scan)
    return { scan, linked: linked.count ?? 0 }
  }, [])

  const scan = useCallback(async () => {
    setScanning(true)
    setError(null)
    try {
      setLastScan(await scanHardcover())
      await load()
      onScanned?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setScanning(false)
    }
  }, [load, onScanned])

  // Load, then check Hardcover once per visit when the last check is a day old
  // or more authors are linked than it covered.
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      const state = await load()
      if (cancelled || autoScanned.current || !state) return
      const { scan: last, linked } = state
      // Also re-check when authors were linked since the last check.
      const stale =
        !last ||
        Date.now() - new Date(last.checkedAt).getTime() > SCAN_EVERY_MS ||
        linked > last.authors
      if (stale) {
        autoScanned.current = true
        scan()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, load, scan])

  const inbox = useMemo(
    () =>
      items
        .filter((s) => s.status === 'new')
        .sort((a, b) =>
          (a.release_date ?? '9999').localeCompare(b.release_date ?? '9999') ||
          a.title.localeCompare(b.title),
        ),
    [items],
  )

  // Latest Hardcover data for books you track, by Hardcover book id (date hints).
  const byHardcoverBook = useMemo(
    () => new Map(items.filter((s) => s.status === 'accepted').map((s) => [s.hardcover_book_id, s])),
    [items],
  )

  const setStatus = useCallback(
    async (id: number, status: Suggestion['status']) => {
      const { error: err } = await supabase.from('book_suggestions').update({ status }).eq('id', id)
      if (err) throw new Error(err.message)
      await load()
    },
    [load],
  )

  return { inbox, byHardcoverBook, lastScan, scanning, error, scan, setStatus, reload: load }
}
