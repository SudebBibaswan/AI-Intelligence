begin;

-- RE09: Verified Pattern Engine
-- Identifies repeated, bounded relationships across accepted observations.
-- Must cite: >=3 accepted observations, >=3 independent source families, >=2 distinct events/entities,
-- and recurrence across time or repetition across independent entities.
-- Full lineage: pattern -> observations -> signals -> evidence -> sources
-- No human gate. Status transitions are deterministic.

create or replace function public.n8n_list_pattern_observation_candidates(
  p_workspace_id uuid,
  p_domain_limit integer default 3,
  p_observations_per_domain integer default 12
)
returns table (
  observation_id uuid,
  workspace_id uuid,
  workspace_domain_id uuid,
  domain_key text,
  domain_name text,
  observation_type text,
  title text,
  statement text,
  time_window_start date,
  time_window_end date,
  confidence numeric,
  signal_count bigint,
  source_count bigint,
  source_ids jsonb,
  accepted_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with eligible as (
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
      coalesce((observation.metadata ->> 'signal_count')::bigint, 0) as signal_count,
      coalesce((observation.metadata ->> 'source_count')::bigint, 0) as source_count,
      coalesce(observation.metadata -> 'source_ids', '[]'::jsonb) as source_ids,
      observation.accepted_at
    from public.observations observation
    join public.workspace_domains workspace_domain
      on workspace_domain.id = observation.workspace_domain_id
     and workspace_domain.workspace_id = observation.workspace_id
    join public.domains domain on domain.id = workspace_domain.domain_id
    where observation.workspace_id = p_workspace_id
      and observation.status = 'accepted'
      and observation.acceptance_method = 'automated'
      and workspace_domain.status <> 'archived'
      and coalesce((observation.metadata ->> 'signal_count')::bigint, 0) >= 2
      and coalesce((observation.metadata ->> 'source_count')::bigint, 0) >= 2
  ),
  ranked_domains as (
    select workspace_domain_id,
      row_number() over (order by count(*) desc, workspace_domain_id) as domain_rank
    from eligible
    group by workspace_domain_id
    having count(*) >= 3
  ),
  bounded as (
    select eligible.*,
      row_number() over (
        partition by eligible.workspace_domain_id
        order by eligible.accepted_at desc, eligible.observation_id
      ) as observation_rank
    from eligible
    join ranked_domains using (workspace_domain_id)
    where ranked_domains.domain_rank <= greatest(1, least(coalesce(p_domain_limit, 3), 7))
  )
  select
    bounded.observation_id,
    bounded.workspace_id,
    bounded.workspace_domain_id,
    bounded.domain_key,
    bounded.domain_name,
    bounded.observation_type,
    bounded.title,
    bounded.statement,
    bounded.time_window_start,
    bounded.time_window_end,
    bounded.confidence,
    bounded.signal_count,
    bounded.source_count,
    bounded.source_ids,
    bounded.accepted_at
  from bounded
  where bounded.observation_rank <= greatest(3, least(coalesce(p_observations_per_domain, 12), 20))
  order by bounded.workspace_domain_id, bounded.observation_rank;
$$;

create unique index if not exists patterns_workspace_dedupe_uidx
  on public.patterns (workspace_id, workspace_domain_id, ((metadata ->> 'dedupe_key')))
  where metadata ? 'dedupe_key' and status <> 'archived';

create index if not exists patterns_domain_status_updated_idx
  on public.patterns (workspace_domain_id, status, updated_at desc);

create or replace function public.n8n_upsert_verified_pattern(p_pattern jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (p_pattern ->> 'workspace_id')::uuid;
  v_workspace_domain_id uuid := (p_pattern ->> 'workspace_domain_id')::uuid;
  v_pattern_type text := lower(btrim(p_pattern ->> 'pattern_type'));
  v_title text := btrim(p_pattern ->> 'title');
  v_statement text := btrim(p_pattern ->> 'statement');
  v_time_window_start date;
  v_time_window_end date;
  v_first_detected_at timestamptz;
  v_last_confirmed_at timestamptz;
  v_observation_ids uuid[];
  v_contradiction_ids uuid[];
  v_requested_count integer;
  v_eligible_count integer;
  v_source_family_count integer;
  v_event_entity_count integer;
  v_strength_score numeric := least(1, greatest(0, coalesce((p_pattern ->> 'strength_score')::numeric, 0)));
  v_persistence_score numeric := least(1, greatest(0, coalesce((p_pattern ->> 'persistence_score')::numeric, 0)));
  v_diversity_score numeric := least(1, greatest(0, coalesce((p_pattern ->> 'diversity_score')::numeric, 0)));
  v_model_confidence numeric := least(1, greatest(0, coalesce((p_pattern ->> 'confidence')::numeric, 0)));
  v_final_confidence numeric;
  v_dedupe_key text;
  v_pattern public.patterns%rowtype;
  v_reference jsonb;
  v_is_new boolean := false;
  v_status text := 'emerging';
  v_engine_version text := coalesce(nullif(p_pattern ->> 'engine_version', ''), 'pattern-engine-v1.0.0');
begin
  if v_pattern_type not in (
      'capital_flow', 'market_activity', 'technology_adoption', 'research_development',
      'regulatory_shift', 'competitive_movement', 'operational_change', 'talent_flow',
      'product_evolution', 'investment_thesis', 'other'
    )
    or length(v_title) not between 1 and 240
    or length(v_statement) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'INVALID_PATTERN_PAYLOAD';
  end if;

  if jsonb_typeof(coalesce(p_pattern -> 'observations', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_pattern -> 'observations', '[]'::jsonb)) not between 3 and 12 then
    raise exception using errcode = '22023', message = 'PATTERN_REQUIRES_THREE_TO_TWELVE_OBSERVATIONS';
  end if;

  if not exists (
    select 1 from public.workspace_domains workspace_domain
    where workspace_domain.id = v_workspace_domain_id
      and workspace_domain.workspace_id = v_workspace_id
      and workspace_domain.status <> 'archived'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_PATTERN_WORKSPACE_DOMAIN';
  end if;

  begin
    if nullif(btrim(p_pattern ->> 'time_window_start'), '') is not null then
      v_time_window_start := (p_pattern ->> 'time_window_start')::date;
    end if;
    if nullif(btrim(p_pattern ->> 'time_window_end'), '') is not null then
      v_time_window_end := (p_pattern ->> 'time_window_end')::date;
    end if;
  exception when others then
    raise exception using errcode = '22023', message = 'INVALID_PATTERN_TIME_WINDOW';
  end;
  if v_time_window_start is not null and v_time_window_end is not null
    and v_time_window_end < v_time_window_start then
    raise exception using errcode = '22023', message = 'INVALID_PATTERN_TIME_WINDOW';
  end if;

  if nullif(btrim(p_pattern ->> 'first_detected_at'), '') is not null then
    v_first_detected_at := (p_pattern ->> 'first_detected_at')::timestamptz;
  else
    v_first_detected_at := now();
  end if;

  if nullif(btrim(p_pattern ->> 'last_confirmed_at'), '') is not null then
    v_last_confirmed_at := (p_pattern ->> 'last_confirmed_at')::timestamptz;
  else
    v_last_confirmed_at := now();
  end if;

  if v_last_confirmed_at < v_first_detected_at then
    raise exception using errcode = '22023', message = 'INVALID_PATTERN_TIMESTAMP_ORDER';
  end if;

  select array_agg(distinct (reference ->> 'observation_id')::uuid), count(*)
  into v_observation_ids, v_requested_count
  from jsonb_array_elements(p_pattern -> 'observations') reference
  where (reference ->> 'role')::text in ('supporting', 'contradicting', 'context')
     or reference ->> 'role' is null;

  if cardinality(v_observation_ids) <> v_requested_count then
    raise exception using errcode = '22023', message = 'DUPLICATE_PATTERN_OBSERVATION';
  end if;

  select array_agg(distinct (reference ->> 'observation_id')::uuid)
  into v_contradiction_ids
  from jsonb_array_elements(p_pattern -> 'observations') reference
  where (reference ->> 'role')::text = 'contradicting';

  with checked_observations as (
    select
      observation.id,
      observation.confidence,
      coalesce((observation.metadata ->> 'signal_count')::bigint, 0) as signal_count,
      coalesce((observation.metadata ->> 'source_count')::bigint, 0) as source_count,
      coalesce(observation.metadata -> 'source_ids', '[]'::jsonb) as source_ids,
      observation.accepted_at,
      count(distinct observation_link.signal_id) filter (
        where signal.id is null
           or signal.status <> 'accepted'
           or signal.workspace_domain_id <> v_workspace_domain_id
           or evidence.id is null
           or evidence.verification_status <> 'verified'
           or source.id is null
           or source.evidence_status <> 'accepted'
           or source.deleted_at is not null
           or run.workspace_domain_id <> v_workspace_domain_id
      ) as invalid_signal_count
    from public.observations observation
    left join public.observation_signals observation_link
      on observation_link.observation_id = observation.id
     and observation_link.workspace_id = observation.workspace_id
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
    where observation.id = any(v_observation_ids)
      and observation.workspace_id = v_workspace_id
      and observation.workspace_domain_id = v_workspace_domain_id
      and observation.status = 'accepted'
      and observation.acceptance_method = 'automated'
    group by observation.id, observation.confidence, observation.metadata, observation.accepted_at
  ), eligible_observations as (
    select * from checked_observations
    where invalid_signal_count = 0
  )
  select count(*)
  into v_eligible_count
  from eligible_observations;

  if v_eligible_count <> v_requested_count then
    raise exception using errcode = '22023', message = 'PATTERN_REQUIRES_ACCEPTED_AUTOMATED_OBSERVATIONS';
  end if;

  select count(distinct source_id)
  into v_source_family_count
  from eligible_observations,
  lateral jsonb_array_elements_text(source_ids) as src(source_id);

  if v_source_family_count < 3 then
    raise exception using errcode = '22023', message = 'PATTERN_REQUIRES_THREE_INDEPENDENT_SOURCE_FAMILIES';
  end if;

  select count(distinct signal_id)
  into v_event_entity_count
  from public.observation_signals os
  join public.signals s on s.id = os.signal_id and s.workspace_id = os.workspace_id
  where os.observation_id = any(v_observation_ids)
    and os.workspace_id = v_workspace_id
    and s.status = 'accepted';

  if v_event_entity_count < 2 then
    raise exception using errcode = '22023', message = 'PATTERN_REQUIRES_TWO_DISTINCT_EVENTS_OR_ENTITIES';
  end if;

  v_final_confidence := least(v_model_confidence,
    coalesce((select avg(confidence) from eligible_observations), 0));

  v_dedupe_key := md5(concat_ws('|', v_workspace_domain_id::text, v_pattern_type,
    lower(regexp_replace(v_title, '[^a-z0-9]+', ' ', 'gi')),
    coalesce(v_time_window_start::text, 'open'), coalesce(v_time_window_end::text, 'open')));

  perform pg_advisory_xact_lock(hashtextextended(v_workspace_id::text || ':' || v_dedupe_key, 0));

  select * into v_pattern
  from public.patterns pattern
  where pattern.workspace_id = v_workspace_id
    and pattern.workspace_domain_id = v_workspace_domain_id
    and pattern.metadata ->> 'dedupe_key' = v_dedupe_key
    and pattern.status <> 'archived'
  order by pattern.created_at
  limit 1;

  if found then
    if v_pattern.status in ('emerging', 'persistent') then
      if v_contradiction_ids is not null and cardinality(v_contradiction_ids) > 0 then
        v_status := 'contradicted';
      elsif v_pattern.status = 'emerging'
        and v_persistence_score >= 0.7
        and v_strength_score >= 0.7
        and v_diversity_score >= 0.7
        and v_final_confidence >= 0.7 then
        v_status := 'persistent';
      else
        v_status := v_pattern.status;
      end if;

      update public.patterns
      set statement = v_statement,
          strength_score = greatest(strength_score, v_strength_score),
          persistence_score = greatest(persistence_score, v_persistence_score),
          evidence_diversity_score = greatest(evidence_diversity_score, v_diversity_score),
          time_window_start = coalesce(v_time_window_start, time_window_start),
          time_window_end = coalesce(v_time_window_end, time_window_end),
          last_confirmed_at = greatest(last_confirmed_at, v_last_confirmed_at),
          confidence = greatest(confidence, v_final_confidence),
          status = v_status,
          metadata = metadata || jsonb_build_object(
            'observation_count', v_requested_count,
            'source_family_count', v_source_family_count,
            'event_entity_count', v_event_entity_count,
            'last_recomputed_at', now(),
            'has_contradictions', cardinality(v_contradiction_ids) > 0
          ),
          engine_version = v_engine_version,
          updated_at = now()
      where id = v_pattern.id
      returning * into v_pattern;
    end if;
  else
    v_status := 'emerging';
    insert into public.patterns (
      workspace_id, workspace_domain_id, pattern_type, title, statement,
      strength_score, persistence_score, evidence_diversity_score,
      time_window_start, time_window_end,
      first_detected_at, last_confirmed_at,
      metadata, engine_version, status, confidence
    ) values (
      v_workspace_id, v_workspace_domain_id, v_pattern_type, v_title, v_statement,
      v_strength_score, v_persistence_score, v_diversity_score,
      v_time_window_start, v_time_window_end,
      v_first_detected_at, v_last_confirmed_at,
      coalesce(p_pattern -> 'metadata', '{}'::jsonb) || jsonb_build_object(
        'dedupe_key', v_dedupe_key,
        'observation_count', v_requested_count,
        'source_family_count', v_source_family_count,
        'event_entity_count', v_event_entity_count,
        'has_contradictions', cardinality(v_contradiction_ids) > 0
      ),
      v_engine_version, v_status, v_final_confidence
    ) returning * into v_pattern;
    v_is_new := true;
  end if;

  if v_pattern.status in ('emerging', 'persistent', 'contradicted') then
    for v_reference in select value from jsonb_array_elements(p_pattern -> 'observations') loop
      insert into public.pattern_observations (workspace_id, pattern_id, observation_id, role, weight)
      values (
        v_workspace_id,
        v_pattern.id,
        (v_reference ->> 'observation_id')::uuid,
        case when (v_reference ->> 'role')::text in ('supporting', 'contradicting', 'context')
          then (v_reference ->> 'role')::text else 'supporting' end,
        least(1, greatest(0, coalesce((v_reference ->> 'weight')::numeric, 0.7)))
      ) on conflict (pattern_id, observation_id, role) do update
        set weight = greatest(public.pattern_observations.weight, excluded.weight);
    end loop;
  end if;

  return jsonb_build_object(
    'pattern_id', v_pattern.id,
    'status', v_pattern.status,
    'is_new', v_is_new,
    'observation_count', v_requested_count,
    'source_family_count', v_source_family_count,
    'event_entity_count', v_event_entity_count,
    'strength_score', v_pattern.strength_score,
    'persistence_score', v_pattern.persistence_score,
    'diversity_score', v_pattern.evidence_diversity_score,
    'confidence', v_pattern.confidence,
    'promoted', (v_pattern.status = 'persistent' and not v_is_new)
  );
end;
$$;

create or replace function public.n8n_revalidate_verified_patterns(
  p_workspace_id uuid,
  p_workspace_domain_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pattern public.patterns%rowtype;
  v_supporting_count integer;
  v_contradicting_count integer;
  v_current_confidence numeric;
  v_new_status text;
  v_updated integer := 0;
  v_promoted integer := 0;
  v_contradicted integer := 0;
  v_unchanged integer := 0;
begin
  for v_pattern in
    select * from public.patterns
    where workspace_id = p_workspace_id
      and (p_workspace_domain_id is null or workspace_domain_id = p_workspace_domain_id)
      and status in ('emerging', 'persistent')
      and status <> 'archived'
  loop
    select count(*) filter (where role = 'supporting'),
           count(*) filter (where role = 'contradicting')
    into v_supporting_count, v_contradicting_count
    from public.pattern_observations
    where pattern_id = v_pattern.id
      and workspace_id = v_pattern.workspace_id;

    if v_contradicting_count > 0 and v_pattern.status <> 'contradicted' then
      update public.patterns
      set status = 'contradicted',
          metadata = metadata || jsonb_build_object(
            'contradiction_detected_at', now(),
            'contradiction_count', v_contradicting_count
          ),
          updated_at = now()
      where id = v_pattern.id;
      v_contradicted := v_contradicted + 1;
      v_updated := v_updated + 1;
      continue;
    end if;

    if v_pattern.status = 'emerging'
      and v_pattern.persistence_score >= 0.7
      and v_pattern.strength_score >= 0.7
      and v_pattern.evidence_diversity_score >= 0.7
      and v_pattern.confidence >= 0.7
      and v_supporting_count >= 3 then
      update public.patterns
      set status = 'persistent',
          metadata = metadata || jsonb_build_object(
            'promoted_at', now(),
            'promoted_from', 'emerging'
          ),
          updated_at = now()
      where id = v_pattern.id;
      v_promoted := v_promoted + 1;
      v_updated := v_updated + 1;
    else
      v_unchanged := v_unchanged + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'updated', v_updated,
    'promoted_to_persistent', v_promoted,
    'marked_contradicted', v_contradicted,
    'unchanged', v_unchanged
  );
end;
$$;

revoke all on function public.n8n_list_pattern_observation_candidates(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.n8n_upsert_verified_pattern(jsonb) from public, anon, authenticated;
revoke all on function public.n8n_revalidate_verified_patterns(uuid, uuid) from public, anon, authenticated;
grant execute on function public.n8n_list_pattern_observation_candidates(uuid, integer, integer) to service_role;
grant execute on function public.n8n_upsert_verified_pattern(jsonb) to service_role;
grant execute on function public.n8n_revalidate_verified_patterns(uuid, uuid) to service_role;

commit;