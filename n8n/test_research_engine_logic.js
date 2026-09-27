const assert = require('assert');
const workflow = require('./research_engine_complete.json');

const byName = new Map(workflow.nodes.map((node) => [node.name, node]));

function runCode(name, inputJson, references = {}) {
  const node = byName.get(name);
  assert(node, `Missing node ${name}`);
  const inputItems = Array.isArray(inputJson) ? inputJson.map((json) => ({ json })) : [{ json: inputJson }];
  const $input = {
    all: () => inputItems,
    first: () => inputItems[0],
    item: inputItems[0],
  };
  const $ = (referenceName) => {
    const values = Array.isArray(references[referenceName]) ? references[referenceName] : [references[referenceName]];
    const items = values.filter((value) => value !== undefined).map((json) => ({ json }));
    if (!items.length) throw new Error(`Missing test reference ${referenceName}`);
    return {
      all: () => items,
      first: () => items[0],
      item: items[0],
    };
  };
  return new Function('$input', '$', 'require', node.parameters.jsCode)($input, $, require);
}

const initial = runCode('Research Request and Limits', {})[0].json;
initial.config.supabase_url = 'https://example.supabase.co';
initial.config.workspace_id = '11111111-1111-4111-a111-111111111111';
initial.config.workspace_domain_id = '22222222-2222-4222-a222-222222222222';

const prepared = runCode('Validate and Prepare Run', initial)[0].json;
assert.match(prepared.research_run_id, /^[0-9a-f-]{36}$/i);
assert.equal(prepared.run_payload.status, 'queued');
assert.equal(prepared.run_payload.config_snapshot.automation_mode, 'review_only');

const plannerResponse = {
  id: 'resp_plan_test',
  model: 'gpt-6-luna',
  output: [{
    content: [{
      type: 'output_text',
      text: JSON.stringify({
        queries: [
          { query: 'AI agent launches official announcement', intent: 'official_sources', recency_days: 30, result_limit: 5 },
          { query: 'AI agent benchmark research paper', intent: 'research_and_technical', recency_days: 90, result_limit: 5 },
        ],
      }),
    }],
  }],
  usage: { input_tokens: 100, output_tokens: 50 },
};
const plan = runCode('Parse Query Plan', plannerResponse, { 'Validate and Prepare Run': prepared })[0].json;
assert.equal(plan.query_items.length, 2);
assert.equal(plan.planner_fallback_used, false);
assert.equal(plan.planner_usage.success, true);

const fallbackPlan = runCode('Parse Query Plan', { error: 'provider unavailable' }, { 'Validate and Prepare Run': prepared })[0].json;
assert(fallbackPlan.query_items.length >= 1);
assert.equal(fallbackPlan.planner_fallback_used, true);

const queryItems = [
  { config: prepared.config, query: 'AI agent launch official', intent: 'official_sources' },
  { config: prepared.config, query: 'AI model news', intent: 'current_news' },
];
const candidates = runCode(
  'Normalize and Dedupe Candidates',
  [
    { request_id: 't1', results: [{ title: 'Example launch', url: 'https://example.com/news?id=7&utm_source=test', content: 'Official AI agent product launch details', score: 0.9 }] },
    { request_id: 't2', results: [{ title: 'Example launch duplicate', url: 'https://EXAMPLE.com/news?utm_medium=x&id=7#section', content: 'Same AI model news', score: 0.8 }] },
  ],
  {
    'Expand Queries': queryItems,
    'Validate and Prepare Run': prepared,
  },
).map((item) => item.json);
assert.equal(candidates.length, 1);
assert.equal(candidates[0].canonical_url, 'https://example.com/news?id=7');
assert.equal(candidates[0].discovery_queries.length, 2);

const sourceInput = {
  ...candidates[0],
  content_text: 'This is a sufficiently grounded source body. '.repeat(50),
  content_status: 'success',
  extraction_method: 'firecrawl-v2-markdown',
  extracted_at: new Date().toISOString(),
};
const sourcePrepared = runCode('Prepare Source Persistence', sourceInput)[0].json;
assert.match(sourcePrepared.content_hash, /^sha256:[0-9a-f]{64}$/);
assert.equal(sourcePrepared.source_contract.schema_version, '1.0.0');
assert.equal(sourcePrepared.source_contract.classification.decision, 'needs_review');
assert.equal(sourcePrepared.eligible_for_evidence, true);

const groundedExcerpt = 'The company launched an AI agent platform for enterprise customers on Tuesday.';
const evidenceSource = {
  ...sourcePrepared,
  source_id: '33333333-3333-4333-a333-333333333333',
  content_text: `Introduction. ${groundedExcerpt} The platform includes audit logging and access controls.`,
};
const evidenceResponse = {
  id: 'resp_evidence_test',
  model: 'gpt-6-luna',
  output: [{
    content: [{
      type: 'output_text',
      text: JSON.stringify({
        items: [
          {
            evidence_type: 'event',
            claim_text: 'The company launched an enterprise AI agent platform.',
            excerpt: groundedExcerpt,
            locator: { section: 'Introduction', paragraph: 1 },
            polarity: 'supports',
            confidence: 0.92,
          },
          {
            evidence_type: 'claim',
            claim_text: 'The product has ten million users.',
            excerpt: 'The product has ten million users.',
            locator: { section: 'Unknown', paragraph: 99 },
            polarity: 'supports',
            confidence: 0.99,
          },
        ],
      }),
    }],
  }],
  usage: { input_tokens: 500, output_tokens: 120 },
};
const verified = runCode('Parse and Verify Evidence', evidenceResponse, { 'Build Evidence Request': evidenceSource })[0].json;
assert.equal(verified.evidence_items.length, 1);
assert.equal(verified.evidence_rejected_count, 1);
assert.equal(verified.evidence_items[0].excerpt, groundedExcerpt);
assert.equal(verified.evidence_items[0].verification_status, 'verified');

console.log('LOGIC TESTS PASSED');
console.log(JSON.stringify({
  queryPlanItems: plan.query_items.length,
  canonicalCandidates: candidates.length,
  contentHash: sourcePrepared.content_hash,
  groundedEvidenceAccepted: verified.evidence_items.length,
  ungroundedEvidenceRejected: verified.evidence_rejected_count,
}, null, 2));
