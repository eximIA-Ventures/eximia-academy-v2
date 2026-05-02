-- Add processing status columns to books for async PDF upload tracking

alter table public.books
  add column if not exists processing_status text not null default 'idle',
  add column if not exists processing_error text;

alter table public.books
  add constraint books_processing_status_check
  check (processing_status in ('idle', 'uploading', 'extracting', 'organizing', 'completed', 'failed'));
