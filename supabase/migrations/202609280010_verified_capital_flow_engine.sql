begin;

-- RE-Capital: Capital Flow Engine
-- Maps patterns to VC/YC entities, tracks capital flow across sectors/stages/geographies.
-- Consumes patterns (RE09) and theses (RE-Thesis), produces capital flow mappings.

create or replace function public.n8n_list_capital_flow_candidates(
  p_workspace_id uuid,
  p_workspace_domain_id uuid default null,
  p_min_pattern_strength numeric default 0.5,
  p_max_patterns integer default 50
)
returns table (
  pattern_id uuid,
  pattern_type text,
  pattern_title text,
  pattern_statement text,
  pattern_strength_score numeric,
  pattern_persistence_score numeric,
  pattern_diversity_score numeric,
  pattern_confidence numeric,
  pattern_status text,
  time_window_start date,
  time_window_end date,
  observation_count bigint,
  source_family_count bigint,
  event_entity_count bigint,
  entity_id uuid,
  entity_name text,
  entity_type text,
  entity_metadata jsonb,
  thesis_id uuid,
  thesis_type text,
  thesis_statement text,
  thesis_confidence numeric,
  thesis_methodology text,
  match_type text,
  match_confidence numeric
)
language sql
security definer
set search_path = ''
as $$
  with eligible_patterns as (
    select
      p.id as pattern_id, p.pattern_type, p.title as pattern_title, p.statement as pattern_statement,
      p.strength_score as pattern_strength_score, p.persistence_score as pattern_persistence_score,
      p.evidence_diversity_score as pattern_diversity_score, p.confidence as pattern_confidence,
      p.status as pattern_status, p.time_window_start, p.time_window_end,
      coalesce((p.metadata ->> 'observation_count')::bigint, 0) as observation_count,
      coalesce((p.metadata ->> 'source_family_count')::bigint, 0) as source_family_count,
      coalesce((p.metadata ->> 'event_entity_count')::bigint, 0) as event_entity_count
    from public.patterns p
    where p.workspace_id = p_workspace_id
      and p.status in ('persistent', 'emerging')
      and p.strength_score >= p_min_pattern_strength
      and (p_workspace_domain_id is null or p.workspace_domain_id = p_workspace_domain_id)
  ),
  eligible_theses as (
    select
      t.id as thesis_id, t.subject_entity_id, t.thesis_type, t.statement as thesis_statement,
      t.confidence as thesis_confidence, t.methodology as thesis_methodology,
      e.id as entity_id, e.name as entity_name, e.entity_type, e.attributes as entity_metadata
    from public.theses t
    join public.entities e on e.id = t.subject_entity_id and e.workspace_id = t.workspace_id
    where t.workspace_id = p_workspace_id
      and t.status in ('accepted', 'draft')
      and (p_workspace_domain_id is null or t.workspace_domain_id = p_workspace_domain_id)
  ),
  pattern_entity_matches as (
    select
      ep.*, et.*,
      case
        when et.thesis_type = 'revealed' then 'revealed_thesis_match'
        when et.thesis_type = 'stated' then 'stated_thesis_match'
        else 'pattern_entity_overlap'
      end as match_type,
      case
        when et.thesis_confidence is not null then least(1, ep.pattern_confidence * et.thesis_confidence)
        else ep.pattern_confidence
      end as match_confidence
    from eligible_patterns ep
    cross join lateral (
      select * from eligible_theses et
    ) et
    where (ep.pattern_statement ILIKE '%' || et.entity_name || '%'
        or ep.pattern_title ILIKE '%' || et.entity_name || '%'
        or et.thesis_statement ILIKE '%' || ep.pattern_type || '%'
        or et.entity_metadata ->> 'category' ILIKE '%' || ep.pattern_type || '%')
  ),
  ranked as (
    select *,
      row_number() over (partition by pattern_id order by match_confidence desc, thesis_confidence desc nulls last) as rn
    from pattern_entity_matches
  )
  select
    pattern_id, pattern_type, pattern_title, pattern_statement,
    pattern_strength_score, pattern_persistence_score, pattern_diversity_score, pattern_confidence,
    pattern_status, time_window_start, time_window_end,
    observation_count, source_family_count, event_entity_count,
    entity_id, entity_name, entity_type, entity_metadata,
    thesis_id, thesis_type, thesis_statement, thesis_confidence, thesis_methodology,
    match_type, match_confidence
  from ranked
  where rn <= 3
  order by pattern_strength_score desc, match_confidence desc
  limit p_max_patterns;
$$;

create table if not exists public.capital_flow_mappings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workspace_domain_id uuid not null,
  pattern_id uuid not null,
  entity_id uuid not null,
  thesis_id uuid,
  match_type text not null,
  match_confidence public.score_01 not null,
  capital_direction text not null check (capital_direction in ('inflow', 'outflow', 'bidirectional')),
  sector_tags text[] not null default '{}',
  stage_tags text[] not null default '{}',
  geography_tags text[] not null default '{}',
  check_size_min_usd numeric,
  check_size_max_usd numeric,
  deal_count integer not null default 1,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  engine_version text not null,
  status text not null default 'draft'
    check (status in ('draft', 'accepted', 'rejected', 'superseded')),
  confidence public.score_01 not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (workspace_domain_id, workspace_id)
    references public.workspace_domains(id, workspace_id),
  foreign key (pattern_id, workspace_id)
    references public.patterns(id, workspace_id) on delete cascade,
  foreign key (entity_id, workspace_id)
    references public.entities(id, workspace_id) on delete cascade,
  foreign key (thesis_id, workspace_id)
    references public.theses(id, workspace_id) on delete set null
);

create index if not exists capital_flow_entity_idx
  on public.capital_flow_mappings (workspace_id, entity_id);
create index if not exists capital_flow_pattern_idx
  on public.capital_flow_mappings (workspace_id, pattern_id);
create index if not exists capital_flow_status_idx
  on public.capital_flow_mappings (workspace_id, status, updated_at desc);

create or replace function public.n8n_upsert_capital_flow_mapping(p_mapping jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (p_mapping ->> 'workspace_id')::uuid;
  v_workspace_domain_id uuid := (p_mapping ->> 'workspace_domain_id')::uuid;
  v_pattern_id uuid := (p_mapping ->> 'pattern_id')::uuid;
  v_entity_id uuid := (p_mapping ->> 'entity_id')::uuid;
  v_thesis_id uuid := case when (p_mapping ->> 'thesis_id') is not null and nullif(p_mapping ->> 'thesis_id', '') <> '' then (p_mapping ->> 'thesis_id')::uuid else null end;
  v_match_type text := p_mapping ->> 'match_type';
  v_match_confidence numeric := least(1, greatest(0, coalesce((p_mapping ->> 'match_confidence')::numeric, 0)));
  v_capital_direction text := p_mapping ->> 'capital_direction';
  v_sector_tags text[] := coalesce((p_mapping -> 'sector_tags')::text[], '{}');
  v_stage_tags text[] := coalesce((p_mapping -> 'stage_tags')::text[], '{}');
  v_geography_tags text[] := coalesce((p_mapping -> 'geography_tags')::text[], '{}');
  v_check_size_min_usd numeric := case when (p_mapping ->> 'check_size_min_usd') is not null then (p_mapping ->> 'check_size_min_usd')::numeric else null end;
  v_check_size_max_usd numeric := case when (p_mapping ->> 'check_size_max_usd') is not null then (p_mapping ->> 'check_size_max_usd')::numeric else null end;
  v_deal_count integer := coalesce((p_mapping ->> 'deal_count')::integer, 1);
  v_model_confidence numeric := least(1, greatest(0, coalesce((p_mapping ->> 'confidence')::numeric, 0)));
  v_final_confidence numeric;
  v_dedupe_key text;
  v_mapping public.capital_flow_mappings%rowtype;
  v_is_new boolean := false;
  v_engine_version text := coalesce(nullif(p_mapping ->> 'engine_version', ''), 'capital-flow-engine-v1.0.0');
begin
  if v_match_type not in ('revealed_thesis_match', 'stated_thesis_match', 'pattern_entity_overlap', 'thesis_driven')
    or v_capital_direction not in ('inflow', 'outflow', 'bidirectional') then
    raise exception using errcode = '22023', message = 'INVALID_CAPITAL_FLOW_PAYLOAD';
  end if;

  if not exists (
    select 1 from public.workspace_domains wd
    where wd.id = v_workspace_domain_id and wd.workspace_id = v_workspace_id and wd.status <> 'archived'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_CAPITAL_FLOW_WORKSPACE_DOMAIN';
  end if;

  if not exists (
    select 1 from public.patterns p
    where p.id = v_pattern_id and p.workspace_id = v_workspace_id
  ) then
    raise exception using errcode = '22023', message = 'INVALID_CAPITAL_FLOW_PATTERN';
  end if;

  if not exists (
    select 1 from public.entities e
    where e.id = v_entity_id and e.workspace_id = v_workspace_id and e.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'INVALID_CAPITAL_FLOW_ENTITY';
  end if;

  if v_thesis_id is not null and not exists (
    select 1 from public.theses t
    where t.id = v_thesis_id and t.workspace_id = v_workspace_id
  ) then
    raise exception using errcode = '22023', message = 'INVALID_CAPITAL_FLOW_THESIS';
  end if;

  v_final_confidence := least(v_model_confidence, v_match_confidence);

  v_dedupe_key := md5(concat_ws('|', v_workspace_domain_id::text, v_pattern_id::text, v_entity_id::text, v_match_type));

  perform pg_advisory_xact_lock(hashtextextended(v_workspace_id::text || ':' || v_dedupe_key, 0));

  select * into v_mapping
  from public.capital_flow_mappings m
  where m.workspace_id = v_workspace_id
    and m.pattern_id = v_pattern_id
    and m.entity_id = v_entity_id
    and m.match_type = v_match_type
    and m.status <> 'rejected'
  order by m.created_at
  limit 1;

  if found then
    update public.capital_flow_mappings
    set thesis_id = v_thesis_id,
        match_confidence = greatest(match_confidence, v_match_confidence),
        capital_direction = v_capital_direction,
        sector_tags = array_cat(sector_tags, v_sector_tags) - array[]::text[],
        stage_tags = array_cat(stage_tags, v_stage_tags) - array[]::text[],
        geography_tags = array_cat(geography_tags, v_geography_tags) - array[]::text[],
        check_size_min_usd = least(coalesce(check_size_min_usd, v_check_size_min_usd), v_check_size_min_usd),
        check_size_max_usd = greatest(coalesce(check_size_max_usd, v_check_size_max_usd), v_check_size_max_usd),
        deal_count = deal_count + v_deal_count,
        confidence = greatest(confidence, v_final_confidence),
        metadata = metadata || jsonb_build_object(
          'last_recomputed_at', now(),
          'deal_count', deal_count + v_deal_count
        ),
        engine_version = v_engine_version,
        updated_at = now()
    where id = v_mapping.id
    returning * into v_mapping;
  else
    insert into public.capital_flow_mappings (
      workspace_id, workspace_domain_id, pattern_id, entity_id, thesis_id,
      match_type, match_confidence, capital_direction,
      sector_tags, stage_tags, geography_tags,
      check_size_min_usd, check_size_max_usd, deal_count,
      metadata, engine_version, status, confidence
    ) values (
      v_workspace_id, v_workspace_domain_id, v_pattern_id, v_entity_id, v_thesis_id,
      v_match_type, v_match_confidence, v_capital_direction,
      v_sector_tags, v_stage_tags, v_geography_tags,
      v_check_size_min_usd, v_check_size_max_usd, v_deal_count,
      coalesce(p_mapping -> 'metadata', '{}'::jsonb) || jsonb_build_object(
        'dedupe_key', v_dedupe_key,
        'deal_count', v_deal_count
      ),
      v_engine_version, 'draft', v_final_confidence
    ) returning * into v_mapping;
    v_is_new := true;
  end if;

  return jsonb_build_object(
    'mapping_id', v_mapping.id,
    'status', v_mapping.status,
    'is_new', v_is_new,
    'pattern_id', v_mapping.pattern_id,
    'entity_id', v_mapping.entity_id,
    'match_type', v_mapping.match_type,
    'match_confidence', v_mapping.match_confidence,
    'capital_direction', v_mapping.capital_direction,
    'confidence', v_mapping.confidence
  );
end;
$$;

revoke all on function public.n8n_list_capital_flow_candidates(uuid, uuid, numeric, integer) from public, anon, authenticated;
revoke all on function public.n8n_upsert_capital_flow_mapping(jsonb) from public, anon, authenticated;
grant execute on function public.n8n_list_capital_flow_candidates(uuid, uuid, numeric, integer) to service_role;
grant execute on function public.n8n_upsert_capital_flow_mapping(jsonb) to service_role;

commit;