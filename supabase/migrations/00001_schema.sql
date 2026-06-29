-- RED Database Schema
-- Run this in the Supabase SQL Editor to set up all tables, RLS, and triggers.

-- 1. USERS TABLE
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  user_type text not null default 'free' check (user_type in ('free', 'premium')),
  premium_since timestamptz,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own row"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own row"
  on public.users for update
  using (auth.uid() = id);

-- Auto-create a users row on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. USAGE LOG TABLE
create table if not exists public.usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  prompt_hash text not null,
  refine_count int not null default 0,
  quota_consumed int not null default 0,
  date date not null default current_date
);

alter table public.usage_log enable row level security;

create policy "Users can read own usage"
  on public.usage_log for select
  using (auth.uid() = user_id);

create policy "Users can insert own usage"
  on public.usage_log for insert
  with check (auth.uid() = user_id);

create policy "Users can update own usage"
  on public.usage_log for update
  using (auth.uid() = user_id);

-- 3. REFINE HISTORY TABLE
create table if not exists public.refine_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  original_prompt text not null,
  refined_prompt text,
  token_count_before int,
  token_count_after int,
  score int,
  created_at timestamptz not null default now()
);

alter table public.refine_history enable row level security;

create policy "Users can read own history"
  on public.refine_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own history"
  on public.refine_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own history"
  on public.refine_history for delete
  using (auth.uid() = user_id);
