begin;

alter table public.workspaces
  drop constraint if exists workspaces_workspace_type_check;

alter table public.workspaces
  add constraint workspaces_workspace_type_check
  check (workspace_type in ('personal', 'team', 'service'));

do $$
begin
  if exists (
    select 1 from public.domains where key = 'artificial-intelligence'
  ) and not exists (
    select 1 from public.domains where key = 'core-ai-it-infrastructure'
  ) then
    update public.domains
    set
      key = 'core-ai-it-infrastructure',
      name = 'Core AI Technology, IT, and Infrastructure',
      updated_at = now()
    where key = 'artificial-intelligence';
  elsif exists (
    select 1 from public.domains where key = 'artificial-intelligence'
  ) then
    update public.domains
    set is_active = false, updated_at = now()
    where key = 'artificial-intelligence';
  end if;
end $$;

with domain_seed(key, name, description, topics, query_focus) as (
  values
    (
      'cybersecurity',
      'Cybersecurity',
      'Cybersecurity companies, products, threats, regulation, adoption, funding, acquisitions, and investor activity.',
      array['identity-and-access', 'cloud-security', 'application-security', 'data-security', 'security-operations', 'threat-intelligence', 'governance-risk-compliance', 'funding-and-ma']::text[],
      array['product launches and technical releases', 'funding rounds acquisitions and investor activity', 'material threats incidents regulation and enterprise adoption']::text[]
    ),
    (
      'banking-financial-services',
      'Banking and Financial Services',
      'Banking, payments, lending, insurance, capital markets, financial infrastructure, regulation, and investment intelligence.',
      array['banking-infrastructure', 'payments', 'lending', 'insurance', 'capital-markets', 'risk-and-compliance', 'financial-ai', 'funding-and-ma']::text[],
      array['financial product and infrastructure launches', 'funding rounds acquisitions and investor activity', 'regulation risk adoption and operating-model changes']::text[]
    ),
    (
      'ai-manufacturing-operations',
      'AI in Manufacturing and Operations',
      'AI adoption across industrial production, supply chains, robotics, maintenance, quality, logistics, and enterprise operations.',
      array['industrial-ai', 'robotics', 'predictive-maintenance', 'quality-control', 'supply-chain', 'logistics', 'operations-software', 'funding-and-ma']::text[],
      array['industrial AI deployments products and partnerships', 'funding rounds acquisitions and investor activity', 'measured operating outcomes workforce changes and adoption barriers']::text[]
    ),
    (
      'healthcare',
      'Healthcare',
      'Healthcare delivery, biotechnology, medical technology, digital health, clinical AI, regulation, and investment intelligence.',
      array['care-delivery', 'clinical-ai', 'biotechnology', 'medical-devices', 'digital-health', 'health-infrastructure', 'regulation', 'funding-and-ma']::text[],
      array['clinical product research and regulatory milestones', 'funding rounds acquisitions and investor activity', 'health-system adoption outcomes safety and reimbursement']::text[]
    ),
    (
      'core-ai-it-infrastructure',
      'Core AI Technology, IT, and Infrastructure',
      'AI models, agents, developer platforms, compute, chips, data infrastructure, cloud systems, safety, regulation, and capital flows.',
      array['models', 'agents', 'developer-platforms', 'compute-and-chips', 'data-infrastructure', 'cloud-and-it', 'safety-and-regulation', 'funding-and-ma']::text[],
      array['model agent product and infrastructure releases', 'funding rounds acquisitions and investor activity', 'compute economics safety regulation and enterprise adoption']::text[]
    ),
    (
      'agriculture',
      'Agriculture',
      'Agricultural technology, farm operations, inputs, climate resilience, food systems, supply chains, and investment intelligence.',
      array['precision-agriculture', 'farm-automation', 'inputs-and-biologicals', 'climate-resilience', 'food-systems', 'agri-supply-chain', 'market-access', 'funding-and-ma']::text[],
      array['agricultural product deployments research and partnerships', 'funding rounds acquisitions and investor activity', 'farm economics regulation climate resilience and adoption outcomes']::text[]
    ),
    (
      'retail-ecommerce',
      'Retail and E-commerce',
      'Retail technology, commerce infrastructure, marketplaces, logistics, consumer behavior, merchandising, and investment intelligence.',
      array['commerce-infrastructure', 'marketplaces', 'retail-ai', 'merchandising', 'customer-experience', 'fulfillment-and-logistics', 'payments-and-fraud', 'funding-and-ma']::text[],
      array['retail and commerce product launches partnerships and adoption', 'funding rounds acquisitions and investor activity', 'consumer demand unit economics logistics and regulatory changes']::text[]
    )
)
insert into public.domains (
  key,
  name,
  description,
  default_config,
  config_version,
  is_active
)
select
  key,
  name,
  description,
  jsonb_build_object(
    'profile_version', '1.0.0',
    'topics', to_jsonb(topics),
    'query_focus', to_jsonb(query_focus),
    'geographies', jsonb_build_array('global', 'india'),
    'entity_types', jsonb_build_array(
      'organization', 'person', 'fund', 'accelerator', 'company', 'product',
      'technology', 'market', 'geography', 'regulator'
    ),
    'capital_flow_lens', jsonb_build_object(
      'enabled', true,
      'event_types', jsonb_build_array(
        'funding_round', 'acquisition', 'strategic_investment',
        'fund_launch', 'portfolio_change', 'accelerator_batch'
      )
    )
  ),
  1,
  true
from domain_seed
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  default_config = excluded.default_config,
  config_version = excluded.config_version,
  is_active = true,
  updated_at = now();

create table public.domain_collection_schedules (
  domain_id uuid primary key references public.domains(id),
  collector_workspace_id uuid,
  collector_workspace_domain_id uuid,
  slot_hours_utc smallint[] not null default array[0, 12]::smallint[],
  profile_version text not null default '1.0.0'
    check (length(btrim(profile_version)) > 0),
  engine_version text not null default 'research-engine-v1.0.0'
    check (length(btrim(engine_version)) > 0),
  schedule_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(schedule_config) = 'object'),
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint domain_collection_schedules_two_slots_check
    check (
      cardinality(slot_hours_utc) = 2
      and slot_hours_utc[1] between 0 and 23
      and slot_hours_utc[2] between 0 and 23
      and slot_hours_utc[1] <> slot_hours_utc[2]
    ),
  constraint domain_collection_schedules_collector_pair_check
    check (
      (collector_workspace_id is null and collector_workspace_domain_id is null)
      or (collector_workspace_id is not null and collector_workspace_domain_id is not null)
    ),
  foreign key (collector_workspace_domain_id, collector_workspace_id)
    references public.workspace_domains(id, workspace_id)
);

create trigger domain_collection_schedules_set_updated_at
before update on public.domain_collection_schedules
for each row execute function public.set_updated_at();

alter table public.domain_collection_schedules enable row level security;
alter table public.domain_collection_schedules force row level security;

revoke all on table public.domain_collection_schedules from public, anon, authenticated;
grant select, insert, update, delete on table public.domain_collection_schedules to service_role;

insert into public.domain_collection_schedules (domain_id)
select id
from public.domains
where key in (
  'cybersecurity',
  'banking-financial-services',
  'ai-manufacturing-operations',
  'healthcare',
  'core-ai-it-infrastructure',
  'agriculture',
  'retail-ecommerce'
)
on conflict (domain_id) do nothing;

create or replace function public.n8n_bootstrap_shared_research_workspace(
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  service_workspace_id uuid;
  domain_record record;
  collector_domain_id uuid;
  configured_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles where user_id = p_operator_user_id
  ) then
    raise exception using errcode = '22023', message = 'OPERATOR_PROFILE_NOT_FOUND';
  end if;

  select id into service_workspace_id
  from public.workspaces
  where slug = 'system-shared-research';

  if service_workspace_id is null then
    insert into public.workspaces (
      name,
      slug,
      workspace_type,
      created_by,
      settings
    ) values (
      'System Shared Research',
      'system-shared-research',
      'service',
      p_operator_user_id,
      jsonb_build_object('internal', true, 'purpose', 'shared-domain-research')
    )
    returning id into service_workspace_id;
  elsif not exists (
    select 1 from public.workspaces
    where id = service_workspace_id and workspace_type = 'service'
  ) then
    raise exception using errcode = '23505', message = 'SYSTEM_RESEARCH_SLUG_ALREADY_IN_USE';
  end if;

  for domain_record in
    select id, key, name
    from public.domains
    where is_active
      and key in (
        'cybersecurity',
        'banking-financial-services',
        'ai-manufacturing-operations',
        'healthcare',
        'core-ai-it-infrastructure',
        'agriculture',
        'retail-ecommerce'
      )
    order by key
  loop
    select id into collector_domain_id
    from public.workspace_domains
    where workspace_id = service_workspace_id
      and domain_id = domain_record.id
      and status <> 'archived'
    order by created_at
    limit 1;

    if collector_domain_id is null then
      insert into public.workspace_domains (
        workspace_id,
        domain_id,
        name,
        topics,
        geographies,
        entity_types,
        source_config,
        collection_frequency,
        status,
        created_by
      ) values (
        service_workspace_id,
        domain_record.id,
        'Shared ' || domain_record.name || ' Collector',
        '{}',
        '{}',
        '{}',
        jsonb_build_object('shared_collector', true),
        'daily',
        'draft',
        p_operator_user_id
      )
      returning id into collector_domain_id;
    end if;

    update public.domain_collection_schedules
    set
      collector_workspace_id = service_workspace_id,
      collector_workspace_domain_id = collector_domain_id,
      is_enabled = true,
      updated_at = now()
    where domain_id = domain_record.id;

    configured_count := configured_count + 1;
    collector_domain_id := null;
  end loop;

  return jsonb_build_object(
    'workspace_id', service_workspace_id,
    'configured_domains', configured_count,
    'slot_hours_utc', jsonb_build_array(0, 12),
    'status', 'ready'
  );
end;
$$;

create or replace function public.n8n_schedule_domain_collection_runs(
  p_slot_start timestamptz default now()
)
returns setof jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_slot timestamptz := date_trunc('hour', coalesce(p_slot_start, now()));
  schedule_record record;
  run_id uuid;
  run_request_id uuid;
  run_created boolean;
  run_key text;
begin
  for schedule_record in
    select
      schedule.domain_id,
      domain_definition.key as domain_key,
      schedule.collector_workspace_id,
      schedule.collector_workspace_domain_id,
      schedule.profile_version,
      schedule.engine_version,
      schedule.schedule_config,
      count(distinct subscriber.workspace_id) as subscriber_count
    from public.domain_collection_schedules schedule
    join public.domains domain_definition
      on domain_definition.id = schedule.domain_id
      and domain_definition.is_active
    join public.workspace_domains subscriber
      on subscriber.domain_id = schedule.domain_id
      and subscriber.status = 'active'
      and subscriber.workspace_id <> schedule.collector_workspace_id
    join public.workspaces subscriber_workspace
      on subscriber_workspace.id = subscriber.workspace_id
      and subscriber_workspace.workspace_type <> 'service'
      and subscriber_workspace.deleted_at is null
    where schedule.is_enabled
      and schedule.collector_workspace_id is not null
      and extract(hour from normalized_slot at time zone 'UTC')::smallint = any(schedule.slot_hours_utc)
    group by
      schedule.domain_id,
      domain_definition.key,
      schedule.collector_workspace_id,
      schedule.collector_workspace_domain_id,
      schedule.profile_version,
      schedule.engine_version,
      schedule.schedule_config
    order by domain_definition.key
  loop
    run_key := concat(
      'domain-schedule:',
      schedule_record.domain_id::text,
      ':',
      to_char(normalized_slot at time zone 'UTC', 'YYYYMMDDHH24'),
      ':',
      schedule_record.profile_version,
      ':',
      schedule_record.engine_version
    );

    run_id := null;
    run_request_id := null;

    insert into public.research_runs (
      workspace_id,
      workspace_domain_id,
      trigger_type,
      status,
      idempotency_key,
      contract_version,
      config_snapshot,
      metrics
    ) values (
      schedule_record.collector_workspace_id,
      schedule_record.collector_workspace_domain_id,
      'schedule',
      'queued',
      run_key,
      '1.0.0',
      jsonb_build_object(
        'domain_id', schedule_record.domain_id,
        'domain_key', schedule_record.domain_key,
        'schedule_slot_start', normalized_slot,
        'profile_version', schedule_record.profile_version,
        'engine_version', schedule_record.engine_version,
        'subscriber_count', schedule_record.subscriber_count,
        'schedule_config', schedule_record.schedule_config
      ),
      jsonb_build_object(
        'started_from', 'shared-domain-scheduler-v1',
        'eligible_workspace_count', schedule_record.subscriber_count
      )
    )
    on conflict (workspace_id, idempotency_key) do nothing
    returning id, request_id into run_id, run_request_id;

    run_created := found;

    if not run_created then
      select id, request_id
      into run_id, run_request_id
      from public.research_runs
      where workspace_id = schedule_record.collector_workspace_id
        and idempotency_key = run_key;
    end if;

    return next jsonb_build_object(
      'research_run_id', run_id,
      'request_id', run_request_id,
      'domain_id', schedule_record.domain_id,
      'domain_key', schedule_record.domain_key,
      'collector_workspace_id', schedule_record.collector_workspace_id,
      'collector_workspace_domain_id', schedule_record.collector_workspace_domain_id,
      'subscriber_count', schedule_record.subscriber_count,
      'slot_start', normalized_slot,
      'created', run_created
    );
  end loop;

  return;
end;
$$;

revoke all on function public.n8n_bootstrap_shared_research_workspace(uuid)
  from public, anon, authenticated;
revoke all on function public.n8n_schedule_domain_collection_runs(timestamptz)
  from public, anon, authenticated;

grant execute on function public.n8n_bootstrap_shared_research_workspace(uuid)
  to service_role;
grant execute on function public.n8n_schedule_domain_collection_runs(timestamptz)
  to service_role;

commit;
