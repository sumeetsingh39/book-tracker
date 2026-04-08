import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Author, SortField, FilterStatus } from '../lib/types'

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

    setAuthors(data as Author[])
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
    if (filterStatus === 'upcoming') {
      return author.books.some((b) => b.status === 'upcoming')
    }
    if (filterStatus === 'overdue') {
      return author.books.some((b) => b.status === 'overdue')
    }
    if (filterStatus === 'no_books') {
      return author.books.length === 0
    }

    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === 'name') {
      return a.name.localeCompare(b.name)
    }

    // Sort by earliest upcoming date
    const getEarliestDate = (author: Author): number => {
      const dates = author.books
        .filter((book) => book.release_date)
        .map((book) => new Date(book.release_date!).getTime())
      if (dates.length === 0) return Infinity
      return Math.min(...dates)
    }

    return getEarliestDate(a) - getEarliestDate(b)
  })

  return {
    authors: sorted,
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
