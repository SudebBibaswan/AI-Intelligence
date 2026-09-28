begin;

-- Observation review is the explicit boundary between descriptive synthesis
-- and any later pattern analysis. Direct status writes remain unavailable.

create table if not exists public.observation_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  observation_id uuid not null,
  reviewer_id uuid not null references public.profiles(user_id),
  decision text not null check (decision in ('accepted', 'rejected')),
  previous_status text not null
    check (previous_status in ('draft', 'accepted', 'rejected', 'superseded')),
  reason text check (reason is null or length(btrim(reason)) between 1 and 2000),
  request_id uuid not null unique,
  created_at timestamptz not null default now(),
  foreign key (observation_id, workspace_id)
    references public.observations(id, workspace_id) on delete cascade
);

create index if not exists observation_reviews_observation_created_idx
  on public.observation_reviews (observation_id, created_at desc);
create index if not exists observation_reviews_workspace_created_idx
  on public.observation_reviews (workspace_id, created_at desc);

alter table public.observation_reviews enable row level security;
alter table public.observation_reviews force row level security;

grant select on public.observation_reviews to authenticated;

create policy observation_reviews_select_member
on public.observation_reviews for select
to authenticated
using ((select private.is_workspace_member(workspace_id)));

create or replace function public.review_intelligence_observation(
  p_observation_id uuid,
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
  v_observation public.observations%rowtype;
  v_existing public.observation_reviews%rowtype;
  v_review public.observation_reviews%rowtype;
  v_signal_count integer := 0;
  v_source_count integer := 0;
  v_invalid_signal_count integer := 0;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_REVIEWER_REQUIRED';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'REVIEW_REQUEST_ID_REQUIRED';
  end if;
  if v_decision not in ('accepted', 'rejected') then
    raise exception using errcode = '22023', message = 'INVALID_OBSERVATION_REVIEW_DECISION';
  end if;
  if v_decision = 'rejected' and v_reason is null then
    raise exception using errcode = '22023', message = 'REVIEW_REASON_REQUIRED';
  end if;

  select * into v_existing
  from public.observation_reviews
  where request_id = p_request_id
  limit 1;
  if found then
    if not private.is_workspace_member(v_existing.workspace_id, array['owner', 'admin', 'member']) then
      raise exception using errcode = '42501', message = 'OBSERVATION_REVIEW_NOT_AUTHORIZED';
    end if;
    if v_existing.observation_id <> p_observation_id or v_existing.decision <> v_decision then
      raise exception using errcode = '22023', message = 'REVIEW_REQUEST_ID_CONFLICT';
    end if;
    return jsonb_build_object(
      'review_id', v_existing.id,
      'observation_id', v_existing.observation_id,
      'decision', v_existing.decision,
      'replayed', true
    );
  end if;

  select * into v_observation
  from public.observations
  where id = p_observation_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'OBSERVATION_NOT_FOUND';
  end if;
  if not private.is_workspace_member(v_observation.workspace_id, array['owner', 'admin', 'member']) then
    raise exception using errcode = '42501', message = 'OBSERVATION_REVIEW_NOT_AUTHORIZED';
  end if;
  if v_observation.status = 'superseded' then
    raise exception using errcode = '22023', message = 'SUPERSEDED_OBSERVATION_CANNOT_BE_REVIEWED';
  end if;

  select
    count(distinct observation_link.signal_id),
    count(distinct evidence.source_id),
    count(distinct observation_link.signal_id) filter (
      where signal.id is null
         or signal.status <> 'accepted'
         or signal.workspace_domain_id <> v_observation.workspace_domain_id
         or evidence.id is null
         or evidence.verification_status <> 'verified'
         or source.id is null
         or source.evidence_status <> 'accepted'
         or source.deleted_at is not null
         or run.workspace_domain_id <> v_observation.workspace_domain_id
    )
  into v_signal_count, v_source_count, v_invalid_signal_count
  from public.observation_signals observation_link
  left join public.signals signal
    on signal.id = observation_link.signal_id
   and signal.workspace_id = observation_link.workspace_id
  left join public.signal_evidence signal_link
    on signal_link.signal_id = signal.id
   and signal_link.workspace_id = signal.workspace_id
  left join public.evidence evidence
    on evidence.id = signal_link.evidence_id
   and evidence.workspace_id = signal_link.workspace_id
  left join public.sources source
    on source.id = evidence.source_id
   and source.workspace_id = evidence.workspace_id
  left join public.research_runs run
    on run.id = evidence.research_run_id
   and run.workspace_id = evidence.workspace_id
  where observation_link.observation_id = v_observation.id
    and observation_link.workspace_id = v_observation.workspace_id;

  if v_decision = 'accepted' and v_signal_count < 2 then
    raise exception using errcode = '22023', message = 'OBSERVATION_REQUIRES_TWO_ACCEPTED_SIGNALS';
  end if;
  if v_decision = 'accepted' and v_source_count < 2 then
    raise exception using errcode = '22023', message = 'OBSERVATION_REQUIRES_TWO_CURRENT_SOURCES';
  end if;
  if v_decision = 'accepted' and v_invalid_signal_count > 0 then
    raise exception using errcode = '22023', message = 'OBSERVATION_REQUIRES_CURRENT_ACCEPTED_SIGNALS';
  end if;

  insert into public.observation_reviews (
    workspace_id, observation_id, reviewer_id, decision, previous_status, reason, request_id
  ) values (
    v_observation.workspace_id, v_observation.id, v_actor_id, v_decision,
    v_observation.status, v_reason, p_request_id
  ) returning * into v_review;

  update public.observations
  set status = v_decision,
      metadata = metadata || jsonb_build_object(
        'reviewed_at', now(),
        'reviewed_by', v_actor_id,
        'review_decision', v_decision,
        'signal_count_at_review', v_signal_count,
        'source_count_at_review', v_source_count
      ),
      updated_at = now()
  where id = v_observation.id;

  insert into public.audit_log (
    workspace_id, actor_type, actor_id, action, target_type, target_id, request_id, metadata
  ) values (
    v_observation.workspace_id, 'user', v_actor_id, 'observation.reviewed', 'observation',
    v_observation.id, p_request_id, jsonb_build_object(
      'previous_status', v_observation.status,
      'decision', v_decision,
      'reason', v_reason,
      'signal_count', v_signal_count,
      'source_count', v_source_count
    )
  );

  return jsonb_build_object(
    'review_id', v_review.id,
    'observation_id', v_observation.id,
    'previous_status', v_observation.status,
    'decision', v_decision,
    'signal_count', v_signal_count,
    'source_count', v_source_count,
    'replayed', false
  );
end;
$$;

create or replace view public.v_observation_review_queue
with (security_invoker = true)
as
select
  observation.id as observation_id,
  observation.workspace_id,
  observation.workspace_domain_id,
  domain.key as domain_key,
  coalesce(workspace_domain.name, domain.name) as domain_name,
  observation.observation_type,
  observation.title,
  observation.statement,
  observation.time_window_start,
  observation.time_window_end,
  observation.confidence,
  observation.status,
  coalesce(link_stats.signal_count, 0) as signal_count,
  coalesce(link_stats.independent_source_count, 0) as independent_source_count,
  coalesce(link_stats.invalid_signal_count, 0) as invalid_signal_count,
  coalesce(link_stats.all_inputs_current, false) as all_inputs_current,
  coalesce(review_stats.review_count, 0) as review_count,
  review_stats.last_reviewed_at,
  observation.created_at,
  observation.updated_at
from public.observations observation
join public.workspace_domains workspace_domain
  on workspace_domain.id = observation.workspace_domain_id
 and workspace_domain.workspace_id = observation.workspace_id
join public.domains domain on domain.id = workspace_domain.domain_id
left join lateral (
  select
    count(distinct observation_link.signal_id) as signal_count,
    count(distinct evidence.source_id) as independent_source_count,
    count(distinct observation_link.signal_id) filter (
      where signal.id is null
         or signal.status <> 'accepted'
         or signal.workspace_domain_id <> observation.workspace_domain_id
         or evidence.id is null
         or evidence.verification_status <> 'verified'
         or source.id is null
         or source.evidence_status <> 'accepted'
         or source.deleted_at is not null
         or run.workspace_domain_id <> observation.workspace_domain_id
    ) as invalid_signal_count,
    count(distinct observation_link.signal_id) >= 2
      and count(distinct evidence.source_id) >= 2
      and count(distinct observation_link.signal_id) filter (
        where signal.id is null
           or signal.status <> 'accepted'
           or signal.workspace_domain_id <> observation.workspace_domain_id
           or evidence.id is null
           or evidence.verification_status <> 'verified'
           or source.id is null
           or source.evidence_status <> 'accepted'
           or source.deleted_at is not null
           or run.workspace_domain_id <> observation.workspace_domain_id
      ) = 0 as all_inputs_current
  from public.observation_signals observation_link
  left join public.signals signal
    on signal.id = observation_link.signal_id
   and signal.workspace_id = observation_link.workspace_id
  left join public.signal_evidence signal_link
    on signal_link.signal_id = signal.id
   and signal_link.workspace_id = signal.workspace_id
  left join public.evidence evidence
    on evidence.id = signal_link.evidence_id
   and evidence.workspace_id = signal_link.workspace_id
  left join public.sources source
    on source.id = evidence.source_id
   and source.workspace_id = evidence.workspace_id
  left join public.research_runs run
    on run.id = evidence.research_run_id
   and run.workspace_id = evidence.workspace_id
  where observation_link.observation_id = observation.id
    and observation_link.workspace_id = observation.workspace_id
) link_stats on true
left join lateral (
  select count(*) as review_count, max(review.created_at) as last_reviewed_at
  from public.observation_reviews review
  where review.observation_id = observation.id
    and review.workspace_id = observation.workspace_id
) review_stats on true
where observation.status = 'draft';

create or replace view public.v_observation_review_details
with (security_invoker = true)
as
select
  observation.id as observation_id,
  observation.workspace_id,
  observation.workspace_domain_id,
  observation.observation_type,
  observation.title as observation_title,
  observation.statement as observation_statement,
  observation.confidence as observation_confidence,
  observation_link.role as signal_role,
  observation_link.weight as signal_weight,
  signal.id as signal_id,
  signal.signal_type,
  signal.title as signal_title,
  signal.summary as signal_summary,
  signal.confidence as signal_confidence,
  signal.status as signal_status,
  signal_sources.independent_source_count,
  signal_sources.source_titles,
  signal_sources.canonical_urls,
  signal_sources.signal_currently_eligible,
  observation.created_at as observation_created_at
from public.observations observation
join public.observation_signals observation_link
  on observation_link.observation_id = observation.id
 and observation_link.workspace_id = observation.workspace_id
join public.signals signal
  on signal.id = observation_link.signal_id
 and signal.workspace_id = observation_link.workspace_id
left join lateral (
  select
    count(distinct evidence.source_id) as independent_source_count,
    array_agg(distinct source.title order by source.title) as source_titles,
    array_agg(distinct source.canonical_url order by source.canonical_url) as canonical_urls,
    signal.status = 'accepted'
      and count(distinct signal_link.evidence_id) > 0
      and count(distinct signal_link.evidence_id) filter (
        where evidence.verification_status <> 'verified'
           or source.evidence_status <> 'accepted'
           or source.deleted_at is not null
           or run.workspace_domain_id <> observation.workspace_domain_id
      ) = 0 as signal_currently_eligible
  from public.signal_evidence signal_link
  join public.evidence evidence
    on evidence.id = signal_link.evidence_id
   and evidence.workspace_id = signal_link.workspace_id
  join public.sources source
    on source.id = evidence.source_id
   and source.workspace_id = evidence.workspace_id
  join public.research_runs run
    on run.id = evidence.research_run_id
   and run.workspace_id = evidence.workspace_id
  where signal_link.signal_id = signal.id
    and signal_link.workspace_id = signal.workspace_id
) signal_sources on true
where observation.status = 'draft';

create or replace view public.v_pattern_eligible_observations
with (security_invoker = true)
as
select
  observation.id as observation_id,
  observation.workspace_id,
  observation.workspace_domain_id,
  observation.observation_type,
  observation.title,
  observation.statement,
  observation.time_window_start,
  observation.time_window_end,
  observation.confidence,
  observation.metadata,
  link_stats.signal_count,
  link_stats.independent_source_count,
  observation.created_at,
  observation.updated_at
from public.observations observation
join lateral (
  select
    count(distinct observation_link.signal_id) as signal_count,
    count(distinct evidence.source_id) as independent_source_count,
    count(distinct observation_link.signal_id) filter (
      where signal.id is null
         or signal.status <> 'accepted'
         or signal.workspace_domain_id <> observation.workspace_domain_id
         or evidence.id is null
         or evidence.verification_status <> 'verified'
         or source.id is null
         or source.evidence_status <> 'accepted'
         or source.deleted_at is not null
         or run.workspace_domain_id <> observation.workspace_domain_id
    ) as invalid_signal_count
  from public.observation_signals observation_link
  left join public.signals signal
    on signal.id = observation_link.signal_id
   and signal.workspace_id = observation_link.workspace_id
  left join public.signal_evidence signal_link
    on signal_link.signal_id = signal.id
   and signal_link.workspace_id = signal.workspace_id
  left join public.evidence evidence
    on evidence.id = signal_link.evidence_id
   and evidence.workspace_id = signal_link.workspace_id
  left join public.sources source
    on source.id = evidence.source_id
   and source.workspace_id = evidence.workspace_id
  left join public.research_runs run
    on run.id = evidence.research_run_id
   and run.workspace_id = evidence.workspace_id
  where observation_link.observation_id = observation.id
    and observation_link.workspace_id = observation.workspace_id
) link_stats on true
where observation.status = 'accepted'
  and link_stats.signal_count >= 2
  and link_stats.independent_source_count >= 2
  and link_stats.invalid_signal_count = 0;

revoke all on function public.review_intelligence_observation(uuid, text, text, uuid) from public, anon;
grant execute on function public.review_intelligence_observation(uuid, text, text, uuid) to authenticated;
grant select on public.v_observation_review_queue to authenticated;
grant select on public.v_observation_review_details to authenticated;
grant select on public.v_pattern_eligible_observations to authenticated;

commit;
