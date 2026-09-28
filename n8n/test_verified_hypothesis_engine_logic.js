const assert = require('assert');
const workflow = require('./verified_hypothesis_engine.json');

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
  patterns_per_domain: 10, max_hypotheses_per_domain: 3,
  min_strength_score: 0.7, model: 'gpt-6-luna', engine_version: 'hypothesis-engine-v1.0.0',
};
const domainId = '22222222-2222-4222-a222-222222222222';
const patternRows = [
  { pattern_id: 'dddddddd-dddd-4ddd-dddd-ddddddddddd1', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    pattern_type: 'capital_flow', title: 'AI infrastructure providers complete large financing events',
    statement: 'Crusoe and Bird.com each completed financing events; Lambda Labs expanded GPU capacity.',
    strength_score: 0.8, persistence_score: 0.75, diversity_score: 0.85, confidence: 0.78,
    status: 'persistent', observation_count: 3, source_family_count: 6, event_entity_count: 3,
    has_contradictions: false, first_detected_at: '2026-09-20T10:00:00Z', last_confirmed_at: '2026-09-25T10:00:00Z',
    metadata: {} },
  { pattern_id: 'dddddddd-dddd-4ddd-dddd-ddddddddddd2', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    pattern_type: 'technology_adoption', title: 'Enterprise adoption of managed AI training platforms accelerates',
    statement: 'Multiple enterprises deployed managed AI training platforms in Q3 2026.',
    strength_score: 0.72, persistence_score: 0.68, diversity_score: 0.7, confidence: 0.7,
    status: 'emerging', observation_count: 3, source_family_count: 4, event_entity_count: 2,
    has_contradictions: false, first_detected_at: '2026-09-15T10:00:00Z', last_confirmed_at: '2026-09-28T10:00:00Z',
    metadata: {} },
];

const packs = runCode('Build Diverse Pattern Packs', patternRows, { 'Hypothesis Engine Configuration': config });
assert.equal(packs.length, 1);
assert.equal(packs[0].json.pattern_items.length, 2);
assert.equal(packs[0].json.pattern_count, 2);

const pack = packs[0].json;
const request = runCode('Build Hypothesis Request', pack)[0].json;
assert.equal(request.openai_request.text.format.name, 'pattern_hypotheses');
assert.equal(request.openai_request.text.format.strict, true);

const modelOutput = { hypotheses: [
  {
    pattern_type: 'capital_flow', title: 'Enterprise GPU compute demand outstrips supply',
    statement: 'Large financing rounds and capacity expansions indicate enterprise GPU compute demand exceeds available supply.',
    target_user: 'AI infrastructure startup founders', problem: 'Cannot access sufficient GPU compute for training/inference',
    proposed_value: 'A marketplace for fragmented GPU capacity with flexible contracts',
    assumptions: ['Enterprise GPU demand will continue growing', 'Current providers cannot meet peak demand', 'Fragmented capacity exists but is hard to discover'],
    falsifiers: ['Major cloud providers announce massive new GPU capacity coming online', 'Enterprise GPU demand plateaus or declines'],
    validation_questions: ['What fraction of enterprise GPU workloads run on-prem vs cloud?', 'How much idle GPU capacity exists in mid-market data centers?'],
    confidence: 0.75,
    patterns: [
      { pattern_id: patternRows[0].pattern_id, role: 'primary', weight: 0.9 },
      { pattern_id: patternRows[1].pattern_id, role: 'supporting', weight: 0.7 },
    ],
  },
  {
    pattern_type: 'capital_flow', title: 'Funding proves demand for GPU marketplaces',
    statement: 'The large financing rounds prove there is demand for GPU marketplace solutions.',
    target_user: 'AI infrastructure startup founders', problem: 'Cannot access sufficient GPU compute',
    proposed_value: 'A GPU marketplace',
    assumptions: ['Demand exists'], falsifiers: ['Supply increases'], validation_questions: ['Is there demand?'],
    confidence: 0.9,
    patterns: [{ pattern_id: patternRows[0].pattern_id, role: 'primary', weight: 0.9 }],
  },
  {
    pattern_type: 'capital_flow', title: 'Missing target_user',
    statement: 'A hypothesis without a target user should be rejected.',
    target_user: '', problem: 'Some problem',
    proposed_value: 'Some value',
    assumptions: ['Assumption'], falsifiers: ['Falsifier'], validation_questions: ['Question'],
    confidence: 0.7,
    patterns: [{ pattern_id: patternRows[0].pattern_id, role: 'primary', weight: 0.9 }],
  },
  {
    pattern_type: 'capital_flow', title: 'Missing assumptions',
    statement: 'A hypothesis without assumptions should be rejected.',
    target_user: 'Some user', problem: 'Some problem',
    proposed_value: 'Some value',
    assumptions: [], falsifiers: ['Falsifier'], validation_questions: ['Question'],
    confidence: 0.7,
    patterns: [{ pattern_id: patternRows[0].pattern_id, role: 'primary', weight: 0.9 }],
  },
] };
const response = { output: [{ content: [{ type: 'output_text', text: JSON.stringify(modelOutput) }] }] };
const candidates = runCode('Validate Hypothesis Candidates', response, { 'Build Hypothesis Request': request });
assert.equal(candidates.length, 1);
assert.equal(candidates[0].json.p_hypothesis.patterns.length, 2);
assert.equal(candidates[0].json.p_hypothesis.target_user, 'AI infrastructure startup founders');
assert.equal(candidates[0].json.p_hypothesis.problem, 'Cannot access sufficient GPU compute for training/inference');
assert.equal(candidates[0].json.p_hypothesis.assumptions.length, 3);
assert.equal(candidates[0].json.p_hypothesis.falsifiers.length, 2);
assert.equal(candidates[0].json.p_hypothesis.validation_questions.length, 2);
assert.equal(candidates[0].json.candidates_rejected, 3);

const empty = runCode('Validate Hypothesis Candidates',
  { output: [{ content: [{ type: 'output_text', text: '{"hypotheses":[]}' }] }] },
  { 'Build Hypothesis Request': request });
assert.equal(empty[0].json.no_hypothesis, true);

const singlePatternPack = { ...pack, pattern_items: [patternRows[0]] };
const singlePatternRequest = runCode('Build Hypothesis Request', singlePatternPack)[0].json;
const singlePatternResponse = { output: [{ content: [{ type: 'output_text', text: JSON.stringify({
  hypotheses: [{
    pattern_type: 'capital_flow', title: 'Single pattern hypothesis',
    statement: 'A hypothesis citing only one eligible pattern.',
    target_user: 'Some user', problem: 'Some problem',
    proposed_value: 'Some value',
    assumptions: ['Assumption'], falsifiers: ['Falsifier'], validation_questions: ['Question'],
    confidence: 0.7,
    patterns: [{ pattern_id: patternRows[0].pattern_id, role: 'primary', weight: 0.9 }],
  }]
}) }] }] };
const singlePatternCandidates = runCode('Validate Hypothesis Candidates', singlePatternResponse, { 'Build Hypothesis Request': singlePatternRequest });
assert.equal(singlePatternCandidates.length, 1);
assert.equal(singlePatternCandidates[0].json.p_hypothesis.patterns.length, 1);

console.log('VERIFIED HYPOTHESIS ENGINE LOGIC TESTS PASSED');
console.log(JSON.stringify({ eligiblePatterns: pack.pattern_items.length, persistentPatterns: pack.pattern_items.filter(p => p.status === 'persistent').length,
  acceptedCandidates: candidates.length, rejectedCandidates: candidates[0].json.candidates_rejected,
  fundingOnlyRejected: true, missingFieldsRejected: true, singlePatternAccepted: true, textIntegrityPreserved: true }, null, 2));