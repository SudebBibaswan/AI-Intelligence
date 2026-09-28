begin;

-- Human review is an authenticated, auditable decision. Model output remains
-- unverified until this contract records an explicit reviewer action.

create table if not exists public.evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  evidence_id uuid not null,
  reviewer_id uuid not null references public.profiles(user_id),
  decision text not null check (decision in ('verified', 'disputed', 'rejected')),
  previous_status text not null check (previous_status in ('unverified', 'verified', 'disputed', 'rejected')),
  reason text check (reason is null or length(btrim(reason)) between 1 and 2000),
  request_id uuid not null unique,
  created_at timestamptz not null default now(),
  foreign key (evidence_id, workspace_id)
    references public.evidence(id, workspace_id) on delete cascade
);

create index if not exists evidence_reviews_evidence_created_idx
  on public.evidence_reviews (evidence_id, created_at desc);
create index if not exists evidence_reviews_workspace_created_idx
  on public.evidence_reviews (workspace_id, created_at desc);

alter table public.evidence_reviews enable row level security;
alter table public.evidence_reviews force row level security;

grant select on public.evidence_reviews to authenticated;

create policy evidence_reviews_select_member
on public.evidence_reviews for select
to authenticated
using ((select private.is_workspace_member(workspace_id)));

create or replace function public.review_research_evidence(
  p_evidence_id uuid,
  p_decision text,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_reason text := nullif(btrim(p_reason), '');
  v_evidence public.evidence%rowtype;
  v_existing public.evidence_reviews%rowtype;
  v_review public.evidence_reviews%rowtype;
  v_source_status text;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_REVIEWER_REQUIRED';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'REVIEW_REQUEST_ID_REQUIRED';
  end if;
  if v_decision not in ('verified', 'disputed', 'rejected') then
    raise exception using errcode = '22023', message = 'INVALID_EVIDENCE_REVIEW_DECISION';
  end if;
  if v_decision in ('disputed', 'rejected') and v_reason is null then
    raise exception using errcode = '22023', message = 'REVIEW_REASON_REQUIRED';
  end if;

  select * into v_existing
  from public.evidence_reviews
  where request_id = p_request_id
  limit 1;
  if found then
    if not private.is_workspace_member(v_existing.workspace_id, array['owner', 'admin', 'member']) then
      raise exception using errcode = '42501', message = 'EVIDENCE_REVIEW_NOT_AUTHORIZED';
    end if;
    return jsonb_build_object(
      'review_id', v_existing.id,
      'evidence_id', v_existing.evidence_id,
      'decision', v_existing.decision,
      'replayed', true
    );
  end if;

  select * into v_evidence
  from public.evidence
  where id = p_evidence_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'EVIDENCE_NOT_FOUND';
  end if;
  if not private.is_workspace_member(v_evidence.workspace_id, array['owner', 'admin', 'member']) then
    raise exception using errcode = '42501', message = 'EVIDENCE_REVIEW_NOT_AUTHORIZED';
  end if;

  insert into public.evidence_reviews (
    workspace_id, evidence_id, reviewer_id, decision, previous_status, reason, request_id
  ) values (
    v_evidence.workspace_id, v_evidence.id, v_actor_id, v_decision,
    v_evidence.verification_status, v_reason, p_request_id
  ) returning * into v_review;

  update public.evidence
  set verification_status = v_decision,
      updated_at = now()
  where id = v_evidence.id;

  select case
    when exists (
      select 1 from public.evidence item
      where item.workspace_id = v_evidence.workspace_id
        and item.source_id = v_evidence.source_id
        and item.verification_status = 'verified'
    ) then 'accepted'
    when exists (
      select 1 from public.evidence item
      where item.workspace_id = v_evidence.workspace_id
        and item.source_id = v_evidence.source_id
        and item.verification_status in ('unverified', 'disputed')
    ) then 'needs_review'
    else 'rejected'
  end into v_source_status;

  update public.sources
  set evidence_status = v_source_status,
      updated_at = now()
  where id = v_evidence.source_id
    and workspace_id = v_evidence.workspace_id;

  insert into public.audit_log (
    workspace_id, actor_type, actor_id, action, target_type, target_id, request_id, metadata
  ) values (
    v_evidence.workspace_id, 'user', v_actor_id, 'evidence.reviewed', 'evidence',
    v_evidence.id, p_request_id, jsonb_build_object(
      'previous_status', v_evidence.verification_status,
      'decision', v_decision,
      'reason', v_reason,
      'source_id', v_evidence.source_id
    )
  );

  return jsonb_build_object(
    'review_id', v_review.id,
    'evidence_id', v_evidence.id,
    'source_id', v_evidence.source_id,
    'previous_status', v_evidence.verification_status,
    'decision', v_decision,
    'source_evidence_status', v_source_status,
    'replayed', false
  );
end;
$$;

create or replace view public.v_evidence_review_queue
with (security_invoker = true)
as
select
  evidence.id as evidence_id,
  evidence.workspace_id,
  run.workspace_domain_id,
  evidence.source_id,
  source.title as source_title,
  source.canonical_url,
  source.publisher,
  source.source_type,
  source.source_quality_score,
  source.extraction_status,
  evidence.evidence_type,
  evidence.claim_text,
  evidence.excerpt,
  evidence.locator,
  evidence.polarity,
  evidence.confidence,
  evidence.verification_status,
  evidence.created_at,
  coalesce(review_stats.review_count, 0) as review_count,
  review_stats.last_reviewed_at
from public.evidence evidence
join public.sources source
  on source.id = evidence.source_id
 and source.workspace_id = evidence.workspace_id
join public.research_runs run
  on run.id = evidence.research_run_id
 and run.workspace_id = evidence.workspace_id
left join lateral (
  select count(*) as review_count, max(review.created_at) as last_reviewed_at
  from public.evidence_reviews review
  where review.evidence_id = evidence.id
    and review.workspace_id = evidence.workspace_id
) review_stats on true
where evidence.verification_status in ('unverified', 'disputed')
  and source.deleted_at is null;

create or replace view public.v_signal_eligible_evidence
with (security_invoker = true)
as
select
  evidence.id as evidence_id,
  evidence.workspace_id,
  run.workspace_domain_id,
  evidence.source_id,
  source.title as source_title,
  source.canonical_url,
  source.publisher,
  source.published_at,
  source.source_type,
  source.source_quality_score,
  evidence.evidence_type,
  evidence.claim_text,
  evidence.excerpt,
  evidence.locator,
  evidence.polarity,
  evidence.confidence,
  evidence.created_at
from public.evidence evidence
join public.sources source
  on source.id = evidence.source_id
 and source.workspace_id = evidence.workspace_id
join public.research_runs run
  on run.id = evidence.research_run_id
 and run.workspace_id = evidence.workspace_id
left join public.signal_evidence used
  on used.evidence_id = evidence.id
 and used.workspace_id = evidence.workspace_id
where evidence.verification_status = 'verified'
  and source.evidence_status = 'accepted'
  and source.deleted_at is null
  and used.evidence_id is null;

-- Tighten capital activity: only explicitly verified evidence can establish
-- evidenced or active capital behavior.
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
  select count(distinct evidence.id) as evidence_count, max(evidence.created_at) as last_evidence_at
  from public.evidence_entities link
  join public.evidence evidence
    on evidence.id = link.evidence_id and evidence.workspace_id = link.workspace_id
  where link.entity_id = ent.id
    and link.workspace_id = ent.workspace_id
    and evidence.verification_status = 'verified'
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
    and supporting_evidence.verification_status = 'verified'
) activity_stats on true
where ent.entity_type in ('investor', 'fund', 'accelerator')
  and ent.resolution_status <> 'merged';

revoke all on function public.review_research_evidence(uuid, text, text, uuid) from public, anon;
grant execute on function public.review_research_evidence(uuid, text, text, uuid) to authenticated;
grant select on public.v_evidence_review_queue to authenticated;
grant select on public.v_signal_eligible_evidence to authenticated;

commit;
