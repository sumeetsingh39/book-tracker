-- Entries that are a series or imprint rather than a person ("Malazan series",
-- "Black Tide Rising") follow Hardcover series instead of (or as well as) an
-- author. Hardcover often splits one series across several records, so an
-- entry can follow several: [{ "id": 1167, "name": "Malazan Book of the Fallen", "slug": "..." }].
alter table public.authors
  add column hardcover_series jsonb not null default '[]'::jsonb;
