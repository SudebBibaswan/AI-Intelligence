const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'migrations', '202609270013_capital_profile_verification.sql'), 'utf8');
const required = [
  'create or replace function public.n8n_list_capital_profile_candidates(',
  'limit greatest(1, least(coalesce(p_limit, 3), 10))',
  'create or replace function public.n8n_update_capital_official_profile(p_profile jsonb)',
  "v_status not in ('verified', 'needs_review')",
  "'activity_status_changed', false",
  "'workflow_context', coalesce(p_profile -> '_workflow_context', '{}'::jsonb)",
  "entity.attributes ->> 'registry_source' in ('sebi', 'wikidata')",
  'create or replace view public.v_capital_profile_verification_queue',
  'with (security_invoker = true)',
  'grant execute on function public.n8n_list_capital_profile_candidates(uuid, integer) to service_role',
  'grant execute on function public.n8n_update_capital_official_profile(jsonb) to service_role',
];
for (const fragment of required) if (!sql.includes(fragment)) throw new Error(`MISSING_PROFILE_GUARD:${fragment}`);
if (/insert into public\.relationships|activity_verification_status'\s*,\s*'active/i.test(sql)) {
  throw new Error('PROFILE_VERIFICATION_MUST_NOT_ASSERT_ACTIVITY');
}
if (/drop table|drop column/i.test(sql)) throw new Error('NON_ADDITIVE_PROFILE_MIGRATION');
if (!/^begin;/m.test(sql) || !/^commit;/m.test(sql)) throw new Error('MIGRATION_NOT_TRANSACTIONAL');

console.log('CAPITAL PROFILE VERIFICATION SQL VALIDATION PASSED');
console.log(JSON.stringify({ defaultBatch: 3, maximumBatch: 10, activityMutation: false }, null, 2));
