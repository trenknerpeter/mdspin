-- Phase 2 step 2: Knowledge Vault membership flag.
-- Record-only: already applied to hosted project (ref ixdsddfxkrkytiitfici) via Supabase MCP.

alter table public.conversions
  add column if not exists in_vault boolean not null default false;

create index if not exists conversions_in_vault_idx
  on public.conversions(user_id) where in_vault = true;
