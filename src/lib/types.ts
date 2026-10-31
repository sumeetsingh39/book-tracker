export interface Author {
  id: number
  name: string
  goodreads_url: string | null
  extra_urls: string | null
  created_at: string
  hardcover_id: number | null
  hardcover_slug: string | null
  hardcover_status: 'unlinked' | 'linked' | 'skipped'
  // Hardcover series followed by entries that are a series, not a person.
  hardcover_series: HardcoverSeries[]
  books: Book[]
}

export interface HardcoverSeries {
  id: number
  name: string
  slug: string
}

export interface Book {
  id: number
  author_id: number
  title: string
  release_date: string | null
  date_precision: DatePrecision
  status: 'upcoming' | 'overdue'
  hardcover_book_id: number | null
  created_at: string
}

// A book Hardcover lists for a linked author (see supabase/functions/hardcover).
export interface Suggestion {
  id: number
  author_id: number
  hardcover_book_id: number
  title: string
  release_date: string | null
  date_precision: DatePrecision
  hardcover_slug: string | null
  readers: number
  status: 'new' | 'accepted' | 'dismissed'
  found_at: string
  updated_at: string
  authors?: { name: string } | null
}

export type DatePrecision = 'day' | 'month' | 'year'

export type SortField = 'name' | 'date'
export type FilterStatus = 'all' | 'due' | 'upcoming' | 'overdue' | 'unknown' | 'no_books'
