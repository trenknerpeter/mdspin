-- Stage 3 schema: pgvector, document_chunks, conversions.embedding_status, claim_pending_embeddings.
-- Applied live via Supabase MCP; this file is a record-only mirror.

create extension if not exists vector with schema extensions;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.conversions(id) on delete cascade,
  user_id uuid not null,
  chunk_index integer not null,
  heading_path text,
  content text not null,
  token_count integer not null,
  embedding extensions.vector(384),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists document_chunks_document_id_idx on public.document_chunks(document_id);
create index if not exists document_chunks_user_id_idx on public.document_chunks(user_id);
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.document_chunks enable row level security;

-- No policy allows UPDATE: a chunk is deleted and reinserted on re-embed (see the
-- embedding-backfill route, Task 8), never mutated in place.
create policy document_chunks_owner_select on public.document_chunks
  for select using (auth.uid() = user_id);

create policy document_chunks_owner_insert on public.document_chunks
  for insert with check (auth.uid() = user_id);

create policy document_chunks_owner_delete on public.document_chunks
  for delete using (auth.uid() = user_id);

alter table public.conversions
  add column if not exists embedding_status text not null default 'pending'
    check (embedding_status in ('pending','running','ready','failed')),
  add column if not exists embedding_generated_at timestamptz,
  add column if not exists embedding_attempts integer not null default 0,
  add column if not exists embedding_claimed_at timestamptz;

create or replace function public.claim_pending_embeddings(p_limit integer default 5)
returns table(id uuid, user_id uuid, title text, filename text, markdown_text text)
language plpgsql
set search_path to 'public'
as $$
begin
  return query
  update public.conversions c
     set embedding_status    = 'running',
         embedding_attempts  = c.embedding_attempts + 1,
         embedding_claimed_at = now()
   where c.id in (
     select c2.id
       from public.conversions c2
      where c2.user_id = auth.uid()
        and c2.in_vault
        and (
          c2.embedding_status = 'pending'
          or (c2.embedding_status = 'running' and c2.embedding_claimed_at < now() - interval '10 minutes')
        )
      order by c2.converted_at desc
      limit greatest(p_limit, 1)
      for update skip locked
   )
   returning c.id, c.user_id, c.title, c.filename, c.markdown_text;
end;
$$;
