-- Bao Message — Supabase schema. Paste into the SQL editor (or use as migration 0001).
-- Designed so Phase 2 (E2EE) is an additive change, not a rewrite.

-- ---------- Allowlist (who may sign up) ----------
create table public.allowlist (
  email text primary key,
  added_at timestamptz not null default now(),
  note text
);
alter table public.allowlist enable row level security;
-- No policies: only the dashboard / service role can read or write it.

-- Reject signups not on the allowlist (server-side enforcement).
create or replace function public.enforce_allowlist()
returns trigger language plpgsql security definer as $$
begin
  if not exists (select 1 from public.allowlist where lower(email) = lower(new.email)) then
    raise exception 'This email is not on the guest list.';
  end if;
  return new;
end $$;
create trigger check_allowlist before insert on auth.users
  for each row execute function public.enforce_allowlist();

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 40),
  avatar_color text not null default '#FFD6A5',
  avatar_emoji text,
  public_key text,                    -- Phase 2: base64 X25519 public key
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles readable by signed-in users" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "users edit own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- ---------- Conversations & membership ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,                         -- null for 1:1, optional for groups
  is_group boolean not null default false,
  created_by uuid not null references public.profiles(id),
  key_version int not null default 1, -- Phase 2
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

-- Helper: is the current user a member? (security definer avoids RLS recursion)
create or replace function public.is_member(conv uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

alter table public.conversations enable row level security;
create policy "members read conversations" on public.conversations
  for select using (public.is_member(id));
create policy "signed-in users create conversations" on public.conversations
  for insert with check (auth.uid() = created_by);
create policy "creator updates conversation" on public.conversations
  for update using (auth.uid() = created_by);

-- Helper: did the current user create this conversation? Must be security
-- definer: a plain subquery on conversations inside a policy is itself subject
-- to the conversations RLS, which requires membership — a bootstrap deadlock
-- (the creator isn't a member yet when they add themself).
create or replace function public.is_creator(conv uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.conversations
    where id = conv and created_by = auth.uid()
  );
$$;

alter table public.conversation_members enable row level security;
create policy "members see membership" on public.conversation_members
  for select using (public.is_member(conversation_id));
create policy "members add members" on public.conversation_members
  for insert with check (
    -- either you're adding yourself to a conversation you created, or you're already a member adding someone
    (auth.uid() = user_id and public.is_creator(conversation_id))
    or public.is_member(conversation_id)
  );
create policy "users update own membership" on public.conversation_members
  for update using (auth.uid() = user_id);
create policy "users leave" on public.conversation_members
  for delete using (auth.uid() = user_id);

-- ---------- Messages ----------
create table public.messages (
  id uuid primary key,                          -- generated client-side for optimistic UI
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text check (body is null or length(body) <= 4000),   -- Phase 1 plaintext; null in Phase 2
  ciphertext text,                              -- Phase 2 base64
  nonce text,                                   -- Phase 2 base64 (24 bytes)
  key_version int not null default 1,
  created_at timestamptz not null default now(),
  check (body is not null or ciphertext is not null)
);
create index messages_conv_created on public.messages (conversation_id, created_at desc);

alter table public.messages enable row level security;
create policy "members read messages" on public.messages
  for select using (public.is_member(conversation_id));
create policy "members send as themselves" on public.messages
  for insert with check (auth.uid() = sender_id and public.is_member(conversation_id));
create policy "senders delete own messages" on public.messages
  for delete using (auth.uid() = sender_id);

-- Realtime: enable for messages (Dashboard → Database → Replication, or:)
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_members;

-- ---------- Phase 2 tables (safe to create now) ----------
create table public.conversation_keys (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  key_version int not null default 1,
  wrapped_key text not null,   -- nacl.box(convKey) for this user, base64
  nonce text not null,
  wrapped_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id, key_version)
);
alter table public.conversation_keys enable row level security;
create policy "read own wrapped keys" on public.conversation_keys
  for select using (auth.uid() = user_id);
create policy "members wrap keys for members" on public.conversation_keys
  for insert with check (auth.uid() = wrapped_by and public.is_member(conversation_id));

create table public.key_backups (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  salt text not null,
  nonce text not null,
  ciphertext text not null,    -- identity private key encrypted under PBKDF2(passphrase)
  updated_at timestamptz not null default now()
);
alter table public.key_backups enable row level security;
create policy "own backup only" on public.key_backups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Seed ----------
-- insert into public.allowlist (email, note) values ('you@example.com', 'owner'), ('friend@example.com', 'friend');
