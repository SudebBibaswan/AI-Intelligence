begin;

-- Signals remain drafts until an authenticated workspace member explicitly
-- accepts or rejects them. The review record is append-only and replay-safe.

create table if not exists public.signal_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  signal_id uuid not null,
  reviewer_id uuid not null references public.profiles(user_id),
  decision text not null check (decision in ('accepted', 'rejected')),
  previous_status text not null
    check (previous_status in ('draft', 'accepted', 'rejected', 'superseded')),
  reason text check (reason is null or length(btrim(reason)) between 1 and 2000),
  request_id uuid not null unique,
  created_at timestamptz not null default now(),
  foreign key (signal_id, workspace_id)
    references public.signals(id, workspace_id) on delete cascade
);

create index if not exists signal_reviews_signal_created_idx
  on public.signal_reviews (signal_id, created_at desc);
create index if not exists signal_reviews_workspace_created_idx
  on public.signal_reviews (workspace_id, created_at desc);

alter table public.signal_reviews enable row level security;
alter table public.signal_reviews force row level security;

grant select on public.signal_reviews to authenticated;

create policy signal_reviews_select_member
on public.signal_reviews for select
to authenticated
using ((select private.is_workspace_member(workspace_id)));

create or replace function public.review_intelligence_signal(
  p_signal_id uuid,
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
  v_signal public.signals%rowtype;
  v_existing public.signal_reviews%rowtype;
  v_review public.signal_reviews%rowtype;
  v_evidence_count integer := 0;
  v_source_count integer := 0;
  v_invalid_evidence_count integer := 0;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_REVIEWER_REQUIRED';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'REVIEW_REQUEST_ID_REQUIRED';
  end if;
  if v_decision not in ('accepted', 'rejected') then
    raise exception using errcode = '22023', message = 'INVALID_SIGNAL_REVIEW_DECISION';
  end if;
  if v_decision = 'rejected' and v_reason is null then
    raise exception using errcode = '22023', message = 'REVIEW_REASON_REQUIRED';
  end if;

  select * into v_existing
  from public.signal_reviews
  where request_id = p_request_id
  limit 1;
  if found then
    if not private.is_workspace_member(v_existing.workspace_id, array['owner', 'admin', 'member']) then
      raise exception using errcode = '42501', message = 'SIGNAL_REVIEW_NOT_AUTHORIZED';
    end if;
    if v_existing.signal_id <> p_signal_id or v_existing.decision <> v_decision then
      raise exception using errcode = '22023', message = 'REVIEW_REQUEST_ID_CONFLICT';
    end if;
    return jsonb_build_object(
      'review_id', v_existing.id,
      'signal_id', v_existing.signal_id,
      'decision', v_existing.decision,
      'replayed', true
    );
  end if;

  select * into v_signal
  from public.signals
  where id = p_signal_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'SIGNAL_NOT_FOUND';
  end if;
  if not private.is_workspace_member(v_signal.workspace_id, array['owner', 'admin', 'member']) then
    raise exception using errcode = '42501', message = 'SIGNAL_REVIEW_NOT_AUTHORIZED';
  end if;
  if v_signal.status = 'superseded' then
    raise exception using errcode = '22023', message = 'SUPERSEDED_SIGNAL_CANNOT_BE_REVIEWED';
  end if;

  select
    count(distinct link.evidence_id),
    count(distinct evidence.source_id),
    count(distinct link.evidence_id) filter (
      where evidence.id is null
         or evidence.verification_status <> 'verified'
         or source.id is null
         or source.evidence_status <> 'accepted'
         or source.deleted_at is not null
         or run.workspace_domain_id <> v_signal.workspace_domain_id
    )
  into v_evidence_count, v_source_count, v_invalid_evidence_count
  from public.signal_evidence link
  left join public.evidence evidence
    on evidence.id = link.evidence_id
   and evidence.workspace_id = link.workspace_id
  left join public.sources source
    on source.id = evidence.source_id
   and source.workspace_id = evidence.workspace_id
  left join public.research_runs run
    on run.id = evidence.research_run_id
   and run.workspace_id = evidence.workspace_id
  where link.signal_id = v_signal.id
    and link.workspace_id = v_signal.workspace_id;

  if v_decision = 'accepted' and v_evidence_count = 0 then
    raise exception using errcode = '22023', message = 'SIGNAL_REQUIRES_LINKED_EVIDENCE';
  end if;
  if v_decision = 'accepted' and v_invalid_evidence_count > 0 then
    raise exception using errcode = '22023', message = 'SIGNAL_REQUIRES_CURRENT_VERIFIED_EVIDENCE';
  end if;

  insert into public.signal_reviews (
    workspace_id, signal_id, reviewer_id, decision, previous_status, reason, request_id
  ) values (
    v_signal.workspace_id, v_signal.id, v_actor_id, v_decision,
    v_signal.status, v_reason, p_request_id
  ) returning * into v_review;

  update public.signals
  set status = v_decision,
      metadata = metadata || jsonb_build_object(
        'reviewed_at', now(),
        'reviewed_by', v_actor_id,
        'review_decision', v_decision,
        'evidence_count_at_review', v_evidence_count,
        'source_count_at_review', v_source_count
      ),
      updated_at = now()
  where id = v_signal.id;

  insert into public.audit_log (
    workspace_id, actor_type, actor_id, action, target_type, target_id, request_id, metadata
  ) values (
    v_signal.workspace_id, 'user', v_actor_id, 'signal.reviewed', 'signal',
    v_signal.id, p_request_id, jsonb_build_object(
      'previous_status', v_signal.status,
      'decision', v_decision,
      'reason', v_reason,
      'evidence_count', v_evidence_count,
      'source_count', v_source_count,
      'corroboration_status', case when v_source_count >= 2 then 'multi_source' else 'single_source' end
    )
  );

  return jsonb_build_object(
    'review_id', v_review.id,
    'signal_id', v_signal.id,
    'previous_status', v_signal.status,
    'decision', v_decision,
    'evidence_count', v_evidence_count,
    'source_count', v_source_count,
    'corroboration_status', case when v_source_count >= 2 then 'multi_source' else 'single_source' end,
    'replayed', false
  );
end;
$$;

create or replace view public.v_signal_review_queue
with (security_invoker = true)
as
select
  signal.id as signal_id,
  signal.workspace_id,
  signal.workspace_domain_id,
  domain.key as domain_key,
  coalesce(workspace_domain.name, domain.name) as domain_name,
  signal.signal_type,
  signal.title,
  signal.summary,
  signal.event_at,
  signal.confidence,
  signal.novelty_score,
  signal.importance_score,
  signal.status,
  signal.metadata ->> 'corroboration_status' as corroboration_status,
  coalesce(evidence_stats.evidence_count, 0) as evidence_count,
  coalesce(evidence_stats.independent_source_count, 0) as independent_source_count,
  coalesce(evidence_stats.invalid_evidence_count, 0) as invalid_evidence_count,
  coalesce(evidence_stats.all_evidence_verified, false) as all_evidence_verified,
  coalesce(review_stats.review_count, 0) as review_count,
  review_stats.last_reviewed_at,
  signal.created_at,
  signal.updated_at
from public.signals signal
join public.workspace_domains workspace_domain
  on workspace_domain.id = signal.workspace_domain_id
 and workspace_domain.workspace_id = signal.workspace_id
join public.domains domain on domain.id = workspace_domain.domain_id
left join lateral (
  select
    count(distinct link.evidence_id) as evidence_count,
    count(distinct evidence.source_id) as independent_source_count,
    count(distinct link.evidence_id) filter (
      where evidence.id is null
         or evidence.verification_status <> 'verified'
         or source.id is null
         or source.evidence_status <> 'accepted'
         or source.deleted_at is not null
         or run.workspace_domain_id <> signal.workspace_domain_id
    ) as invalid_evidence_count,
    count(distinct link.evidence_id) > 0
      and count(distinct link.evidence_id) filter (
        where evidence.id is null
           or evidence.verification_status <> 'verified'
           or source.id is null
           or source.evidence_status <> 'accepted'
           or source.deleted_at is not null
           or run.workspace_domain_id <> signal.workspace_domain_id
      ) = 0 as all_evidence_verified
  from public.signal_evidence link
  left join public.evidence evidence
    on evidence.id = link.evidence_id
   and evidence.workspace_id = link.workspace_id
  left join public.sources source
    on source.id = evidence.source_id
   and source.workspace_id = evidence.workspace_id
  left join public.research_runs run
    on run.id = evidence.research_run_id
   and run.workspace_id = evidence.workspace_id
  where link.signal_id = signal.id
    and link.workspace_id = signal.workspace_id
) evidence_stats on true
left join lateral (
  select count(*) as review_count, max(review.created_at) as last_reviewed_at
  from public.signal_reviews review
  where review.signal_id = signal.id
    and review.workspace_id = signal.workspace_id
) review_stats on true
where signal.status = 'draft';

create or replace view public.v_observation_eligible_signals
with (security_invoker = true)
as
select
  signal.id as signal_id,
  signal.workspace_id,
  signal.workspace_domain_id,
  signal.signal_type,
  signal.title,
  signal.summary,
  signal.event_at,
  signal.confidence,
  signal.novelty_score,
  signal.importance_score,
  signal.geographies,
  signal.topics,
  signal.metadata,
  evidence_stats.evidence_count,
  evidence_stats.independent_source_count,
  signal.created_at,
  signal.updated_at
from public.signals signal
join lateral (
  select
    count(distinct link.evidence_id) as evidence_count,
    count(distinct evidence.source_id) as independent_source_count,
    count(distinct link.evidence_id) filter (
      where evidence.id is null
         or evidence.verification_status <> 'verified'
         or source.id is null
         or source.evidence_status <> 'accepted'
         or source.deleted_at is not null
         or run.workspace_domain_id <> signal.workspace_domain_id
    ) as invalid_evidence_count
  from public.signal_evidence link
  left join public.evidence evidence
    on evidence.id = link.evidence_id
   and evidence.workspace_id = link.workspace_id
  left join public.sources source
    on source.id = evidence.source_id
   and source.workspace_id = evidence.workspace_id
  left join public.research_runs run
    on run.id = evidence.research_run_id
   and run.workspace_id = evidence.workspace_id
  where link.signal_id = signal.id
    and link.workspace_id = signal.workspace_id
) evidence_stats on true
where signal.status = 'accepted'
  and evidence_stats.evidence_count > 0
  and evidence_stats.invalid_evidence_count = 0;

revoke all on function public.review_intelligence_signal(uuid, text, text, uuid) from public, anon;
grant execute on function public.review_intelligence_signal(uuid, text, text, uuid) to authenticated;
grant select on public.v_signal_review_queue to authenticated;
grant select on public.v_observation_eligible_signals to authenticated;

commit;
