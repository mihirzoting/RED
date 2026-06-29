-- Allow refined_prompt to be null so keystroke analysis saves can succeed
alter table if exists public.refine_history
  alter column refined_prompt drop not null;
