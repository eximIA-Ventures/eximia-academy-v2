-- Allow decimal ratings (e.g., 4.5) instead of integer-only
alter table public.books
  alter column rating type numeric(2,1) using rating::numeric(2,1);
