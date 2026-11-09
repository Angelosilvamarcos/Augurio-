-- Augurio memory query optimization
-- Adds an index for the global recent-events timeline used by listAgentEvents().
-- Safe to re-run; does not alter or delete existing records.

create index if not exists agent_events_created_at_idx
  on public.agent_events (created_at desc);
