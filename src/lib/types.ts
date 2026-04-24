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

export type Shelf = 'read' | 'currently-reading'

export interface GrItem {
  id: number
  goodreads_book_id: string
  title: string
  author: string | null
  shelf: Shelf
  rating: number
  review: string | null
  image_url: string | null
  link: string | null
  date_read: string | null
  date_added: string | null
  fetched_at: string
}

export type TbrCategory =
  | 'investing'
  | 'trading'
  | 'economics'
  | 'personal-finance'
  | 'fun'

export type TbrPriority = 1 | 2 | 3 | 4 | 5

export interface TbrItem {
  id: number
  title: string
  author: string | null
  notes: string | null
  category: TbrCategory | null
  priority: TbrPriority
  added_at: string
}

export const TBR_CATEGORIES: { value: TbrCategory; label: string }[] = [
  { value: 'investing', label: 'Investing' },
  { value: 'trading', label: 'Trading' },
  { value: 'economics', label: 'Economics' },
  { value: 'personal-finance', label: 'Personal Finance' },
  { value: 'fun', label: 'Fun & Knowledge' },
]

export const TBR_PRIORITY_OPTIONS: { value: TbrPriority; label: string }[] = [
  { value: 1, label: 'P1 — Read first' },
  { value: 2, label: 'P2' },
  { value: 3, label: 'P3 — Default' },
  { value: 4, label: 'P4' },
  { value: 5, label: 'P5 — Optional' },
]
