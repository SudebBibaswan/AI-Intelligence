begin;

insert into public.domains (key, name, description, default_config, config_version, is_active)
values (
  'artificial-intelligence',
  'Artificial Intelligence',
  'AI ecosystem, research, products, infrastructure, companies, investment, policy, safety, and adoption intelligence.',
  jsonb_build_object(
    'profile_version', '1.0.0',
    'topics', jsonb_build_array(
      'models', 'agents', 'infrastructure', 'research', 'funding',
      'regulation-and-safety', 'open-weight', 'enterprise-adoption'
    ),
    'geographies', jsonb_build_array('global', 'india'),
    'entity_types', jsonb_build_array(
      'organization', 'person', 'fund', 'product', 'model',
      'technology', 'market', 'geography', 'regulator'
    )
  ),
  1,
  true
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  default_config = excluded.default_config,
  config_version = excluded.config_version,
  is_active = excluded.is_active,
  updated_at = now();

create or replace view public.v_dashboard_signal_cards
with (security_invoker = true)
as
select
  s.id,
  s.workspace_id,
  s.workspace_domain_id,
  s.signal_type,
  s.title,
  s.summary,
  s.event_at,
  s.confidence,
  s.novelty_score,
  s.importance_score,
  s.geographies,
  s.topics,
  s.status,
  s.engine_version,
  s.created_at,
  count(distinct se.evidence_id) as evidence_count,
  count(distinct sn.entity_id) as entity_count
from public.signals s
left join public.signal_evidence se on se.signal_id = s.id and se.workspace_id = s.workspace_id
left join public.signal_entities sn on sn.signal_id = s.id and sn.workspace_id = s.workspace_id
where s.status in ('draft', 'accepted')
group by s.id;

create or replace view public.v_pattern_summaries
with (security_invoker = true)
as
select
  p.id,
  p.workspace_id,
  p.workspace_domain_id,
  p.pattern_type,
  p.title,
  p.statement,
  p.strength_score,
  p.persistence_score,
  p.evidence_diversity_score,
  p.confidence,
  p.status,
  p.first_detected_at,
  p.last_confirmed_at,
  p.updated_at,
  count(distinct po.observation_id) as observation_count
from public.patterns p
left join public.pattern_observations po on po.pattern_id = p.id and po.workspace_id = p.workspace_id
group by p.id;

create or replace view public.v_hypothesis_validation_status
with (security_invoker = true)
as
select
  h.id,
  h.workspace_id,
  h.workspace_domain_id,
  h.title,
  h.statement,
  h.target_user,
  h.problem,
  h.proposed_value,
  h.origin,
  h.status,
  h.confidence,
  h.updated_at,
  vr.id as latest_validation_run_id,
  vr.status as latest_validation_status,
  vr.result as latest_validation_result,
  vr.confidence as latest_validation_confidence,
  vr.completed_at as latest_validation_completed_at
from public.hypotheses h
left join lateral (
  select v.*
  from public.validation_runs v
  where v.hypothesis_id = h.id and v.workspace_id = h.workspace_id
  order by v.created_at desc
  limit 1
) vr on true
where h.deleted_at is null;

create or replace view public.v_research_run_health
with (security_invoker = true)
as
select
  rr.id,
  rr.workspace_id,
  rr.workspace_domain_id,
  rr.trigger_type,
  rr.status,
  rr.request_id,
  rr.contract_version,
  rr.started_at,
  rr.completed_at,
  rr.created_at,
  rr.metrics,
  rr.error_summary,
  (
    select count(*)
    from public.research_run_sources rrs
    where rrs.research_run_id = rr.id and rrs.workspace_id = rr.workspace_id
  ) as discovered_source_count,
  (
    select count(*)
    from public.evidence e
    where e.research_run_id = rr.id and e.workspace_id = rr.workspace_id
  ) as evidence_count,
  coalesce((
    select sum(u.estimated_cost_usd)
    from public.llm_usage u
    where u.research_run_id = rr.id and u.workspace_id = rr.workspace_id
  ), 0)::numeric(12,6) as estimated_cost_usd
from public.research_runs rr;

create or replace view public.v_workspace_cost_daily
with (security_invoker = true)
as
select
  workspace_id,
  (created_at at time zone 'UTC')::date as usage_date,
  provider,
  model,
  operation,
  count(*) as call_count,
  sum(input_tokens) as input_tokens,
  sum(output_tokens) as output_tokens,
  sum(estimated_cost_usd)::numeric(12,6) as estimated_cost_usd,
  count(*) filter (where success = false) as failed_call_count
from public.llm_usage
group by workspace_id, (created_at at time zone 'UTC')::date, provider, model, operation;

create or replace view public.v_source_lineage
with (security_invoker = true)
as
select
  src.id as source_id,
  src.workspace_id,
  src.canonical_url,
  src.title,
  src.publisher,
  src.published_at,
  src.source_type,
  src.storage_class,
  src.extraction_status,
  src.evidence_status,
  src.first_discovered_at,
  src.last_discovered_at,
  count(distinct rrs.research_run_id) as research_run_count,
  count(distinct e.id) as evidence_count,
  max(e.created_at) as latest_evidence_at
from public.sources src
left join public.research_run_sources rrs
  on rrs.source_id = src.id and rrs.workspace_id = src.workspace_id
left join public.evidence e
  on e.source_id = src.id and e.workspace_id = src.workspace_id
where src.deleted_at is null
group by src.id;

grant select on public.v_dashboard_signal_cards to authenticated;
grant select on public.v_pattern_summaries to authenticated;
grant select on public.v_hypothesis_validation_status to authenticated;
grant select on public.v_research_run_health to authenticated;
grant select on public.v_workspace_cost_daily to authenticated;
grant select on public.v_source_lineage to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'research-content',
  'research-content',
  false,
  10485760,
  array['text/plain', 'text/markdown', 'application/json', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
