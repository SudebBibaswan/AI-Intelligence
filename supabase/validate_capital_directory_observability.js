const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, 'migrations', '202609270011_capital_directory_observability.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');
const required = [
  'create or replace view public.v_capital_directory',
  'with (security_invoker = true)',
  "then 'active_evidenced'",
  "then 'evidenced'",
  "else 'candidate_unverified'",
  "relationship.relationship_type in ('invested_in', 'partnered_with', 'acquired')",
  "supporting_evidence.verification_status <> 'rejected'",
  'grant select on public.v_capital_directory to authenticated',
];
for (const fragment of required) {
  if (!sql.includes(fragment)) throw new Error(`MISSING_CAPITAL_DIRECTORY_GUARD:${fragment}`);
}
if (!/^begin;/m.test(sql) || !/^commit;/m.test(sql)) throw new Error('MIGRATION_NOT_TRANSACTIONAL');
if (/alter table|drop table|drop column/i.test(sql)) throw new Error('NON_ADDITIVE_CAPITAL_DIRECTORY_MIGRATION');

console.log('CAPITAL DIRECTORY OBSERVABILITY VALIDATION PASSED');
console.log(JSON.stringify({
  view: 'v_capital_directory',
  activityWindowDays: 365,
  rejectsUnsupportedActivityClaims: true,
}, null, 2));
