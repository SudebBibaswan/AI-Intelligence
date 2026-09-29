const fs = require('fs');
const path = require('path');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_observation_engine.json'), 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const required = [
  'Manual Trigger', 'Daily Observation Check', 'Observation Engine Configuration', 'Load Accepted Signals',
  'Build Diverse Signal Packs', 'Observation Domain Loop', 'Has Diverse Accepted Signals?',
  'Build Observation Request', 'OpenAI Observation Synthesis', 'Validate Observation Candidates',
  'Observation Candidate Loop', 'Persist Validated Observation', 'Auto-Accept Observation', 'Observation Candidate Complete',
  'Observation Domain Complete', 'Observation Engine Summary',
];
for (const name of required) if (!nodes.has(name)) throw new Error(`MISSING_NODE:${name}`);

const config = nodes.get('Observation Engine Configuration').parameters.jsCode;
for (const fragment of ['domain_limit: 3', 'signals_per_domain: 12', 'max_observations_per_domain: 4',
  "engine_version: 'observation-engine-v1.1.0'"]) {
  if (!config.includes(fragment)) throw new Error(`MISSING_OBSERVATION_CAP:${fragment}`);
}
const load = nodes.get('Load Accepted Signals');
if (!String(load.parameters.url).includes('/rpc/n8n_list_observation_signal_candidates')) {
  throw new Error('ACCEPTED_SIGNAL_RPC_NOT_USED');
}
if (load.credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('CENTRAL_SUPABASE_CREDENTIAL_NOT_REUSED');
const openai = nodes.get('OpenAI Observation Synthesis');
if (openai.credentials?.openAiApi?.name !== 'OpenAI account') throw new Error('CENTRAL_OPENAI_CREDENTIAL_NOT_REUSED');
const request = nodes.get('Build Observation Request').parameters.jsCode;
for (const fragment of ['additionalProperties: false', "name: 'accepted_signal_observations'",
  'at least two supplied signal_id values', 'Do not force unrelated signals together',
  'Do not claim a trend, recurring pattern, causal relationship, prediction, thesis, recommendation, or final insight']) {
  if (!request.includes(fragment)) throw new Error(`MISSING_OBSERVATION_PROMPT_GUARD:${fragment}`);
}
const validation = nodes.get('Validate Observation Candidates').parameters.jsCode;
for (const fragment of ['signalById.has', 'uniqueRefs.length < 2', 'sourceIds.size < 2', 'forbiddenClaim',
  "if (character.trim() === '')", 'no_observation: true']) {
  if (!validation.includes(fragment)) throw new Error(`MISSING_OBSERVATION_VALIDATION_GATE:${fragment}`);
}
if (validation.includes("replace(/s+/g, ' ')")) throw new Error('LETTER_S_CORRUPTION_REGRESSION');
const persist = nodes.get('Persist Validated Observation');
if (!String(persist.parameters.url).includes('/rpc/n8n_upsert_verified_observation')) {
  throw new Error('VERIFIED_OBSERVATION_RPC_NOT_USED');
}
const autoAccept = nodes.get('Auto-Accept Observation');
if (!String(autoAccept.parameters.url).includes('/rpc/n8n_accept_verified_observation')) {
  throw new Error('AUTOMATIC_OBSERVATION_ACCEPTANCE_RPC_NOT_USED');
}
if (autoAccept.credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('AUTO_ACCEPT_CREDENTIAL_NOT_REUSED');
const forbiddenPaid = workflow.nodes.filter((item) => /tavily|firecrawl/i.test(`${item.name} ${item.type}`));
if (forbiddenPaid.length) throw new Error(`UNNECESSARY_DISCOVERY_PRESENT:${forbiddenPaid.map((item) => item.name).join(',')}`);

const reachable = new Set();
const pending = ['Manual Trigger', 'Daily Observation Check'];
while (pending.length) {
  const name = pending.pop();
  if (reachable.has(name)) continue;
  reachable.add(name);
  for (const output of (workflow.connections[name]?.main ?? [])) for (const edge of output) pending.push(edge.node);
}
const unreachable = workflow.nodes.map((item) => item.name).filter((name) => !reachable.has(name));
if (unreachable.length) throw new Error(`UNREACHABLE_NODES:${unreachable.join(',')}`);

console.log('VERIFIED OBSERVATION ENGINE WORKFLOW VALIDATION PASSED');
console.log(JSON.stringify({ nodes: workflow.nodes.length, domainsPerRun: 3, signalsPerDomain: 12,
  maxObservationsPerDomain: 4, minimumSignals: 2, minimumSources: 2,
  credentials: ['Supabase account', 'OpenAI account'], outputStatus: 'accepted', humanGate: 'signals_only' }, null, 2));