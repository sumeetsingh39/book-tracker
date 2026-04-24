import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { TbrCategory, TbrItem, TbrPriority } from '../lib/types'

export function useTbr(enabled: boolean) {
  const [items, setItems] = useState<TbrItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('tbr')
      .select('*')
      .order('priority', { ascending: true })
      .order('added_at', { ascending: false })
    if (err) setError(err.message)
    else setItems((data ?? []) as TbrItem[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (enabled) load()
  }, [enabled, load])

  const add = useCallback(
    async (
      title: string,
      author: string,
      notes: string,
      category: TbrCategory | '',
      priority: TbrPriority,
    ) => {
      const { error: err } = await supabase.from('tbr').insert({
        title: title.trim(),
        author: author.trim() || null,
        notes: notes.trim() || null,
        category: category || null,
        priority,
      })
      if (err) return err.message
      await load()
      return null
    },
    [load],
  )

  const remove = useCallback(
    async (id: number) => {
      const { error: err } = await supabase.from('tbr').delete().eq('id', id)
      if (err) return err.message
      await load()
      return null
    },
    [load],
  )

  return { items, loading, error, add, remove, refetch: load }
}
