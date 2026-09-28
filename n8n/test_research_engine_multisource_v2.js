const assert = require('assert');
const workflow = require('./Research Engine_multisource_v2.json');

const byName = new Map(workflow.nodes.map((node) => [node.name, node]));

function runCode(name, inputJson, references = {}) {
  const node = byName.get(name);
  assert(node, `Missing node ${name}`);
  const inputItems = Array.isArray(inputJson) ? inputJson.map((json) => ({ json })) : [{ json: inputJson }];
  const $input = { all: () => inputItems, first: () => inputItems[0], item: inputItems[0] };
  const $ = (referenceName) => {
    const value = references[referenceName];
    if (value === undefined) throw new Error(`Missing test reference ${referenceName}`);
    const values = Array.isArray(value) ? value : [value];
    const items = values.map((json) => ({ json }));
    return { all: () => items, first: () => items[0], item: items[0] };
  };
  return new Function('$input', '$', 'require', node.parameters.jsCode)($input, $, require);
}

const config = {
  supabase_url: 'https://example.supabase.co',
  workspace_id: '11111111-1111-4111-a111-111111111111',
  workspace_domain_id: '22222222-2222-4222-a222-222222222222',
  domain_key: 'core-ai-it-infrastructure',
  topic: 'AI agents, model infrastructure, funding and product launches',
  objective: 'Find current, source-grounded developments.',
  geographies: ['global'],
  entities: [],
  preferred_domains: [],
  blocked_domains: ['pinterest.com'],
  date_from: '2026-09-26T00:00:00.000Z',
  date_to: '2026-09-27T00:00:00.000Z',
  automation_mode: 'automatic',
  query_model: 'gpt-6-luna',
  evidence_model: 'gpt-6-luna',
  prompt_version: 'research-evidence-v1.1.0',
  query_prompt_version: 'research-query-plan-v1.0.0',
  contract_version: '1.0.0',
  engine_version: 'research-engine-v2.1.0',
  monitored_feeds: [],
  ecosystem_domains: ['ycombinator.com', 'a16z.com', 'reddit.com', 'x.com'],
  limits: {
    max_queries: 3,
    results_per_query: 5,
    max_candidates: 12,
    max_source_chars: 24000,
    min_content_chars: 700,
    max_evidence_per_source: 5,
    max_openai_output_tokens: 1600,
    max_estimated_openai_cost_usd: 0.1,
    max_tavily_queries: 3,
    max_firecrawl_candidates: 2,
    hn_results: 8,
    hn_queries: 4,
    arxiv_results: 5,
    gdelt_results: 20,
    gdelt_queries: 1,
  },
  thresholds: { min_relevance: 0.35, min_source_quality: 0.35, min_evidence_confidence: 0.55 },
  pricing_per_million_tokens: { input: 0.1, output: 0.5 },
};

const seed = {
  config,
  research_run_id: '33333333-3333-4333-a333-333333333333',
  request_id: '44444444-4444-4444-a444-444444444444',
};
const plan = {
  config,
  research_run_id: seed.research_run_id,
  request_id: seed.request_id,
  query_items: [
    { query: 'AI agent launches official announcements', intent: 'official_sources', result_limit: 5, recency_days: 30 },
    { query: 'AI infrastructure funding acquisitions', intent: 'market_activity', result_limit: 5, recency_days: 30 },
    { query: 'AI regulation and safety developments', intent: 'regulation_and_safety', result_limit: 5, recency_days: 30 },
  ],
};

const jobs = runCode('Build Discovery Jobs', {}, { 'Parse Query Plan': plan }).map((item) => item.json);
assert.equal(jobs.filter((job) => job.adapter === 'tavily').length, 3);
assert(jobs.filter((job) => job.adapter === 'hacker_news').length >= 3);
assert(jobs.filter((job) => job.adapter === 'hacker_news').length <= 4);
assert.equal(jobs.filter((job) => job.adapter === 'arxiv').length, 1);
assert.equal(jobs.filter((job) => job.adapter === 'gdelt').length, 1);
assert(jobs.filter((job) => job.adapter === 'hacker_news').every((job) => !job.query.includes(',')));
assert.match(jobs.find((job) => job.adapter === 'arxiv').query, / OR /);
const capitalDiscoveryJob = jobs.find((job) => job.adapter === 'tavily' && job.channel === 'ecosystem_and_community');
assert(capitalDiscoveryJob);
assert.match(capitalDiscoveryJob.query, /announces investment/);
assert.match(capitalDiscoveryJob.query, /investment thesis/);
assert.equal(capitalDiscoveryJob.source_tier, 'primary_discovery');

const arxivNode = byName.get('arXiv Search');
assert.equal(arxivNode.parameters.url, 'https://api.openalex.org/works');
assert.equal(arxivNode.parameters.queryParameters.parameters.find((item) => item.name === 'search').value, '={{ $json.query }}');
assert.equal(arxivNode.parameters.headerParameters.parameters.find((item) => item.name === 'Accept').value, 'application/json');

const tavilyJob = jobs.find((job) => job.adapter === 'tavily');
const tavilyResult = runCode('Normalize Tavily Discovery', {
  request_id: 'tavily-request',
  results: [
    { url: 'https://example.com/release?utm_source=test', title: 'AI agent launch', content: 'Official launch and infrastructure details', score: 0.9 },
    { url: 'https://reddit.com/r/artificial/comments/abc', title: 'Community discussion', content: 'Users discuss a possible AI launch', score: 0.8 },
  ],
}, { 'Discovery Job Loop': tavilyJob })[0].json;
assert.equal(tavilyResult.candidates.length, 2);

const hnJob = jobs.find((job) => job.adapter === 'hacker_news');
const hnResult = runCode('Normalize Hacker News Discovery', {
  hits: [{
    objectID: '123',
    title: 'New AI infrastructure company',
    url: 'https://example.org/launch',
    points: 120,
    num_comments: 40,
    created_at: '2026-09-27T00:00:00.000Z',
    author: 'founder',
  }, {
    objectID: '124',
    title: 'Ask HN: AI infrastructure adoption patterns',
    points: 80,
    num_comments: 35,
    created_at: '2026-09-27T01:00:00.000Z',
    author: 'operator',
  }],
}, { 'Discovery Job Loop': hnJob })[0].json;
assert.equal(hnResult.candidates[0].discovery_provider, 'hacker_news_algolia');
assert.equal(hnResult.candidates[1].source_type, 'post');

const arxivJob = jobs.find((job) => job.adapter === 'arxiv');
const abstractWords = 'A grounded research abstract about AI agent infrastructure and evaluation '.repeat(14).trim().split(' ');
const abstract_inverted_index = {};
abstractWords.forEach((word, index) => {
  abstract_inverted_index[word] = [...(abstract_inverted_index[word] ?? []), index];
});
const arxivResult = runCode('Normalize arXiv Discovery', { results: [{
  id: 'https://openalex.org/W123',
  doi: 'https://doi.org/10.1000/test',
  display_name: 'Efficient Agent Infrastructure',
  publication_date: '2026-09-27',
  abstract_inverted_index,
  authorships: [{ author: { display_name: 'Researcher One' } }],
}] }, { 'Discovery Job Loop': arxivJob })[0].json;
assert.equal(arxivResult.candidates.length, 1);
assert.match(arxivResult.candidates[0].embedded_content, /Abstract/);
assert.equal(arxivResult.candidates[0].discovery_provider, 'openalex');

const gdeltJob = jobs.find((job) => job.adapter === 'gdelt');
const gdeltResult = runCode('Normalize GDELT Discovery', {
  articles: [{
    url: 'https://news.example.net/company-funding?utm_campaign=test',
    title: 'Infrastructure company raises new funding',
    seendate: '20260927T120000Z',
    domain: 'news.example.net',
    language: 'English',
    sourcecountry: 'India',
  }],
}, { 'Discovery Job Loop': gdeltJob })[0].json;
assert.equal(gdeltResult.candidates.length, 1);
assert.equal(gdeltResult.candidates[0].discovery_provider, 'gdelt_doc');

// Restricted n8n task runners may expose neither the URL global nor built-in modules.
// The normalizer must remain self-contained.
const savedGlobalUrl = global.URL;
global.URL = undefined;
let normalized;
try {
  normalized = runCode(
    'Normalize and Dedupe Candidates',
    [tavilyResult, hnResult, arxivResult, gdeltResult],
    { 'Validate and Prepare Run': seed },
  ).map((item) => item.json);
} finally {
  global.URL = savedGlobalUrl;
}

assert(normalized.some((item) => item.discovery_provider === 'tavily'));
assert(normalized.some((item) => item.discovery_provider === 'hacker_news_algolia'));
assert(normalized.some((item) => item.discovery_provider === 'openalex'));
assert(normalized.some((item) => item.discovery_provider === 'gdelt_doc'));
assert(!byName.get('Normalize and Dedupe Candidates').parameters.jsCode.includes("require('url')"));
const canonicalized = normalized.find((item) => item.original_url?.includes('utm_source=test'));
assert.equal(canonicalized.canonical_url, 'https://example.com/release');
const reddit = normalized.find((item) => item.publisher === 'reddit.com');
assert(reddit);
assert.equal(reddit.should_extract, false);
assert(reddit.reason_codes.includes('DISCOVERY_ONLY_SOCIAL_SOURCE'));
const arxiv = normalized.find((item) => item.discovery_provider === 'openalex');
assert(arxiv.embedded_content.length > 300);

const embedded = runCode('Normalize Embedded Content', arxiv)[0].json;
assert.equal(embedded.extraction_method, 'openalex-embedded-content');
assert(['success', 'partial'].includes(embedded.content_status));

const longCandidate = {
  ...tavilyResult.candidates[0],
  config,
  reason_codes: [],
  publisher: 'example.com',
  language: 'en',
};
const longExtracted = runCode(
  'Normalize Extracted Content',
  { markdown: 'Detailed source material. '.repeat(1200), metadata: { statusCode: 200 } },
  { 'Resolve Existing Source': longCandidate },
)[0].json;
assert.equal(longExtracted.content_text.length, config.limits.max_source_chars);
assert.equal(longExtracted.content_status, 'success');
assert(longExtracted.reason_codes.includes('CONTENT_TRUNCATED'));
assert(longExtracted.extracted_char_count > config.limits.max_source_chars);

const shortExtracted = runCode(
  'Normalize Extracted Content',
  { data: { markdown: 'Too short', metadata: { statusCode: 200 } } },
  { 'Resolve Existing Source': longCandidate },
)[0].json;
assert.equal(shortExtracted.content_status, 'partial');
assert(shortExtracted.reason_codes.includes('CONTENT_TOO_SHORT'));

const contentHashDuplicate = runCode(
  'Restore Persisted Source Context',
  { source_id: 'existing-source', match_type: 'content_hash', decision: 'duplicate', is_new: false },
  { 'Prepare Source Persistence': { ...longExtracted, eligible_for_evidence: true } },
)[0].json;
assert.equal(contentHashDuplicate.eligible_for_evidence, true);
assert.equal(contentHashDuplicate.evidence_reprocessing_reason, 'CURRENT_EXTRACTION_MATCHED_EXISTING_CONTENT');

const canonicalDuplicate = runCode(
  'Restore Persisted Source Context',
  { source_id: 'existing-source', match_type: 'canonical_url', decision: 'duplicate', is_new: false },
  { 'Prepare Source Persistence': { ...longExtracted, eligible_for_evidence: false } },
)[0].json;
assert.equal(canonicalDuplicate.eligible_for_evidence, false);

const emptyDiscovery = runCode(
  'Normalize and Dedupe Candidates',
  [
    { provider: 'tavily', candidates: [], provider_error: 'NO_TAVILY_RESULTS' },
    { provider: 'hacker_news_algolia', candidates: [], provider_error: 'NO_HACKER_NEWS_RESULTS' },
    { provider: 'openalex', candidates: [], provider_error: 'OPENALEX_REQUEST_FAILED' },
    { adapter: 'unexpected_adapter_shape' },
  ],
  { 'Validate and Prepare Run': seed },
).map((item) => item.json);
assert.equal(emptyDiscovery.length, 1);
assert.equal(emptyDiscovery[0].candidate_id, 'no-results');
assert.equal(emptyDiscovery[0].discovery_provider, 'discovery_orchestrator');
assert(emptyDiscovery[0].discovery_provider_errors.some((error) => error.code === 'OPENALEX_REQUEST_FAILED'));
assert(emptyDiscovery[0].discovery_provider_errors.some((error) => error.code === 'INVALID_DISCOVERY_ENVELOPE'));

const completedEmpty = runCode('Candidate Complete', emptyDiscovery[0], {
  'Candidate Loop - One at a Time': emptyDiscovery[0],
})[0].json;
assert.deepEqual(completedEmpty.errors, ['NO_DISCOVERY_RESULTS']);
assert.equal(completedEmpty.discovery_provider, 'discovery_orchestrator');
assert(completedEmpty.provider_errors.length >= 4);

const attributedCompletion = runCode('Candidate Complete', {
  source_id: '55555555-5555-4555-a555-555555555555',
  source_persisted: true,
}, {
  'Candidate Loop - One at a Time': normalized.find((item) => item.discovery_provider === 'openalex'),
})[0].json;
assert.equal(attributedCompletion.discovery_provider, 'openalex');
assert.equal(attributedCompletion.discovery_channel, 'arxiv');

console.log('MULTI-SOURCE LOGIC TESTS PASSED');
console.log(JSON.stringify({
  discoveryJobs: jobs.length,
  tavilyJobs: jobs.filter((job) => job.adapter === 'tavily').length,
  normalizedCandidates: normalized.length,
  providers: [...new Set(normalized.map((item) => item.discovery_provider))],
  emptyDiscoveryError: completedEmpty.errors[0],
  redditDiscoveryOnly: reddit.should_extract === false,
  arxivEmbeddedContent: Boolean(arxiv.embedded_content),
  longFirecrawlContentStatus: longExtracted.content_status,
  shortFirecrawlContentStatus: shortExtracted.content_status,
  contentHashDuplicateEligibleForEvidence: contentHashDuplicate.eligible_for_evidence,
  canonicalDuplicateEligibleForEvidence: canonicalDuplicate.eligible_for_evidence,
}, null, 2));
