const assert = require('assert');
const workflow = require('./verified_observation_engine.json');

const byName = new Map(workflow.nodes.map((node) => [node.name, node]));
function runCode(name, inputJson, references = {}) {
  const target = byName.get(name);
  assert(target, `Missing node ${name}`);
  const inputItems = (Array.isArray(inputJson) ? inputJson : [inputJson]).map((json) => ({ json }));
  const $input = { all: () => inputItems, first: () => inputItems[0], item: inputItems[0] };
  const $ = (referenceName) => {
    const value = references[referenceName];
    if (value === undefined) throw new Error(`Missing test reference ${referenceName}`);
    const items = (Array.isArray(value) ? value : [value]).map((json) => ({ json }));
    return { all: () => items, first: () => items[0], item: items[0] };
  };
  return new Function('$input', '$', target.parameters.jsCode)($input, $);
}

const config = {
  workspace_id: '11111111-1111-4111-a111-111111111111', domain_limit: 3,
  signals_per_domain: 12, max_observations_per_domain: 4,
  model: 'gpt-6-luna', engine_version: 'observation-engine-v1.1.0',
};
const domainId = '22222222-2222-4222-a222-222222222222';
const signalRows = [
  { signal_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa1', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    signal_type: 'funding', title: 'Crusoe announces infrastructure financing',
    summary: 'Crusoe announced a financing round for infrastructure expansion.', confidence: 0.75,
    novelty_score: 0.7, importance_score: 0.8, evidence_count: 1, independent_source_count: 1,
    source_ids: ['bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb1'] },
  { signal_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa2', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    signal_type: 'funding', title: 'Bird.com completes communications financing',
    summary: 'Bird.com completed debt financing for communications infrastructure.', confidence: 0.75,
    novelty_score: 0.65, importance_score: 0.65, evidence_count: 1, independent_source_count: 1,
    source_ids: ['bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb2'] },
  { signal_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa3', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    signal_type: 'research', title: 'Study reports repeat-run reliability',
    summary: 'A research study reports repeat-run reliability measurements.', confidence: 0.75,
    novelty_score: 0.55, importance_score: 0.55, evidence_count: 2, independent_source_count: 1,
    source_ids: ['bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb3'] },
];

const packs = runCode('Build Diverse Signal Packs', signalRows, { 'Observation Engine Configuration': config });
assert.equal(packs.length, 1);
assert.equal(packs[0].json.signal_items.length, 3);
assert.equal(packs[0].json.source_count, 3);

const pack = packs[0].json;
const request = runCode('Build Observation Request', pack)[0].json;
assert.equal(request.openai_request.text.format.name, 'accepted_signal_observations');
assert.equal(request.openai_request.text.format.strict, true);

const modelOutput = { observations: [
  {
    observation_type: 'capital_flow', title: 'Infrastructure companies completed large financing events',
    statement: 'Crusoe and Bird.com each completed financing events associated with infrastructure expansion.',
    time_window_start: '', time_window_end: '', confidence: 0.72,
    signals: [
      { signal_id: signalRows[0].signal_id, role: 'supporting', weight: 0.8 },
      { signal_id: signalRows[1].signal_id, role: 'supporting', weight: 0.8 },
    ],
  },
  {
    observation_type: 'capital_flow', title: 'Single source candidate',
    statement: 'This candidate cites only one accepted signal and therefore must be rejected.',
    time_window_start: '', time_window_end: '', confidence: 0.7,
    signals: [{ signal_id: signalRows[0].signal_id, role: 'supporting', weight: 0.8 }],
  },
  {
    observation_type: 'capital_flow', title: 'Infrastructure financing trend',
    statement: 'These events prove a recurring pattern that predicts continued infrastructure financing.',
    time_window_start: '', time_window_end: '', confidence: 0.9,
    signals: [
      { signal_id: signalRows[0].signal_id, role: 'supporting', weight: 0.8 },
      { signal_id: signalRows[1].signal_id, role: 'supporting', weight: 0.8 },
    ],
  },
] };
const response = { output: [{ content: [{ type: 'output_text', text: JSON.stringify(modelOutput) }] }] };
const candidates = runCode('Validate Observation Candidates', response, { 'Build Observation Request': request });
assert.equal(candidates.length, 1);
assert.equal(candidates[0].json.p_observation.signals.length, 2);
assert.equal(candidates[0].json.candidate_quality.input_source_count, 2);
assert.equal(candidates[0].json.candidates_rejected, 2);
assert.equal(candidates[0].json.p_observation.title, 'Infrastructure companies completed large financing events');
assert.equal(candidates[0].json.p_observation.statement,
  'Crusoe and Bird.com each completed financing events associated with infrastructure expansion.');

const empty = runCode('Validate Observation Candidates',
  { output: [{ content: [{ type: 'output_text', text: '{"observations":[]}' }] }] },
  { 'Build Observation Request': request });
assert.equal(empty[0].json.no_observation, true);

console.log('VERIFIED OBSERVATION ENGINE LOGIC TESTS PASSED');
console.log(JSON.stringify({ acceptedSignals: pack.signal_items.length, independentSources: pack.source_count,
  acceptedCandidates: candidates.length, rejectedCandidates: candidates[0].json.candidates_rejected,
  singleSourceRejected: true, patternLanguageRejected: true, textIntegrityPreserved: true }, null, 2));
