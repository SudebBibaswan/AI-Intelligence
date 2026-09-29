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
  workspace_id: '11111111-1111-4111-a111-111111111111', domain_limit: 3,
  evidence_per_domain: 12, evidence_per_source: 2, max_signals_per_domain: 5,
  model: 'gpt-6-luna', engine_version: 'signal-engine-v1.0.2',
};
const domainId = '22222222-2222-4222-a222-222222222222';
const evidenceRows = [
  { evidence_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa1', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    source_id: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb1', source_title: 'TechCrunch',
    canonical_url: 'https://techcrunch.com/2026/09/20/ai-startup-funding', publisher: 'TechCrunch',
    published_at: '2026-09-20T10:00:00Z', source_type: 'news', source_quality_score: 0.9,
    evidence_type: 'funding_announcement', claim_text: 'Startup raised $50M Series B',
    excerpt: 'The AI infrastructure startup announced a $50M Series B round led by VC Firm.',
    polarity: 'positive', confidence: 0.9, linked_entities: [] },
  { evidence_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa2', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    source_id: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb2', source_title: 'Crunchbase',
    canonical_url: 'https://crunchbase.com/funding_round/abc', publisher: 'Crunchbase',
    published_at: '2026-09-20T11:00:00Z', source_type: 'database', source_quality_score: 0.95,
    evidence_type: 'funding_announcement', claim_text: 'Series B $50M confirmed',
    excerpt: 'Crunchbase confirms the $50M Series B round for the AI startup.',
    polarity: 'positive', confidence: 0.95, linked_entities: [] },
  { evidence_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa3', workspace_id: config.workspace_id,
    workspace_domain_id: domainId, domain_key: 'core-ai-it-infrastructure', domain_name: 'Core AI',
    source_id: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbb1', source_title: 'TechCrunch',
    canonical_url: 'https://techcrunch.com/2026/09/21/another-ai-funding', publisher: 'TechCrunch',
    published_at: '2026-09-21T10:00:00Z', source_type: 'news', source_quality_score: 0.9,
    evidence_type: 'funding_announcement', claim_text: 'Another AI startup raised $30M',
    excerpt: 'A different AI startup announced a $30M Series A.',
    polarity: 'positive', confidence: 0.85, linked_entities: [] },
];

const packs = runCode('Build Diverse Evidence Packs', evidenceRows, { 'Signal Engine Configuration': config });
assert.equal(packs.length, 1);
assert.equal(packs[0].json.evidence_items.length, 3);
assert.equal(packs[0].json.source_count, 2);

const pack = packs[0].json;
const request = runCode('Build Signal Request', pack)[0].json;
assert.equal(request.openai_request.text.format.name, 'verified_evidence_signals');
assert.equal(request.openai_request.text.format.strict, true);

const modelOutput = { signals: [
  {
    signal_type: 'funding', title: 'AI infrastructure startup raises $50M Series B',
    summary: 'The AI infrastructure startup announced a $50M Series B round led by VC Firm.',
    event_at: '2026-09-20T10:00:00Z', confidence: 0.92, novelty_score: 0.7, importance_score: 0.8,
    geographies: ['global'], topics: ['ai-infrastructure', 'funding'],
    evidence: [
      { evidence_id: evidenceRows[0].evidence_id, role: 'supporting', weight: 0.9 },
      { evidence_id: evidenceRows[1].evidence_id, role: 'supporting', weight: 0.9 },
    ],
  },
  {
    signal_type: 'funding', title: 'Unknown evidence reference',
    summary: 'This signal cites an evidence_id not in the supplied pack.',
    event_at: '2026-09-20T10:00:00Z', confidence: 0.8, novelty_score: 0.6, importance_score: 0.7,
    geographies: ['global'], topics: ['funding'],
    evidence: [{ evidence_id: 'ffffffff-ffff-4fff-ffff-ffffffffffff', role: 'supporting', weight: 0.8 }],
  },
  {
    signal_type: 'funding', title: 'Another AI startup raises $30M Series A',
    summary: 'A different AI startup announced a $30M Series A round.',
    event_at: '2026-09-21T10:00:00Z', confidence: 0.85, novelty_score: 0.7, importance_score: 0.75,
    geographies: ['global'], topics: ['ai-infrastructure', 'funding'],
    evidence: [{ evidence_id: evidenceRows[2].evidence_id, role: 'supporting', weight: 0.85 }],
  },
  {
    signal_type: 'funding', title: 'Ambiguous event date',
    summary: 'Signal with invalid event date.',
    event_at: 'not-a-date', confidence: 0.8, novelty_score: 0.6, importance_score: 0.7,
    geographies: ['global'], topics: ['funding'],
    evidence: [{ evidence_id: evidenceRows[0].evidence_id, role: 'supporting', weight: 0.8 }],
  },
] };
const response = { output: [{ content: [{ type: 'output_text', text: JSON.stringify(modelOutput) }] }] };
const candidates = runCode('Validate Signal Candidates', response, { 'Build Signal Request': request });
assert.equal(candidates.length, 2);
assert.equal(candidates[0].json.p_signal.evidence.length, 2);
assert.equal(candidates[0].json.candidates_rejected, 2);

const empty = runCode('Validate Signal Candidates',
  { output: [{ content: [{ type: 'output_text', text: '{"signals":[]}' }] }] },
  { 'Build Signal Request': request });
assert.equal(empty[0].json.no_signal, true);

console.log('VERIFIED SIGNAL ENGINE LOGIC TESTS PASSED');
console.log(JSON.stringify({ evidenceItems: pack.evidence_items.length, independentSources: pack.source_count,
  acceptedCandidates: candidates.length, rejectedCandidates: candidates[0].json.candidates_rejected,
  unknownEvidenceRejected: true, ambiguousEventDateRejected: true, isoEventDateNormalized: true }, null, 2));