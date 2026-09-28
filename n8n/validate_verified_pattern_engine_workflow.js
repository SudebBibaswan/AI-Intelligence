const fs = require('fs');
const path = require('path');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_pattern_engine.json'), 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const required = [
  'Manual Trigger', 'Daily Pattern Check', 'Pattern Engine Configuration', 'Load Accepted Observations',
  'Build Diverse Observation Packs', 'Pattern Domain Loop', 'Has Sufficient Diverse Observations?',
  'Build Pattern Request', 'OpenAI Pattern Synthesis', 'Validate Pattern Candidates',
  'Pattern Candidate Loop', 'Persist Validated Pattern', 'Pattern Candidate Complete',
  'Pattern Domain Complete', 'Pattern Engine Summary',
];
for (const name of required) if (!nodes.has(name)) throw new Error(`MISSING_NODE:${name}`);

const config = nodes.get('Pattern Engine Configuration').parameters.jsCode;
for (const fragment of ['domain_limit: 3', 'observations_per_domain: 12', 'max_patterns_per_domain: 3',
  "engine_version: 'pattern-engine-v1.0.0'"]) {
  if (!config.includes(fragment)) throw new Error(`MISSING_PATTERN_CAP:${fragment}`);
}
const load = nodes.get('Load Accepted Observations');
if (!String(load.parameters.url).includes('/rpc/n8n_list_pattern_observation_candidates')) {
  throw new Error('ACCEPTED_OBSERVATION_RPC_NOT_USED');
}
if (load.credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('CENTRAL_SUPABASE_CREDENTIAL_NOT_REUSED');
const openai = nodes.get('OpenAI Pattern Synthesis');
if (openai.credentials?.openAiApi?.name !== 'OpenAI account') throw new Error('CENTRAL_OPENAI_CREDENTIAL_NOT_REUSED');
const request = nodes.get('Build Pattern Request').parameters.jsCode;
for (const fragment of ['additionalProperties: false', "name: 'accepted_observation_patterns'",
  'at least three supplied observation_id values', 'at least three independent source families',
  'at least two distinct events or entities', 'Do not create patterns directly from signals',
  'Do not claim a trend, causal relationship, prediction, hypothesis, recommendation, or final insight']) {
  if (!request.includes(fragment)) throw new Error(`MISSING_PATTERN_PROMPT_GUARD:${fragment}`);
}
const validation = nodes.get('Validate Pattern Candidates').parameters.jsCode;
for (const fragment of ['observationById.has', 'uniqueRefs.length < 3', 'sourceFamilies.size < 3', 'forbiddenClaim',
  "if (character.trim() === '')", 'no_pattern: true']) {
  if (!validation.includes(fragment)) throw new Error(`MISSING_PATTERN_VALIDATION_GATE:${fragment}`);
}
if (validation.includes("replace(/s+/g, ' ')")) throw new Error('LETTER_S_CORRUPTION_REGRESSION');
const persist = nodes.get('Persist Validated Pattern');
if (!String(persist.parameters.url).includes('/rpc/n8n_upsert_verified_pattern')) {
  throw new Error('VERIFIED_PATTERN_RPC_NOT_USED');
}
if (persist.credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('PERSIST_CREDENTIAL_NOT_REUSED');
const forbiddenPaid = workflow.nodes.filter((item) => /tavily|firecrawl/i.test(`${item.name} ${item.type}`));
if (forbiddenPaid.length) throw new Error(`UNNECESSARY_DISCOVERY_PRESENT:${forbiddenPaid.map((item) => item.name).join(',')}`);

const reachable = new Set();
const pending = ['Manual Trigger', 'Daily Pattern Check'];
while (pending.length) {
  const name = pending.pop();
  if (reachable.has(name)) continue;
  reachable.add(name);
  for (const output of (workflow.connections[name]?.main ?? [])) for (const edge of output) pending.push(edge.node);
}
const unreachable = workflow.nodes.map((item) => item.name).filter((name) => !reachable.has(name));
if (unreachable.length) throw new Error(`UNREACHABLE_NODES:${unreachable.join(',')}`);

console.log('VERIFIED PATTERN ENGINE WORKFLOW VALIDATION PASSED');
console.log(JSON.stringify({ nodes: workflow.nodes.length, domainsPerRun: 3, observationsPerDomain: 12,
  maxPatternsPerDomain: 3, minimumObservations: 3, minimumSourceFamilies: 3, minimumEventsEntities: 2,
  credentials: ['Supabase account', 'OpenAI account'], outputStatus: 'emerging', humanGate: 'signals_only' }, null, 2));