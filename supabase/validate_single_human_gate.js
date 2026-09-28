const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(path.join(__dirname, 'migrations', '202609280005_single_human_gate.sql'), 'utf8');
const reset = fs.readFileSync(path.join(__dirname, 'reset_workspace_generated_data.sql'), 'utf8');

const requiredMigrationFragments = [
  'verification_method text not null',
  "verification_method in ('pending', 'automated', 'human', 'legacy')",
  'AUTOMATED_EVIDENCE_REQUIRES_EXACT_GROUNDING',
  'create or replace function public.n8n_accept_verified_observation',
  "signal.status <> 'accepted'",
  'v_signal_count < 2',
  'v_source_count < 2',
  "acceptance_method = 'automated'",
  "'human_gate', 'signal_review'",
  'create or replace function private.reset_workspace_generated_data',
  "p_confirmation <> 'RESET_GENERATED_DATA:' || p_workspace_id::text",
  "'workspace_domains', 'domain_collection_schedules'",
  'grant execute on function public.n8n_accept_verified_observation(uuid, boolean) to service_role',
];

for (const fragment of requiredMigrationFragments) {
  if (!migration.includes(fragment)) throw new Error(`MISSING_SINGLE_GATE_SCHEMA_GUARD:${fragment}`);
}

for (const preservedTable of ['workspaces', 'workspace_members', 'domains', 'workspace_domains', 'domain_collection_schedules']) {
  if (migration.includes(`delete from public.${preservedTable} `)) {
    throw new Error(`RESET_MUST_PRESERVE_CONFIGURATION:${preservedTable}`);
  }
}

for (const generatedTable of ['research_runs', 'sources', 'evidence', 'signals', 'observations', 'audit_log']) {
  if (!migration.includes(`delete from public.${generatedTable} where workspace_id = p_workspace_id`)) {
    throw new Error(`RESET_DOES_NOT_CLEAR_GENERATED_TABLE:${generatedTable}`);
  }
}

if (!reset.includes('STOP after the preview')) throw new Error('RESET_PREVIEW_WARNING_MISSING');
if (!reset.includes('RESET_GENERATED_DATA:a51b8277-4cd5-4f8a-9ffd-4ddbe56683da')) {
  throw new Error('RESET_CONFIRMATION_TOKEN_MISSING');
}
if (!reset.includes("'REPLACE_WITH_EXACT_CONFIRMATION'")) throw new Error('RESET_MUST_SHIP_LOCKED');
if (/drop\s+(table|schema|database)|truncate/i.test(reset)) throw new Error('RESET_SCRIPT_TOO_BROAD');

console.log('SINGLE HUMAN GATE SCHEMA VALIDATION PASSED');
console.log(JSON.stringify({
  humanGate: 'signal_review',
  evidenceVerification: 'automated_exact_grounding',
  observationAcceptance: 'automated_two_signal_two_source_policy',
  resetScope: 'generated_workspace_data_only',
}, null, 2));
