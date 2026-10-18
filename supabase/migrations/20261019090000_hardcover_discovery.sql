-- Book discovery from Hardcover (hardcover.app).
--
-- Authors are linked once to a Hardcover author id; the `hardcover` edge
-- function then checks every linked author for future books and files what it
-- finds as suggestions. Nothing is written into `books` until a suggestion is
-- accepted, and accepted books are never changed by the check (a changed
-- Hardcover date only shows up as a hint).

alter table public.authors
  add column hardcover_id integer unique,
  add column hardcover_slug text,
  -- unlinked: not tried yet; linked: hardcover_id set; skipped: no match on Hardcover
  add column hardcover_status text not null default 'unlinked'
    check (hardcover_status in ('unlinked', 'linked', 'skipped'));

-- Which Hardcover book a tracked book is (set on accept, or when the check
-- recognises a book you already track).
alter table public.books
  add column hardcover_book_id integer;

create table public.book_suggestions (
  id bigint generated always as identity primary key,
  author_id integer not null references public.authors (id) on delete cascade,
  hardcover_book_id integer not null,
  title text not null,
  release_date date,
  date_precision text not null default 'day'
    check (date_precision in ('day', 'month', 'year')),
  hardcover_slug text,
  readers integer not null default 0,
  -- new: waiting in the inbox; accepted: copied into books; dismissed: hidden for good
  status text not null default 'new'
    check (status in ('new', 'accepted', 'dismissed')),
  found_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, hardcover_book_id)
);

alter table public.book_suggestions enable row level security;

create policy "Authenticated users manage suggestions"
  on public.book_suggestions for all to authenticated
  using (true) with check (true);

-- Small key/value store for app-wide state (e.g. when Hardcover was last checked).
create table public.app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "Authenticated users read app state"
  on public.app_state for select to authenticated
  using (true);
