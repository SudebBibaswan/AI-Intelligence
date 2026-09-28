const assert = require('assert');
const workflow = require('./verified_pattern_engine.json');

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
  observations_per_domain: 12, max_patterns_per_domain: 3,
  model: 'gpt-6-luna', engine_version: 'pattern-engine-v1.0.0',
};
const domainId = '22222222-2222-4222-a222-222222222222';
const observationRows = [
  { observation_id: 'cccccccc-cccc-4ccc-cccc-ccccccccccc1', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    observation_type: 'capital_flow', title: 'Infrastructure financing round completed',
    statement: 'Crusoe announced a financing round for infrastructure expansion.',
    time_window_start: '', time_window_end: '', confidence: 0.75,
    signal_count: 2, source_count: 2,
    source_ids: ['bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb1', 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb2'],
    accepted_at: '2026-09-20T10:00:00Z' },
  { observation_id: 'cccccccc-cccc-4ccc-cccc-ccccccccccc2', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    observation_type: 'capital_flow', title: 'Communications infrastructure debt financing',
    statement: 'Bird.com completed debt financing for communications infrastructure.',
    time_window_start: '', time_window_end: '', confidence: 0.75,
    signal_count: 2, source_count: 2,
    source_ids: ['bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb3', 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb4'],
    accepted_at: '2026-09-21T10:00:00Z' },
  { observation_id: 'cccccccc-cccc-4ccc-cccc-ccccccccccc3', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    observation_type: 'market_activity', title: 'AI infrastructure provider expands capacity',
    statement: 'Lambda Labs announced new GPU cluster deployment across multiple regions.',
    time_window_start: '', time_window_end: '', confidence: 0.75,
    signal_count: 2, source_count: 2,
    source_ids: ['bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb5', 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb6'],
    accepted_at: '2026-09-22T10:00:00Z' },
  { observation_id: 'cccccccc-cccc-4ccc-cccc-ccccccccccc4', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    observation_type: 'technology_adoption', title: 'Enterprise adopts AI training platform',
    statement: 'A major enterprise customer deployed a managed AI training platform.',
    time_window_start: '', time_window_end: '', confidence: 0.75,
    signal_count: 2, source_count: 2,
    source_ids: ['bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb7', 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb8'],
    accepted_at: '2026-09-23T10:00:00Z' },
];

const packs = runCode('Build Diverse Observation Packs', observationRows, { 'Pattern Engine Configuration': config });
assert.equal(packs.length, 1);
assert.equal(packs[0].json.observation_items.length, 4);
assert.equal(packs[0].json.source_family_count, 8);

const pack = packs[0].json;
const request = runCode('Build Pattern Request', pack)[0].json;
assert.equal(request.openai_request.text.format.name, 'accepted_observation_patterns');
assert.equal(request.openai_request.text.format.strict, true);

const modelOutput = { patterns: [
  {
    pattern_type: 'capital_flow', title: 'AI infrastructure providers complete large financing events',
    statement: 'Crusoe and Bird.com each completed financing events associated with infrastructure expansion, and Lambda Labs expanded GPU capacity.',
    time_window_start: '', time_window_end: '',
    first_detected_at: '2026-09-20T10:00:00Z', last_confirmed_at: '2026-09-22T10:00:00Z',
    strength_score: 0.72, persistence_score: 0.65, diversity_score: 0.8, confidence: 0.72,
    observations: [
      { observation_id: observationRows[0].observation_id, role: 'supporting', weight: 0.8 },
      { observation_id: observationRows[1].observation_id, role: 'supporting', weight: 0.8 },
      { observation_id: observationRows[2].observation_id, role: 'supporting', weight: 0.75 },
    ],
  },
  {
    pattern_type: 'capital_flow', title: 'Insufficient observations candidate',
    statement: 'This candidate cites only two accepted observations and therefore must be rejected.',
    time_window_start: '', time_window_end: '',
    first_detected_at: '2026-09-20T10:00:00Z', last_confirmed_at: '2026-09-21T10:00:00Z',
    strength_score: 0.7, persistence_score: 0.6, diversity_score: 0.5, confidence: 0.7,
    observations: [
      { observation_id: observationRows[0].observation_id, role: 'supporting', weight: 0.8 },
      { observation_id: observationRows[1].observation_id, role: 'supporting', weight: 0.8 },
    ],
  },
  {
    pattern_type: 'capital_flow', title: 'AI infrastructure financing trend predicts continued growth',
    statement: 'These events prove a recurring pattern that predicts continued infrastructure financing.',
    time_window_start: '', time_window_end: '',
    first_detected_at: '2026-09-20T10:00:00Z', last_confirmed_at: '2026-09-22T10:00:00Z',
    strength_score: 0.9, persistence_score: 0.8, diversity_score: 0.9, confidence: 0.9,
    observations: [
      { observation_id: observationRows[0].observation_id, role: 'supporting', weight: 0.8 },
      { observation_id: observationRows[1].observation_id, role: 'supporting', weight: 0.8 },
      { observation_id: observationRows[2].observation_id, role: 'supporting', weight: 0.75 },
    ],
  },
] };
const response = { output: [{ content: [{ type: 'output_text', text: JSON.stringify(modelOutput) }] }] };
const candidates = runCode('Validate Pattern Candidates', response, { 'Build Pattern Request': request });
assert.equal(candidates.length, 1);
assert.equal(candidates[0].json.p_pattern.observations.length, 3);
assert.equal(candidates[0].json.candidate_quality.input_source_family_count, 6);
assert.equal(candidates[0].json.candidates_rejected, 2);
assert.equal(candidates[0].json.p_pattern.title, 'AI infrastructure providers complete large financing events');
assert.equal(candidates[0].json.p_pattern.statement,
  'Crusoe and Bird.com each completed financing events associated with infrastructure expansion, and Lambda Labs expanded GPU capacity.');

const empty = runCode('Validate Pattern Candidates',
  { output: [{ content: [{ type: 'output_text', text: '{"patterns":[]}' }] }] },
  { 'Build Pattern Request': request });
assert.equal(empty[0].json.no_pattern, true);

const syndicatedObservationRows = [
  { observation_id: 'cccccccc-cccc-4ccc-cccc-ccccccccccc1', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    observation_type: 'capital_flow', title: 'Infrastructure financing round completed',
    statement: 'Crusoe announced a financing round for infrastructure expansion.',
    time_window_start: '', time_window_end: '', confidence: 0.75,
    signal_count: 2, source_count: 2,
    source_ids: ['bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb1', 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb2'],
    accepted_at: '2026-09-20T10:00:00Z' },
  { observation_id: 'cccccccc-cccc-4ccc-cccc-ccccccccccc2', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    observation_type: 'capital_flow', title: 'Communications infrastructure debt financing',
    statement: 'Bird.com completed debt financing for communications infrastructure.',
    time_window_start: '', time_window_end: '', confidence: 0.75,
    signal_count: 2, source_count: 2,
    source_ids: ['bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb1', 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb2'],
    accepted_at: '2026-09-21T10:00:00Z' },
  { observation_id: 'cccccccc-cccc-4ccc-cccc-ccccccccccc3', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    observation_type: 'market_activity', title: 'AI infrastructure provider expands capacity',
    statement: 'Lambda Labs announced new GPU cluster deployment across multiple regions.',
    time_window_start: '', time_window_end: '', confidence: 0.75,
    signal_count: 2, source_count: 2,
    source_ids: ['bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb1', 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb2'],
    accepted_at: '2026-09-22T10:00:00Z' },
];
const syndicatedPack = { ...pack, observation_items: syndicatedObservationRows };
const syndicatedRequest = runCode('Build Pattern Request', syndicatedPack)[0].json;
const syndicatedResponse = { output: [{ content: [{ type: 'output_text', text: JSON.stringify({
  patterns: [{
    pattern_type: 'capital_flow', title: 'Fake diversity from syndicated sources',
    statement: 'Three observations but only two source families.',
    time_window_start: '', time_window_end: '',
    first_detected_at: '2026-09-20T10:00:00Z', last_confirmed_at: '2026-09-22T10:00:00Z',
    strength_score: 0.7, persistence_score: 0.6, diversity_score: 0.5, confidence: 0.7,
    observations: [
      { observation_id: syndicatedObservationRows[0].observation_id, role: 'supporting', weight: 0.8 },
      { observation_id: syndicatedObservationRows[1].observation_id, role: 'supporting', weight: 0.8 },
      { observation_id: syndicatedObservationRows[2].observation_id, role: 'supporting', weight: 0.75 },
    ],
  }]
}) }] }] };
const syndicatedCandidates = runCode('Validate Pattern Candidates', syndicatedResponse, { 'Build Pattern Request': syndicatedRequest });
assert.equal(syndicatedCandidates.length, 1);
assert.equal(syndicatedCandidates[0].json.no_pattern, true);

console.log('VERIFIED PATTERN ENGINE LOGIC TESTS PASSED');
console.log(JSON.stringify({ acceptedObservations: pack.observation_items.length, independentSourceFamilies: pack.source_family_count,
  acceptedCandidates: candidates.length, rejectedCandidates: candidates[0].json.candidates_rejected,
  insufficientObservationsRejected: true, syndicatedSourcesRejected: true, patternLanguageRejected: true, textIntegrityPreserved: true }, null, 2));