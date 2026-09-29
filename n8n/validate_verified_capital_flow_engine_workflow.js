const fs = require('fs');
const path = require('path');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_capital_flow_engine.json'), 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const required = [
  'Manual Trigger', 'Daily Capital Flow', 'Capital Flow Configuration', 'Load Pattern-Entity Candidates',
  'Group by Entity', 'Entity Capital Flow Loop', 'Has Pattern Matches?',
  'Build Capital Flow Request', 'OpenAI Capital Flow Mapping', 'Validate Capital Flow Mappings',
  'Mapping Loop', 'Has Valid Mapping?', 'Persist Capital Flow Mapping',
  'Mapping Complete', 'Skipped Mapping',
  'Entity Capital Flow Complete', 'No Matches Entity Complete', 'Capital Flow Engine Summary',
];
for (const name of required) if (!nodes.has(name)) throw new Error(`MISSING_NODE:${name}`);

const config = nodes.get('Capital Flow Configuration').parameters.jsCode;
for (const fragment of ['min_pattern_strength: 0.5', 'max_patterns: 50',
  "engine_version: 'capital-flow-engine-v1.0.0'"]) {
  if (!config.includes(fragment)) throw new Error(`MISSING_CAPITAL_CAP:${fragment}`);
}
const load = nodes.get('Load Pattern-Entity Candidates');
if (!String(load.parameters.url).includes('/rpc/n8n_list_capital_flow_candidates')) {
  throw new Error('CAPITAL_FLOW_CANDIDATES_RPC_NOT_USED');
}
if (load.credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('CENTRAL_SUPABASE_CREDENTIAL_NOT_REUSED');
const openai = nodes.get('OpenAI Capital Flow Mapping');
if (openai.credentials?.openAiApi?.name !== 'OpenAI account') throw new Error('CENTRAL_OPENAI_CREDENTIAL_NOT_REUSED');
const request = nodes.get('Build Capital Flow Request').parameters.jsCode;
for (const fragment of ['additionalProperties: false', "name: 'entity_capital_flow_mappings'",
  'capital direction', 'sector/stage/geography tags', 'check sizes and deal count']) {
  if (!request.includes(fragment)) throw new Error(`MISSING_CAPITAL_PROMPT:${fragment}`);
}
const validation = nodes.get('Validate Capital Flow Mappings').parameters.jsCode;
for (const fragment of ['patternById.get', 'matchConfidence < 0.4', 'confidence < 0.4',
  "if (character.trim() === '')", 'no_mapping: true']) {
  if (!validation.includes(fragment)) throw new Error(`MISSING_CAPITAL_VALIDATION:${fragment}`);
}
if (validation.includes("replace(/s+/g, ' ')")) throw new Error('LETTER_S_CORRUPTION_REGRESSION');
const persist = nodes.get('Persist Capital Flow Mapping');
if (!String(persist.parameters.url).includes('/rpc/n8n_upsert_capital_flow_mapping')) {
  throw new Error('CAPITAL_FLOW_RPC_NOT_USED');
}
if (persist.credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('PERSIST_CREDENTIAL_NOT_REUSED');

const forbiddenPaid = workflow.nodes.filter((item) => /tavily|firecrawl/i.test(`${item.name} ${item.type}`));
if (forbiddenPaid.length) throw new Error(`UNNECESSARY_DISCOVERY_PRESENT:${forbiddenPaid.map((item) => item.name).join(',')}`);

const reachable = new Set();
const pending = ['Manual Trigger', 'Daily Capital Flow'];
while (pending.length) {
  const name = pending.pop();
  if (reachable.has(name)) continue;
  reachable.add(name);
  for (const output of (workflow.connections[name]?.main ?? [])) for (const edge of output) pending.push(edge.node);
}
const unreachable = workflow.nodes.map((item) => item.name).filter((name) => !reachable.has(name));
if (unreachable.length) throw new Error(`UNREACHABLE_NODES:${unreachable.join(',')}`);

console.log('VERIFIED CAPITAL FLOW ENGINE WORKFLOW VALIDATION PASSED');
console.log(JSON.stringify({ nodes: workflow.nodes.length, minPatternStrength: 0.5, maxPatterns: 50,
  matchTypes: ['revealed_thesis_match','stated_thesis_match','pattern_entity_overlap','thesis_driven'],
  capitalDirections: ['inflow','outflow','bidirectional'],
  credentials: ['Supabase account', 'OpenAI account'], outputStatus: 'draft', humanGate: 'signals_only' }, null, 2));