const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(
  path.join(__dirname, 'migrations', '202609270012_regulated_capital_registry.sql'),
  'utf8',
);
const required = [
  'create or replace function public.n8n_upsert_regulated_capital_entity(p_entity jsonb)',
  "'^IN/(VCF|VC)/[0-9]{2}-[0-9]{2}/[0-9]+$'",
  "'regulatory_status', 'registered'",
  "'activity_verification_status', 'unverified'",
  "'{sebi_registration_numbers}'",
  "resolution_status = 'resolved'",
  'create or replace view public.v_regulated_capital_funds',
  'with (security_invoker = true)',
  'left join public.v_capital_directory directory',
  'grant execute on function public.n8n_upsert_regulated_capital_entity(jsonb) to service_role',
  'grant select on public.v_regulated_capital_funds to authenticated',
];
for (const fragment of required) {
  if (!sql.includes(fragment)) throw new Error(`MISSING_REGULATED_CAPITAL_GUARD:${fragment}`);
}
if (!/^begin;/m.test(sql) || !/^commit;/m.test(sql)) throw new Error('MIGRATION_NOT_TRANSACTIONAL');
if (/drop table|drop column/i.test(sql)) throw new Error('NON_ADDITIVE_REGULATED_CAPITAL_MIGRATION');

console.log('REGULATED CAPITAL REGISTRY VALIDATION PASSED');
console.log(JSON.stringify({
  rpc: 'n8n_upsert_regulated_capital_entity',
  view: 'v_regulated_capital_funds',
  identityStatus: 'resolved',
  activityStatus: 'unverified',
}, null, 2));
