begin;

-- Observations are bounded descriptive syntheses of accepted signals. They are
-- not trends, patterns, causal claims, hypotheses, or publishable insights.

create or replace function public.n8n_list_observation_signal_candidates(
  p_workspace_id uuid,
  p_domain_limit integer default 3,
  p_signals_per_domain integer default 12
)
returns table (
  signal_id uuid,
  workspace_id uuid,
  workspace_domain_id uuid,
  domain_key text,
  domain_name text,
  signal_type text,
  title text,
  summary text,
  event_at timestamptz,
  confidence numeric,
  novelty_score numeric,
  importance_score numeric,
  geographies text[],
  topics text[],
  evidence_count bigint,
  independent_source_count bigint,
  source_ids jsonb
)
language sql
security definer
set search_path = ''
as $$
  with eligible as (
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
      signal.geographies,
      signal.topics,
      signal.created_at,
      evidence_stats.evidence_count,
      evidence_stats.independent_source_count,
      evidence_stats.source_ids
    from public.signals signal
    join public.workspace_domains workspace_domain
      on workspace_domain.id = signal.workspace_domain_id
     and workspace_domain.workspace_id = signal.workspace_id
    join public.domains domain on domain.id = workspace_domain.domain_id
    join lateral (
      select
        count(distinct link.evidence_id) as evidence_count,
        count(distinct evidence.source_id) as independent_source_count,
        jsonb_agg(distinct evidence.source_id) as source_ids,
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
    where signal.workspace_id = p_workspace_id
      and signal.status = 'accepted'
      and evidence_stats.evidence_count > 0
      and evidence_stats.invalid_evidence_count = 0
      and workspace_domain.status <> 'archived'
  ),
  ranked_domains as (
    select workspace_domain_id,
      row_number() over (order by count(*) desc, workspace_domain_id) as domain_rank
    from eligible
    group by workspace_domain_id
    having count(*) >= 2
  ),
  bounded as (
    select eligible.*,
      row_number() over (
        partition by eligible.workspace_domain_id
        order by eligible.importance_score desc, eligible.confidence desc,
          eligible.created_at desc, eligible.signal_id
      ) as signal_rank
    from eligible
    join ranked_domains using (workspace_domain_id)
    where ranked_domains.domain_rank <= greatest(1, least(coalesce(p_domain_limit, 3), 7))
  )
  select
    bounded.signal_id,
    bounded.workspace_id,
    bounded.workspace_domain_id,
    bounded.domain_key,
    bounded.domain_name,
    bounded.signal_type,
    bounded.title,
    bounded.summary,
    bounded.event_at,
    bounded.confidence,
    bounded.novelty_score,
    bounded.importance_score,
    bounded.geographies,
    bounded.topics,
    bounded.evidence_count,
    bounded.independent_source_count,
    bounded.source_ids
  from bounded
  where bounded.signal_rank <= greatest(2, least(coalesce(p_signals_per_domain, 12), 20))
  order by bounded.workspace_domain_id, bounded.signal_rank;
$$;

create unique index if not exists observations_workspace_dedupe_uidx
  on public.observations (workspace_id, workspace_domain_id, ((metadata ->> 'dedupe_key')))
  where metadata ? 'dedupe_key' and status <> 'rejected';

create or replace function public.n8n_upsert_verified_observation(p_observation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (p_observation ->> 'workspace_id')::uuid;
  v_workspace_domain_id uuid := (p_observation ->> 'workspace_domain_id')::uuid;
  v_observation_type text := lower(btrim(p_observation ->> 'observation_type'));
  v_title text := btrim(p_observation ->> 'title');
  v_statement text := btrim(p_observation ->> 'statement');
  v_time_window_start date;
  v_time_window_end date;
  v_signal_ids uuid[];
  v_requested_count integer;
  v_eligible_count integer;
  v_source_count integer;
  v_signal_confidence numeric;
  v_model_confidence numeric := least(1, greatest(0, coalesce((p_observation ->> 'confidence')::numeric, 0)));
  v_final_confidence numeric;
  v_dedupe_key text;
  v_observation public.observations%rowtype;
  v_reference jsonb;
  v_is_new boolean := false;
begin
  if v_observation_type not in ('capital_flow', 'market_activity', 'technology_adoption',
      'research_development', 'regulatory_shift', 'competitive_movement',
      'operational_change', 'other')
    or length(v_title) not between 1 and 240
    or length(v_statement) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'INVALID_OBSERVATION_PAYLOAD';
  end if;
  if jsonb_typeof(coalesce(p_observation -> 'signals', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_observation -> 'signals', '[]'::jsonb)) not between 2 and 8 then
    raise exception using errcode = '22023', message = 'OBSERVATION_REQUIRES_TWO_TO_EIGHT_SIGNALS';
  end if;
  if not exists (
    select 1 from public.workspace_domains workspace_domain
    where workspace_domain.id = v_workspace_domain_id
      and workspace_domain.workspace_id = v_workspace_id
      and workspace_domain.status <> 'archived'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_OBSERVATION_WORKSPACE_DOMAIN';
  end if;

  begin
    if nullif(btrim(p_observation ->> 'time_window_start'), '') is not null then
      v_time_window_start := (p_observation ->> 'time_window_start')::date;
    end if;
    if nullif(btrim(p_observation ->> 'time_window_end'), '') is not null then
      v_time_window_end := (p_observation ->> 'time_window_end')::date;
    end if;
  exception when others then
    raise exception using errcode = '22023', message = 'INVALID_OBSERVATION_TIME_WINDOW';
  end;
  if v_time_window_start is not null and v_time_window_end is not null
    and v_time_window_end < v_time_window_start then
    raise exception using errcode = '22023', message = 'INVALID_OBSERVATION_TIME_WINDOW';
  end if;

  select array_agg(distinct (reference ->> 'signal_id')::uuid), count(*)
  into v_signal_ids, v_requested_count
  from jsonb_array_elements(p_observation -> 'signals') reference;
  if cardinality(v_signal_ids) <> v_requested_count then
    raise exception using errcode = '22023', message = 'DUPLICATE_OBSERVATION_SIGNAL';
  end if;

  with checked_signals as (
    select
      signal.id,
      signal.confidence,
      count(distinct link.evidence_id) as evidence_count,
      count(distinct evidence.source_id) as source_count,
      count(distinct link.evidence_id) filter (
        where evidence.id is null
           or evidence.verification_status <> 'verified'
           or source.id is null
           or source.evidence_status <> 'accepted'
           or source.deleted_at is not null
           or run.workspace_domain_id <> v_workspace_domain_id
      ) as invalid_evidence_count
    from public.signals signal
    left join public.signal_evidence link
      on link.signal_id = signal.id
     and link.workspace_id = signal.workspace_id
    left join public.evidence evidence
      on evidence.id = link.evidence_id
     and evidence.workspace_id = link.workspace_id
    left join public.sources source
      on source.id = evidence.source_id
     and source.workspace_id = evidence.workspace_id
    left join public.research_runs run
      on run.id = evidence.research_run_id
     and run.workspace_id = evidence.workspace_id
    where signal.id = any(v_signal_ids)
      and signal.workspace_id = v_workspace_id
      and signal.workspace_domain_id = v_workspace_domain_id
      and signal.status = 'accepted'
    group by signal.id, signal.confidence
  ), eligible_signals as (
    select * from checked_signals
    where evidence_count > 0 and invalid_evidence_count = 0
  )
  select count(*), avg(confidence)
  into v_eligible_count, v_signal_confidence
  from eligible_signals;

  select count(distinct evidence.source_id)
  into v_source_count
  from public.signal_evidence link
  join public.evidence evidence
    on evidence.id = link.evidence_id
   and evidence.workspace_id = link.workspace_id
  where link.workspace_id = v_workspace_id
    and link.signal_id = any(v_signal_ids)
    and evidence.verification_status = 'verified';

  if v_eligible_count <> v_requested_count then
    raise exception using errcode = '22023', message = 'OBSERVATION_REQUIRES_ACCEPTED_CURRENT_SIGNALS';
  end if;
  if v_source_count < 2 then
    raise exception using errcode = '22023', message = 'OBSERVATION_REQUIRES_TWO_INDEPENDENT_SOURCES';
  end if;

  v_final_confidence := least(v_model_confidence, coalesce(v_signal_confidence, 0));
  v_dedupe_key := md5(concat_ws('|', v_workspace_domain_id::text, v_observation_type,
    lower(regexp_replace(v_title, '[^a-z0-9]+', ' ', 'gi')),
    coalesce(v_time_window_start::text, 'open'), coalesce(v_time_window_end::text, 'open')));
  perform pg_advisory_xact_lock(hashtextextended(v_workspace_id::text || ':' || v_dedupe_key, 0));

  select * into v_observation
  from public.observations observation
  where observation.workspace_id = v_workspace_id
    and observation.workspace_domain_id = v_workspace_domain_id
    and observation.metadata ->> 'dedupe_key' = v_dedupe_key
    and observation.status <> 'rejected'
  order by observation.created_at
  limit 1;

  if found then
    if v_observation.status = 'draft' then
      update public.observations
      set statement = v_statement,
          confidence = greatest(confidence, v_final_confidence),
          time_window_start = coalesce(v_time_window_start, time_window_start),
          time_window_end = coalesce(v_time_window_end, time_window_end),
          metadata = metadata || jsonb_build_object(
            'signal_count', v_requested_count,
            'source_count', v_source_count,
            'last_recomputed_at', now()
          ),
          updated_at = now()
      where id = v_observation.id
      returning * into v_observation;
    end if;
  else
    insert into public.observations (
      workspace_id, workspace_domain_id, title, statement, observation_type,
      time_window_start, time_window_end, metadata, engine_version, status, confidence
    ) values (
      v_workspace_id, v_workspace_domain_id, v_title, v_statement, v_observation_type,
      v_time_window_start, v_time_window_end,
      coalesce(p_observation -> 'metadata', '{}'::jsonb) || jsonb_build_object(
        'dedupe_key', v_dedupe_key,
        'signal_count', v_requested_count,
        'source_count', v_source_count,
        'corroboration_status', 'multi_source'
      ),
      coalesce(nullif(p_observation ->> 'engine_version', ''), 'observation-engine-v1.0.0'),
      'draft', v_final_confidence
    ) returning * into v_observation;
    v_is_new := true;
  end if;

  if v_observation.status = 'draft' then
    for v_reference in select value from jsonb_array_elements(p_observation -> 'signals') loop
      insert into public.observation_signals (workspace_id, observation_id, signal_id, role, weight)
      values (
        v_workspace_id,
        v_observation.id,
        (v_reference ->> 'signal_id')::uuid,
        case when v_reference ->> 'role' in ('supporting', 'contradicting', 'context')
          then v_reference ->> 'role' else 'supporting' end,
        least(1, greatest(0, coalesce((v_reference ->> 'weight')::numeric, 0.7)))
      ) on conflict (observation_id, signal_id) do update
        set role = excluded.role, weight = greatest(public.observation_signals.weight, excluded.weight);
    end loop;
  end if;

  return jsonb_build_object(
    'observation_id', v_observation.id,
    'status', v_observation.status,
    'is_new', v_is_new,
    'signal_count', v_requested_count,
    'source_count', v_source_count,
    'confidence', v_final_confidence,
    'corroboration_status', 'multi_source'
  );
end;
$$;

create or replace view public.v_observation_engine_health
with (security_invoker = true)
as
select
  observation.workspace_id,
  observation.workspace_domain_id,
  count(*) as observation_count,
  count(*) filter (where observation.status = 'draft') as draft_observations,
  count(*) filter (where observation.status = 'accepted') as accepted_observations,
  round(avg(observation.confidence), 4) as average_confidence,
  round(avg(coalesce((observation.metadata ->> 'signal_count')::numeric, 0)), 2) as average_signal_count,
  round(avg(coalesce((observation.metadata ->> 'source_count')::numeric, 0)), 2) as average_source_count,
  max(observation.updated_at) as last_observation_at
from public.observations observation
where observation.status <> 'rejected'
group by observation.workspace_id, observation.workspace_domain_id;

revoke all on function public.n8n_list_observation_signal_candidates(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.n8n_upsert_verified_observation(jsonb) from public, anon, authenticated;
grant execute on function public.n8n_list_observation_signal_candidates(uuid, integer, integer) to service_role;
grant execute on function public.n8n_upsert_verified_observation(jsonb) to service_role;
grant select on public.v_observation_engine_health to authenticated;

commit;
