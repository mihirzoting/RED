-- Ensure RLS is enabled and policies exist on all tables.
-- Run this in the Supabase SQL Editor to fix data privacy.
-- This is idempotent — safe to run multiple times.

-- 1. REFINE HISTORY — enforce per-user isolation
alter table if exists public.refine_history enable row level security;

drop policy if exists "Users can read own history" on public.refine_history;
create policy "Users can read own history"
  on public.refine_history for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own history" on public.refine_history;
create policy "Users can insert own history"
  on public.refine_history for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own history" on public.refine_history;
create policy "Users can delete own history"
  on public.refine_history for delete
  to authenticated
  using (auth.uid() = user_id);

-- 2. USAGE LOG — enforce per-user isolation
alter table if exists public.usage_log enable row level security;

drop policy if exists "Users can read own usage" on public.usage_log;
create policy "Users can read own usage"
  on public.usage_log for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own usage" on public.usage_log;
create policy "Users can insert own usage"
  on public.usage_log for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own usage" on public.usage_log;
create policy "Users can update own usage"
  on public.usage_log for update
  to authenticated
  using (auth.uid() = user_id);

-- 3. USERS — ensure user can only read/update own row
alter table if exists public.users enable row level security;

drop policy if exists "Users can read own row" on public.users;
create policy "Users can read own row"
  on public.users for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update own row" on public.users;
create policy "Users can update own row"
  on public.users for update
  to authenticated
  using (auth.uid() = id);

-- 4. Clean up orphaned rows (shouldn't exist with NOT NULL, but just in case)
delete from public.refine_history where user_id is null;
