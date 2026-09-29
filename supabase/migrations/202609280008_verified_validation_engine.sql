begin;

-- RE11: Adversarial Validation Engine
-- Uses shared Research Engine for targeted research across 9 dimensions.
-- Preserves supporting/contradicting/neutral evidence; PostgreSQL determines result.
-- Partial failures can never produce false support.

-- Compatibility bridge: some environments applied the original RE10 migration
-- before these structured hypothesis fields were added to its local definition.
-- Keep this in the first still-pending migration so existing databases and clean
-- rebuilds converge without rewriting Supabase migration history.
alter table public.hypotheses
  add column if not exists falsifiers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(falsifiers) = 'array'),
  add column if not exists validation_questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(validation_questions) = 'array');

create or replace function public.n8n_list_validation_hypothesis_candidates(
  p_workspace_id uuid,
  p_domain_limit integer default 3,
  p_hypotheses_per_domain integer default 10
)
returns table (
  hypothesis_id uuid,
  workspace_id uuid,
  workspace_domain_id uuid,
  domain_key text,
  domain_name text,
  title text,
  statement text,
  target_user text,
  problem text,
  proposed_value text,
  assumptions jsonb,
  falsifiers jsonb,
  validation_questions jsonb,
  confidence numeric,
  pattern_ids uuid[],
  pattern_titles text[],
  pattern_types text[],
  engine_version text
)
language sql
security definer
set search_path = ''
as $$
  with eligible as (
    select
      hypothesis.id as hypothesis_id,
      hypothesis.workspace_id,
      hypothesis.workspace_domain_id,
      hypothesis.created_at,
      domain.key as domain_key,
      coalesce(workspace_domain.name, domain.name) as domain_name,
      hypothesis.title,
      hypothesis.statement,
      hypothesis.target_user,
      hypothesis.problem,
      hypothesis.proposed_value,
      hypothesis.assumptions,
      hypothesis.falsifiers,
      hypothesis.validation_questions,
      hypothesis.confidence,
      hypothesis.engine_version,
      array_agg(distinct hp.pattern_id) filter (where hp.pattern_id is not null) as pattern_ids,
      array_agg(distinct p.title) filter (where p.title is not null) as pattern_titles,
      array_agg(distinct p.pattern_type) filter (where p.pattern_type is not null) as pattern_types
    from public.hypotheses hypothesis
    join public.workspace_domains workspace_domain
      on workspace_domain.id = hypothesis.workspace_domain_id
     and workspace_domain.workspace_id = hypothesis.workspace_id
    join public.domains domain on domain.id = workspace_domain.domain_id
    left join public.hypothesis_patterns hp
      on hp.hypothesis_id = hypothesis.id
     and hp.workspace_id = hypothesis.workspace_id
    left join public.patterns p
      on p.id = hp.pattern_id
     and p.workspace_id = hp.workspace_id
    where hypothesis.workspace_id = p_workspace_id
      and hypothesis.status = 'ready_for_validation'
      and hypothesis.deleted_at is null
      and hypothesis.origin = 'engine'
      and workspace_domain.status <> 'archived'
    group by hypothesis.id, hypothesis.workspace_id, hypothesis.workspace_domain_id,
      hypothesis.created_at,
      domain.key, workspace_domain.name, domain.name,
      hypothesis.title, hypothesis.statement, hypothesis.target_user,
      hypothesis.problem, hypothesis.proposed_value, hypothesis.assumptions,
      hypothesis.falsifiers, hypothesis.validation_questions,
      hypothesis.confidence, hypothesis.engine_version
  ),
  ranked_domains as (
    select workspace_domain_id,
      row_number() over (order by count(*) desc, workspace_domain_id) as domain_rank
    from eligible
    group by workspace_domain_id
    having count(*) >= 1
  ),
  bounded as (
    select eligible.*,
      row_number() over (
        partition by eligible.workspace_domain_id
        order by eligible.confidence desc, eligible.created_at desc, eligible.hypothesis_id
      ) as hypothesis_rank
    from eligible
    join ranked_domains using (workspace_domain_id)
    where ranked_domains.domain_rank <= greatest(1, least(coalesce(p_domain_limit, 3), 7))
  )
  select
    bounded.hypothesis_id,
    bounded.workspace_id,
    bounded.workspace_domain_id,
    bounded.domain_key,
    bounded.domain_name,
    bounded.title,
    bounded.statement,
    bounded.target_user,
    bounded.problem,
    bounded.proposed_value,
    bounded.assumptions,
    bounded.falsifiers,
    bounded.validation_questions,
    bounded.confidence,
    bounded.pattern_ids,
    bounded.pattern_titles,
    bounded.pattern_types,
    bounded.engine_version
  from bounded
  where bounded.hypothesis_rank <= greatest(1, least(coalesce(p_hypotheses_per_domain, 10), 15))
  order by bounded.workspace_domain_id, bounded.hypothesis_rank;
$$;

create or replace function public.n8n_upsert_validation_run(p_validation_run jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (p_validation_run ->> 'workspace_id')::uuid;
  v_hypothesis_id uuid := (p_validation_run ->> 'hypothesis_id')::uuid;
  v_research_run_id uuid := case when (p_validation_run ->> 'research_run_id') is not null and nullif(p_validation_run ->> 'research_run_id', '') <> '' then (p_validation_run ->> 'research_run_id')::uuid else null end;
  v_dimensions text[] := coalesce((p_validation_run -> 'dimensions')::text[], '{}');
  v_methodology jsonb := coalesce(p_validation_run -> 'methodology', '{}'::jsonb);
  v_engine_version text := coalesce(nullif(p_validation_run ->> 'engine_version', ''), 'validation-engine-v1.0.0');
  v_idempotency_key text := p_validation_run ->> 'idempotency_key';
  v_validation_run public.validation_runs%rowtype;
  v_is_new boolean := false;
  v_supported_count integer;
  v_contradicting_count integer;
  v_neutral_count integer;
  v_total_weight numeric;
  v_support_weight numeric;
  v_contradict_weight numeric;
  v_result text;
  v_confidence numeric;
begin
  if v_idempotency_key is null or v_idempotency_key = '' then
    raise exception using errcode = '22023', message = 'VALIDATION_RUN_REQUIRES_IDEMPOTENCY_KEY';
  end if;

  if not exists (
    select 1 from public.hypotheses h
    where h.id = v_hypothesis_id
      and h.workspace_id = v_workspace_id
      and h.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'VALIDATION_HYPOTHESIS_NOT_FOUND';
  end if;

  if v_research_run_id is not null and not exists (
    select 1 from public.research_runs rr
    where rr.id = v_research_run_id
      and rr.workspace_id = v_workspace_id
  ) then
    raise exception using errcode = '22023', message = 'VALIDATION_RESEARCH_RUN_NOT_FOUND';
  end if;

  select * into v_validation_run
  from public.validation_runs vr
  where vr.workspace_id = v_workspace_id
    and vr.idempotency_key = v_idempotency_key
  limit 1;

  if found then
    update public.validation_runs
    set status = 'completed',
        methodology = v_methodology,
        dimensions = v_dimensions,
        completed_at = now(),
        updated_at = now()
    where id = v_validation_run.id
    returning * into v_validation_run;
  else
    insert into public.validation_runs (
      workspace_id, hypothesis_id, research_run_id,
      status, dimensions, methodology, engine_version, idempotency_key,
      started_at
    ) values (
      v_workspace_id, v_hypothesis_id, v_research_run_id,
      'completed', v_dimensions, v_methodology, v_engine_version, v_idempotency_key,
      now()
    ) returning * into v_validation_run;
    v_is_new := true;
  end if;

  select
    count(*) filter (where stance = 'supporting'),
    count(*) filter (where stance = 'contradicting'),
    count(*) filter (where stance = 'neutral'),
    sum(weight),
    sum(weight) filter (where stance = 'supporting'),
    sum(weight) filter (where stance = 'contradicting')
  into v_supported_count, v_contradicting_count, v_neutral_count, v_total_weight, v_support_weight, v_contradict_weight
  from public.validation_evidence
  where validation_run_id = v_validation_run.id
    and workspace_id = v_workspace_id;

  if v_total_weight is null or v_total_weight = 0 then
    v_result := 'inconclusive';
    v_confidence := 0;
  else
    if v_support_weight / v_total_weight >= 0.6 and v_contradicting_count = 0 then
      v_result := 'supported';
      v_confidence := least(1, v_support_weight / v_total_weight);
    elsif v_contradict_weight / v_total_weight >= 0.6 and v_supported_count = 0 then
      v_result := 'weakened';
      v_confidence := least(1, v_contradict_weight / v_total_weight);
    elsif v_contradicting_count > 0 and v_supported_count > 0 then
      v_result := 'mixed';
      v_confidence := least(1, greatest(v_support_weight, v_contradict_weight) / v_total_weight);
    else
      v_result := 'inconclusive';
      v_confidence := 0.5;
    end if;
  end if;

  update public.validation_runs
  set result = v_result,
      confidence = v_confidence,
      completed_at = now(),
      updated_at = now()
  where id = v_validation_run.id
  returning * into v_validation_run;

  update public.hypotheses
  set status = v_result,
      confidence = v_confidence,
      updated_at = now()
  where id = v_hypothesis_id
    and workspace_id = v_workspace_id;

  return jsonb_build_object(
    'validation_run_id', v_validation_run.id,
    'result', v_result,
    'confidence', v_confidence,
    'dimensions_researched', array_length(v_dimensions, 1),
    'evidence_supported', v_supported_count,
    'evidence_contradicting', v_contradicting_count,
    'evidence_neutral', v_neutral_count
  );
end;
$$;

create or replace function public.n8n_upsert_validation_evidence(p_evidence jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (p_evidence ->> 'workspace_id')::uuid;
  v_validation_run_id uuid := (p_evidence ->> 'validation_run_id')::uuid;
  v_evidence_id uuid := (p_evidence ->> 'evidence_id')::uuid;
  v_dimension text := p_evidence ->> 'dimension';
  v_stance text := p_evidence ->> 'stance';
  v_weight numeric := least(1, greatest(0, coalesce((p_evidence ->> 'weight')::numeric, 0.5)));
  v_reasoning_summary text := p_evidence ->> 'reasoning_summary';
  v_existing public.validation_evidence%rowtype;
begin
  if v_dimension not in (
    'competitor', 'demand', 'adoption', 'funding', 'technical',
    'regulatory', 'incumbent', 'failed_attempt', 'counter_signal'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_VALIDATION_DIMENSION';
  end if;
  if v_stance not in ('supporting', 'contradicting', 'neutral') then
    raise exception using errcode = '22023', message = 'INVALID_VALIDATION_STANCE';
  end if;
  if v_reasoning_summary is null or length(v_reasoning_summary) < 10 then
    raise exception using errcode = '22023', message = 'VALIDATION_EVIDENCE_REQUIRES_REASONING';
  end if;

  select * into v_existing
  from public.validation_evidence
  where validation_run_id = v_validation_run_id
    and workspace_id = v_workspace_id
    and evidence_id = v_evidence_id
    and dimension = v_dimension
  limit 1;

  if found then
    update public.validation_evidence
    set stance = v_stance,
        weight = greatest(weight, v_weight),
        reasoning_summary = v_reasoning_summary,
        created_at = now()
    where id = v_existing.id
    returning * into v_existing;
  else
    insert into public.validation_evidence (
      workspace_id, validation_run_id, evidence_id, dimension, stance, weight, reasoning_summary
    ) values (
      v_workspace_id, v_validation_run_id, v_evidence_id, v_dimension, v_stance, v_weight, v_reasoning_summary
    ) returning * into v_existing;
  end if;

  return jsonb_build_object(
    'validation_evidence_id', v_existing.id,
    'dimension', v_existing.dimension,
    'stance', v_existing.stance,
    'weight', v_existing.weight
  );
end;
$$;

revoke all on function public.n8n_list_validation_hypothesis_candidates(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.n8n_upsert_validation_run(jsonb) from public, anon, authenticated;
revoke all on function public.n8n_upsert_validation_evidence(jsonb) from public, anon, authenticated;
grant execute on function public.n8n_list_validation_hypothesis_candidates(uuid, integer, integer) to service_role;
grant execute on function public.n8n_upsert_validation_run(jsonb) to service_role;
grant execute on function public.n8n_upsert_validation_evidence(jsonb) to service_role;

commit;
