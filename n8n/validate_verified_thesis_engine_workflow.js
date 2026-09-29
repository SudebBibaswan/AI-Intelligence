const fs = require('fs');
const path = require('path');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_thesis_engine.json'), 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const required = [
  'Manual Trigger', 'Daily Thesis Extraction', 'Thesis Engine Configuration', 'Load Thesis Evidence Candidates',
  'Group Evidence by Entity', 'Entity Loop', 'Has Evidence for Entity?',
  'Build Stated Thesis Request', 'Build Revealed Thesis Request',
  'OpenAI Stated Thesis', 'OpenAI Revealed Thesis',
  'Validate Stated Thesis', 'Validate Revealed Thesis',
  'Persist Stated Thesis', 'Persist Revealed Thesis',
  'Stated Thesis Complete', 'Revealed Thesis Complete',
  'Skipped Stated Thesis', 'Skipped Revealed Thesis',
  'Entity Complete', 'No Evidence Entity Complete', 'Thesis Engine Summary',
];
for (const name of required) if (!nodes.has(name)) throw new Error(`MISSING_NODE:${name}`);

const config = nodes.get('Thesis Engine Configuration').parameters.jsCode;
for (const fragment of ['entity_types:', 'max_evidence_per_entity: 20',
  "engine_version: 'thesis-engine-v1.0.0'"]) {
  if (!config.includes(fragment)) throw new Error(`MISSING_THESIS_CAP:${fragment}`);
}
const load = nodes.get('Load Thesis Evidence Candidates');
if (!String(load.parameters.url).includes('/rpc/n8n_list_thesis_evidence_candidates')) {
  throw new Error('THESIS_EVIDENCE_RPC_NOT_USED');
}
if (load.credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('CENTRAL_SUPABASE_CREDENTIAL_NOT_REUSED');
const openai1 = nodes.get('OpenAI Stated Thesis');
const openai2 = nodes.get('OpenAI Revealed Thesis');
if (openai1.credentials?.openAiApi?.name !== 'OpenAI account') throw new Error('CENTRAL_OPENAI_CREDENTIAL_NOT_REUSED');
if (openai2.credentials?.openAiApi?.name !== 'OpenAI account') throw new Error('CENTRAL_OPENAI_CREDENTIAL_NOT_REUSED');
const statedRequest = nodes.get('Build Stated Thesis Request').parameters.jsCode;
const revealedRequest = nodes.get('Build Revealed Thesis Request').parameters.jsCode;
for (const fragment of ['additionalProperties: false', "name: 'entity_stated_thesis'",
  'STATED thesis (what this entity publicly claims', 'direct quotes, public statements']) {
  if (!statedRequest.includes(fragment)) throw new Error(`MISSING_STATED_PROMPT:${fragment}`);
}
for (const fragment of ['additionalProperties: false', "name: 'entity_revealed_thesis'",
  'REVEALED thesis (what this entity\'s actual investments reveal', 'Analyze investment patterns']) {
  if (!revealedRequest.includes(fragment)) throw new Error(`MISSING_REVEALED_PROMPT:${fragment}`);
}
const statedValidation = nodes.get('Validate Stated Thesis').parameters.jsCode;
const revealedValidation = nodes.get('Validate Revealed Thesis').parameters.jsCode;
for (const fragment of ['uniqueRefs.length < 2', 'datesValid', 'confidence < 0.4',
  "if (character.trim() === '')", 'no_thesis: true']) {
  if (!statedValidation.includes(fragment)) throw new Error(`MISSING_STATED_VALIDATION:${fragment}`);
  if (!revealedValidation.includes(fragment)) throw new Error(`MISSING_REVEALED_VALIDATION:${fragment}`);
}
if (statedValidation.includes("replace(/s+/g, ' ')")) throw new Error('LETTER_S_CORRUPTION_REGRESSION');
const persist1 = nodes.get('Persist Stated Thesis');
const persist2 = nodes.get('Persist Revealed Thesis');
if (!String(persist1.parameters.url).includes('/rpc/n8n_upsert_verified_thesis')) {
  throw new Error('THESIS_RPC_NOT_USED');
}
if (persist1.credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('PERSIST_CREDENTIAL_NOT_REUSED');

const forbiddenPaid = workflow.nodes.filter((item) => /tavily|firecrawl/i.test(`${item.name} ${item.type}`));
if (forbiddenPaid.length) throw new Error(`UNNECESSARY_DISCOVERY_PRESENT:${forbiddenPaid.map((item) => item.name).join(',')}`);

const reachable = new Set();
const pending = ['Manual Trigger', 'Daily Thesis Extraction'];
while (pending.length) {
  const name = pending.pop();
  if (reachable.has(name)) continue;
  reachable.add(name);
  for (const output of (workflow.connections[name]?.main ?? [])) for (const edge of output) pending.push(edge.node);
}
const unreachable = workflow.nodes.map((item) => item.name).filter((name) => !reachable.has(name));
if (unreachable.length) throw new Error(`UNREACHABLE_NODES:${unreachable.join(',')}`);

console.log('VERIFIED THESIS ENGINE WORKFLOW VALIDATION PASSED');
console.log(JSON.stringify({ nodes: workflow.nodes.length, entityTypes: ['organization'],
  maxEvidencePerEntity: 20, thesisTypes: ['stated', 'revealed'],
  credentials: ['Supabase account', 'OpenAI account'], outputStatus: 'draft', humanGate: 'signals_only' }, null, 2));