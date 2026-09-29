const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(path.join(__dirname, 'migrations', '202609270010_research_quality_observability.sql'), 'utf8');
const snapshotsMigration = fs.readFileSync(path.join(__dirname, 'migrations', '202609290001_research_quality_snapshots.sql'), 'utf8');
const adminMigration = fs.readFileSync(path.join(__dirname, 'migrations', '202609290002_admin_operations_panel.sql'), 'utf8');
const failures = [];
const migrationVersions = new Map();
for (const filename of fs.readdirSync(path.join(__dirname, 'migrations'))) {
  const version = filename.match(/^(\d+)_.*\.sql$/)?.[1];
  if (!version) continue;
  const existing = migrationVersions.get(version);
  if (existing) failures.push(`Duplicate migration version ${version}: ${existing}, ${filename}`);
  else migrationVersions.set(version, filename);
}
const requiredViews = [
  'v_research_quality_runs',
  'v_research_provider_quality',
  'v_research_review_backlog',
  'v_capital_graph_health',
];

for (const view of requiredViews) {
  if (!migration.includes(`create or replace view public.${view}`)) failures.push(`Missing view ${view}`);
  if (!migration.includes(`grant select on public.${view} to authenticated`)) failures.push(`Missing authenticated grant for ${view}`);
}
if ((migration.match(/with \(security_invoker = true\)/g) ?? []).length !== requiredViews.length) failures.push('Every observability view must use security_invoker');
if (!migration.includes('source_to_evidence_yield')) failures.push('Evidence yield metric missing');
if (!migration.includes('discovery_provider_error_count')) failures.push('Provider error metric missing');
if (!migration.includes('entity_provenance_coverage') || !migration.includes('relationship_provenance_coverage')) failures.push('Capital provenance metrics missing');
if (!/^begin;[\s\S]*commit;\s*$/.test(migration)) failures.push('Migration must be transactional');

for (const policy of ['research_quality_snapshots_select_member', 'research_quality_snapshots_insert_service']) {
  const drop = snapshotsMigration.indexOf(`drop policy if exists ${policy}`);
  const create = snapshotsMigration.indexOf(`create policy ${policy}`);
  if (drop < 0 || create < 0 || drop > create) failures.push(`Snapshot policy ${policy} is not replay-safe`);
}
if (!/^begin;[\s\S]*commit;\s*$/.test(snapshotsMigration)) failures.push('Snapshots migration must be transactional');
for (const fragment of ['with usage_daily as (', 'run_daily as (', 'left join run_daily',
  'run_daily.activity_date = usage_daily.activity_date']) {
  if (!adminMigration.includes(fragment)) failures.push(`Admin daily aggregation missing: ${fragment}`);
}
if (/where run\.workspace_id = usage\.workspace_id/.test(adminMigration)) {
  failures.push('Admin daily view must not correlate grouped usage rows with research runs');
}
if (!/^begin;[\s\S]*commit;\s*$/.test(adminMigration)) failures.push('Admin migration must be transactional');

if (failures.length) {
  console.error('RESEARCH QUALITY OBSERVABILITY VALIDATION FAILED');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exit(1);
}
console.log('RESEARCH QUALITY OBSERVABILITY VALIDATION PASSED');
console.log(JSON.stringify({ views: requiredViews, securityInvokerViews: requiredViews.length }, null, 2));
