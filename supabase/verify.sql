-- Run after migrations. This script is read-only except for raising an error on failure.

do $$
declare
  required_table text;
  required_view text;
begin
  foreach required_table in array array[
    'profiles', 'workspaces', 'workspace_members', 'domains', 'workspace_domains',
    'research_runs', 'sources', 'research_run_sources', 'evidence', 'entities',
    'entity_aliases', 'evidence_entities', 'relationships', 'relationship_evidence',
    'signals', 'signal_evidence', 'signal_entities', 'observations',
    'observation_signals', 'theses', 'thesis_evidence', 'patterns',
    'pattern_observations', 'hypotheses', 'hypothesis_patterns', 'validation_runs',
    'validation_evidence', 'insights', 'saved_items', 'daily_briefs', 'llm_usage',
    'job_runs', 'audit_log'
  ]
  loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = required_table
        and c.relkind = 'r'
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) then
      raise exception 'Required table public.% is missing or is not protected by RLS + FORCE RLS', required_table;
    end if;
  end loop;

  foreach required_view in array array[
    'v_dashboard_signal_cards',
    'v_pattern_summaries',
    'v_hypothesis_validation_status',
    'v_research_run_health',
    'v_workspace_cost_daily',
    'v_source_lineage'
  ]
  loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = required_view
        and c.relkind = 'v'
        and 'security_invoker=true' = any (coalesce(c.reloptions, array[]::text[]))
    ) then
      raise exception 'Required view public.% is missing or is not security_invoker', required_view;
    end if;
  end loop;

  if not exists (
    select 1 from public.domains
    where key = 'artificial-intelligence' and is_active
  ) then
    raise exception 'Artificial Intelligence domain seed is missing';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'research-content' and public = false
  ) then
    raise exception 'Private research-content bucket is missing';
  end if;

  if not (
    has_function_privilege('service_role', 'public.n8n_claim_research_run(uuid,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.n8n_set_research_run_status(uuid,uuid,text,jsonb,jsonb)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.n8n_record_research_source(jsonb)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.n8n_record_research_evidence(jsonb)', 'EXECUTE')
  ) then
    raise exception 'One or more n8n research runtime functions are missing service_role EXECUTE access';
  end if;

  if has_function_privilege('authenticated', 'public.n8n_claim_research_run(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.n8n_set_research_run_status(uuid,uuid,text,jsonb,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.n8n_record_research_source(jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.n8n_record_research_evidence(jsonb)', 'EXECUTE') then
    raise exception 'Authenticated users must not execute n8n research runtime functions';
  end if;
end $$;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
