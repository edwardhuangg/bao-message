-- Migration 0002 — fix the creator-can't-join-own-conversation deadlock.
-- Paste this whole file into the Supabase SQL editor and Run.
--
-- Problem: the "members add members" insert policy checked conversations with
-- a plain subquery, which is itself filtered by the conversations RLS policy
-- ("must be a member") — so the creator could never insert their own
-- membership row, and no chat could ever be started.

create or replace function public.is_creator(conv uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.conversations
    where id = conv and created_by = auth.uid()
  );
$$;

drop policy "members add members" on public.conversation_members;
create policy "members add members" on public.conversation_members
  for insert with check (
    (auth.uid() = user_id and public.is_creator(conversation_id))
    or public.is_member(conversation_id)
  );
