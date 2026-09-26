begin;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, timezone, onboarding_state) on public.profiles to authenticated;
grant select on public.workspaces to authenticated;
grant update (name, slug, settings) on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select on public.domains to authenticated;
grant select, insert, delete on public.workspace_domains to authenticated;
grant update (name, topics, geographies, entity_types, source_config, collection_frequency, status)
  on public.workspace_domains to authenticated;

grant select on public.research_runs to authenticated;
grant select on public.sources to authenticated;
grant select on public.research_run_sources to authenticated;
grant select on public.evidence to authenticated;
grant select on public.entities to authenticated;
grant select on public.entity_aliases to authenticated;
grant select on public.evidence_entities to authenticated;
grant select on public.relationships to authenticated;
grant select on public.relationship_evidence to authenticated;
grant select on public.signals to authenticated;
grant select on public.signal_evidence to authenticated;
grant select on public.signal_entities to authenticated;
grant select on public.observations to authenticated;
grant select on public.observation_signals to authenticated;
grant select on public.theses to authenticated;
grant select on public.thesis_evidence to authenticated;
grant select on public.patterns to authenticated;
grant select on public.pattern_observations to authenticated;
grant select, insert, delete on public.hypotheses to authenticated;
grant update (title, statement, target_user, problem, proposed_value, assumptions, status, confidence, metadata, deleted_at)
  on public.hypotheses to authenticated;
grant select on public.hypothesis_patterns to authenticated;
grant select on public.validation_runs to authenticated;
grant select on public.validation_evidence to authenticated;
grant select on public.insights to authenticated;
grant select, insert, delete on public.saved_items to authenticated;
grant update (annotation, tags) on public.saved_items to authenticated;
grant select on public.daily_briefs to authenticated;
grant select on public.llm_usage to authenticated;
grant select on public.job_runs to authenticated;
grant select on public.audit_log to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
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
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
  end loop;
end $$;

create policy profiles_select_self
on public.profiles for select
to authenticated
using (user_id = (select auth.uid()));

create policy profiles_update_self
on public.profiles for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy workspaces_select_member
on public.workspaces for select
to authenticated
using ((select private.is_workspace_member(id)));

create policy workspaces_update_admin
on public.workspaces for update
to authenticated
using ((select private.is_workspace_member(id, array['owner', 'admin'])))
with check ((select private.is_workspace_member(id, array['owner', 'admin'])));

create policy workspace_members_select_member
on public.workspace_members for select
to authenticated
using ((select private.is_workspace_member(workspace_id)));

create policy domains_select_authenticated
on public.domains for select
to authenticated
using (is_active = true);

create policy workspace_domains_select_member
on public.workspace_domains for select
to authenticated
using ((select private.is_workspace_member(workspace_id)));

create policy workspace_domains_insert_admin
on public.workspace_domains for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_workspace_member(workspace_id, array['owner', 'admin']))
);

create policy workspace_domains_update_admin
on public.workspace_domains for update
to authenticated
using ((select private.is_workspace_member(workspace_id, array['owner', 'admin'])))
with check ((select private.is_workspace_member(workspace_id, array['owner', 'admin'])));

create policy workspace_domains_delete_admin
on public.workspace_domains for delete
to authenticated
using ((select private.is_workspace_member(workspace_id, array['owner', 'admin'])));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'research_runs', 'sources', 'research_run_sources', 'evidence', 'entities',
    'entity_aliases', 'evidence_entities', 'relationships', 'relationship_evidence',
    'signals', 'signal_evidence', 'signal_entities', 'observations',
    'observation_signals', 'theses', 'thesis_evidence', 'patterns',
    'pattern_observations', 'hypotheses', 'hypothesis_patterns', 'validation_runs',
    'validation_evidence', 'insights', 'daily_briefs', 'job_runs'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_workspace_member(workspace_id)))',
      table_name || '_select_member',
      table_name
    );
  end loop;
end $$;

create policy hypotheses_insert_member
on public.hypotheses for insert
to authenticated
with check (
  origin in ('user', 'mixed')
  and created_by = (select auth.uid())
  and (select private.is_workspace_member(workspace_id, array['owner', 'admin', 'member']))
);

create policy hypotheses_update_author_or_admin
on public.hypotheses for update
to authenticated
using (
  created_by = (select auth.uid())
  or (select private.is_workspace_member(workspace_id, array['owner', 'admin']))
)
with check (
  (created_by = (select auth.uid()) or (select private.is_workspace_member(workspace_id, array['owner', 'admin'])))
  and origin in ('user', 'mixed')
  and (select private.is_workspace_member(workspace_id, array['owner', 'admin', 'member']))
);

create policy hypotheses_delete_author_or_admin
on public.hypotheses for delete
to authenticated
using (
  created_by = (select auth.uid())
  or (select private.is_workspace_member(workspace_id, array['owner', 'admin']))
);

create policy saved_items_select_own
on public.saved_items for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id))
);

create policy saved_items_insert_own
on public.saved_items for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id, array['owner', 'admin', 'member']))
);

create policy saved_items_update_own
on public.saved_items for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (select private.is_workspace_member(workspace_id, array['owner', 'admin', 'member']))
);

create policy saved_items_delete_own
on public.saved_items for delete
to authenticated
using (user_id = (select auth.uid()));

create policy llm_usage_select_admin
on public.llm_usage for select
to authenticated
using ((select private.is_workspace_member(workspace_id, array['owner', 'admin'])));

create policy audit_log_select_admin
on public.audit_log for select
to authenticated
using ((select private.is_workspace_member(workspace_id, array['owner', 'admin'])));

commit;
