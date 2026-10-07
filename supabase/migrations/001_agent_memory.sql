-- Augurio agent memory schema
-- Run this migration in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  objective text not null,
  prompt text not null,
  model text not null,
  plan jsonb not null default '{}'::jsonb,
  status text not null check (status in ('planned','blocked','completed')),
  current_step integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_model_attempts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.agent_tasks(id) on delete cascade,
  provider text not null,
  model text not null,
  status text not null check (status in ('success','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.agent_tasks(id) on delete cascade,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_tasks_created_at_idx
  on public.agent_tasks (created_at desc);

create index if not exists agent_tasks_status_idx
  on public.agent_tasks (status);

create index if not exists agent_model_attempts_task_id_idx
  on public.agent_model_attempts (task_id, created_at desc);

create index if not exists agent_events_task_id_idx
  on public.agent_events (task_id, created_at asc);

alter table public.agent_tasks enable row level security;
alter table public.agent_model_attempts enable row level security;
alter table public.agent_events enable row level security;

-- Augurio writes these tables server-side with SUPABASE_SECRET_KEY.
-- No anonymous policies are created intentionally.

create or replace function public.set_agent_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_tasks_updated_at on public.agent_tasks;

create trigger agent_tasks_updated_at
before update on public.agent_tasks
for each row
execute function public.set_agent_tasks_updated_at();
