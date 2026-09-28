begin;

-- The only mandatory human decision is signal review. Evidence is admitted by
-- a strict automated grounding policy, and observations are accepted by a
-- deterministic policy after they are synthesized from human-accepted signals.

alter table public.evidence
  add column if not exists verification_method text not null default 'pending',
  add column if not exists verification_score public.score_01,
  add column if not exists verified_at timestamptz,
  add column if not exists verifier_version text;

alter table public.evidence
  drop constraint if exists evidence_verification_method_check;
alter table public.evidence
  add constraint evidence_verification_method_check
  check (verification_method in ('pending', 'automated', 'human', 'legacy'));

update public.evidence evidence
set verification_method = case
      when evidence.verification_status = 'verified' then 'legacy'
      else 'pending'
    end,
    verification_score = case
      when evidence.verification_status = 'verified' then evidence.confidence
      else null
    end,
    verified_at = case
      when evidence.verification_status = 'verified' then coalesce(evidence.updated_at, evidence.created_at)
      else null
    end,
    verifier_version = case
      when evidence.verification_status = 'verified' then evidence.extractor_version
      else null
    end
where evidence.verification_method = 'pending';

alter table public.evidence
  drop constraint if exists evidence_verified_provenance_check;
alter table public.evidence
  add constraint evidence_verified_provenance_check
  check (
    verification_status <> 'verified'
    or (
      verification_method <> 'pending'
      and verification_score is not null
      and verified_at is not null
      and verifier_version is not null
    )
  );

create or replace function private.set_evidence_verification_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.verification_status = 'verified' then
    if new.verification_method = 'pending' then
      if coalesce(new.metadata ->> 'review_mode', '') = 'automatic'
        and coalesce((new.metadata ->> 'exact_excerpt_match')::boolean, false)
        and new.confidence >= 0.55 then
        new.verification_method := 'automated';
      else
        new.verification_method := 'human';
      end if;
    end if;

    if new.verification_method = 'automated'
      and (
        coalesce(new.metadata ->> 'review_mode', '') <> 'automatic'
        or not coalesce((new.metadata ->> 'exact_excerpt_match')::boolean, false)
        or new.confidence < 0.55
      ) then
      raise exception using errcode = '22023', message = 'AUTOMATED_EVIDENCE_REQUIRES_EXACT_GROUNDING';
    end if;

    new.verification_score := coalesce(new.verification_score, new.confidence);
    new.verified_at := coalesce(new.verified_at, now());
    new.verifier_version := coalesce(
      nullif(new.verifier_version, ''),
      nullif(new.metadata ->> 'model', ''),
      new.extractor_version
    );
  elsif new.verification_status = 'unverified' then
    new.verification_method := 'pending';
    new.verification_score := null;
    new.verified_at := null;
    new.verifier_version := null;
  end if;

  return new;
end;
$$;

drop trigger if exists evidence_verification_provenance on public.evidence;
create trigger evidence_verification_provenance
before insert or update of verification_status, verification_method, confidence, metadata
on public.evidence
for each row execute function private.set_evidence_verification_provenance();

alter table public.observations
  add column if not exists acceptance_method text not null default 'pending',
  add column if not exists accepted_at timestamptz;

alter table public.observations
  drop constraint if exists observations_acceptance_method_check;
alter table public.observations
  add constraint observations_acceptance_method_check
  check (acceptance_method in ('pending', 'automated', 'human', 'legacy'));

update public.observations observation
set acceptance_method = case when observation.status = 'accepted' then 'legacy' else 'pending' end,
    accepted_at = case when observation.status = 'accepted' then coalesce(observation.updated_at, observation.created_at) else null end
where observation.acceptance_method = 'pending';

alter table public.observations
  drop constraint if exists observations_accepted_provenance_check;
alter table public.observations
  add constraint observations_accepted_provenance_check
  check (
    status <> 'accepted'
    or (acceptance_method <> 'pending' and accepted_at is not null)
  );

create or replace function private.set_observation_acceptance_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'accepted' then
    if new.acceptance_method = 'pending' then
      new.acceptance_method := 'human';
    end if;
    new.accepted_at := coalesce(new.accepted_at, now());
  elsif new.status = 'draft' then
    new.acceptance_method := 'pending';
    new.accepted_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists observation_acceptance_provenance on public.observations;
create trigger observation_acceptance_provenance
before insert or update of status, acceptance_method
on public.observations
for each row execute function private.set_observation_acceptance_provenance();

create or replace function public.n8n_accept_verified_observation(
  p_observation_id uuid,
  p_is_new boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_observation public.observations%rowtype;
  v_signal_count integer := 0;
  v_source_count integer := 0;
  v_invalid_signal_count integer := 0;
begin
  select * into v_observation
  from public.observations
  where id = p_observation_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'OBSERVATION_NOT_FOUND';
  end if;

  if v_observation.status = 'accepted' then
    return jsonb_build_object(
      'observation_id', v_observation.id,
      'status', v_observation.status,
      'is_new', p_is_new,
      'signal_count', coalesce((v_observation.metadata ->> 'signal_count')::integer, 0),
      'source_count', coalesce((v_observation.metadata ->> 'source_count')::integer, 0),
      'confidence', v_observation.confidence,
      'corroboration_status', 'multi_source',
      'replayed', true
    );
  end if;

  if v_observation.status <> 'draft' then
    raise exception using errcode = '22023', message = 'ONLY_DRAFT_OBSERVATIONS_CAN_BE_AUTO_ACCEPTED';
  end if;

  if coalesce(v_observation.metadata ->> 'generation_mode', '') <> 'accepted_signals_only' then
    raise exception using errcode = '22023', message = 'OBSERVATION_AUTOMATION_POLICY_MISSING';
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

  if v_signal_count < 2 then
    raise exception using errcode = '22023', message = 'OBSERVATION_REQUIRES_TWO_ACCEPTED_SIGNALS';
  end if;
  if v_source_count < 2 then
    raise exception using errcode = '22023', message = 'OBSERVATION_REQUIRES_TWO_CURRENT_SOURCES';
  end if;
  if v_invalid_signal_count > 0 then
    raise exception using errcode = '22023', message = 'OBSERVATION_REQUIRES_CURRENT_ACCEPTED_SIGNALS';
  end if;

  update public.observations
  set status = 'accepted',
      acceptance_method = 'automated',
      accepted_at = now(),
      metadata = metadata || jsonb_build_object(
        'acceptance_method', 'automated_policy',
        'accepted_at', now(),
        'signal_count_at_acceptance', v_signal_count,
        'source_count_at_acceptance', v_source_count,
        'human_gate', 'signal_review'
      ),
      updated_at = now()
  where id = v_observation.id
  returning * into v_observation;

  insert into public.audit_log (
    workspace_id, actor_type, action, target_type, target_id, request_id, metadata
  ) values (
    v_observation.workspace_id, 'system', 'observation.auto_accepted', 'observation',
    v_observation.id, gen_random_uuid(), jsonb_build_object(
      'signal_count', v_signal_count,
      'source_count', v_source_count,
      'policy', 'single-human-gate-v1'
    )
  );

  return jsonb_build_object(
    'observation_id', v_observation.id,
    'status', v_observation.status,
    'is_new', p_is_new,
    'signal_count', v_signal_count,
    'source_count', v_source_count,
    'confidence', v_observation.confidence,
    'corroboration_status', 'multi_source',
    'replayed', false
  );
end;
$$;

-- Guarded operational reset. It preserves identity, workspace membership,
-- domains, workspace-domain configuration, and scheduler configuration.
create or replace function private.reset_workspace_generated_data(
  p_workspace_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  if p_confirmation <> 'RESET_GENERATED_DATA:' || p_workspace_id::text then
    raise exception using errcode = '22023', message = 'RESET_CONFIRMATION_MISMATCH';
  end if;

  if not exists (select 1 from public.workspaces where id = p_workspace_id) then
    raise exception using errcode = '22023', message = 'WORKSPACE_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace-reset:' || p_workspace_id::text, 0));

  select jsonb_build_object(
    'research_runs', (select count(*) from public.research_runs where workspace_id = p_workspace_id),
    'sources', (select count(*) from public.sources where workspace_id = p_workspace_id),
    'evidence', (select count(*) from public.evidence where workspace_id = p_workspace_id),
    'entities', (select count(*) from public.entities where workspace_id = p_workspace_id),
    'signals', (select count(*) from public.signals where workspace_id = p_workspace_id),
    'observations', (select count(*) from public.observations where workspace_id = p_workspace_id),
    'patterns', (select count(*) from public.patterns where workspace_id = p_workspace_id),
    'hypotheses', (select count(*) from public.hypotheses where workspace_id = p_workspace_id),
    'insights', (select count(*) from public.insights where workspace_id = p_workspace_id)
  ) into v_before;

  delete from public.saved_items where workspace_id = p_workspace_id;
  delete from public.daily_briefs where workspace_id = p_workspace_id;
  delete from public.insights where workspace_id = p_workspace_id;
  delete from public.llm_usage where workspace_id = p_workspace_id;
  delete from public.validation_evidence where workspace_id = p_workspace_id;
  delete from public.validation_runs where workspace_id = p_workspace_id;
  delete from public.hypothesis_patterns where workspace_id = p_workspace_id;
  delete from public.hypotheses where workspace_id = p_workspace_id;
  delete from public.pattern_observations where workspace_id = p_workspace_id;
  delete from public.patterns where workspace_id = p_workspace_id;
  delete from public.observation_reviews where workspace_id = p_workspace_id;
  delete from public.observation_signals where workspace_id = p_workspace_id;
  delete from public.observations where workspace_id = p_workspace_id;
  delete from public.signal_reviews where workspace_id = p_workspace_id;
  delete from public.signal_entities where workspace_id = p_workspace_id;
  delete from public.signal_evidence where workspace_id = p_workspace_id;
  delete from public.signals where workspace_id = p_workspace_id;
  delete from public.thesis_evidence where workspace_id = p_workspace_id;
  delete from public.theses where workspace_id = p_workspace_id;
  delete from public.relationship_evidence where workspace_id = p_workspace_id;
  delete from public.relationships where workspace_id = p_workspace_id;
  delete from public.evidence_reviews where workspace_id = p_workspace_id;
  delete from public.evidence_entities where workspace_id = p_workspace_id;
  delete from public.entity_aliases where workspace_id = p_workspace_id;
  delete from public.entities where workspace_id = p_workspace_id;
  delete from public.evidence where workspace_id = p_workspace_id;
  delete from public.research_run_sources where workspace_id = p_workspace_id;
  delete from public.sources where workspace_id = p_workspace_id;
  delete from public.job_runs where workspace_id = p_workspace_id;
  delete from public.audit_log where workspace_id = p_workspace_id;
  delete from public.research_runs where workspace_id = p_workspace_id;

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'deleted', v_before,
    'preserved', jsonb_build_array(
      'profiles', 'workspaces', 'workspace_members', 'domains',
      'workspace_domains', 'domain_collection_schedules'
    )
  );
end;
$$;

revoke all on function public.n8n_accept_verified_observation(uuid, boolean) from public, anon, authenticated;
grant execute on function public.n8n_accept_verified_observation(uuid, boolean) to service_role;

revoke all on function private.reset_workspace_generated_data(uuid, text) from public, anon, authenticated;
grant execute on function private.reset_workspace_generated_data(uuid, text) to service_role;

commit;
