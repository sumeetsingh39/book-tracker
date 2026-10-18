-- Approximate release dates and date-driven status.
--   date_precision: how much of release_date is known. 'month' and 'year'
--   dates are stored as the first day of the period (2027-03-01, 2027-01-01).
--   status: only what the date can't tell. 'upcoming' (the app shows it as
--   Due once the period has passed) or 'overdue' (set by hand). 'released'
--   was never used: a book is removed once it's available.
alter table public.books
  add column date_precision text not null default 'day'
    check (date_precision in ('day', 'month', 'year'));

update public.books set status = 'upcoming' where status = 'released';

alter table public.books drop constraint books_status_check;
alter table public.books add constraint books_status_check
  check (status in ('upcoming', 'overdue'));
