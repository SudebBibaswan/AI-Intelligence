begin;

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workspace_domain_id uuid not null,
  signal_type text not null
    check (signal_type in ('funding', 'launch', 'partnership', 'acquisition', 'founder_movement', 'hiring', 'research', 'technology', 'regulation', 'market', 'shutdown', 'investment_thesis', 'other')),
  title text not null check (length(title) between 1 and 240),
  summary text not null check (length(summary) between 1 and 2000),
  event_at timestamptz,
  novelty_score public.score_01 not null,
  importance_score public.score_01 not null,
  confidence public.score_01 not null,
  geographies text[] not null default '{}',
  topics text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  supersedes_signal_id uuid,
  engine_version text not null,
  status text not null default 'draft'
    check (status in ('draft', 'accepted', 'rejected', 'superseded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (workspace_domain_id, workspace_id)
    references public.workspace_domains(id, workspace_id),
  foreign key (supersedes_signal_id, workspace_id)
    references public.signals(id, workspace_id)
);

create index signals_domain_event_idx
  on public.signals (workspace_domain_id, event_at desc);
create index signals_workspace_status_importance_idx
  on public.signals (workspace_id, status, importance_score desc);

create table public.signal_evidence (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  signal_id uuid not null,
  evidence_id uuid not null,
  role text not null check (role in ('supporting', 'contradicting', 'context')),
  weight public.score_01 not null,
  primary key (signal_id, evidence_id, role),
  foreign key (signal_id, workspace_id)
    references public.signals(id, workspace_id) on delete cascade,
  foreign key (evidence_id, workspace_id)
    references public.evidence(id, workspace_id) on delete cascade
);

create table public.signal_entities (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  signal_id uuid not null,
  entity_id uuid not null,
  role text not null,
  primary key (signal_id, entity_id, role),
  foreign key (signal_id, workspace_id)
    references public.signals(id, workspace_id) on delete cascade,
  foreign key (entity_id, workspace_id)
    references public.entities(id, workspace_id) on delete cascade
);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workspace_domain_id uuid not null,
  title text not null,
  statement text not null,
  observation_type text not null,
  time_window_start date,
  time_window_end date,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  engine_version text not null,
  status text not null default 'draft'
    check (status in ('draft', 'accepted', 'rejected', 'superseded')),
  confidence public.score_01 not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (workspace_domain_id, workspace_id)
    references public.workspace_domains(id, workspace_id),
  check (time_window_end is null or time_window_start is null or time_window_end >= time_window_start)
);

create table public.observation_signals (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  observation_id uuid not null,
  signal_id uuid not null,
  role text not null check (role in ('supporting', 'contradicting', 'context')),
  weight public.score_01 not null,
  primary key (observation_id, signal_id),
  foreign key (observation_id, workspace_id)
    references public.observations(id, workspace_id) on delete cascade,
  foreign key (signal_id, workspace_id)
    references public.signals(id, workspace_id) on delete cascade
);

create table public.theses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workspace_domain_id uuid not null,
  subject_entity_id uuid not null,
  thesis_type text not null check (thesis_type in ('stated', 'revealed')),
  statement text not null,
  time_window_start date,
  time_window_end date,
  methodology text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  engine_version text not null,
  status text not null default 'draft'
    check (status in ('draft', 'accepted', 'rejected', 'superseded')),
  confidence public.score_01 not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (workspace_domain_id, workspace_id)
    references public.workspace_domains(id, workspace_id),
  foreign key (subject_entity_id, workspace_id)
    references public.entities(id, workspace_id),
  check (time_window_end is null or time_window_start is null or time_window_end >= time_window_start)
);

create table public.thesis_evidence (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  thesis_id uuid not null,
  evidence_id uuid not null,
  role text not null check (role in ('supporting', 'contradicting', 'context')),
  weight public.score_01 not null,
  primary key (thesis_id, evidence_id, role),
  foreign key (thesis_id, workspace_id)
    references public.theses(id, workspace_id) on delete cascade,
  foreign key (evidence_id, workspace_id)
    references public.evidence(id, workspace_id) on delete cascade
);

create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workspace_domain_id uuid not null,
  pattern_type text not null,
  title text not null,
  statement text not null,
  strength_score public.score_01 not null,
  persistence_score public.score_01 not null,
  evidence_diversity_score public.score_01 not null,
  time_window_start date,
  time_window_end date,
  first_detected_at timestamptz not null,
  last_confirmed_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  engine_version text not null,
  status text not null default 'emerging'
    check (status in ('emerging', 'persistent', 'weakening', 'contradicted', 'archived')),
  confidence public.score_01 not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (workspace_domain_id, workspace_id)
    references public.workspace_domains(id, workspace_id),
  check (time_window_end is null or time_window_start is null or time_window_end >= time_window_start),
  check (last_confirmed_at >= first_detected_at)
);

create index patterns_domain_status_updated_idx
  on public.patterns (workspace_domain_id, status, updated_at desc);

create table public.pattern_observations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pattern_id uuid not null,
  observation_id uuid not null,
  role text not null check (role in ('supporting', 'contradicting', 'context')),
  weight public.score_01 not null,
  primary key (pattern_id, observation_id, role),
  foreign key (pattern_id, workspace_id)
    references public.patterns(id, workspace_id) on delete cascade,
  foreign key (observation_id, workspace_id)
    references public.observations(id, workspace_id) on delete cascade
);

create table public.hypotheses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workspace_domain_id uuid not null,
  title text not null check (length(title) between 1 and 240),
  statement text not null check (length(statement) between 1 and 2000),
  target_user text not null,
  problem text not null,
  proposed_value text,
  assumptions jsonb not null default '[]'::jsonb check (jsonb_typeof(assumptions) = 'array'),
  origin text not null check (origin in ('user', 'engine', 'mixed')),
  status text not null default 'draft'
    check (status in ('draft', 'ready_for_validation', 'validating', 'supported', 'mixed', 'weakened', 'inconclusive', 'archived')),
  confidence public.score_01 not null default 0.000,
  engine_version text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, workspace_id),
  foreign key (workspace_domain_id, workspace_id)
    references public.workspace_domains(id, workspace_id)
);

create index hypotheses_domain_status_updated_idx
  on public.hypotheses (workspace_domain_id, status, updated_at desc);

create table public.hypothesis_patterns (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hypothesis_id uuid not null,
  pattern_id uuid not null,
  role text not null check (role in ('primary', 'supporting', 'contradicting', 'context')),
  weight public.score_01 not null,
  primary key (hypothesis_id, pattern_id, role),
  foreign key (hypothesis_id, workspace_id)
    references public.hypotheses(id, workspace_id) on delete cascade,
  foreign key (pattern_id, workspace_id)
    references public.patterns(id, workspace_id) on delete cascade
);

create table public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hypothesis_id uuid not null,
  research_run_id uuid,
  status text not null default 'queued'
    check (status in ('queued', 'researching', 'synthesizing', 'completed', 'partial', 'failed', 'cancelled')),
  dimensions text[] not null default '{}',
  methodology jsonb not null default '{}'::jsonb check (jsonb_typeof(methodology) = 'object'),
  result text check (result is null or result in ('supported', 'mixed', 'weakened', 'inconclusive')),
  confidence public.score_01,
  summary text,
  limitations text[] not null default '{}',
  unresolved_questions text[] not null default '{}',
  source_cutoff_at timestamptz,
  engine_version text not null,
  idempotency_key text not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  unique (id, workspace_id),
  foreign key (hypothesis_id, workspace_id)
    references public.hypotheses(id, workspace_id),
  foreign key (research_run_id, workspace_id)
    references public.research_runs(id, workspace_id)
);

create index validation_runs_hypothesis_created_idx
  on public.validation_runs (hypothesis_id, created_at desc);

create table public.validation_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  validation_run_id uuid not null,
  evidence_id uuid not null,
  dimension text not null
    check (dimension in ('competitor', 'demand', 'adoption', 'funding', 'technical', 'regulatory', 'incumbent', 'failed_attempt', 'counter_signal')),
  stance text not null check (stance in ('supporting', 'contradicting', 'neutral')),
  weight public.score_01 not null,
  reasoning_summary text not null,
  created_at timestamptz not null default now(),
  unique (validation_run_id, evidence_id, dimension),
  foreign key (validation_run_id, workspace_id)
    references public.validation_runs(id, workspace_id) on delete cascade,
  foreign key (evidence_id, workspace_id)
    references public.evidence(id, workspace_id)
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workspace_domain_id uuid not null,
  hypothesis_id uuid,
  validation_run_id uuid,
  title text not null,
  conclusion text not null,
  confidence public.score_01 not null,
  limitations text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'superseded', 'archived')),
  engine_version text not null,
  analytical_basis jsonb not null default '{}'::jsonb check (jsonb_typeof(analytical_basis) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (workspace_domain_id, workspace_id)
    references public.workspace_domains(id, workspace_id),
  foreign key (hypothesis_id, workspace_id)
    references public.hypotheses(id, workspace_id),
  foreign key (validation_run_id, workspace_id)
    references public.validation_runs(id, workspace_id),
  check (validation_run_id is not null or jsonb_object_length(analytical_basis) > 0)
);

create table public.saved_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  item_type text not null
    check (item_type in ('source', 'signal', 'pattern', 'hypothesis', 'insight', 'brief')),
  item_id uuid not null,
  annotation text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, item_type, item_id)
);

create table public.daily_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workspace_domain_id uuid not null,
  brief_date date not null,
  title text not null,
  summary text not null,
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  source_cutoff_at timestamptz not null,
  engine_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_domain_id, brief_date),
  unique (id, workspace_id),
  foreign key (workspace_domain_id, workspace_id)
    references public.workspace_domains(id, workspace_id)
);

create table public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  research_run_id uuid,
  validation_run_id uuid,
  request_id uuid not null,
  workflow text not null,
  agent text not null,
  operation text not null,
  provider text not null,
  model text not null,
  model_tier smallint not null check (model_tier between 0 and 3),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(12,6) not null default 0 check (estimated_cost_usd >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  success boolean not null,
  error_code text,
  prompt_version text not null,
  schema_version text not null,
  created_at timestamptz not null default now(),
  foreign key (research_run_id, workspace_id)
    references public.research_runs(id, workspace_id),
  foreign key (validation_run_id, workspace_id)
    references public.validation_runs(id, workspace_id)
);

create index llm_usage_workspace_created_idx
  on public.llm_usage (workspace_id, created_at desc);
create index llm_usage_research_run_idx on public.llm_usage (research_run_id);
create index llm_usage_validation_run_idx on public.llm_usage (validation_run_id);

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_type text not null,
  subject_type text not null,
  subject_id uuid,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled')),
  request_id uuid not null,
  idempotency_key text not null,
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 1 check (max_attempts > 0),
  progress public.score_01 not null default 0.000,
  error_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(error_summary) = 'object'),
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (workspace_id, idempotency_key)
);

create index job_runs_workspace_status_idx
  on public.job_runs (workspace_id, status, queued_at desc);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_type text not null check (actor_type in ('user', 'service', 'system')),
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index audit_log_workspace_created_idx
  on public.audit_log (workspace_id, created_at desc);

create index observations_domain_updated_idx
  on public.observations (workspace_domain_id, status, updated_at desc);
create index theses_domain_updated_idx
  on public.theses (workspace_domain_id, status, updated_at desc);

create trigger signals_set_updated_at before update on public.signals
for each row execute function public.set_updated_at();
create trigger observations_set_updated_at before update on public.observations
for each row execute function public.set_updated_at();
create trigger theses_set_updated_at before update on public.theses
for each row execute function public.set_updated_at();
create trigger patterns_set_updated_at before update on public.patterns
for each row execute function public.set_updated_at();
create trigger hypotheses_set_updated_at before update on public.hypotheses
for each row execute function public.set_updated_at();
create trigger insights_set_updated_at before update on public.insights
for each row execute function public.set_updated_at();
create trigger saved_items_set_updated_at before update on public.saved_items
for each row execute function public.set_updated_at();
create trigger daily_briefs_set_updated_at before update on public.daily_briefs
for each row execute function public.set_updated_at();

commit;

