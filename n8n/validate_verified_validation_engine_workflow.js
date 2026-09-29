const fs = require('fs');
const path = require('path');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_validation_engine.json'), 'utf8'));
const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations',
  '202609280008_verified_validation_engine.sql'), 'utf8');
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const required = [
  'Manual Trigger', 'Daily Validation Check', 'Validation Engine Configuration', 'Load Hypotheses Ready for Validation',
  'Build Validation Packs', 'Validation Domain Loop', 'Has Hypotheses to Validate?',
  'Build Validation Research Plan', 'Research Dimension Loop', 'Build Research Request',
  'OpenAI Validation Research', 'Process Validation Evidence', 'Upsert Validation Evidence',
  'Evidence Loop', 'Has Valid Evidence?', 'Next Evidence', 'Dimension Complete',
  'All Dimensions Complete', 'Finalize Validation Run', 'Validation Complete',
  'No Hypotheses Domain Complete', 'Validation Engine Summary',
];
for (const name of required) if (!nodes.has(name)) throw new Error(`MISSING_NODE:${name}`);

const compatibilityBridge = migration.indexOf('alter table public.hypotheses');
const candidateRpc = migration.indexOf('create or replace function public.n8n_list_validation_hypothesis_candidates');
if (compatibilityBridge < 0 || compatibilityBridge > candidateRpc
  || !migration.includes('add column if not exists falsifiers')
  || !migration.includes('add column if not exists validation_questions')) {
  throw new Error('RE10_STRUCTURED_FIELDS_COMPATIBILITY_BRIDGE_MISSING');
}

const config = nodes.get('Validation Engine Configuration').parameters.jsCode;
for (const fragment of ['domain_limit: 3', 'hypotheses_per_domain: 10', 'max_validations_per_domain: 5',
  "engine_version: 'validation-engine-v1.0.0'"]) {
  if (!config.includes(fragment)) throw new Error(`MISSING_VALIDATION_CAP:${fragment}`);
}
const load = nodes.get('Load Hypotheses Ready for Validation');
if (!String(load.parameters.url).includes('/rpc/n8n_list_validation_hypothesis_candidates')) {
  throw new Error('VALIDATION_HYPOTHESIS_RPC_NOT_USED');
}
if (load.credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('CENTRAL_SUPABASE_CREDENTIAL_NOT_REUSED');
const openai = nodes.get('OpenAI Validation Research');
if (openai.credentials?.openAiApi?.name !== 'OpenAI account') throw new Error('CENTRAL_OPENAI_CREDENTIAL_NOT_REUSED');
const request = nodes.get('Build Research Request').parameters.jsCode;
for (const fragment of ['additionalProperties: false', "name: 'validation_evidence'",
  'concrete evidence (not opinions)', 'Return exact excerpts with source URLs',
  'Evidence must be verifiable']) {
  if (!request.includes(fragment)) throw new Error(`MISSING_VALIDATION_PROMPT_GUARD:${fragment}`);
}
const validation = nodes.get('Process Validation Evidence').parameters.jsCode;
for (const fragment of ['supportingSignals', 'contradictingSignals', 'falsifierWords',
  'hasSupporting', 'hasContradicting', 'stance', 'valid_evidence', 'evidence_count']) {
  if (!validation.includes(fragment)) throw new Error(`MISSING_VALIDATION_LOGIC:${fragment}`);
}
const upsertEvidence = nodes.get('Upsert Validation Evidence');
if (!String(upsertEvidence.parameters.url).includes('/rpc/n8n_upsert_validation_evidence')) {
  throw new Error('VALIDATION_EVIDENCE_RPC_NOT_USED');
}
const upsertRun = nodes.get('Finalize Validation Run');
if (!String(upsertRun.parameters.url).includes('/rpc/n8n_upsert_validation_run')) {
  throw new Error('VALIDATION_RUN_RPC_NOT_USED');
}
const forbiddenPaid = workflow.nodes.filter((item) => /tavily|firecrawl/i.test(`${item.name} ${item.type}`));
if (forbiddenPaid.length) throw new Error(`UNNECESSARY_DISCOVERY_PRESENT:${forbiddenPaid.map((item) => item.name).join(',')}`);

const reachable = new Set();
const pending = ['Manual Trigger', 'Daily Validation Check'];
while (pending.length) {
  const name = pending.pop();
  if (reachable.has(name)) continue;
  reachable.add(name);
  for (const output of (workflow.connections[name]?.main ?? [])) for (const edge of output) pending.push(edge.node);
}
const unreachable = workflow.nodes.map((item) => item.name).filter((name) => !reachable.has(name));
if (unreachable.length) throw new Error(`UNREACHABLE_NODES:${unreachable.join(',')}`);

console.log('VERIFIED VALIDATION ENGINE WORKFLOW VALIDATION PASSED');
console.log(JSON.stringify({ nodes: workflow.nodes.length, domainsPerRun: 3, hypothesesPerDomain: 10,
  maxValidationsPerDomain: 5, dimensionsResearched: 9,
  credentials: ['Supabase account', 'OpenAI account'], outputStatus: 'validated', humanGate: 'signals_only' }, null, 2));
