const fs = require('fs');
const path = require('path');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_hypothesis_engine.json'), 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const required = [
  'Manual Trigger', 'Daily Hypothesis Check', 'Hypothesis Engine Configuration', 'Load Eligible Patterns',
  'Build Diverse Pattern Packs', 'Hypothesis Domain Loop', 'Has Eligible Patterns?',
  'Build Hypothesis Request', 'OpenAI Hypothesis Synthesis', 'Validate Hypothesis Candidates',
  'Hypothesis Candidate Loop', 'Persist Validated Hypothesis', 'Hypothesis Candidate Complete',
  'Hypothesis Domain Complete', 'Hypothesis Engine Summary',
];
for (const name of required) if (!nodes.has(name)) throw new Error(`MISSING_NODE:${name}`);

const config = nodes.get('Hypothesis Engine Configuration').parameters.jsCode;
for (const fragment of ['domain_limit: 3', 'patterns_per_domain: 10', 'max_hypotheses_per_domain: 3',
  'min_strength_score: 0.7', "engine_version: 'hypothesis-engine-v1.0.0'"]) {
  if (!config.includes(fragment)) throw new Error(`MISSING_HYPOTHESIS_CAP:${fragment}`);
}
const load = nodes.get('Load Eligible Patterns');
if (!String(load.parameters.url).includes('/rpc/n8n_list_hypothesis_pattern_candidates')) {
  throw new Error('ELIGIBLE_PATTERN_RPC_NOT_USED');
}
if (load.credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('CENTRAL_SUPABASE_CREDENTIAL_NOT_REUSED');
const openai = nodes.get('OpenAI Hypothesis Synthesis');
if (openai.credentials?.openAiApi?.name !== 'OpenAI account') throw new Error('CENTRAL_OPENAI_CREDENTIAL_NOT_REUSED');
const request = nodes.get('Build Hypothesis Request').parameters.jsCode;
for (const fragment of ['additionalProperties: false', "name: 'pattern_hypotheses'",
  'target user', 'concrete problem', 'explicit assumptions, falsifiers, and validation questions',
  'Funding alone is not proof of demand', 'Do not declare facts, make predictions, or claim causation']) {
  if (!request.includes(fragment)) throw new Error(`MISSING_HYPOTHESIS_PROMPT_GUARD:${fragment}`);
}
const validation = nodes.get('Validate Hypothesis Candidates').parameters.jsCode;
for (const fragment of ['patternById.has', 'uniqueRefs.length < 1', 'assumptions.length < 1', 'falsifiers.length < 1',
  'validationQuestions.length < 1', 'fundingOnlyClaim', "if (character.trim() === '')", 'no_hypothesis: true']) {
  if (!validation.includes(fragment)) throw new Error(`MISSING_HYPOTHESIS_VALIDATION_GATE:${fragment}`);
}
if (validation.includes("replace(/s+/g, ' ')")) throw new Error('LETTER_S_CORRUPTION_REGRESSION');
const persist = nodes.get('Persist Validated Hypothesis');
if (!String(persist.parameters.url).includes('/rpc/n8n_upsert_verified_hypothesis')) {
  throw new Error('VERIFIED_HYPOTHESIS_RPC_NOT_USED');
}
if (persist.credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('PERSIST_CREDENTIAL_NOT_REUSED');
const forbiddenPaid = workflow.nodes.filter((item) => /tavily|firecrawl/i.test(`${item.name} ${item.type}`));
if (forbiddenPaid.length) throw new Error(`UNNECESSARY_DISCOVERY_PRESENT:${forbiddenPaid.map((item) => item.name).join(',')}`);

const reachable = new Set();
const pending = ['Manual Trigger', 'Daily Hypothesis Check'];
while (pending.length) {
  const name = pending.pop();
  if (reachable.has(name)) continue;
  reachable.add(name);
  for (const output of (workflow.connections[name]?.main ?? [])) for (const edge of output) pending.push(edge.node);
}
const unreachable = workflow.nodes.map((item) => item.name).filter((name) => !reachable.has(name));
if (unreachable.length) throw new Error(`UNREACHABLE_NODES:${unreachable.join(',')}`);

console.log('VERIFIED HYPOTHESIS ENGINE WORKFLOW VALIDATION PASSED');
console.log(JSON.stringify({ nodes: workflow.nodes.length, domainsPerRun: 3, patternsPerDomain: 10,
  maxHypothesesPerDomain: 3, minimumPatterns: 1, minStrengthScore: 0.7,
  credentials: ['Supabase account', 'OpenAI account'], outputStatus: 'ready_for_validation', humanGate: 'signals_only' }, null, 2));