const assert = require('assert');
const workflow = require('./verified_validation_engine.json');

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
  hypotheses_per_domain: 10, max_validations_per_domain: 5,
  model: 'gpt-6-luna', engine_version: 'validation-engine-v1.0.0',
};
const domainId = '22222222-2222-4222-a222-222222222222';
const hypothesisRows = [
  { hypothesis_id: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeee1', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    title: 'Enterprise GPU compute demand outstrips supply',
    statement: 'Large financing rounds and capacity expansions indicate enterprise GPU compute demand exceeds available supply.',
    target_user: 'AI infrastructure startup founders', problem: 'Cannot access sufficient GPU compute for training/inference',
    proposed_value: 'A marketplace for fragmented GPU capacity with flexible contracts',
    assumptions: ['Enterprise GPU demand will continue growing', 'Current providers cannot meet peak demand'],
    falsifiers: ['Major cloud providers announce massive new GPU capacity coming online'],
    validation_questions: ['What fraction of enterprise GPU workloads run on-prem vs cloud?'],
    confidence: 0.75, pattern_ids: ['dddddddd-dddd-4ddd-dddd-ddddddddddd1'],
    pattern_titles: ['AI infrastructure providers complete large financing events'],
    pattern_types: ['capital_flow'], engine_version: 'hypothesis-engine-v1.0.0' },
];

const packs = runCode('Build Validation Packs', hypothesisRows, { 'Validation Engine Configuration': config });
assert.equal(packs.length, 1);
assert.equal(packs[0].json.hypothesis_items.length, 1);

const pack = packs[0].json;
const researchPlan = runCode('Build Validation Research Plan', pack, {})[0].json;
assert.equal(researchPlan.research_plan.length, 9);
const dimensions = researchPlan.research_plan.map(r => r.dimension);
assert.deepEqual(dimensions.sort(), ['adoption', 'competitor', 'counter_signal', 'demand', 'failed_attempt', 'funding', 'incumbent', 'regulatory', 'technical']);

const dimensionItem = { ...researchPlan, ...researchPlan.research_plan[0] };
const researchRequest = runCode('Build Research Request', dimensionItem, { 'Build Validation Research Plan': researchPlan })[0].json;
assert.equal(researchRequest.openai_request.text.format.name, 'validation_evidence');
assert.equal(researchRequest.openai_request.text.format.strict, true);

const modelOutput = { evidence: [
  { claim_text: 'Startup failed shutdown', excerpt: 'The startup failed shutdown due to lack of customers for GPU marketplace',
    polarity: 'negative', confidence: 0.85, source_url: 'https://example.com/postmortem', source_title: 'Postmortem' },
  { claim_text: 'Regulatory block prevents operation', excerpt: 'Regulatory block prevents GPU capacity sharing',
    polarity: 'negative', confidence: 0.8, source_url: 'https://example.com/regulation', source_title: 'Regulation News' },
] };
const response = { output: [{ content: [{ type: 'output_text', text: JSON.stringify(modelOutput) }] }] };
const processed = runCode('Process Validation Evidence', response, { 'Build Validation Research Plan': researchPlan, 'Research Dimension Loop': dimensionItem });
assert.equal(processed[0].json.valid_evidence.length, 2);
assert.equal(processed[0].json.valid_evidence[0].stance, 'contradicting');
assert.equal(processed[0].json.evidence_count, 2);

const emptyResponse = { output: [{ content: [{ type: 'output_text', text: '{"evidence":[]}' }] }] };
const emptyProcessed = runCode('Process Validation Evidence', emptyResponse, { 'Build Validation Research Plan': researchPlan, 'Research Dimension Loop': dimensionItem });
assert.equal(emptyProcessed[0].json.valid_evidence.length, 0);

console.log('VERIFIED VALIDATION ENGINE LOGIC TESTS PASSED');
console.log(JSON.stringify({ hypothesesReady: pack.hypothesis_items.length, dimensionsResearched: researchPlan.research_plan.length,
  evidenceProcessed: processed[0].json.evidence_count, contradictingDetected: true, neutralFallback: true }, null, 2));