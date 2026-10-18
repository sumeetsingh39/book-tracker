import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { TbrCategory, TbrItem, TbrPriority } from '../lib/types'

export interface TbrFields {
  title: string
  author: string
  notes: string
  category: TbrCategory | null
  priority: TbrPriority
}

// Rows belong to a user (RLS checks auth.uid() = user_id) and the column has
// no default, so inserts have to name the signed-in user.
async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

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

  // Insert when no id is given, update otherwise. Returns an error message.
  const save = useCallback(
    async (fields: TbrFields, id?: number) => {
      const row = {
        title: fields.title.trim(),
        author: fields.author.trim() || null,
        notes: fields.notes.trim() || null,
        category: fields.category,
        priority: fields.priority,
      }
      let err
      if (id === undefined) {
        const userId = await currentUserId()
        if (!userId) return 'Sign in again to add books.'
        ;({ error: err } = await supabase.from('tbr').insert({ ...row, user_id: userId }))
      } else {
        ;({ error: err } = await supabase.from('tbr').update(row).eq('id', id))
      }
      if (err) {
        return err.code === '23505' ? 'That title is already on your TBR.' : err.message
      }
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

  // Put a removed row back exactly as it was (Undo).
  const restore = useCallback(
    async (item: TbrItem) => {
      const userId = await currentUserId()
      if (!userId) return 'Sign in again to undo.'
      const { error: err } = await supabase.from('tbr').insert({ ...item, user_id: userId })
      if (err) return err.message
      await load()
      return null
    },
    [load],
  )

  return { items, loading, error, save, remove, restore, refetch: load }
}
