export interface Author {
  id: number
  name: string
  goodreads_url: string | null
  extra_urls: string | null
  created_at: string
  books: Book[]
}

export interface Book {
  id: number
  author_id: number
  title: string
  release_date: string | null
  status: 'upcoming' | 'overdue' | 'released'
  created_at: string
}

export type SortField = 'name' | 'date'
export type FilterStatus = 'all' | 'upcoming' | 'overdue' | 'no_books'
