create table if not exists public.conversion_presets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  options     jsonb not null default '{}'::jsonb,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists conversion_presets_user_id_idx
  on public.conversion_presets(user_id);

alter table public.conversion_presets enable row level security;

create policy "owner can read" on public.conversion_presets
  for select using (auth.uid() = user_id);
create policy "owner can insert" on public.conversion_presets
  for insert with check (auth.uid() = user_id);
create policy "owner can update" on public.conversion_presets
  for update using (auth.uid() = user_id);
create policy "owner can delete" on public.conversion_presets
  for delete using (auth.uid() = user_id);
