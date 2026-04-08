import type { SortField, FilterStatus } from '../lib/types'

interface SearchBarProps {
  search: string
  onSearchChange: (value: string) => void
  sortField: SortField
  onSortChange: (value: SortField) => void
  filterStatus: FilterStatus
  onFilterChange: (value: FilterStatus) => void
  totalCount: number
  filteredCount: number
}

export function SearchBar({
  search,
  onSearchChange,
  sortField,
  onSortChange,
  filterStatus,
  onFilterChange,
  totalCount,
  filteredCount,
}: SearchBarProps) {
  return (
    <div className="search-bar">
      <div className="search-row">
        <input
          type="text"
          placeholder="Search authors or books..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
        <span className="count">
          {filteredCount} / {totalCount}
        </span>
      </div>
      <div className="filter-row">
        <div className="filter-group">
          <label>Filter:</label>
          <select
            value={filterStatus}
            onChange={(e) => onFilterChange(e.target.value as FilterStatus)}
          >
            <option value="all">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="overdue">Overdue</option>
            <option value="no_books">No books listed</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Sort:</label>
          <select
            value={sortField}
            onChange={(e) => onSortChange(e.target.value as SortField)}
          >
            <option value="date">Release date</option>
            <option value="name">Author name</option>
          </select>
        </div>
      </div>
    </div>
  )
}
