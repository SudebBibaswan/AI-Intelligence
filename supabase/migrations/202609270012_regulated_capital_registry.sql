begin;

-- Preserve regulator-issued identifiers without conflating registration with
-- evidence of recent investment activity.

create or replace function public.n8n_upsert_regulated_capital_entity(p_entity jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_number text := upper(btrim(p_entity ->> 'registration_number'));
  v_payload jsonb;
  v_result jsonb;
  v_entity_id uuid;
begin
  if v_registration_number !~ '^IN/(VCF|VC)/[0-9]{2}-[0-9]{2}/[0-9]+$' then
    raise exception using errcode = '22023', message = 'INVALID_SEBI_VCF_REGISTRATION_NUMBER';
  end if;

  v_payload := (p_entity - 'registration_number') || jsonb_build_object(
    'entity_type', 'fund',
    'external_ids', coalesce(p_entity -> 'external_ids', '{}'::jsonb)
      || jsonb_build_object('sebi_registration_no', v_registration_number),
    'attributes', coalesce(p_entity -> 'attributes', '{}'::jsonb)
      || jsonb_build_object(
        'registry_source', 'sebi',
        'regulatory_status', 'registered',
        'activity_verification_status', 'unverified'
      )
  );

  v_result := public.n8n_upsert_research_entity(v_payload);
  v_entity_id := (v_result ->> 'entity_id')::uuid;

  update public.entities entity
  set
    resolution_status = 'resolved',
    external_ids = jsonb_set(
      entity.external_ids,
      '{sebi_registration_numbers}',
      (
        select coalesce(jsonb_agg(registration_number order by registration_number), '[]'::jsonb)
        from (
          select distinct existing.value as registration_number
          from jsonb_array_elements_text(
            coalesce(entity.external_ids -> 'sebi_registration_numbers', '[]'::jsonb)
          ) existing
          union
          select v_registration_number
        ) registrations
      ),
      true
    )
  where entity.id = v_entity_id;

  return v_result || jsonb_build_object(
    'registration_number', v_registration_number,
    'regulatory_status', 'registered',
    'activity_verification_status', 'unverified'
  );
end;
$$;

create or replace view public.v_regulated_capital_funds
with (security_invoker = true)
as
select
  entity.id as entity_id,
  entity.workspace_id,
  entity.name,
  entity.canonical_url,
  entity.resolution_status,
  entity.external_ids -> 'sebi_registration_numbers' as sebi_registration_numbers,
  entity.attributes ->> 'regulatory_status' as regulatory_status,
  entity.attributes ->> 'activity_verification_status' as activity_verification_status,
  entity.attributes ->> 'registry_country' as registry_country,
  entity.attributes ->> 'registry_validity' as registry_validity,
  entity.attributes ->> 'registry_address' as registry_address,
  directory.activity_status,
  directory.evidence_count,
  directory.capital_relationship_count,
  directory.last_capital_activity_at,
  entity.created_at,
  entity.updated_at
from public.entities entity
left join public.v_capital_directory directory
  on directory.entity_id = entity.id
 and directory.workspace_id = entity.workspace_id
where entity.entity_type = 'fund'
  and entity.attributes ->> 'registry_source' = 'sebi'
  and entity.resolution_status <> 'merged';

revoke all on function public.n8n_upsert_regulated_capital_entity(jsonb) from public, anon, authenticated;
grant execute on function public.n8n_upsert_regulated_capital_entity(jsonb) to service_role;
grant select on public.v_regulated_capital_funds to authenticated;

commit;
