begin;

-- Signal generation is downstream of human review. Evidence packs are bounded
-- per domain and per source so repeated claims from one article cannot create
-- false corroboration.

create or replace function public.n8n_list_signal_evidence_candidates(
  p_workspace_id uuid,
  p_domain_limit integer default 3,
  p_evidence_per_domain integer default 12,
  p_evidence_per_source integer default 2
)
returns table (
  evidence_id uuid,
  workspace_id uuid,
  workspace_domain_id uuid,
  domain_key text,
  domain_name text,
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
  linked_entities jsonb
)
language sql
security definer
set search_path = ''
as $$
  with eligible as (
    select
      evidence.id as evidence_id,
      evidence.workspace_id,
      run.workspace_domain_id,
      domain.key as domain_key,
      coalesce(workspace_domain.name, domain.name) as domain_name,
      source.id as source_id,
      source.title as source_title,
      source.canonical_url,
      source.publisher,
      source.published_at,
      source.source_type,
      source.source_quality_score,
      evidence.evidence_type,
      evidence.claim_text,
      evidence.excerpt,
      evidence.polarity,
      evidence.confidence,
      evidence.created_at,
      coalesce(entity_links.linked_entities, '[]'::jsonb) as linked_entities,
      row_number() over (
        partition by run.workspace_domain_id, source.id
        order by evidence.confidence desc, evidence.created_at desc, evidence.id
      ) as source_rank
    from public.evidence evidence
    join public.sources source
      on source.id = evidence.source_id
     and source.workspace_id = evidence.workspace_id
    join public.research_runs run
      on run.id = evidence.research_run_id
     and run.workspace_id = evidence.workspace_id
    join public.workspace_domains workspace_domain
      on workspace_domain.id = run.workspace_domain_id
     and workspace_domain.workspace_id = run.workspace_id
    join public.domains domain on domain.id = workspace_domain.domain_id
    left join public.signal_evidence consumed
      on consumed.evidence_id = evidence.id
     and consumed.workspace_id = evidence.workspace_id
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'entity_id', entity.id,
        'entity_type', entity.entity_type,
        'name', entity.name,
        'role', link.role
      ) order by entity.name) as linked_entities
      from public.evidence_entities link
      join public.entities entity
        on entity.id = link.entity_id
       and entity.workspace_id = link.workspace_id
      where link.evidence_id = evidence.id
        and link.workspace_id = evidence.workspace_id
        and entity.resolution_status <> 'merged'
    ) entity_links on true
    where evidence.workspace_id = p_workspace_id
      and evidence.verification_status = 'verified'
      and source.evidence_status = 'accepted'
      and source.deleted_at is null
      and consumed.evidence_id is null
      and workspace_domain.status <> 'archived'
  ),
  source_bounded as (
    select * from eligible
    where source_rank <= greatest(1, least(coalesce(p_evidence_per_source, 2), 3))
  ),
  ranked_domains as (
    select workspace_domain_id,
      row_number() over (order by count(*) desc, workspace_domain_id) as domain_rank
    from source_bounded
    group by workspace_domain_id
  ),
  domain_bounded as (
    select source_bounded.*,
      row_number() over (
        partition by source_bounded.workspace_domain_id
        order by source_bounded.confidence desc, source_bounded.created_at desc, source_bounded.evidence_id
      ) as domain_evidence_rank
    from source_bounded
    join ranked_domains using (workspace_domain_id)
    where ranked_domains.domain_rank <= greatest(1, least(coalesce(p_domain_limit, 3), 7))
  )
  select
    domain_bounded.evidence_id,
    domain_bounded.workspace_id,
    domain_bounded.workspace_domain_id,
    domain_bounded.domain_key,
    domain_bounded.domain_name,
    domain_bounded.source_id,
    domain_bounded.source_title,
    domain_bounded.canonical_url,
    domain_bounded.publisher,
    domain_bounded.published_at,
    domain_bounded.source_type,
    domain_bounded.source_quality_score,
    domain_bounded.evidence_type,
    domain_bounded.claim_text,
    domain_bounded.excerpt,
    domain_bounded.polarity,
    domain_bounded.confidence,
    domain_bounded.linked_entities
  from domain_bounded
  where domain_evidence_rank <= greatest(1, least(coalesce(p_evidence_per_domain, 12), 20))
  order by workspace_domain_id, domain_evidence_rank;
$$;

create unique index if not exists signals_workspace_dedupe_uidx
  on public.signals (workspace_id, workspace_domain_id, ((metadata ->> 'dedupe_key')))
  where metadata ? 'dedupe_key' and status <> 'rejected';

create or replace function public.n8n_upsert_verified_signal(p_signal jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (p_signal ->> 'workspace_id')::uuid;
  v_workspace_domain_id uuid := (p_signal ->> 'workspace_domain_id')::uuid;
  v_signal_type text := lower(btrim(p_signal ->> 'signal_type'));
  v_title text := btrim(p_signal ->> 'title');
  v_summary text := btrim(p_signal ->> 'summary');
  v_event_at timestamptz;
  v_evidence_ids uuid[];
  v_requested_count integer;
  v_verified_count integer;
  v_source_count integer;
  v_evidence_confidence numeric;
  v_model_confidence numeric := least(1, greatest(0, coalesce((p_signal ->> 'confidence')::numeric, 0)));
  v_final_confidence numeric;
  v_dedupe_key text;
  v_signal public.signals%rowtype;
  v_reference jsonb;
  v_is_new boolean := false;
begin
  if v_signal_type not in ('funding', 'launch', 'partnership', 'acquisition', 'founder_movement', 'hiring', 'research', 'technology', 'regulation', 'market', 'shutdown', 'investment_thesis', 'other')
    or length(v_title) not between 1 and 240
    or length(v_summary) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'INVALID_SIGNAL_PAYLOAD';
  end if;
  if jsonb_typeof(coalesce(p_signal -> 'evidence', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_signal -> 'evidence', '[]'::jsonb)) not between 1 and 6 then
    raise exception using errcode = '22023', message = 'INVALID_SIGNAL_EVIDENCE_SET';
  end if;
  if jsonb_typeof(coalesce(p_signal -> 'geographies', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_signal -> 'topics', '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_SIGNAL_ARRAYS';
  end if;
  if nullif(btrim(p_signal ->> 'event_at'), '') is not null then
    begin
      v_event_at := (p_signal ->> 'event_at')::timestamptz;
    exception when others then
      raise exception using errcode = '22023', message = 'INVALID_SIGNAL_EVENT_AT';
    end;
  end if;
  if not exists (
    select 1 from public.workspace_domains workspace_domain
    where workspace_domain.id = v_workspace_domain_id
      and workspace_domain.workspace_id = v_workspace_id
      and workspace_domain.status <> 'archived'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_SIGNAL_WORKSPACE_DOMAIN';
  end if;

  select array_agg(distinct (reference ->> 'evidence_id')::uuid), count(*)
  into v_evidence_ids, v_requested_count
  from jsonb_array_elements(p_signal -> 'evidence') reference;
  if cardinality(v_evidence_ids) <> v_requested_count then
    raise exception using errcode = '22023', message = 'DUPLICATE_SIGNAL_EVIDENCE';
  end if;

  select count(*), count(distinct source.id), avg(evidence.confidence)
  into v_verified_count, v_source_count, v_evidence_confidence
  from public.evidence evidence
  join public.sources source
    on source.id = evidence.source_id
   and source.workspace_id = evidence.workspace_id
  join public.research_runs run
    on run.id = evidence.research_run_id
   and run.workspace_id = evidence.workspace_id
  where evidence.id = any(v_evidence_ids)
    and evidence.workspace_id = v_workspace_id
    and evidence.verification_status = 'verified'
    and source.evidence_status = 'accepted'
    and source.deleted_at is null
    and run.workspace_domain_id = v_workspace_domain_id;
  if v_verified_count <> v_requested_count then
    raise exception using errcode = '22023', message = 'SIGNAL_REQUIRES_VERIFIED_SAME_DOMAIN_EVIDENCE';
  end if;

  v_final_confidence := least(v_model_confidence, coalesce(v_evidence_confidence, 0), case when v_source_count >= 2 then 1 else 0.75 end);
  v_dedupe_key := md5(concat_ws('|', v_workspace_domain_id::text, v_signal_type,
    lower(regexp_replace(v_title, '[^a-z0-9]+', ' ', 'gi')), coalesce(v_event_at::date::text, 'undated')));
  perform pg_advisory_xact_lock(hashtextextended(v_workspace_id::text || ':' || v_dedupe_key, 0));

  select * into v_signal
  from public.signals signal
  where signal.workspace_id = v_workspace_id
    and signal.workspace_domain_id = v_workspace_domain_id
    and signal.metadata ->> 'dedupe_key' = v_dedupe_key
    and signal.status <> 'rejected'
  order by signal.created_at
  limit 1;

  if found then
    update public.signals
    set
      summary = v_summary,
      confidence = greatest(confidence, v_final_confidence),
      novelty_score = greatest(novelty_score, least(1, greatest(0, coalesce((p_signal ->> 'novelty_score')::numeric, 0)))),
      importance_score = greatest(importance_score, least(1, greatest(0, coalesce((p_signal ->> 'importance_score')::numeric, 0)))),
      geographies = array(select distinct jsonb_array_elements_text(coalesce(p_signal -> 'geographies', '[]'::jsonb))),
      topics = array(select distinct jsonb_array_elements_text(coalesce(p_signal -> 'topics', '[]'::jsonb))),
      metadata = metadata || jsonb_build_object('source_count', v_source_count, 'last_recomputed_at', now()),
      updated_at = now()
    where id = v_signal.id
    returning * into v_signal;
  else
    insert into public.signals (
      workspace_id, workspace_domain_id, signal_type, title, summary, event_at,
      novelty_score, importance_score, confidence, geographies, topics,
      metadata, engine_version, status
    ) values (
      v_workspace_id, v_workspace_domain_id, v_signal_type, v_title, v_summary, v_event_at,
      least(1, greatest(0, coalesce((p_signal ->> 'novelty_score')::numeric, 0))),
      least(1, greatest(0, coalesce((p_signal ->> 'importance_score')::numeric, 0))),
      v_final_confidence,
      array(select distinct jsonb_array_elements_text(coalesce(p_signal -> 'geographies', '[]'::jsonb))),
      array(select distinct jsonb_array_elements_text(coalesce(p_signal -> 'topics', '[]'::jsonb))),
      coalesce(p_signal -> 'metadata', '{}'::jsonb) || jsonb_build_object(
        'dedupe_key', v_dedupe_key,
        'source_count', v_source_count,
        'corroboration_status', case when v_source_count >= 2 then 'multi_source' else 'single_source' end
      ),
      coalesce(nullif(p_signal ->> 'engine_version', ''), 'signal-engine-v1.0.0'),
      'draft'
    ) returning * into v_signal;
    v_is_new := true;
  end if;

  for v_reference in select value from jsonb_array_elements(p_signal -> 'evidence') loop
    insert into public.signal_evidence (workspace_id, signal_id, evidence_id, role, weight)
    values (
      v_workspace_id,
      v_signal.id,
      (v_reference ->> 'evidence_id')::uuid,
      case when v_reference ->> 'role' in ('supporting', 'contradicting', 'context') then v_reference ->> 'role' else 'supporting' end,
      least(1, greatest(0, coalesce((v_reference ->> 'weight')::numeric, 0.7)))
    ) on conflict (signal_id, evidence_id, role) do update
      set weight = greatest(public.signal_evidence.weight, excluded.weight);
  end loop;

  insert into public.signal_entities (workspace_id, signal_id, entity_id, role)
  select distinct v_workspace_id, v_signal.id, link.entity_id, left(coalesce(nullif(link.role, ''), 'mentioned'), 100)
  from public.evidence_entities link
  where link.workspace_id = v_workspace_id
    and link.evidence_id = any(v_evidence_ids)
  on conflict (signal_id, entity_id, role) do nothing;

  return jsonb_build_object(
    'signal_id', v_signal.id,
    'status', v_signal.status,
    'is_new', v_is_new,
    'evidence_count', v_requested_count,
    'source_count', v_source_count,
    'confidence', v_final_confidence,
    'corroboration_status', case when v_source_count >= 2 then 'multi_source' else 'single_source' end
  );
end;
$$;

create or replace view public.v_signal_engine_health
with (security_invoker = true)
as
select
  signal.workspace_id,
  signal.workspace_domain_id,
  count(*) as signal_count,
  count(*) filter (where signal.status = 'draft') as draft_signals,
  count(*) filter (where signal.status = 'accepted') as accepted_signals,
  count(*) filter (where signal.metadata ->> 'corroboration_status' = 'multi_source') as multi_source_signals,
  round(avg(signal.confidence), 4) as average_confidence,
  round(avg(coalesce((signal.metadata ->> 'source_count')::numeric, 0)), 2) as average_source_count,
  max(signal.updated_at) as last_signal_at
from public.signals signal
where signal.status <> 'rejected'
group by signal.workspace_id, signal.workspace_domain_id;

revoke all on function public.n8n_list_signal_evidence_candidates(uuid, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.n8n_upsert_verified_signal(jsonb) from public, anon, authenticated;
grant execute on function public.n8n_list_signal_evidence_candidates(uuid, integer, integer, integer) to service_role;
grant execute on function public.n8n_upsert_verified_signal(jsonb) to service_role;
grant select on public.v_signal_engine_health to authenticated;

commit;
