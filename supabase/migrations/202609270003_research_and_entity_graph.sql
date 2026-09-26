begin;

create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workspace_domain_id uuid not null,
  trigger_type text not null check (trigger_type in ('manual', 'schedule', 'validation', 'backfill')),
  status text not null default 'queued'
    check (status in ('queued', 'discovering', 'extracting', 'verifying', 'analyzing', 'partial', 'completed', 'failed', 'cancelled')),
  request_id uuid not null default gen_random_uuid(),
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  contract_version text not null,
  config_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(config_snapshot) = 'object'),
  metrics jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metrics) = 'object'),
  error_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(error_summary) = 'object'),
  requested_by uuid references public.profiles(user_id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  unique (id, workspace_id),
  foreign key (workspace_domain_id, workspace_id)
    references public.workspace_domains(id, workspace_id)
);

create index research_runs_domain_created_idx
  on public.research_runs (workspace_domain_id, created_at desc);
create index research_runs_workspace_created_idx
  on public.research_runs (workspace_id, created_at desc);
create index research_runs_active_idx
  on public.research_runs (workspace_id, status, created_at)
  where status in ('queued', 'discovering', 'extracting', 'verifying', 'analyzing');

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  canonical_url text not null check (canonical_url ~ '^https?://'),
  original_url text not null check (original_url ~ '^https?://'),
  title text not null check (length(btrim(title)) > 0),
  source_type text not null
    check (source_type in ('article', 'company_page', 'fund_page', 'portfolio_page', 'paper', 'filing', 'repository', 'transcript', 'video', 'post', 'dataset', 'press_release', 'job_posting', 'regulatory_notice', 'other')),
  publisher text,
  author text,
  published_at timestamptz,
  first_discovered_at timestamptz not null default now(),
  last_discovered_at timestamptz not null default now(),
  content_hash text check (content_hash is null or content_hash ~ '^sha256:[0-9a-f]{64}$'),
  content_storage_path text,
  storage_class text not null default 'S0'
    check (storage_class in ('S0', 'S1', 'S2', 'S3', 'S4', 'S5')),
  content_expires_at timestamptz,
  language text check (language is null or language ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  source_quality_score public.score_01,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'success', 'partial', 'failed', 'blocked')),
  evidence_status text not null default 'pending'
    check (evidence_status in ('pending', 'accepted', 'rejected', 'needs_review')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, canonical_url),
  unique (id, workspace_id)
);

create unique index sources_content_hash_uidx
  on public.sources (workspace_id, content_hash)
  where content_hash is not null and deleted_at is null;
create index sources_workspace_created_idx
  on public.sources (workspace_id, created_at desc);

create table public.research_run_sources (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  research_run_id uuid not null,
  source_id uuid not null,
  discovery_source text not null,
  query text,
  rank integer check (rank is null or rank > 0),
  relevance_score public.score_01,
  decision text not null check (decision in ('accepted', 'rejected', 'duplicate', 'failed', 'needs_review')),
  decision_reasons text[] not null default '{}',
  discovered_at timestamptz not null default now(),
  primary key (research_run_id, source_id),
  foreign key (research_run_id, workspace_id)
    references public.research_runs(id, workspace_id) on delete cascade,
  foreign key (source_id, workspace_id)
    references public.sources(id, workspace_id) on delete cascade
);

create index research_run_sources_workspace_idx
  on public.research_run_sources (workspace_id, discovered_at desc);
create index research_run_sources_source_idx
  on public.research_run_sources (source_id, discovered_at desc);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_id uuid not null,
  research_run_id uuid not null,
  evidence_type text not null
    check (evidence_type in ('fact', 'quote', 'metric', 'event', 'claim', 'counter_claim')),
  claim_text text not null check (length(btrim(claim_text)) > 0),
  excerpt text not null check (length(btrim(excerpt)) > 0),
  locator jsonb not null default '{}'::jsonb
    check (jsonb_typeof(locator) = 'object'),
  polarity text not null default 'neutral'
    check (polarity in ('supports', 'contradicts', 'neutral')),
  confidence public.score_01 not null,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'disputed', 'rejected')),
  extractor_version text not null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (source_id, workspace_id)
    references public.sources(id, workspace_id),
  foreign key (research_run_id, workspace_id)
    references public.research_runs(id, workspace_id)
);

create index evidence_workspace_created_idx
  on public.evidence (workspace_id, created_at desc);
create index evidence_source_idx on public.evidence (source_id);
create index evidence_research_run_idx on public.evidence (research_run_id);

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null check (length(btrim(entity_type)) > 0),
  name text not null check (length(btrim(name)) > 0),
  normalized_name text not null check (length(btrim(normalized_name)) > 0),
  canonical_url text check (canonical_url is null or canonical_url ~ '^https?://'),
  external_ids jsonb not null default '{}'::jsonb
    check (jsonb_typeof(external_ids) = 'object'),
  attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(attributes) = 'object'),
  resolution_status text not null default 'provisional'
    check (resolution_status in ('provisional', 'resolved', 'merged', 'rejected')),
  merged_into_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (merged_into_id, workspace_id)
    references public.entities(id, workspace_id)
);

create index entities_workspace_type_name_idx
  on public.entities (workspace_id, entity_type, normalized_name);
create index entities_workspace_created_idx
  on public.entities (workspace_id, created_at desc);

create table public.entity_aliases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_id uuid not null,
  alias text not null check (length(btrim(alias)) > 0),
  normalized_alias text not null check (length(btrim(normalized_alias)) > 0),
  source_id uuid,
  created_at timestamptz not null default now(),
  unique (workspace_id, entity_id, normalized_alias),
  foreign key (entity_id, workspace_id)
    references public.entities(id, workspace_id) on delete cascade,
  foreign key (source_id, workspace_id)
    references public.sources(id, workspace_id)
);

create index entity_aliases_workspace_alias_idx
  on public.entity_aliases (workspace_id, normalized_alias);

create table public.evidence_entities (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  evidence_id uuid not null,
  entity_id uuid not null,
  role text not null,
  confidence public.score_01 not null,
  primary key (evidence_id, entity_id, role),
  foreign key (evidence_id, workspace_id)
    references public.evidence(id, workspace_id) on delete cascade,
  foreign key (entity_id, workspace_id)
    references public.entities(id, workspace_id) on delete cascade
);

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_entity_id uuid not null,
  to_entity_id uuid not null,
  relationship_type text not null
    check (relationship_type in ('invested_in', 'founded', 'employed_by', 'partnered_with', 'acquired', 'competes_with', 'uses_technology', 'other')),
  direction text not null default 'directed'
    check (direction in ('directed', 'undirected')),
  valid_from date,
  valid_to date,
  confidence public.score_01 not null,
  attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (from_entity_id, workspace_id)
    references public.entities(id, workspace_id),
  foreign key (to_entity_id, workspace_id)
    references public.entities(id, workspace_id),
  check (from_entity_id <> to_entity_id),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create index relationships_workspace_type_idx
  on public.relationships (workspace_id, relationship_type, created_at desc);

create table public.relationship_evidence (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  relationship_id uuid not null,
  evidence_id uuid not null,
  polarity text not null check (polarity in ('supports', 'contradicts', 'neutral')),
  primary key (relationship_id, evidence_id),
  foreign key (relationship_id, workspace_id)
    references public.relationships(id, workspace_id) on delete cascade,
  foreign key (evidence_id, workspace_id)
    references public.evidence(id, workspace_id) on delete cascade
);

create trigger sources_set_updated_at
before update on public.sources
for each row execute function public.set_updated_at();

create trigger evidence_set_updated_at
before update on public.evidence
for each row execute function public.set_updated_at();

create trigger entities_set_updated_at
before update on public.entities
for each row execute function public.set_updated_at();

create trigger relationships_set_updated_at
before update on public.relationships
for each row execute function public.set_updated_at();

commit;

