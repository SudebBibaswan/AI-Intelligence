const fs = require('fs');
const path = require('path');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_signal_engine.json'), 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const required = [
  'Manual Trigger', 'Daily Signal Check', 'Signal Engine Configuration', 'Load Verified Evidence',
  'Build Diverse Evidence Packs', 'Domain Pack Loop', 'Has Verified Evidence Pack?',
  'Build Signal Request', 'OpenAI Signal Extraction', 'Validate Signal Candidates',
  'Signal Candidate Loop', 'Persist Draft Signal', 'Signal Candidate Complete',
  'Signal Domain Complete', 'Signal Engine Summary',
];
for (const name of required) if (!nodes.has(name)) throw new Error(`MISSING_NODE:${name}`);

const config = nodes.get('Signal Engine Configuration').parameters.jsCode;
for (const fragment of ['domain_limit: 3', 'evidence_per_domain: 12', 'max_signals_per_domain: 5',
  "engine_version: 'signal-engine-v1.0.2'"]) {
  if (!config.includes(fragment)) throw new Error(`MISSING_SIGNAL_CAP:${fragment}`);
}
const load = nodes.get('Load Verified Evidence');
if (!String(load.parameters.url).includes('/rpc/n8n_list_signal_evidence_candidates')) {
  throw new Error('SIGNAL_EVIDENCE_RPC_NOT_USED');
}
if (load.credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('CENTRAL_SUPABASE_CREDENTIAL_NOT_REUSED');
const openai = nodes.get('OpenAI Signal Extraction');
if (openai.credentials?.openAiApi?.name !== 'OpenAI account') throw new Error('CENTRAL_OPENAI_CREDENTIAL_NOT_REUSED');
const request = nodes.get('Build Signal Request').parameters.jsCode;
for (const fragment of ['additionalProperties: false', "name: 'verified_evidence_signals'",
  'Every signal must cite one or more supplied evidence_id values', 'Do not add facts',
  'Keep separate events as separate signals']) {
  if (!request.includes(fragment)) throw new Error(`MISSING_SIGNAL_PROMPT_GUARD:${fragment}`);
}
const validation = nodes.get('Validate Signal Candidates').parameters.jsCode;
for (const fragment of ['evidenceById.has', '!uniqueRefs.length', 'hasExplicitDate',
  "if (character.trim() === '')", 'no_signal: true']) {
  if (!validation.includes(fragment)) throw new Error(`MISSING_SIGNAL_VALIDATION_GATE:${fragment}`);
}
if (validation.includes("replace(/s+/g, ' ')")) throw new Error('LETTER_S_CORRUPTION_REGRESSION');
const persist = nodes.get('Persist Draft Signal');
if (!String(persist.parameters.url).includes('/rpc/n8n_upsert_verified_signal')) {
  throw new Error('VERIFIED_SIGNAL_RPC_NOT_USED');
}
const forbiddenPaid = workflow.nodes.filter((item) => /tavily|firecrawl/i.test(`${item.name} ${item.type}`));
if (forbiddenPaid.length) throw new Error(`UNNECESSARY_DISCOVERY_PRESENT:${forbiddenPaid.map((item) => item.name).join(',')}`);

const reachable = new Set();
const pending = ['Manual Trigger', 'Daily Signal Check'];
while (pending.length) {
  const name = pending.pop();
  if (reachable.has(name)) continue;
  reachable.add(name);
  for (const output of (workflow.connections[name]?.main ?? [])) for (const edge of output) pending.push(edge.node);
}
const unreachable = workflow.nodes.map((item) => item.name).filter((name) => !reachable.has(name));
if (unreachable.length) throw new Error(`UNREACHABLE_NODES:${unreachable.join(',')}`);

console.log('VERIFIED SIGNAL ENGINE WORKFLOW VALIDATION PASSED');
console.log(JSON.stringify({ nodes: workflow.nodes.length, domainsPerRun: 3, evidencePerSource: 2,
  maxSignalsPerDomain: 5, credentials: ['Supabase account', 'OpenAI account'], outputStatus: 'draft', humanGate: 'signals_only' }, null, 2));