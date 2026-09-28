const assert = require('assert');
const workflow = require('./verified_signal_engine.json');

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
  workspace_id: '11111111-1111-4111-a111-111111111111',
  domain_limit: 3,
  evidence_per_domain: 12,
  evidence_per_source: 2,
  max_signals_per_domain: 5,
  model: 'gpt-6-luna',
  engine_version: 'signal-engine-v1.0.2',
};
const domainId = '22222222-2222-4222-a222-222222222222';
const evidenceRows = [
  { evidence_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa1', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    source_id: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb1', source_title: 'Primary announcement',
    canonical_url: 'https://example.com/a', claim_text: 'Company A launched a new inference system.',
    excerpt: 'Company A launched a new inference system.', confidence: 0.9 },
  { evidence_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa2', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    source_id: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb1', source_title: 'Primary announcement',
    canonical_url: 'https://example.com/a', claim_text: 'The system reduces inference latency.',
    excerpt: 'The system reduces inference latency.', confidence: 0.88 },
  { evidence_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa3', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    source_id: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb2', source_title: 'Independent report',
    canonical_url: 'https://example.org/b', claim_text: 'Independent testing reported lower latency.',
    excerpt: 'Independent testing reported lower latency.', confidence: 0.84 },
];

const packs = runCode('Build Diverse Evidence Packs', evidenceRows, { 'Signal Engine Configuration': config });
assert.equal(packs.length, 1);
assert.equal(packs[0].json.evidence_items.length, 3);
assert.equal(packs[0].json.source_count, 2);

const pack = packs[0].json;
const request = runCode('Build Signal Request', pack)[0].json;
assert.equal(request.openai_request.text.format.name, 'verified_evidence_signals');
assert.equal(request.openai_request.text.format.strict, true);

const modelOutput = {
  signals: [
    {
      signal_type: 'technology', title: 'Crusoe announces closing of infrastructure financing',
      summary: 'Crusoe describes its infrastructure financing and systems expansion.',
      event_at: '', confidence: 0.86, novelty_score: 0.7, importance_score: 0.8,
      geographies: [], topics: ['inference infrastructure'],
      evidence: [
        { evidence_id: evidenceRows[0].evidence_id, role: 'supporting', weight: 0.8 },
        { evidence_id: evidenceRows[2].evidence_id, role: 'supporting', weight: 0.8 },
      ],
    },
    {
      signal_type: 'technology', title: 'Unsupported signal must be rejected',
      summary: 'This candidate cites an evidence identifier that was never supplied to the model.',
      event_at: '', confidence: 0.9, novelty_score: 0.9, importance_score: 0.9,
      geographies: [], topics: [],
      evidence: [{ evidence_id: 'cccccccc-cccc-4ccc-accc-cccccccccccc', role: 'supporting', weight: 1 }],
    },
    {
      signal_type: 'technology', title: 'Crusoe announces closing of infrastructure financing',
      summary: 'A duplicate candidate should be rejected before persistence.',
      event_at: '', confidence: 0.8, novelty_score: 0.6, importance_score: 0.7,
      geographies: [], topics: [],
      evidence: [{ evidence_id: evidenceRows[0].evidence_id, role: 'supporting', weight: 0.7 }],
    },
  ],
};
const response = { output: [{ content: [{ type: 'output_text', text: JSON.stringify(modelOutput) }] }] };
const candidates = runCode('Validate Signal Candidates', response, { 'Build Signal Request': request });
assert.equal(candidates.length, 1);
assert.equal(candidates[0].json.p_signal.evidence.length, 2);
assert.equal(candidates[0].json.candidate_quality.input_source_count, 2);
assert.equal(candidates[0].json.candidates_rejected, 2);
assert.equal(candidates[0].json.p_signal.metadata.generation_mode, 'verified_evidence_only');
assert.equal(candidates[0].json.p_signal.title, 'Crusoe announces closing of infrastructure financing');
assert.equal(candidates[0].json.p_signal.summary, 'Crusoe describes its infrastructure financing and systems expansion.');

const datedOutput = { signals: [
  {
    signal_type: 'funding', title: 'Temporal closes a reported financing round',
    summary: 'Temporal Technologies reportedly closed a financing round on the cited date.',
    event_at: '2026-09-14', confidence: 0.9, novelty_score: 0.7, importance_score: 0.8,
    geographies: [], topics: ['funding'],
    evidence: [{ evidence_id: evidenceRows[0].evidence_id, role: 'supporting', weight: 1 }],
  },
  {
    signal_type: 'funding', title: 'Ambiguous partial event date is rejected',
    summary: 'This otherwise valid candidate uses a month and day without an explicit year.',
    event_at: 'September 14', confidence: 0.9, novelty_score: 0.7, importance_score: 0.8,
    geographies: [], topics: ['funding'],
    evidence: [{ evidence_id: evidenceRows[0].evidence_id, role: 'supporting', weight: 1 }],
  },
] };
const datedResponse = { output: [{ content: [{ type: 'output_text', text: JSON.stringify(datedOutput) }] }] };
const datedCandidates = runCode('Validate Signal Candidates', datedResponse, { 'Build Signal Request': request });
assert.equal(datedCandidates.length, 1);
assert.equal(datedCandidates[0].json.p_signal.event_at, '2026-09-14T00:00:00.000Z');
assert.equal(datedCandidates[0].json.candidates_rejected, 1);
assert.equal(datedCandidates[0].json.p_signal.engine_version, 'signal-engine-v1.0.2');

const empty = runCode('Validate Signal Candidates', { output: [{ content: [{ type: 'output_text', text: '{"signals":[]}' }] }] },
  { 'Build Signal Request': request });
assert.equal(empty[0].json.no_signal, true);

console.log('VERIFIED SIGNAL ENGINE LOGIC TESTS PASSED');
console.log(JSON.stringify({ evidenceItems: pack.evidence_items.length, independentSources: pack.source_count,
  acceptedCandidates: candidates.length, rejectedCandidates: candidates[0].json.candidates_rejected,
  unknownEvidenceRejected: true, duplicateCandidateRejected: true, ambiguousEventDateRejected: true,
  isoEventDateNormalized: true }, null, 2));
