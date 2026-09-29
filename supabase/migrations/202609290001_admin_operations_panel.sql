begin;

-- Read-only, workspace-scoped admin surfaces. They intentionally expose no prompts,
-- responses, credentials, authorization headers, or arbitrary JSON payloads.
create or replace view public.v_admin_overview_daily
with (security_invoker = true)
as
select
  usage.workspace_id,
  (usage.created_at at time zone 'UTC')::date as activity_date,
  count(*) as llm_request_count,
  count(*) filter (where usage.success) as llm_success_count,
  count(*) filter (where not usage.success) as llm_failed_count,
  coalesce(sum(usage.input_tokens), 0) as input_tokens,
  coalesce(sum(usage.output_tokens), 0) as output_tokens,
  coalesce(sum(usage.input_tokens + usage.output_tokens), 0) as total_tokens,
  coalesce(sum(usage.estimated_cost_usd), 0)::numeric(12,6) as estimated_cost_usd,
  coalesce((
    select count(*)
    from public.research_runs run
    where run.workspace_id = usage.workspace_id
      and (run.created_at at time zone 'UTC')::date = (usage.created_at at time zone 'UTC')::date
  ), 0) as workflow_run_count,
  coalesce((
    select count(*)
    from public.research_runs run
    where run.workspace_id = usage.workspace_id
      and (run.created_at at time zone 'UTC')::date = (usage.created_at at time zone 'UTC')::date
      and run.status in ('partial', 'failed')
  ), 0) as workflow_problem_count
from public.llm_usage usage
where private.is_workspace_member(usage.workspace_id, array['owner', 'admin'])
group by usage.workspace_id, (usage.created_at at time zone 'UTC')::date;

create or replace view public.v_admin_pipeline_counts
with (security_invoker = true)
as
select workspace_id, workspace_domain_id, 'research_runs'::text as object_type, status, count(*) as total
from public.research_runs where private.is_workspace_member(workspace_id, array['owner', 'admin'])
group by workspace_id, workspace_domain_id, status
union all
select workspace_id, workspace_domain_id, 'signals', status, count(*)
from public.signals where private.is_workspace_member(workspace_id, array['owner', 'admin'])
group by workspace_id, workspace_domain_id, status
union all
select workspace_id, workspace_domain_id, 'observations', status, count(*)
from public.observations where private.is_workspace_member(workspace_id, array['owner', 'admin'])
group by workspace_id, workspace_domain_id, status
union all
select workspace_id, workspace_domain_id, 'patterns', status, count(*)
from public.patterns where private.is_workspace_member(workspace_id, array['owner', 'admin'])
group by workspace_id, workspace_domain_id, status
union all
select workspace_id, workspace_domain_id, 'hypotheses', status, count(*)
from public.hypotheses where deleted_at is null and private.is_workspace_member(workspace_id, array['owner', 'admin'])
group by workspace_id, workspace_domain_id, status
union all
select workspace_id, workspace_domain_id, 'insights', status, count(*)
from public.insights where private.is_workspace_member(workspace_id, array['owner', 'admin'])
group by workspace_id, workspace_domain_id, status;

create or replace view public.v_admin_request_health
with (security_invoker = true)
as
select
  usage.workspace_id,
  usage.id as usage_id,
  usage.request_id,
  usage.workflow,
  usage.agent,
  usage.operation,
  usage.provider,
  usage.model,
  usage.input_tokens,
  usage.output_tokens,
  usage.input_tokens + usage.output_tokens as total_tokens,
  usage.estimated_cost_usd,
  usage.latency_ms,
  usage.success,
  usage.error_code,
  usage.prompt_version,
  usage.schema_version,
  usage.research_run_id,
  usage.validation_run_id,
  usage.created_at,
  run.status as research_run_status,
  job.id as job_run_id,
  job.status as job_status,
  job.attempt as job_attempt,
  case when job.error_summary = '{}'::jsonb then run.error_summary else job.error_summary end as safe_error_summary
from public.llm_usage usage
left join public.research_runs run
  on run.id = usage.research_run_id and run.workspace_id = usage.workspace_id
left join lateral (
  select candidate.*
  from public.job_runs candidate
  where candidate.workspace_id = usage.workspace_id and candidate.request_id = usage.request_id
  order by candidate.queued_at desc
  limit 1
) job on true
where private.is_workspace_member(usage.workspace_id, array['owner', 'admin']);

create index if not exists llm_usage_workspace_workflow_created_idx
  on public.llm_usage (workspace_id, workflow, created_at desc);
create index if not exists llm_usage_workspace_provider_model_created_idx
  on public.llm_usage (workspace_id, provider, model, created_at desc);
create index if not exists llm_usage_workspace_request_idx
  on public.llm_usage (workspace_id, request_id);
create index if not exists research_runs_workspace_request_idx
  on public.research_runs (workspace_id, request_id);
create index if not exists job_runs_workspace_request_idx
  on public.job_runs (workspace_id, request_id, queued_at desc);
create index if not exists audit_log_workspace_action_target_created_idx
  on public.audit_log (workspace_id, action, target_type, created_at desc);

grant select on public.v_admin_overview_daily to authenticated;
grant select on public.v_admin_pipeline_counts to authenticated;
grant select on public.v_admin_request_health to authenticated;

commit;
