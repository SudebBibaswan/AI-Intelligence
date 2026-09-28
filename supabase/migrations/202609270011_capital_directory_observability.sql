begin;

-- Conservative capital-directory read model. Registry discovery creates only
-- unverified candidates; recent grounded capital relationships establish activity.

create or replace view public.v_capital_directory
with (security_invoker = true)
as
select
  ent.id as entity_id,
  ent.workspace_id,
  ent.entity_type,
  ent.name,
  ent.canonical_url,
  ent.resolution_status,
  ent.external_ids ->> 'wikidata_qid' as wikidata_qid,
  ent.attributes ->> 'registry_country' as registry_country,
  ent.attributes ->> 'registry_country_qid' as registry_country_qid,
  ent.attributes ->> 'registry_source' as registry_source,
  ent.attributes ->> 'registry_status' as registry_status,
  nullif(ent.attributes ->> 'registry_last_seen_at', '')::timestamptz as registry_last_seen_at,
  coalesce(evidence_stats.evidence_count, 0) as evidence_count,
  evidence_stats.last_evidence_at,
  coalesce(activity_stats.capital_relationship_count, 0) as capital_relationship_count,
  activity_stats.last_capital_activity_at,
  case
    when activity_stats.last_capital_activity_at >= now() - interval '365 days' then 'active_evidenced'
    when coalesce(evidence_stats.evidence_count, 0) > 0 then 'evidenced'
    else 'candidate_unverified'
  end as activity_status,
  ent.created_at,
  ent.updated_at
from public.entities ent
left join lateral (
  select
    count(distinct evidence.id) as evidence_count,
    max(evidence.created_at) as last_evidence_at
  from public.evidence_entities link
  join public.evidence evidence
    on evidence.id = link.evidence_id
   and evidence.workspace_id = link.workspace_id
  where link.entity_id = ent.id
    and link.workspace_id = ent.workspace_id
    and evidence.verification_status <> 'rejected'
) evidence_stats on true
left join lateral (
  select
    count(distinct relationship.id) as capital_relationship_count,
    max(coalesce(relationship.valid_from::timestamptz, supporting_evidence.created_at)) as last_capital_activity_at
  from public.relationships relationship
  join public.relationship_evidence relationship_link
    on relationship_link.relationship_id = relationship.id
   and relationship_link.workspace_id = relationship.workspace_id
  join public.evidence supporting_evidence
    on supporting_evidence.id = relationship_link.evidence_id
   and supporting_evidence.workspace_id = relationship_link.workspace_id
  where relationship.workspace_id = ent.workspace_id
    and (relationship.from_entity_id = ent.id or relationship.to_entity_id = ent.id)
    and relationship.relationship_type in ('invested_in', 'partnered_with', 'acquired')
    and supporting_evidence.verification_status <> 'rejected'
) activity_stats on true
where ent.entity_type in ('investor', 'fund', 'accelerator')
  and ent.resolution_status <> 'merged';

grant select on public.v_capital_directory to authenticated;

commit;
