begin;

-- RE05 Quality Engine: research quality snapshots table
-- Stores periodic quality metrics snapshots for dashboard/trending

create table if not exists public.research_quality_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workspace_domain_id uuid,
  snapshot_at timestamptz not null default now(),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object'),
  runs_detail jsonb not null default '[]'::jsonb check (jsonb_typeof(runs_detail) = 'array'),
  providers_detail jsonb not null default '[]'::jsonb check (jsonb_typeof(providers_detail) = 'array'),
  backlog_detail jsonb not null default '[]'::jsonb check (jsonb_typeof(backlog_detail) = 'array'),
  graph_detail jsonb not null default '{}'::jsonb check (jsonb_typeof(graph_detail) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists research_quality_snapshots_workspace_time_idx
  on public.research_quality_snapshots (workspace_id, snapshot_at desc);

create index if not exists research_quality_snapshots_domain_time_idx
  on public.research_quality_snapshots (workspace_domain_id, snapshot_at desc)
  where workspace_domain_id is not null;

grant select on public.research_quality_snapshots to authenticated;

-- RLS
alter table public.research_quality_snapshots enable row level security;
alter table public.research_quality_snapshots force row level security;

drop policy if exists research_quality_snapshots_select_member
on public.research_quality_snapshots;

create policy research_quality_snapshots_select_member
on public.research_quality_snapshots for select
to authenticated
using ((select private.is_workspace_member(workspace_id)));

drop policy if exists research_quality_snapshots_insert_service
on public.research_quality_snapshots;

create policy research_quality_snapshots_insert_service
on public.research_quality_snapshots for insert
to service_role
with check (true);

commit;
