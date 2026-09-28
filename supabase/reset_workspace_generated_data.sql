-- DESTRUCTIVE: this permanently removes generated/collected data for exactly
-- one workspace. It preserves users, the workspace, membership, domains,
-- workspace-domain configuration, and collection schedules.
--
-- Take a Supabase backup first. Apply migration 202609280005 before running.
-- Run the preview SELECT, inspect its counts, and only then run the transaction.

select
  (select count(*) from public.research_runs where workspace_id = 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da') as research_runs,
  (select count(*) from public.sources where workspace_id = 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da') as sources,
  (select count(*) from public.evidence where workspace_id = 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da') as evidence,
  (select count(*) from public.signals where workspace_id = 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da') as signals,
  (select count(*) from public.observations where workspace_id = 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da') as observations;

-- STOP after the preview unless the workspace and counts are correct.
-- Execute this block separately when you intentionally want the reset.
-- Replace REPLACE_WITH_EXACT_CONFIRMATION with:
-- RESET_GENERATED_DATA:a51b8277-4cd5-4f8a-9ffd-4ddbe56683da
begin;

select private.reset_workspace_generated_data(
  'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da'::uuid,
  'REPLACE_WITH_EXACT_CONFIRMATION'
);

commit;

-- Expected result after commit: all generated counts are zero.
select
  (select count(*) from public.research_runs where workspace_id = 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da') as research_runs,
  (select count(*) from public.sources where workspace_id = 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da') as sources,
  (select count(*) from public.evidence where workspace_id = 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da') as evidence,
  (select count(*) from public.signals where workspace_id = 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da') as signals,
  (select count(*) from public.observations where workspace_id = 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da') as observations;
