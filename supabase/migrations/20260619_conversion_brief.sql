-- Cluster brief: a cross-document synthesis stored as a property of the source doc.
-- Not a new row — two nullable columns on the existing conversions table.
alter table public.conversions
  add column if not exists brief text,
  add column if not exists brief_generated_at timestamptz;
