begin;

-- RE10: Verified Hypothesis Engine
-- Converts persistent patterns (or capped high-strength emerging) into testable hypotheses.
-- Input eligibility: status = 'persistent' OR (status = 'emerging' AND strength_score >= 0.7)
-- Output: hypotheses with target_user, problem, proposed_value, assumptions, falsifiers,
-- validation_questions, cited pattern IDs, semantic deduplication.
-- No human gate. Status auto-advances to ready_for_validation.

create or replace function public.n8n_list_hypothesis_pattern_candidates(
  p_workspace_id uuid,
  p_domain_limit integer default 3,
  p_patterns_per_domain integer default 10,
  p_min_strength_score numeric default 0.7
)
returns table (
  pattern_id uuid,
  workspace_id uuid,
  workspace_domain_id uuid,
  domain_key text,
  domain_name text,
  pattern_type text,
  title text,
  statement text,
  strength_score numeric,
  persistence_score numeric,
  evidence_diversity_score numeric,
  confidence numeric,
  status text,
  observation_count bigint,
  source_family_count bigint,
  event_entity_count bigint,
  has_contradictions boolean,
  first_detected_at timestamptz,
  last_confirmed_at timestamptz,
  metadata jsonb
)
language sql
security definer
set search_path = ''
as $$
  with eligible as (
    select
      pattern.id as pattern_id,
      pattern.workspace_id,
      pattern.workspace_domain_id,
      domain.key as domain_key,
      coalesce(workspace_domain.name, domain.name) as domain_name,
      pattern.pattern_type,
      pattern.title,
      pattern.statement,
      pattern.strength_score,
      pattern.persistence_score,
      pattern.evidence_diversity_score,
      pattern.confidence,
      pattern.status,
      coalesce((pattern.metadata ->> 'observation_count')::bigint, 0) as observation_count,
      coalesce((pattern.metadata ->> 'source_family_count')::bigint, 0) as source_family_count,
      coalesce((pattern.metadata ->> 'event_entity_count')::bigint, 0) as event_entity_count,
      coalesce((pattern.metadata ->> 'has_contradictions')::boolean, false) as has_contradictions,
      pattern.first_detected_at,
      pattern.last_confirmed_at,
      pattern.metadata
    from public.patterns pattern
    join public.workspace_domains workspace_domain
      on workspace_domain.id = pattern.workspace_domain_id
     and workspace_domain.workspace_id = pattern.workspace_id
    join public.domains domain on domain.id = workspace_domain.domain_id
    where pattern.workspace_id = p_workspace_id
      and pattern.status in ('persistent', 'emerging')
      and (pattern.status = 'persistent' or pattern.strength_score >= p_min_strength_score)
      and workspace_domain.status <> 'archived'
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
        order by
          case when eligible.status = 'persistent' then 0 else 1 end,
          eligible.strength_score desc,
          eligible.persistence_score desc,
          eligible.last_confirmed_at desc,
          eligible.pattern_id
      ) as pattern_rank
    from eligible
    join ranked_domains using (workspace_domain_id)
    where ranked_domains.domain_rank <= greatest(1, least(coalesce(p_domain_limit, 3), 7))
  )
  select
    bounded.pattern_id,
    bounded.workspace_id,
    bounded.workspace_domain_id,
    bounded.domain_key,
    bounded.domain_name,
    bounded.pattern_type,
    bounded.title,
    bounded.statement,
    bounded.strength_score,
    bounded.persistence_score,
    bounded.evidence_diversity_score,
    bounded.confidence,
    bounded.status,
    bounded.observation_count,
    bounded.source_family_count,
    bounded.event_entity_count,
    bounded.has_contradictions,
    bounded.first_detected_at,
    bounded.last_confirmed_at,
    bounded.metadata
  from bounded
  where bounded.pattern_rank <= greatest(1, least(coalesce(p_patterns_per_domain, 10), 15))
  order by bounded.workspace_domain_id, bounded.pattern_rank;
$$;

create unique index if not exists hypotheses_workspace_dedupe_uidx
  on public.hypotheses (workspace_id, workspace_domain_id, ((metadata ->> 'dedupe_key')))
  where metadata ? 'dedupe_key' and deleted_at is null;

create or replace function public.n8n_upsert_verified_hypothesis(p_hypothesis jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (p_hypothesis ->> 'workspace_id')::uuid;
  v_workspace_domain_id uuid := (p_hypothesis ->> 'workspace_domain_id')::uuid;
  v_title text := btrim(p_hypothesis ->> 'title');
  v_statement text := btrim(p_hypothesis ->> 'statement');
  v_target_user text := btrim(p_hypothesis ->> 'target_user');
  v_problem text := btrim(p_hypothesis ->> 'problem');
  v_proposed_value text := btrim(coalesce(p_hypothesis ->> 'proposed_value', ''));
  v_assumptions jsonb := coalesce(p_hypothesis -> 'assumptions', '[]'::jsonb);
  v_falsifiers jsonb := coalesce(p_hypothesis -> 'falsifiers', '[]'::jsonb);
  v_validation_questions jsonb := coalesce(p_hypothesis -> 'validation_questions', '[]'::jsonb);
  v_pattern_ids uuid[];
  v_requested_count integer;
  v_eligible_count integer;
  v_min_pattern_confidence numeric;
  v_model_confidence numeric := least(1, greatest(0, coalesce((p_hypothesis ->> 'confidence')::numeric, 0)));
  v_final_confidence numeric;
  v_dedupe_key text;
  v_hypothesis public.hypotheses%rowtype;
  v_reference jsonb;
  v_is_new boolean := false;
  v_engine_version text := coalesce(nullif(p_hypothesis ->> 'engine_version', ''), 'hypothesis-engine-v1.0.0');
begin
  if length(v_title) not between 1 and 240
    or length(v_statement) not between 1 and 2000
    or length(v_target_user) < 1
    or length(v_problem) < 1 then
    raise exception using errcode = '22023', message = 'INVALID_HYPOTHESIS_PAYLOAD';
  end if;

  if jsonb_typeof(v_assumptions) <> 'array' or jsonb_array_length(v_assumptions) < 1 then
    raise exception using errcode = '22023', message = 'HYPOTHESIS_REQUIRES_ASSUMPTIONS';
  end if;
  if jsonb_typeof(v_falsifiers) <> 'array' or jsonb_array_length(v_falsifiers) < 1 then
    raise exception using errcode = '22023', message = 'HYPOTHESIS_REQUIRES_FALSIFIERS';
  end if;
  if jsonb_typeof(v_validation_questions) <> 'array' or jsonb_array_length(v_validation_questions) < 1 then
    raise exception using errcode = '22023', message = 'HYPOTHESIS_REQUIRES_VALIDATION_QUESTIONS';
  end if;

  if jsonb_typeof(coalesce(p_hypothesis -> 'patterns', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_hypothesis -> 'patterns', '[]'::jsonb)) < 1 then
    raise exception using errcode = '22023', message = 'HYPOTHESIS_REQUIRES_AT_LEAST_ONE_PATTERN';
  end if;

  if not exists (
    select 1 from public.workspace_domains workspace_domain
    where workspace_domain.id = v_workspace_domain_id
      and workspace_domain.workspace_id = v_workspace_id
      and workspace_domain.status <> 'archived'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_HYPOTHESIS_WORKSPACE_DOMAIN';
  end if;

  select array_agg(distinct (reference ->> 'pattern_id')::uuid), count(*)
  into v_pattern_ids, v_requested_count
  from jsonb_array_elements(p_hypothesis -> 'patterns') reference
  where (reference ->> 'role')::text in ('primary', 'supporting', 'contradicting', 'context')
     or reference ->> 'role' is null;

  if cardinality(v_pattern_ids) <> v_requested_count then
    raise exception using errcode = '22023', message = 'DUPLICATE_HYPOTHESIS_PATTERN';
  end if;

  with checked_patterns as (
    select
      pattern.id,
      pattern.confidence,
      pattern.status,
      pattern.strength_score,
      coalesce((pattern.metadata ->> 'source_family_count')::bigint, 0) as source_family_count
    from public.patterns pattern
    where pattern.id = any(v_pattern_ids)
      and pattern.workspace_id = v_workspace_id
      and pattern.workspace_domain_id = v_workspace_domain_id
      and pattern.status in ('persistent', 'emerging')
  ), eligible_patterns as (
    select * from checked_patterns
    where status = 'persistent' or strength_score >= 0.7
  )
  select count(*), min(confidence)
  into v_eligible_count, v_min_pattern_confidence
  from eligible_patterns;

  if v_eligible_count <> v_requested_count then
    raise exception using errcode = '22023', message = 'HYPOTHESIS_REQUIRES_ELIGIBLE_PATTERNS';
  end if;

  if v_min_pattern_confidence is null then
    v_min_pattern_confidence := 0;
  end if;

  v_final_confidence := least(v_model_confidence, v_min_pattern_confidence);

  v_dedupe_key := md5(concat_ws('|', v_workspace_domain_id::text,
    lower(regexp_replace(v_target_user, '[^a-z0-9]+', ' ', 'gi')),
    lower(regexp_replace(v_problem, '[^a-z0-9]+', ' ', 'gi')),
    (select string_agg(p::text, ',' order by p) from unnest(v_pattern_ids) as p)
  ));

  perform pg_advisory_xact_lock(hashtextextended(v_workspace_id::text || ':' || v_dedupe_key, 0));

  select * into v_hypothesis
  from public.hypotheses hypothesis
  where hypothesis.workspace_id = v_workspace_id
    and hypothesis.workspace_domain_id = v_workspace_domain_id
    and hypothesis.metadata ->> 'dedupe_key' = v_dedupe_key
    and hypothesis.deleted_at is null
  order by hypothesis.created_at
  limit 1;

  if found then
    update public.hypotheses
    set statement = v_statement,
        proposed_value = nullif(v_proposed_value, ''),
        assumptions = v_assumptions,
        falsifiers = v_falsifiers,
        validation_questions = v_validation_questions,
        confidence = greatest(confidence, v_final_confidence),
        metadata = metadata || jsonb_build_object(
          'pattern_count', v_requested_count,
          'last_recomputed_at', now()
        ),
        engine_version = v_engine_version,
        updated_at = now()
    where id = v_hypothesis.id
    returning * into v_hypothesis;
  else
    insert into public.hypotheses (
      workspace_id, workspace_domain_id, title, statement,
      target_user, problem, proposed_value,
      assumptions, falsifiers, validation_questions,
      origin, status, confidence,
      metadata, engine_version
    ) values (
      v_workspace_id, v_workspace_domain_id, v_title, v_statement,
      v_target_user, v_problem, nullif(v_proposed_value, ''),
      v_assumptions, v_falsifiers, v_validation_questions,
      'engine', 'ready_for_validation', v_final_confidence,
      coalesce(p_hypothesis -> 'metadata', '{}'::jsonb) || jsonb_build_object(
        'dedupe_key', v_dedupe_key,
        'pattern_count', v_requested_count
      ),
      v_engine_version
    ) returning * into v_hypothesis;
    v_is_new := true;
  end if;

  if v_hypothesis.status in ('draft', 'ready_for_validation') then
    for v_reference in select value from jsonb_array_elements(p_hypothesis -> 'patterns') loop
      insert into public.hypothesis_patterns (workspace_id, hypothesis_id, pattern_id, role, weight)
      values (
        v_workspace_id,
        v_hypothesis.id,
        (v_reference ->> 'pattern_id')::uuid,
        case when (v_reference ->> 'role')::text in ('primary', 'supporting', 'contradicting', 'context')
          then (v_reference ->> 'role')::text else 'supporting' end,
        least(1, greatest(0, coalesce((v_reference ->> 'weight')::numeric, 0.7)))
      ) on conflict (hypothesis_id, pattern_id, role) do update
        set weight = greatest(public.hypothesis_patterns.weight, excluded.weight);
    end loop;
  end if;

  return jsonb_build_object(
    'hypothesis_id', v_hypothesis.id,
    'status', v_hypothesis.status,
    'is_new', v_is_new,
    'pattern_count', v_requested_count,
    'confidence', v_hypothesis.confidence
  );
end;
$$;

create or replace function public.n8n_revalidate_verified_hypotheses(
  p_workspace_id uuid,
  p_workspace_domain_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hypothesis public.hypotheses%rowtype;
  v_primary_pattern_count integer;
  v_updated integer := 0;
  v_deduped integer := 0;
begin
  for v_hypothesis in
    select * from public.hypotheses
    where workspace_id = p_workspace_id
      and (p_workspace_domain_id is null or workspace_domain_id = p_workspace_domain_id)
      and deleted_at is null
      and origin = 'engine'
  loop
    select count(*)
    into v_primary_pattern_count
    from public.hypothesis_patterns
    where hypothesis_id = v_hypothesis.id
      and workspace_id = v_hypothesis.workspace_id
      and role = 'primary';

    if v_primary_pattern_count = 0 then
      update public.hypotheses
      set deleted_at = now(),
          metadata = metadata || jsonb_build_object(
            'dedupe_removed_at', now(),
            'dedupe_reason', 'no_primary_pattern'
          ),
          updated_at = now()
      where id = v_hypothesis.id;
      v_deduped := v_deduped + 1;
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'updated', v_updated,
    'deduped_removed', v_deduped
  );
end;
$$;

revoke all on function public.n8n_list_hypothesis_pattern_candidates(uuid, integer, integer, numeric) from public, anon, authenticated;
revoke all on function public.n8n_upsert_verified_hypothesis(jsonb) from public, anon, authenticated;
revoke all on function public.n8n_revalidate_verified_hypotheses(uuid, uuid) from public, anon, authenticated;
grant execute on function public.n8n_list_hypothesis_pattern_candidates(uuid, integer, integer, numeric) to service_role;
grant execute on function public.n8n_upsert_verified_hypothesis(jsonb) to service_role;
grant execute on function public.n8n_revalidate_verified_hypotheses(uuid, uuid) to service_role;

commit;