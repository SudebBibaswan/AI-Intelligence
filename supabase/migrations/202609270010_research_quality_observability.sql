begin;

-- Additive observability views. Existing tables, RPCs, and UI-facing views are unchanged.

create or replace view public.v_research_quality_runs
with (security_invoker = true)
as
select
  rr.id as research_run_id,
  rr.workspace_id,
  rr.workspace_domain_id,
  rr.status,
  rr.trigger_type,
  rr.created_at,
  rr.started_at,
  rr.completed_at,
  extract(epoch from (coalesce(rr.completed_at, now()) - coalesce(rr.started_at, rr.created_at)))::integer as duration_seconds,
  coalesce(source_stats.sources_discovered, 0) as sources_discovered,
  coalesce(source_stats.sources_accepted, 0) as sources_accepted,
  coalesce(source_stats.sources_rejected, 0) as sources_rejected,
  coalesce(source_stats.sources_duplicate, 0) as sources_duplicate,
  coalesce(source_stats.sources_failed, 0) as sources_failed,
  coalesce(source_stats.sources_needing_review, 0) as sources_needing_review,
  coalesce(evidence_stats.evidence_count, 0) as evidence_count,
  coalesce(evidence_stats.sources_with_evidence, 0) as sources_with_evidence,
  coalesce(evidence_stats.verified_evidence, 0) as verified_evidence,
  coalesce(evidence_stats.unverified_evidence, 0) as unverified_evidence,
  evidence_stats.average_evidence_confidence,
  case
    when coalesce(source_stats.sources_discovered, 0) = 0 then 0
    else round(coalesce(evidence_stats.sources_with_evidence, 0)::numeric / source_stats.sources_discovered, 4)
  end as source_to_evidence_yield,
  coalesce(usage_stats.llm_calls, 0) as llm_calls,
  coalesce(usage_stats.failed_llm_calls, 0) as failed_llm_calls,
  coalesce(usage_stats.estimated_cost_usd, 0)::numeric(12,6) as estimated_cost_usd,
  case
    when jsonb_typeof(rr.metrics -> 'discovery_provider_errors') = 'array'
      then jsonb_array_length(rr.metrics -> 'discovery_provider_errors')
    else 0
  end as discovery_provider_error_count,
  rr.metrics,
  rr.error_summary
from public.research_runs rr
left join lateral (
  select
    count(*) as sources_discovered,
    count(*) filter (where rrs.decision = 'accepted') as sources_accepted,
    count(*) filter (where rrs.decision = 'rejected') as sources_rejected,
    count(*) filter (where rrs.decision = 'duplicate') as sources_duplicate,
    count(*) filter (where rrs.decision = 'failed') as sources_failed,
    count(*) filter (where rrs.decision = 'needs_review') as sources_needing_review
  from public.research_run_sources rrs
  where rrs.research_run_id = rr.id and rrs.workspace_id = rr.workspace_id
) source_stats on true
left join lateral (
  select
    count(*) as evidence_count,
    count(distinct e.source_id) as sources_with_evidence,
    count(*) filter (where e.verification_status = 'verified') as verified_evidence,
    count(*) filter (where e.verification_status = 'unverified') as unverified_evidence,
    round(avg(e.confidence), 4) as average_evidence_confidence
  from public.evidence e
  where e.research_run_id = rr.id and e.workspace_id = rr.workspace_id
) evidence_stats on true
left join lateral (
  select
    count(*) as llm_calls,
    count(*) filter (where u.success = false) as failed_llm_calls,
    sum(u.estimated_cost_usd) as estimated_cost_usd
  from public.llm_usage u
  where u.research_run_id = rr.id and u.workspace_id = rr.workspace_id
) usage_stats on true;

create or replace view public.v_research_provider_quality
with (security_invoker = true)
as
select
  rrs.workspace_id,
  rrs.discovery_source as provider,
  count(distinct rrs.research_run_id) as research_run_count,
  count(*) as discovered_source_count,
  count(*) filter (where rrs.decision = 'accepted') as accepted_count,
  count(*) filter (where rrs.decision = 'rejected') as rejected_count,
  count(*) filter (where rrs.decision = 'duplicate') as duplicate_count,
  count(*) filter (where rrs.decision = 'failed') as failed_count,
  count(*) filter (where src.extraction_status = 'success') as extraction_success_count,
  count(*) filter (where src.extraction_status = 'partial') as extraction_partial_count,
  count(*) filter (where src.extraction_status in ('failed', 'blocked')) as extraction_failed_count,
  count(distinct rrs.source_id) filter (where evidence_counts.evidence_count > 0) as sources_with_evidence,
  coalesce(sum(evidence_counts.evidence_count), 0) as evidence_count,
  round(avg(rrs.relevance_score), 4) as average_relevance,
  round(avg(src.source_quality_score), 4) as average_source_quality,
  case
    when count(*) = 0 then 0
    else round(
      (count(distinct rrs.source_id) filter (where evidence_counts.evidence_count > 0))::numeric
        / count(*),
      4
    )
  end as source_to_evidence_yield
from public.research_run_sources rrs
join public.sources src
  on src.id = rrs.source_id and src.workspace_id = rrs.workspace_id
left join lateral (
  select count(*) as evidence_count
  from public.evidence e
  where e.source_id = rrs.source_id and e.workspace_id = rrs.workspace_id
) evidence_counts on true
group by rrs.workspace_id, rrs.discovery_source;

create or replace view public.v_research_review_backlog
with (security_invoker = true)
as
select
  src.id as source_id,
  src.workspace_id,
  src.title,
  src.canonical_url,
  src.source_type,
  src.publisher,
  src.source_quality_score,
  src.extraction_status,
  src.evidence_status,
  src.updated_at,
  count(e.id) as evidence_count,
  round(avg(e.confidence), 4) as average_evidence_confidence,
  min(e.created_at) as oldest_evidence_at,
  max(e.created_at) as newest_evidence_at
from public.sources src
left join public.evidence e
  on e.source_id = src.id and e.workspace_id = src.workspace_id
where src.deleted_at is null
  and src.evidence_status in ('pending', 'needs_review')
group by src.id;

create or replace view public.v_capital_graph_health
with (security_invoker = true)
as
select
  workspace.id as workspace_id,
  coalesce(entity_stats.entity_count, 0) as entity_count,
  coalesce(entity_stats.capital_entity_count, 0) as capital_entity_count,
  coalesce(entity_stats.resolved_entity_count, 0) as resolved_entity_count,
  coalesce(entity_stats.provisional_entity_count, 0) as provisional_entity_count,
  coalesce(entity_stats.entities_with_evidence, 0) as entities_with_evidence,
  coalesce(relationship_stats.relationship_count, 0) as relationship_count,
  coalesce(relationship_stats.capital_relationship_count, 0) as capital_relationship_count,
  coalesce(relationship_stats.relationships_with_evidence, 0) as relationships_with_evidence,
  case
    when coalesce(entity_stats.entity_count, 0) = 0 then 0
    else round(entity_stats.entities_with_evidence::numeric / entity_stats.entity_count, 4)
  end as entity_provenance_coverage,
  case
    when coalesce(relationship_stats.relationship_count, 0) = 0 then 0
    else round(relationship_stats.relationships_with_evidence::numeric / relationship_stats.relationship_count, 4)
  end as relationship_provenance_coverage
from public.workspaces workspace
left join lateral (
  select
    count(*) as entity_count,
    count(*) filter (where ent.entity_type in ('company', 'investor', 'fund', 'accelerator', 'person')) as capital_entity_count,
    count(*) filter (where ent.resolution_status = 'resolved') as resolved_entity_count,
    count(*) filter (where ent.resolution_status = 'provisional') as provisional_entity_count,
    count(*) filter (where exists (
      select 1 from public.evidence_entities ee
      where ee.entity_id = ent.id and ee.workspace_id = ent.workspace_id
    )) as entities_with_evidence
  from public.entities ent
  where ent.workspace_id = workspace.id and ent.resolution_status <> 'merged'
) entity_stats on true
left join lateral (
  select
    count(*) as relationship_count,
    count(*) filter (where rel.relationship_type in ('invested_in', 'founded', 'partnered_with', 'acquired')) as capital_relationship_count,
    count(*) filter (where exists (
      select 1 from public.relationship_evidence re
      where re.relationship_id = rel.id and re.workspace_id = rel.workspace_id
    )) as relationships_with_evidence
  from public.relationships rel
  where rel.workspace_id = workspace.id
) relationship_stats on true;

grant select on public.v_research_quality_runs to authenticated;
grant select on public.v_research_provider_quality to authenticated;
grant select on public.v_research_review_backlog to authenticated;
grant select on public.v_capital_graph_health to authenticated;

commit;
