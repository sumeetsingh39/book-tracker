import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Author, SortField, FilterStatus } from '../lib/types'
import { displayStatus, releaseSortKey } from '../lib/release'

export function useAuthors() {
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  const fetchAuthors = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('authors')
      .select('*, books(*)')
      .order('name')

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setAuthors(
      (data as Author[]).map((a) => ({
        ...a,
        books: [...a.books].sort((x, y) => releaseSortKey(x).localeCompare(releaseSortKey(y))),
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAuthors()
  }, [fetchAuthors])

  const filtered = authors.filter((author) => {
    // Search filter
    if (search) {
      const q = search.toLowerCase()
      const nameMatch = author.name.toLowerCase().includes(q)
      const bookMatch = author.books.some((b) =>
        b.title.toLowerCase().includes(q)
      )
      if (!nameMatch && !bookMatch) return false
    }

    // Status filter
    if (filterStatus === 'no_books') {
      return author.books.length === 0
    }
    if (filterStatus !== 'all') {
      return author.books.some((b) => displayStatus(b) === filterStatus)
    }

    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === 'name') {
      return a.name.localeCompare(b.name)
    }

    // Sort by earliest release; authors without books last
    const earliest = (author: Author): string =>
      author.books.reduce((min, book) => {
        const key = releaseSortKey(book)
        return key < min ? key : min
      }, '￿')
    const ka = earliest(a)
    const kb = earliest(b)
    return ka < kb ? -1 : ka > kb ? 1 : a.name.localeCompare(b.name)
  })

  return {
    authors: sorted,
    allAuthors: authors,
    loading,
    error,
    search,
    setSearch,
    sortField,
    setSortField,
    filterStatus,
    setFilterStatus,
    refetch: fetchAuthors,
    totalCount: authors.length,
    filteredCount: sorted.length,
  }
}
