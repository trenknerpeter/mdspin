-- Pro waitlist: who asked, and for what.
--
-- RECORD ONLY. Applied directly to the hosted project (ixdsddfxkrkytiitfici) via
-- the Supabase MCP on 2026-10-02. RLS stays on with no policies: the table is
-- written only by app/api/waitlist/route.ts using the service role.
alter table public.waitlist
  add column if not exists user_id uuid null references auth.users(id) on delete set null,
  add column if not exists interest text not null default 'pro';
