begin;

-- RE-Thesis: Thesis Extraction Engine
-- Extracts stated thesis (public statements) and revealed thesis (actual investments) for VC/YC entities.
-- Consumes verified evidence about entities, produces thesis records linked to entities.

create or replace function public.n8n_list_thesis_evidence_candidates(
  p_workspace_id uuid,
  p_workspace_domain_id uuid default null,
  p_entity_types text[] default '{organization}',
  p_max_evidence_per_entity integer default 20
)
returns table (
  entity_id uuid,
  entity_name text,
  entity_type text,
  entity_metadata jsonb,
  evidence_id uuid,
  source_id uuid,
  source_title text,
  canonical_url text,
  publisher text,
  published_at timestamptz,
  source_type text,
  source_quality_score numeric,
  evidence_type text,
  claim_text text,
  excerpt text,
  polarity text,
  confidence numeric,
  evidence_metadata jsonb
)
language sql
security definer
set search_path = ''
as $$
  with eligible_entities as (
    select e.id as entity_id, e.name as entity_name, e.entity_type, e.attributes as entity_metadata
    from public.entities e
    where e.workspace_id = p_workspace_id
      and e.entity_type = any(p_entity_types)
      and (p_workspace_domain_id is null or e.attributes ->> 'workspace_domain_id' = p_workspace_domain_id::text)
  ),
  evidence_per_entity as (
    select
      ee.entity_id,
      ee.entity_name,
      ee.entity_type,
      ee.entity_metadata,
      ev.id as evidence_id,
      ev.source_id,
      src.title as source_title,
      src.canonical_url,
      src.publisher,
      src.published_at,
      src.source_type,
      src.source_quality_score,
      ev.evidence_type,
      ev.claim_text,
      ev.excerpt,
      ev.polarity,
      ev.confidence,
      ev.metadata as evidence_metadata,
      row_number() over (partition by ee.entity_id order by src.published_at desc nulls last, ev.confidence desc) as rn
    from eligible_entities ee
    join public.evidence ev on ev.workspace_id = p_workspace_id
      and ev.verification_status = 'verified'
      and ev.metadata ->> 'entity_id' = ee.entity_id::text
    join public.sources src on src.id = ev.source_id
      and src.workspace_id = ev.workspace_id
      and src.deleted_at is null
      and src.evidence_status = 'accepted'
    where ev.confidence >= 0.5
  )
  select
    entity_id, entity_name, entity_type, entity_metadata,
    evidence_id, source_id, source_title, canonical_url, publisher, published_at,
    source_type, source_quality_score, evidence_type, claim_text, excerpt,
    polarity, confidence, evidence_metadata
  from evidence_per_entity
  where rn <= p_max_evidence_per_entity
  order by entity_id, published_at desc nulls last, confidence desc;
$$;

create or replace function public.n8n_upsert_verified_thesis(p_thesis jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (p_thesis ->> 'workspace_id')::uuid;
  v_workspace_domain_id uuid := (p_thesis ->> 'workspace_domain_id')::uuid;
  v_subject_entity_id uuid := (p_thesis ->> 'subject_entity_id')::uuid;
  v_thesis_type text := lower(btrim(p_thesis ->> 'thesis_type'));
  v_statement text := btrim(p_thesis ->> 'statement');
  v_time_window_start date;
  v_time_window_end date;
  v_methodology text := btrim(coalesce(p_thesis ->> 'methodology', ''));
  v_model_confidence numeric := least(1, greatest(0, coalesce((p_thesis ->> 'confidence')::numeric, 0)));
  v_final_confidence numeric;
  v_dedupe_key text;
  v_thesis public.theses%rowtype;
  v_reference jsonb;
  v_is_new boolean := false;
  v_evidence_ids uuid[];
  v_eligible_count integer;
  v_engine_version text := coalesce(nullif(p_thesis ->> 'engine_version', ''), 'thesis-engine-v1.0.0');
begin
  if v_thesis_type not in ('stated', 'revealed')
    or length(v_statement) not between 1 and 5000 then
    raise exception using errcode = '22023', message = 'INVALID_THESIS_PAYLOAD';
  end if;

  if not exists (
    select 1 from public.workspace_domains wd
    where wd.id = v_workspace_domain_id
      and wd.workspace_id = v_workspace_id
      and wd.status <> 'archived'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_THESIS_WORKSPACE_DOMAIN';
  end if;

  if not exists (
    select 1 from public.entities e
    where e.id = v_subject_entity_id
      and e.workspace_id = v_workspace_id
      and e.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_THESIS_ENTITY';
  end if;

  begin
    if nullif(btrim(p_thesis ->> 'time_window_start'), '') is not null then
      v_time_window_start := (p_thesis ->> 'time_window_start')::date;
    end if;
    if nullif(btrim(p_thesis ->> 'time_window_end'), '') is not null then
      v_time_window_end := (p_thesis ->> 'time_window_end')::date;
    end if;
  exception when others then
    raise exception using errcode = '22023', message = 'INVALID_THESIS_TIME_WINDOW';
  end;
  if v_time_window_start is not null and v_time_window_end is not null
    and v_time_window_end < v_time_window_start then
    raise exception using errcode = '22023', message = 'INVALID_THESIS_TIME_WINDOW';
  end if;

  select array_agg(distinct (reference ->> 'evidence_id')::uuid), count(*)
  into v_evidence_ids, v_eligible_count
  from jsonb_array_elements(p_thesis -> 'evidence') reference
  where (reference ->> 'role')::text in ('supporting', 'contradicting', 'context')
     or reference ->> 'role' is null;

  if cardinality(v_evidence_ids) <> v_eligible_count then
    raise exception using errcode = '22023', message = 'DUPLICATE_THESIS_EVIDENCE';
  end if;

  with checked_evidence as (
    select
      e.id,
      e.confidence,
      count(distinct e.id) filter (
        where e.id is null
           or e.verification_status <> 'verified'
           or e.workspace_id <> v_workspace_id
      ) as invalid_count
    from public.evidence e
    where e.id = any(v_evidence_ids)
      and e.workspace_id = v_workspace_id
    group by e.id, e.confidence
  ), eligible_evidence as (
    select * from checked_evidence where invalid_count = 0
  )
  select count(*), avg(confidence)
  into v_eligible_count, v_final_confidence
  from eligible_evidence;

  if v_eligible_count <> cardinality(v_evidence_ids) then
    raise exception using errcode = '22023', message = 'THESIS_REQUIRES_VERIFIED_EVIDENCE';
  end if;

  v_final_confidence := least(v_model_confidence, coalesce(v_final_confidence, 0));

  v_dedupe_key := md5(concat_ws('|', v_workspace_domain_id::text, v_subject_entity_id::text,
    v_thesis_type, lower(regexp_replace(v_statement, '[^a-z0-9]+', ' ', 'gi'))));

  perform pg_advisory_xact_lock(hashtextextended(v_workspace_id::text || ':' || v_dedupe_key, 0));

  select * into v_thesis
  from public.theses t
  where t.workspace_id = v_workspace_id
    and t.subject_entity_id = v_subject_entity_id
    and t.thesis_type = v_thesis_type
    and t.metadata ->> 'dedupe_key' = v_dedupe_key
    and t.status <> 'rejected'
  order by t.created_at
  limit 1;

  if found then
    update public.theses
    set statement = v_statement,
        time_window_start = coalesce(v_time_window_start, time_window_start),
        time_window_end = coalesce(v_time_window_end, time_window_end),
        methodology = v_methodology,
        confidence = greatest(confidence, v_final_confidence),
        metadata = metadata || jsonb_build_object(
          'evidence_count', v_eligible_count,
          'last_recomputed_at', now()
        ),
        engine_version = v_engine_version,
        updated_at = now()
    where id = v_thesis.id
    returning * into v_thesis;
  else
    insert into public.theses (
      workspace_id, workspace_domain_id, subject_entity_id, thesis_type,
      statement, time_window_start, time_window_end, methodology,
      engine_version, status, confidence, metadata
    ) values (
      v_workspace_id, v_workspace_domain_id, v_subject_entity_id, v_thesis_type,
      v_statement, v_time_window_start, v_time_window_end, v_methodology,
      v_engine_version, 'draft', v_final_confidence,
      coalesce(p_thesis -> 'metadata', '{}'::jsonb) || jsonb_build_object(
        'dedupe_key', v_dedupe_key,
        'evidence_count', v_eligible_count
      )
    ) returning * into v_thesis;
    v_is_new := true;
  end if;

  if v_thesis.status = 'draft' then
    for v_reference in select value from jsonb_array_elements(p_thesis -> 'evidence') loop
      insert into public.thesis_evidence (workspace_id, thesis_id, evidence_id, role, weight)
      values (
        v_workspace_id,
        v_thesis.id,
        (v_reference ->> 'evidence_id')::uuid,
        case when (v_reference ->> 'role')::text in ('supporting', 'contradicting', 'context')
          then (v_reference ->> 'role')::text else 'supporting' end,
        least(1, greatest(0, coalesce((v_reference ->> 'weight')::numeric, 0.7)))
      ) on conflict (thesis_id, evidence_id, role) do update
        set weight = greatest(public.thesis_evidence.weight, excluded.weight);
    end loop;
  end if;

  return jsonb_build_object(
    'thesis_id', v_thesis.id,
    'status', v_thesis.status,
    'is_new', v_is_new,
    'evidence_count', v_eligible_count,
    'confidence', v_thesis.confidence
  );
end;
$$;

revoke all on function public.n8n_list_thesis_evidence_candidates(uuid, uuid, text[], integer) from public, anon, authenticated;
revoke all on function public.n8n_upsert_verified_thesis(jsonb) from public, anon, authenticated;
grant execute on function public.n8n_list_thesis_evidence_candidates(uuid, uuid, text[], integer) to service_role;
grant execute on function public.n8n_upsert_verified_thesis(jsonb) to service_role;

commit;