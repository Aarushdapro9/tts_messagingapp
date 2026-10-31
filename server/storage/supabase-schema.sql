-- Run once in Supabase: SQL Editor → New query → Run.
-- The server uses one JSONB row so the existing chat data model stays intact.

create table if not exists public.app_state (
  id text primary key default 'primary' check (id = 'primary'),
  data jsonb not null default '{"users": [], "chats": [], "messages": [], "alerts": []}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

insert into public.app_state (id)
values ('primary')
on conflict (id) do nothing;
