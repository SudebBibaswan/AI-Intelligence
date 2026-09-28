begin;

-- Additive service-only helpers for the research maintenance workflows.
-- No UI-facing table, view, or existing RPC contract is changed.

create or replace function public.n8n_list_evidence_backfill_sources(
  p_workspace_id uuid,
  p_limit integer default 25
)
returns table (
  source_id uuid,
  workspace_id uuid,
  canonical_url text,
  title text,
  source_type text,
  content_storage_path text,
  content_hash text,
  evidence_status text
)
language sql
security definer
set search_path = ''
as $$
  select
    s.id,
    s.workspace_id,
    s.canonical_url,
    s.title,
    s.source_type,
    s.content_storage_path,
    s.content_hash,
    s.evidence_status
  from public.sources s
  where s.workspace_id = p_workspace_id
    and s.deleted_at is null
    and s.content_storage_path is not null
    and s.extraction_status in ('success', 'partial')
    and s.evidence_status in ('pending', 'rejected')
  order by s.updated_at asc, s.id
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

create or replace function public.n8n_upsert_research_entity(p_entity jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (p_entity ->> 'workspace_id')::uuid;
  v_entity_type text := lower(btrim(p_entity ->> 'entity_type'));
  v_name text := btrim(p_entity ->> 'name');
  v_normalized_name text := lower(regexp_replace(v_name, '[^a-z0-9]+', ' ', 'gi'));
  v_entity public.entities%rowtype;
begin
  if v_entity_type not in ('company', 'investor', 'fund', 'accelerator', 'person', 'product', 'technology', 'regulator', 'market')
    or length(v_name) = 0 then
    raise exception using errcode = '22023', message = 'INVALID_RESEARCH_ENTITY';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_workspace_id::text || ':' || v_entity_type || ':' || v_normalized_name, 0));

  select * into v_entity
  from public.entities
  where workspace_id = v_workspace_id
    and entity_type = v_entity_type
    and normalized_name = v_normalized_name
    and resolution_status <> 'merged'
  order by case resolution_status when 'resolved' then 0 else 1 end, created_at
  limit 1;

  if found then
    update public.entities
    set
      canonical_url = coalesce(nullif(p_entity ->> 'canonical_url', ''), canonical_url),
      external_ids = external_ids || coalesce(p_entity -> 'external_ids', '{}'::jsonb),
      attributes = attributes || coalesce(p_entity -> 'attributes', '{}'::jsonb)
    where id = v_entity.id
    returning * into v_entity;
  else
    insert into public.entities (
      workspace_id, entity_type, name, normalized_name, canonical_url, external_ids, attributes
    ) values (
      v_workspace_id,
      v_entity_type,
      v_name,
      v_normalized_name,
      nullif(p_entity ->> 'canonical_url', ''),
      coalesce(p_entity -> 'external_ids', '{}'::jsonb),
      coalesce(p_entity -> 'attributes', '{}'::jsonb)
    ) returning * into v_entity;
  end if;

  if nullif(p_entity ->> 'evidence_id', '') is not null then
    insert into public.evidence_entities (workspace_id, evidence_id, entity_id, role, confidence)
    values (
      v_workspace_id,
      (p_entity ->> 'evidence_id')::uuid,
      v_entity.id,
      coalesce(nullif(p_entity ->> 'role', ''), 'mentioned'),
      least(1, greatest(0, coalesce((p_entity ->> 'confidence')::numeric, 0.7)))
    ) on conflict (evidence_id, entity_id, role) do update
      set confidence = greatest(public.evidence_entities.confidence, excluded.confidence);
  end if;

  return jsonb_build_object('entity_id', v_entity.id, 'entity_type', v_entity.entity_type, 'normalized_name', v_entity.normalized_name);
end;
$$;

create or replace function public.n8n_upsert_research_relationship(p_relationship jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid := (p_relationship ->> 'workspace_id')::uuid;
  v_from uuid := (p_relationship ->> 'from_entity_id')::uuid;
  v_to uuid := (p_relationship ->> 'to_entity_id')::uuid;
  v_type text := p_relationship ->> 'relationship_type';
  v_relationship public.relationships%rowtype;
begin
  if v_from = v_to or v_type not in ('invested_in', 'founded', 'employed_by', 'partnered_with', 'acquired', 'competes_with', 'uses_technology', 'other') then
    raise exception using errcode = '22023', message = 'INVALID_RESEARCH_RELATIONSHIP';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_workspace_id::text || ':' || v_from::text || ':' || v_type || ':' || v_to::text, 0));
  select * into v_relationship from public.relationships
  where workspace_id = v_workspace_id and from_entity_id = v_from and to_entity_id = v_to and relationship_type = v_type
  order by created_at limit 1;

  if found then
    update public.relationships
    set confidence = greatest(confidence, coalesce((p_relationship ->> 'confidence')::numeric, 0.7)),
        attributes = attributes || coalesce(p_relationship -> 'attributes', '{}'::jsonb),
        valid_from = coalesce(valid_from, nullif(p_relationship ->> 'valid_from', '')::date)
    where id = v_relationship.id returning * into v_relationship;
  else
    insert into public.relationships (
      workspace_id, from_entity_id, to_entity_id, relationship_type, valid_from, confidence, attributes
    ) values (
      v_workspace_id, v_from, v_to, v_type,
      nullif(p_relationship ->> 'valid_from', '')::date,
      least(1, greatest(0, coalesce((p_relationship ->> 'confidence')::numeric, 0.7))),
      coalesce(p_relationship -> 'attributes', '{}'::jsonb)
    ) returning * into v_relationship;
  end if;

  if nullif(p_relationship ->> 'evidence_id', '') is not null then
    insert into public.relationship_evidence (workspace_id, relationship_id, evidence_id, polarity)
    values (v_workspace_id, v_relationship.id, (p_relationship ->> 'evidence_id')::uuid, 'supports')
    on conflict (relationship_id, evidence_id) do nothing;
  end if;

  return jsonb_build_object('relationship_id', v_relationship.id, 'relationship_type', v_relationship.relationship_type);
end;
$$;

create or replace function public.n8n_upsert_research_graph(p_graph jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity jsonb;
  v_relation jsonb;
  v_from jsonb;
  v_to jsonb;
  v_entities integer := 0;
  v_relationships integer := 0;
begin
  if jsonb_typeof(coalesce(p_graph -> 'entities', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_graph -> 'relationships', '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_RESEARCH_GRAPH';
  end if;

  for v_entity in select value from jsonb_array_elements(coalesce(p_graph -> 'entities', '[]'::jsonb)) loop
    perform public.n8n_upsert_research_entity(
      v_entity || jsonb_build_object('workspace_id', p_graph ->> 'workspace_id', 'evidence_id', p_graph ->> 'evidence_id')
    );
    v_entities := v_entities + 1;
  end loop;

  for v_relation in select value from jsonb_array_elements(coalesce(p_graph -> 'relationships', '[]'::jsonb)) loop
    v_from := public.n8n_upsert_research_entity(
      (v_relation -> 'from_entity') || jsonb_build_object('workspace_id', p_graph ->> 'workspace_id', 'evidence_id', p_graph ->> 'evidence_id')
    );
    v_to := public.n8n_upsert_research_entity(
      (v_relation -> 'to_entity') || jsonb_build_object('workspace_id', p_graph ->> 'workspace_id', 'evidence_id', p_graph ->> 'evidence_id')
    );
    perform public.n8n_upsert_research_relationship(
      (v_relation - 'from_entity' - 'to_entity') || jsonb_build_object(
        'workspace_id', p_graph ->> 'workspace_id',
        'evidence_id', p_graph ->> 'evidence_id',
        'from_entity_id', v_from ->> 'entity_id',
        'to_entity_id', v_to ->> 'entity_id'
      )
    );
    v_relationships := v_relationships + 1;
  end loop;

  return jsonb_build_object('entities_upserted', v_entities, 'relationships_upserted', v_relationships);
end;
$$;

revoke all on function public.n8n_list_evidence_backfill_sources(uuid, integer) from public, anon, authenticated;
revoke all on function public.n8n_upsert_research_entity(jsonb) from public, anon, authenticated;
revoke all on function public.n8n_upsert_research_relationship(jsonb) from public, anon, authenticated;
revoke all on function public.n8n_upsert_research_graph(jsonb) from public, anon, authenticated;
grant execute on function public.n8n_list_evidence_backfill_sources(uuid, integer) to service_role;
grant execute on function public.n8n_upsert_research_entity(jsonb) to service_role;
grant execute on function public.n8n_upsert_research_relationship(jsonb) to service_role;
grant execute on function public.n8n_upsert_research_graph(jsonb) to service_role;

commit;
