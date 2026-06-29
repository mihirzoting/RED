-- Add score column to refine_history for storing analysis scores
alter table if exists public.refine_history
  add column if not exists score int;

-- Update RLS to allow the score column to be written
-- (existing policies already cover all columns)
