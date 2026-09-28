begin;

-- Bounded service-only queue and persistence contract for official capital
-- profiles. Profile verification never changes evidence-backed activity state.

create or replace function public.n8n_list_capital_profile_candidates(
  p_workspace_id uuid,
  p_limit integer default 3
)
returns table (
  entity_id uuid,
  workspace_id uuid,
  entity_type text,
  name text,
  current_canonical_url text,
  registry_source text,
  registry_country text,
  evidence_count bigint,
  official_profile_status text,
  official_profile_checked_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    entity.id,
    entity.workspace_id,
    entity.entity_type,
    entity.name,
    entity.canonical_url,
    entity.attributes ->> 'registry_source',
    entity.attributes ->> 'registry_country',
    coalesce(directory.evidence_count, 0),
    coalesce(entity.attributes ->> 'official_profile_status', 'unverified'),
    nullif(entity.attributes ->> 'official_profile_checked_at', '')::timestamptz
  from public.entities entity
  left join public.v_capital_directory directory
    on directory.entity_id = entity.id
   and directory.workspace_id = entity.workspace_id
  where entity.workspace_id = p_workspace_id
    and entity.entity_type in ('investor', 'fund', 'accelerator')
    and entity.resolution_status <> 'merged'
    and entity.attributes ->> 'registry_source' in ('sebi', 'wikidata')
    and (
      nullif(entity.attributes ->> 'official_profile_checked_at', '') is null
      or nullif(entity.attributes ->> 'official_profile_checked_at', '')::timestamptz < now() - interval '90 days'
    )
  order by
    case when entity.attributes ->> 'registry_source' = 'sebi' then 0 else 1 end,
    case when entity.canonical_url is null then 0 else 1 end,
    coalesce(directory.evidence_count, 0) desc,
    entity.updated_at,
    entity.id
  limit greatest(1, least(coalesce(p_limit, 3), 10));
$$;

create or replace function public.n8n_update_capital_official_profile(p_profile jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (p_profile ->> 'workspace_id')::uuid;
  v_entity_id uuid := (p_profile ->> 'entity_id')::uuid;
  v_status text := lower(btrim(coalesce(p_profile ->> 'status', 'needs_review')));
  v_official_url text := nullif(btrim(p_profile ->> 'official_website_url'), '');
  v_source_url text := nullif(btrim(p_profile ->> 'profile_source_url'), '');
  v_confidence numeric := least(1, greatest(0, coalesce((p_profile ->> 'confidence')::numeric, 0)));
  v_attributes jsonb;
  v_entity public.entities%rowtype;
begin
  if v_status not in ('verified', 'needs_review') then
    raise exception using errcode = '22023', message = 'INVALID_OFFICIAL_PROFILE_STATUS';
  end if;
  if v_status = 'verified' and (v_official_url is null or v_official_url !~ '^https?://') then
    raise exception using errcode = '22023', message = 'VERIFIED_PROFILE_REQUIRES_OFFICIAL_URL';
  end if;
  if v_official_url is not null and v_official_url !~ '^https?://' then
    raise exception using errcode = '22023', message = 'INVALID_OFFICIAL_PROFILE_URL';
  end if;
  if v_source_url is not null and v_source_url !~ '^https?://' then
    raise exception using errcode = '22023', message = 'INVALID_PROFILE_SOURCE_URL';
  end if;
  if jsonb_typeof(coalesce(p_profile -> 'sectors', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_profile -> 'stages', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_profile -> 'geographies', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_profile -> 'portfolio_company_names', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_profile -> 'evidence_quotes', '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_OFFICIAL_PROFILE_ARRAYS';
  end if;

  select * into v_entity
  from public.entities
  where id = v_entity_id
    and workspace_id = v_workspace_id
    and entity_type in ('investor', 'fund', 'accelerator')
    and resolution_status <> 'merged'
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'CAPITAL_ENTITY_NOT_FOUND';
  end if;

  v_attributes := jsonb_build_object(
    'official_profile_status', v_status,
    'official_profile_checked_at', now(),
    'official_profile_confidence', v_confidence,
    'profile_source_url', v_source_url,
    'stated_thesis_summary', left(coalesce(p_profile ->> 'stated_thesis_summary', ''), 4000),
    'typical_check_size', left(coalesce(p_profile ->> 'typical_check_size', ''), 500),
    'investment_sectors', coalesce(p_profile -> 'sectors', '[]'::jsonb),
    'investment_stages', coalesce(p_profile -> 'stages', '[]'::jsonb),
    'investment_geographies', coalesce(p_profile -> 'geographies', '[]'::jsonb),
    'portfolio_company_names', coalesce(p_profile -> 'portfolio_company_names', '[]'::jsonb),
    'official_profile_evidence_quotes', coalesce(p_profile -> 'evidence_quotes', '[]'::jsonb)
  );

  update public.entities
  set
    canonical_url = case when v_status = 'verified' then v_official_url else canonical_url end,
    attributes = attributes || v_attributes,
    resolution_status = case when v_status = 'verified' then 'resolved' else resolution_status end,
    updated_at = now()
  where id = v_entity_id
  returning * into v_entity;

  return jsonb_build_object(
    'entity_id', v_entity.id,
    'name', v_entity.name,
    'official_profile_status', v_status,
    'official_website_url', v_entity.canonical_url,
    'activity_status_changed', false,
    'workflow_context', coalesce(p_profile -> '_workflow_context', '{}'::jsonb)
  );
end;
$$;

create or replace view public.v_capital_profile_verification_queue
with (security_invoker = true)
as
select
  directory.*,
  coalesce(entity.attributes ->> 'official_profile_status', 'unverified') as official_profile_status,
  nullif(entity.attributes ->> 'official_profile_checked_at', '')::timestamptz as official_profile_checked_at,
  nullif(entity.attributes ->> 'official_profile_confidence', '')::numeric as official_profile_confidence,
  entity.attributes ->> 'profile_source_url' as profile_source_url,
  entity.attributes ->> 'stated_thesis_summary' as stated_thesis_summary,
  entity.attributes -> 'investment_sectors' as investment_sectors,
  entity.attributes -> 'investment_stages' as investment_stages,
  entity.attributes -> 'investment_geographies' as investment_geographies,
  entity.attributes -> 'portfolio_company_names' as portfolio_company_names
from public.v_capital_directory directory
join public.entities entity
  on entity.id = directory.entity_id
 and entity.workspace_id = directory.workspace_id;

revoke all on function public.n8n_list_capital_profile_candidates(uuid, integer) from public, anon, authenticated;
revoke all on function public.n8n_update_capital_official_profile(jsonb) from public, anon, authenticated;
grant execute on function public.n8n_list_capital_profile_candidates(uuid, integer) to service_role;
grant execute on function public.n8n_update_capital_official_profile(jsonb) to service_role;
grant select on public.v_capital_profile_verification_queue to authenticated;

commit;
