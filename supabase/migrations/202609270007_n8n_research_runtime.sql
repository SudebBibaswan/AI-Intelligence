begin;

create or replace function public.n8n_claim_research_run(
  p_research_run_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_run public.research_runs%rowtype;
  configured_domain public.workspace_domains%rowtype;
  domain_definition public.domains%rowtype;
begin
  update public.research_runs
  set
    status = 'discovering',
    started_at = coalesce(started_at, now())
  where id = p_research_run_id
    and request_id = p_request_id
    and status = 'queued'
  returning * into claimed_run;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'RUN_NOT_CLAIMABLE';
  end if;

  select * into configured_domain
  from public.workspace_domains
  where id = claimed_run.workspace_domain_id
    and workspace_id = claimed_run.workspace_id;

  select * into domain_definition
  from public.domains
  where id = configured_domain.domain_id
    and is_active = true;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'DOMAIN_CONFIGURATION_NOT_AVAILABLE';
  end if;

  return jsonb_build_object(
    'research_run', to_jsonb(claimed_run),
    'workspace_domain', to_jsonb(configured_domain),
    'domain', to_jsonb(domain_definition)
  );
end;
$$;

create or replace function public.n8n_set_research_run_status(
  p_research_run_id uuid,
  p_request_id uuid,
  p_status text,
  p_metrics_patch jsonb default '{}'::jsonb,
  p_error_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  updated_run public.research_runs%rowtype;
begin
  if p_status not in ('discovering', 'extracting', 'verifying', 'analyzing', 'partial', 'completed', 'failed') then
    raise exception using errcode = '22023', message = 'INVALID_RESEARCH_RUN_STATUS';
  end if;

  if jsonb_typeof(p_metrics_patch) <> 'object' or jsonb_typeof(p_error_patch) <> 'object' then
    raise exception using errcode = '22023', message = 'RUN_PATCHES_MUST_BE_JSON_OBJECTS';
  end if;

  select status into current_status
  from public.research_runs
  where id = p_research_run_id
    and request_id = p_request_id
  for update;

  if not found or current_status in ('partial', 'completed', 'failed', 'cancelled', 'queued') then
    raise exception using errcode = 'P0001', message = 'RUN_STATUS_NOT_MUTABLE';
  end if;

  if (current_status = 'extracting' and p_status = 'discovering')
    or (current_status = 'verifying' and p_status in ('discovering', 'extracting'))
    or (current_status = 'analyzing' and p_status in ('discovering', 'extracting', 'verifying')) then
    raise exception using errcode = 'P0001', message = 'RUN_STATUS_CANNOT_MOVE_BACKWARD';
  end if;

  update public.research_runs
  set
    status = p_status,
    metrics = metrics || p_metrics_patch,
    error_summary = error_summary || p_error_patch,
    completed_at = case
      when p_status in ('partial', 'completed', 'failed') then now()
      else completed_at
    end
  where id = p_research_run_id
    and request_id = p_request_id
  returning * into updated_run;

  return to_jsonb(updated_run);
end;
$$;

create or replace function public.n8n_record_research_source(
  p_source jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record public.research_runs%rowtype;
  source_record public.sources%rowtype;
  inserted_source_id uuid;
  normalized_decision text;
  match_type text := 'new';
  supplied_hash text := nullif(p_source #>> '{content,content_hash}', '');
  supplied_source_id uuid;
begin
  if coalesce(p_source ->> 'schema_version', '') <> '1.0.0' then
    raise exception using errcode = '22023', message = 'UNSUPPORTED_RESEARCH_SOURCE_SCHEMA';
  end if;

  select * into run_record
  from public.research_runs
  where id = (p_source ->> 'collection_run_id')::uuid
    and workspace_id = (p_source ->> 'workspace_id')::uuid
    and workspace_domain_id = (p_source ->> 'workspace_domain_id')::uuid
    and status in ('discovering', 'extracting', 'verifying', 'analyzing');

  if not found then
    raise exception using errcode = 'P0001', message = 'ACTIVE_RESEARCH_RUN_NOT_FOUND';
  end if;

  normalized_decision := p_source #>> '{classification,decision}';
  if normalized_decision not in ('accepted', 'rejected', 'duplicate', 'needs_review') then
    raise exception using errcode = '22023', message = 'INVALID_SOURCE_DECISION';
  end if;

  if coalesce(run_record.config_snapshot ->> 'automation_mode', 'review_only') <> 'automatic'
    and normalized_decision = 'accepted' then
    normalized_decision := 'needs_review';
  end if;

  select * into source_record
  from public.sources
  where workspace_id = run_record.workspace_id
    and canonical_url = p_source #>> '{identity,canonical_url}'
    and deleted_at is null;

  if found then
    match_type := 'canonical_url';
  elsif supplied_hash is not null then
    select * into source_record
    from public.sources
    where workspace_id = run_record.workspace_id
      and content_hash = supplied_hash
      and deleted_at is null;

    if found then
      match_type := 'content_hash';
      normalized_decision := 'duplicate';
    end if;
  end if;

  if source_record.id is null then
    supplied_source_id := coalesce(nullif(p_source ->> 'source_id', '')::uuid, gen_random_uuid());

    insert into public.sources (
      id,
      workspace_id,
      canonical_url,
      original_url,
      title,
      source_type,
      publisher,
      author,
      published_at,
      first_discovered_at,
      last_discovered_at,
      content_hash,
      content_storage_path,
      storage_class,
      content_expires_at,
      language,
      source_quality_score,
      extraction_status,
      evidence_status,
      metadata
    )
    values (
      supplied_source_id,
      run_record.workspace_id,
      p_source #>> '{identity,canonical_url}',
      p_source #>> '{identity,original_url}',
      p_source #>> '{identity,title}',
      p_source ->> 'source_type',
      nullif(p_source #>> '{identity,publisher}', ''),
      nullif(p_source #>> '{identity,author}', ''),
      nullif(p_source #>> '{identity,published_at}', '')::timestamptz,
      (p_source #>> '{discovery,discovered_at}')::timestamptz,
      (p_source #>> '{discovery,discovered_at}')::timestamptz,
      supplied_hash,
      nullif(p_source #>> '{metadata,content_storage_path}', ''),
      coalesce(nullif(p_source #>> '{metadata,storage_class}', ''), 'S0'),
      nullif(p_source #>> '{metadata,content_expires_at}', '')::timestamptz,
      nullif(p_source #>> '{identity,language}', ''),
      nullif(p_source #>> '{classification,source_quality_score}', '')::numeric,
      p_source #>> '{content,status}',
      'pending',
      jsonb_build_object(
        'schema_version', p_source ->> 'schema_version',
        'classification', p_source -> 'classification',
        'verification', p_source -> 'verification',
        'provider_metadata', coalesce(p_source -> 'metadata' -> 'provider', '{}'::jsonb)
      )
    )
    on conflict do nothing
    returning id into inserted_source_id;

    if inserted_source_id is null then
      select * into source_record
      from public.sources
      where workspace_id = run_record.workspace_id
        and deleted_at is null
        and (
          canonical_url = p_source #>> '{identity,canonical_url}'
          or (supplied_hash is not null and content_hash = supplied_hash)
        )
      order by case when canonical_url = p_source #>> '{identity,canonical_url}' then 0 else 1 end
      limit 1;

      if not found then
        raise exception using errcode = 'P0001', message = 'SOURCE_UPSERT_CONFLICT_UNRESOLVED';
      end if;

      match_type := case
        when source_record.canonical_url = p_source #>> '{identity,canonical_url}' then 'canonical_url'
        else 'content_hash'
      end;
      normalized_decision := 'duplicate';
    else
      select * into source_record from public.sources where id = inserted_source_id;
    end if;
  else
    update public.sources
    set last_discovered_at = greatest(last_discovered_at, (p_source #>> '{discovery,discovered_at}')::timestamptz)
    where id = source_record.id
    returning * into source_record;

    if match_type <> 'new' then
      normalized_decision := 'duplicate';
    end if;
  end if;

  insert into public.research_run_sources (
    workspace_id,
    research_run_id,
    source_id,
    discovery_source,
    query,
    rank,
    relevance_score,
    decision,
    decision_reasons,
    discovered_at
  )
  values (
    run_record.workspace_id,
    run_record.id,
    source_record.id,
    p_source #>> '{discovery,channel}',
    nullif(p_source #>> '{discovery,query}', ''),
    nullif(p_source #>> '{discovery,result_rank}', '')::integer,
    nullif(p_source #>> '{classification,relevance_score}', '')::numeric,
    normalized_decision,
    array(select jsonb_array_elements_text(p_source #> '{classification,reason_codes}')),
    (p_source #>> '{discovery,discovered_at}')::timestamptz
  )
  on conflict (research_run_id, source_id) do update
  set
    relevance_score = excluded.relevance_score,
    decision = excluded.decision,
    decision_reasons = excluded.decision_reasons,
    discovered_at = least(public.research_run_sources.discovered_at, excluded.discovered_at);

  return jsonb_build_object(
    'source_id', source_record.id,
    'workspace_id', source_record.workspace_id,
    'research_run_id', run_record.id,
    'decision', normalized_decision,
    'match_type', match_type,
    'is_new', match_type = 'new'
  );
end;
$$;

create unique index evidence_replay_guard_uidx
  on public.evidence (
    workspace_id,
    source_id,
    extractor_version,
    (encode(extensions.digest(claim_text || E'\n' || excerpt, 'sha256'), 'hex'))
  );

create or replace function public.n8n_record_research_evidence(
  p_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_record public.research_runs%rowtype;
  source_record public.sources%rowtype;
  inserted_evidence_id uuid;
  evidence_record public.evidence%rowtype;
  normalized_verification text;
  supplied_evidence_id uuid;
begin
  select * into run_record
  from public.research_runs
  where id = (p_evidence ->> 'research_run_id')::uuid
    and workspace_id = (p_evidence ->> 'workspace_id')::uuid
    and status in ('discovering', 'extracting', 'verifying', 'analyzing');

  if not found then
    raise exception using errcode = 'P0001', message = 'ACTIVE_RESEARCH_RUN_NOT_FOUND';
  end if;

  select * into source_record
  from public.sources
  where id = (p_evidence ->> 'source_id')::uuid
    and workspace_id = run_record.workspace_id
    and deleted_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'SOURCE_NOT_FOUND_IN_RUN_WORKSPACE';
  end if;

  if coalesce(p_evidence ->> 'evidence_type', '') not in ('fact', 'quote', 'metric', 'event', 'claim', 'counter_claim')
    or length(btrim(coalesce(p_evidence ->> 'claim_text', ''))) = 0
    or length(btrim(coalesce(p_evidence ->> 'excerpt', ''))) = 0 then
    raise exception using errcode = '22023', message = 'INVALID_EVIDENCE_PAYLOAD';
  end if;

  normalized_verification := coalesce(p_evidence ->> 'verification_status', 'unverified');
  if normalized_verification not in ('unverified', 'verified', 'disputed', 'rejected') then
    raise exception using errcode = '22023', message = 'INVALID_EVIDENCE_VERIFICATION';
  end if;

  if coalesce(run_record.config_snapshot ->> 'automation_mode', 'review_only') <> 'automatic'
    and normalized_verification = 'verified' then
    normalized_verification := 'unverified';
  end if;

  supplied_evidence_id := coalesce(nullif(p_evidence ->> 'id', '')::uuid, gen_random_uuid());

  insert into public.evidence (
    id,
    workspace_id,
    source_id,
    research_run_id,
    evidence_type,
    claim_text,
    excerpt,
    locator,
    polarity,
    confidence,
    verification_status,
    extractor_version,
    metadata
  )
  values (
    supplied_evidence_id,
    run_record.workspace_id,
    source_record.id,
    run_record.id,
    p_evidence ->> 'evidence_type',
    p_evidence ->> 'claim_text',
    p_evidence ->> 'excerpt',
    coalesce(p_evidence -> 'locator', '{}'::jsonb),
    coalesce(nullif(p_evidence ->> 'polarity', ''), 'neutral'),
    (p_evidence ->> 'confidence')::numeric,
    normalized_verification,
    p_evidence ->> 'extractor_version',
    coalesce(p_evidence -> 'metadata', '{}'::jsonb)
  )
  on conflict do nothing
  returning id into inserted_evidence_id;

  if inserted_evidence_id is null then
    select * into evidence_record
    from public.evidence
    where workspace_id = run_record.workspace_id
      and source_id = source_record.id
      and extractor_version = p_evidence ->> 'extractor_version'
      and encode(extensions.digest(claim_text || E'\n' || excerpt, 'sha256'), 'hex') =
        encode(extensions.digest((p_evidence ->> 'claim_text') || E'\n' || (p_evidence ->> 'excerpt'), 'sha256'), 'hex')
    limit 1;
  else
    select * into evidence_record
    from public.evidence
    where id = inserted_evidence_id;
  end if;

  update public.sources
  set evidence_status = case
    when normalized_verification = 'verified' then 'accepted'
    when normalized_verification = 'rejected' then 'rejected'
    else 'needs_review'
  end
  where id = source_record.id;

  return jsonb_build_object(
    'evidence_id', evidence_record.id,
    'source_id', source_record.id,
    'research_run_id', run_record.id,
    'verification_status', evidence_record.verification_status,
    'is_new', inserted_evidence_id is not null
  );
end;
$$;

revoke all on function public.n8n_claim_research_run(uuid, uuid) from public, anon, authenticated;
revoke all on function public.n8n_set_research_run_status(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.n8n_record_research_source(jsonb) from public, anon, authenticated;
revoke all on function public.n8n_record_research_evidence(jsonb) from public, anon, authenticated;

grant execute on function public.n8n_claim_research_run(uuid, uuid) to service_role;
grant execute on function public.n8n_set_research_run_status(uuid, uuid, text, jsonb, jsonb) to service_role;
grant execute on function public.n8n_record_research_source(jsonb) to service_role;
grant execute on function public.n8n_record_research_evidence(jsonb) to service_role;

commit;
