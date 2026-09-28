const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sourcePath = path.join(__dirname, 'Research Engine_current_export.json');
const scheduledReferencePath = path.join(__dirname, 'research_engine_complete.json');
const outputPath = path.join(__dirname, 'Research Engine_multisource_v2.json');

const workflow = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const scheduledReference = JSON.parse(fs.readFileSync(scheduledReferencePath, 'utf8'));

function stableUuid(value) {
  const hash = crypto.createHash('sha256').update(value).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function baseNode(name, type, typeVersion, position, parameters, extra = {}) {
  return {
    parameters,
    id: stableUuid(`research-engine-multisource-v2:${name}`),
    name,
    type,
    typeVersion,
    position,
    ...extra,
  };
}

function codeNode(name, position, jsCode, mode = 'runOnceForAllItems', extra = {}) {
  const parameters = { jsCode };
  if (mode === 'runOnceForEachItem') parameters.mode = mode;
  return baseNode(name, 'n8n-nodes-base.code', 2, position, parameters, extra);
}

function ifNode(name, position, expression) {
  return baseNode(name, 'n8n-nodes-base.if', 2.2, position, {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'strict',
        version: 2,
      },
      conditions: [{
        id: stableUuid(`condition:${name}`),
        leftValue: expression,
        rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  });
}

function byName(name) {
  const result = workflow.nodes.find((node) => node.name === name);
  if (!result) throw new Error(`Missing source node: ${name}`);
  return result;
}

function referenceNode(name) {
  const result = scheduledReference.nodes.find((node) => node.name === name);
  if (!result) throw new Error(`Missing scheduled reference node: ${name}`);
  return JSON.parse(JSON.stringify(result));
}

function addNode(node) {
  if (workflow.nodes.some((item) => item.name === node.name)) {
    throw new Error(`Refusing duplicate node: ${node.name}`);
  }
  workflow.nodes.push(node);
}

function connect(from, to, outputIndex = 0, inputIndex = 0) {
  if (!workflow.connections[from]) workflow.connections[from] = { main: [] };
  while (workflow.connections[from].main.length <= outputIndex) workflow.connections[from].main.push([]);
  workflow.connections[from].main[outputIndex].push({ node: to, type: 'main', index: inputIndex });
}

function replaceConnections(from, outputs) {
  workflow.connections[from] = { main: outputs };
}

// Keep the user's working credentials and provider nodes. Only add the new
// orchestration and provider-neutral discovery layers around them.
workflow.name = 'Research Engine V2 - Multi Source';
delete workflow.id;
delete workflow.activeVersionId;
delete workflow.shared;
workflow.active = false;
workflow.versionId = stableUuid('research-engine-multisource-v2-version-1.0.0');

// Create visual space for the discovery adapters while preserving the user's layout.
for (const node of workflow.nodes) {
  if (node.position?.[0] >= 3264) node.position[0] += 1120;
}

const manualConfig = byName('Research Request and Limits');
manualConfig.parameters.jsCode = manualConfig.parameters.jsCode
  .replace('30 * 24 * 60 * 60 * 1000', '60 * 24 * 60 * 60 * 1000')
  .replace("domain_key: 'artificial-intelligence'", "domain_key: 'core-ai-it-infrastructure'")
  .replace(
    "topic: 'AI agents, model infrastructure, funding, product launches, safety and regulation'",
    "topic: 'AI infrastructure, GPU cloud, data centers, model training and inference platforms, model serving, vector databases, agent infrastructure, developer tooling and AI security'",
  )
  .replace(
    "objective: 'Find material, current, source-grounded developments that may become evidence for intelligence analysis.'",
    "objective: 'Find material, current developments specifically about core AI and IT infrastructure. Prefer primary announcements, technical documentation, research, and independent reporting. Include funding only when the company or project is clearly an AI-infrastructure provider.'",
  )
  .replace("automation_mode: 'review_only'", "automation_mode: 'automatic'")
  .replace("prompt_version: 'research-evidence-v1.0.0'", "prompt_version: 'research-evidence-v1.1.0'")
  .replace("engine_version: 'research-engine-v1.0.0'", "engine_version: 'research-engine-v2.1.0'")
  .replace(
    "max_estimated_openai_cost_usd: 0.10",
    "max_estimated_openai_cost_usd: 0.10,\n        max_tavily_queries: 4,\n        max_firecrawl_candidates: 6,\n        hn_results: 10,\n        hn_queries: 5,\n        arxiv_results: 8,\n        gdelt_results: 30,\n        gdelt_queries: 1",
  )
  .replace('max_queries: 3,', 'max_queries: 4,')
  .replace('results_per_query: 5,', 'results_per_query: 8,')
  .replace('max_candidates: 10,', 'max_candidates: 18,')
  .replace('min_relevance: 0.45,', 'min_relevance: 0.38,')
  .replace(
    "pricing_per_million_tokens: {",
    "monitored_feeds: [],\n      ecosystem_domains: [\n        'ycombinator.com',\n        'a16z.com',\n        'sequoiacap.com',\n        'accel.com',\n        'lightspeedvp.com',\n        'indexventures.com',\n        'generalcatalyst.com',\n        'bvp.com',\n        'reddit.com',\n        'x.com'\n      ],\n      pricing_per_million_tokens: {",
  );

// Add the scheduled handoff from the repository reference, but retain every
// working HTTP/provider node and credential from the user's export.
const scheduledTrigger = referenceNode('Scheduled Run Trigger');
scheduledTrigger.position = [352, 800];
addNode(scheduledTrigger);

const scheduledPrepare = referenceNode('Prepare Scheduled Research Request');
scheduledPrepare.position = [576, 800];
scheduledPrepare.parameters.jsCode = scheduledPrepare.parameters.jsCode.replace(
  '14 * 60 * 60 * 1000',
  '3 * 24 * 60 * 60 * 1000',
).replace(
  "engine_version: input.engine_version ?? 'research-engine-v1.0.0'",
  "engine_version: 'research-engine-v2.1.0'",
).replace(
  "automation_mode: 'review_only'",
  "automation_mode: 'automatic'",
).replace(
  "prompt_version: 'research-evidence-v1.0.0'",
  "prompt_version: 'research-evidence-v1.1.0'",
).replace(
  "pricing_per_million_tokens: {",
  "monitored_feeds: Array.isArray(profile.monitored_feeds) ? profile.monitored_feeds : [],\n      ecosystem_domains: Array.isArray(profile.ecosystem_domains) ? profile.ecosystem_domains : [\n        'ycombinator.com', 'a16z.com', 'sequoiacap.com', 'accel.com',\n        'lightspeedvp.com', 'indexventures.com', 'generalcatalyst.com',\n        'bvp.com', 'reddit.com', 'x.com'\n      ],\n      pricing_per_million_tokens: {",
).replace(
  "max_estimated_openai_cost_usd: schedule.max_estimated_openai_cost_usd ?? 0.10",
  "max_estimated_openai_cost_usd: schedule.max_estimated_openai_cost_usd ?? 0.10,\n        max_tavily_queries: schedule.max_tavily_queries ?? 4,\n        max_firecrawl_candidates: schedule.max_firecrawl_candidates ?? 6,\n        hn_results: schedule.hn_results ?? 10,\n        hn_queries: schedule.hn_queries ?? 5,\n        arxiv_results: schedule.arxiv_results ?? 8,\n        gdelt_results: schedule.gdelt_results ?? 30,\n        gdelt_queries: 1",
).replace(
  'max_queries: schedule.max_queries ?? 3,',
  'max_queries: schedule.max_queries ?? 4,',
).replace(
  'results_per_query: schedule.results_per_query ?? 5,',
  'results_per_query: schedule.results_per_query ?? 8,',
).replace(
  'max_candidates: schedule.max_candidates ?? 10,',
  'max_candidates: schedule.max_candidates ?? 18,',
).replace(
  'min_relevance: schedule.min_relevance ?? 0.45,',
  'min_relevance: schedule.min_relevance ?? 0.38,',
);
addNode(scheduledPrepare);

const scheduledValidate = referenceNode('Validate and Prepare Run');
scheduledValidate.id = byName('Validate and Prepare Run').id;
scheduledValidate.position = byName('Validate and Prepare Run').position;
byName('Validate and Prepare Run').parameters = scheduledValidate.parameters;
byName('Validate and Prepare Run').parameters.jsCode = byName('Validate and Prepare Run').parameters.jsCode
  .replace("config.automation_mode !== 'review_only'", "config.automation_mode !== 'automatic'")
  .replace("FIRST_WORKFLOW_MUST_REMAIN_REVIEW_ONLY", "RESEARCH_ENGINE_REQUIRES_AUTOMATIC_EVIDENCE_VERIFICATION");

const alreadyQueued = referenceNode('Run Already Queued?');
alreadyQueued.position = [1040, 528];
addNode(alreadyQueued);
byName('Create Research Run').position = [1120, 704];

// Provider-neutral discovery jobs. Credentialed providers remain native nodes.
byName('Expand Queries').name = 'Build Discovery Jobs';
delete workflow.connections['Expand Queries'];
byName('Build Discovery Jobs').parameters.jsCode = String.raw`const plan = $('Parse Query Plan').first().json;
const config = plan.config;
const jobs = [];
const maxTavily = Math.max(1, Math.min(5, Number(config.limits.max_tavily_queries ?? 3)));
const planned = Array.isArray(plan.query_items) ? plan.query_items : [];
const standardCount = Math.max(1, maxTavily - 1);
const topicTerms = String(config.topic ?? '')
  .split(',')
  .map((term) => term.trim())
  .filter(Boolean);

planned.slice(0, standardCount).forEach((query, index) => {
  jobs.push({
    adapter: 'tavily',
    channel: index === 0 ? 'web_search' : 'official_and_capital_search',
    source_tier: index === 0 ? 'search' : 'primary_discovery',
    query: query.query,
    intent: query.intent,
    result_limit: query.result_limit ?? config.limits.results_per_query,
    recency_days: query.recency_days ?? 30
  });
});

if (maxTavily > standardCount) {
  const domains = (config.ecosystem_domains ?? []).slice(0, 10);
  const siteQuery = domains.map((domain) => 'site:' + domain).join(' OR ');
  jobs.push({
    adapter: 'tavily',
    channel: 'ecosystem_and_community',
    source_tier: 'primary_discovery',
    query: config.topic + ' ("announces investment" OR "funding round" OR "new fund" OR "investment thesis" OR "portfolio company" OR "accelerator cohort") ' + (siteQuery ? '(' + siteQuery + ')' : ''),
    intent: 'market_activity',
    result_limit: config.limits.results_per_query,
    recency_days: 30
  });
}

const hnQueryLimit = Math.max(1, Math.min(6, Number(config.limits.hn_queries ?? 4)));
const hnQueries = [...new Set([
  ...topicTerms,
  ...(config.entities ?? []).map((entity) => String(entity).trim())
].filter(Boolean))].slice(0, hnQueryLimit);

(hnQueries.length ? hnQueries : [config.domain_key]).forEach((query) => jobs.push({
  adapter: 'hacker_news',
  channel: 'hacker_news',
  source_tier: 'structured_community',
  query,
  intent: 'community_signal',
  result_limit: Math.max(1, Math.min(20, Number(config.limits.hn_results ?? 8))),
  date_from_unix: Math.floor(new Date(config.date_from).getTime() / 1000)
}));

jobs.push({
  adapter: 'arxiv',
  channel: 'arxiv',
  source_tier: 'research',
  query: topicTerms.slice(0, 4).join(' OR '),
  intent: 'research_and_technical',
  result_limit: Math.max(1, Math.min(10, Number(config.limits.arxiv_results ?? 5))),
  from_publication_date: String(config.date_from ?? '').slice(0, 10),
  to_publication_date: String(config.date_to ?? '').slice(0, 10)
});

// GDELT's public DOC endpoint asks clients to stay at one request per five
// seconds. Keep one larger query per domain run to avoid a rate-limit burst.
const gdeltLimit = 1;
planned.slice(0, gdeltLimit).forEach((query) => jobs.push({
  adapter: 'gdelt',
  channel: 'global_news',
  source_tier: 'news_aggregator',
  query: topicTerms.slice(0, 5)
    .map((term) => term.split(/\s+/).slice(0, 4).join(' '))
    .filter(Boolean)
    .map((term) => term.includes(' ') ? '"' + term.replace(/"/g, '') + '"' : term)
    .join(' OR '),
  intent: query.intent,
  result_limit: Math.max(1, Math.min(50, Number(config.limits.gdelt_results ?? 20))),
  start_datetime: String(config.date_from ?? '').replace(/[-:TZ.]/g, '').slice(0, 14),
  end_datetime: String(config.date_to ?? '').replace(/[-:TZ.]/g, '').slice(0, 14)
}));

(config.monitored_feeds ?? []).slice(0, 12).forEach((feed) => {
  if (!feed?.url) return;
  jobs.push({
    adapter: 'rss',
    channel: 'monitored_feed',
    source_tier: feed.source_tier ?? 'primary',
    feed_url: feed.url,
    feed_name: feed.name ?? feed.url,
    query: config.topic,
    intent: feed.intent ?? 'current_news',
    result_limit: Math.max(1, Math.min(20, Number(feed.limit ?? 10)))
  });
});

return jobs.map((job, index) => ({
  json: {
    config,
    research_run_id: plan.research_run_id,
    request_id: plan.request_id,
    job_id: 'discovery:' + index,
    ...job
  },
  pairedItem: { item: 0 }
}));`;

addNode(baseNode('Discovery Job Loop', 'n8n-nodes-base.splitInBatches', 3, [2800, 528], {
  batchSize: 1,
  options: {},
}));
addNode(ifNode('Is Tavily Discovery?', [3024, 528], "={{ $json.adapter === 'tavily' }}"));
addNode(ifNode('Is Hacker News Discovery?', [3248, 720], "={{ $json.adapter === 'hacker_news' }}"));
addNode(ifNode('Is arXiv Discovery?', [3472, 944], "={{ $json.adapter === 'arxiv' }}"));
addNode(ifNode('Is GDELT Discovery?', [3696, 1104], "={{ $json.adapter === 'gdelt' }}"));

byName('Tavily Search').position = [3264, 400];
byName('Tavily Search').parameters.query = '={{ $json.query }}';
byName('Tavily Search').parameters.options.max_results = '={{ $json.result_limit }}';

addNode(codeNode('Normalize Tavily Discovery', [3504, 400], String.raw`const job = $('Discovery Job Loop').item.json;
const response = $input.first().json ?? {};
const payload = response?.data && Array.isArray(response.data.results) ? response.data : response;
const results = Array.isArray(payload.results) ? payload.results : [];

const candidates = results.map((result, index) => ({
  original_url: result.url,
  title: result.title,
  snippet: result.content ?? result.snippet ?? result.raw_content ?? '',
  provider_score: Number(result.score ?? 0),
  published_at: result.published_date ?? null,
  author: null,
  source_type: 'article',
  embedded_content: null,
  discovery_provider: 'tavily',
  discovery_channel: job.channel,
  source_tier: job.source_tier,
  query: job.query,
  query_intent: job.intent,
  result_rank: index + 1,
  provider_request_id: (payload.request_id ?? 'tavily') + ':' + index,
  reason_codes: []
}));

return [{
  json: {
    job,
    provider: 'tavily',
    candidates,
    provider_error: results.length ? null : (response.error ? 'TAVILY_REQUEST_FAILED' : 'NO_TAVILY_RESULTS')
  },
  pairedItem: { item: 0 }
}];`));

addNode(baseNode('Hacker News Search', 'n8n-nodes-base.httpRequest', 4.2, [3472, 688], {
  url: 'https://hn.algolia.com/api/v1/search_by_date',
  sendQuery: true,
  queryParameters: {
    parameters: [
      { name: 'query', value: '={{ $json.query }}' },
      { name: 'tags', value: 'story' },
      { name: 'numericFilters', value: '={{ "created_at_i>" + $json.date_from_unix }}' },
      { name: 'hitsPerPage', value: '={{ $json.result_limit }}' },
    ],
  },
  options: { timeout: 30000 },
}, {
  retryOnFail: true,
  maxTries: 2,
  waitBetweenTries: 1000,
  alwaysOutputData: true,
  onError: 'continueRegularOutput',
}));

addNode(codeNode('Normalize Hacker News Discovery', [3712, 688], String.raw`const job = $('Discovery Job Loop').item.json;
const response = $input.first().json ?? {};
const hits = Array.isArray(response.hits) ? response.hits : [];

const candidates = hits.map((hit, index) => {
  const itemUrl = 'https://news.ycombinator.com/item?id=' + hit.objectID;
  const linkedUrl = hit.url || itemUrl;
  const points = Math.max(0, Number(hit.points ?? 0));
  const comments = Math.max(0, Number(hit.num_comments ?? 0));
  return {
    original_url: linkedUrl,
    title: hit.title ?? hit.story_title ?? 'Hacker News discussion',
    snippet: hit.story_text ?? hit.comment_text ?? '',
    provider_score: Math.min(1, (Math.log10(points + 1) + Math.log10(comments + 1)) / 5),
    published_at: hit.created_at ?? null,
    author: hit.author ?? null,
    source_type: linkedUrl === itemUrl ? 'post' : 'article',
    embedded_content: null,
    discovery_provider: 'hacker_news_algolia',
    discovery_channel: 'hacker_news',
    source_tier: 'structured_community',
    query: job.query,
    query_intent: job.intent,
    result_rank: index + 1,
    provider_request_id: hit.objectID ?? null,
    reason_codes: ['COMMUNITY_SIGNAL'],
    discussion_url: itemUrl
  };
});

return [{
  json: {
    job,
    provider: 'hacker_news_algolia',
    candidates,
    provider_error: hits.length ? null : (response.error ? 'HACKER_NEWS_REQUEST_FAILED' : 'NO_HACKER_NEWS_RESULTS')
  },
  pairedItem: { item: 0 }
}];`));

addNode(baseNode('arXiv Search', 'n8n-nodes-base.httpRequest', 4.2, [3712, 912], {
  url: 'https://api.openalex.org/works',
  sendHeaders: true,
  headerParameters: {
    parameters: [
      { name: 'Accept', value: 'application/json' },
      { name: 'User-Agent', value: 'AI-Intelligence-Research/2.0' },
    ],
  },
  sendQuery: true,
  queryParameters: {
    parameters: [
      { name: 'search', value: '={{ $json.query }}' },
      { name: 'filter', value: '={{ "from_publication_date:" + $json.from_publication_date + ",to_publication_date:" + $json.to_publication_date }}' },
      { name: 'per_page', value: '={{ $json.result_limit }}' },
      { name: 'sort', value: 'publication_date:desc' },
    ],
  },
  options: {
    timeout: 30000,
    response: { response: { responseFormat: 'json' } },
  },
}, {
  retryOnFail: true,
  maxTries: 2,
  waitBetweenTries: 1500,
  alwaysOutputData: true,
  onError: 'continueRegularOutput',
}));

addNode(codeNode('Normalize arXiv Discovery', [3952, 912], String.raw`const job = $('Discovery Job Loop').item.json;
const response = $input.first().json ?? {};
const works = Array.isArray(response.results) ? response.results : [];
const abstractText = (index) => {
  if (!index || typeof index !== 'object') return '';
  const words = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of (positions ?? [])) words[position] = word;
  }
  return words.filter(Boolean).join(' ');
};

const candidates = works.map((work, index) => {
  const title = work.display_name ?? work.title ?? 'Research paper';
  const summary = abstractText(work.abstract_inverted_index);
  const authors = (work.authorships ?? []).map((item) => item.author?.display_name).filter(Boolean);
  const url = work.doi || work.primary_location?.landing_page_url || work.id;
  return {
    original_url: url,
    title,
    snippet: summary.slice(0, 3000),
    provider_score: 0.82,
    published_at: work.publication_date || null,
    author: authors.join(', ') || null,
    source_type: 'paper',
    embedded_content: [title, 'Authors: ' + authors.join(', '), 'Abstract:', summary].filter(Boolean).join('\n\n'),
    discovery_provider: 'openalex',
    discovery_channel: 'arxiv',
    source_tier: 'research',
    query: job.query,
    query_intent: job.intent,
    result_rank: index + 1,
    provider_request_id: work.id || url || null,
    reason_codes: ['STRUCTURED_RESEARCH_SOURCE']
  };
});

return [{
  json: {
    job,
    provider: 'openalex',
    candidates,
    provider_error: candidates.length ? null : (response.error ? 'OPENALEX_REQUEST_FAILED' : 'NO_OPENALEX_RESULTS')
  },
  pairedItem: { item: 0 }
}];`));

addNode(baseNode('GDELT News Search', 'n8n-nodes-base.httpRequest', 4.2, [3936, 1104], {
  url: 'https://api.gdeltproject.org/api/v2/doc/doc',
  sendQuery: true,
  queryParameters: {
    parameters: [
      { name: 'query', value: '={{ $json.query }}' },
      { name: 'mode', value: 'artlist' },
      { name: 'format', value: 'json' },
      { name: 'sort', value: 'datedesc' },
      { name: 'maxrecords', value: '={{ $json.result_limit }}' },
      { name: 'startdatetime', value: '={{ $json.start_datetime }}' },
      { name: 'enddatetime', value: '={{ $json.end_datetime }}' },
    ],
  },
  options: { timeout: 30000 },
}, {
  retryOnFail: false,
  alwaysOutputData: true,
  onError: 'continueRegularOutput',
}));

addNode(codeNode('Normalize GDELT Discovery', [4176, 1104], String.raw`const job = $('Discovery Job Loop').item.json;
const response = $input.first().json ?? {};
const articles = Array.isArray(response.articles)
  ? response.articles
  : (Array.isArray(response.data?.articles) ? response.data.articles : []);

const candidates = articles.map((article, index) => ({
  original_url: article.url,
  title: article.title ?? article.domain ?? 'GDELT article',
  snippet: article.description ?? '',
  provider_score: Math.max(0.45, 1 - (index / Math.max(articles.length, 1)) * 0.35),
  published_at: article.seendate ?? null,
  author: null,
  source_type: 'article',
  embedded_content: null,
  discovery_provider: 'gdelt_doc',
  discovery_channel: 'global_news',
  source_tier: 'news_aggregator',
  query: job.query,
  query_intent: job.intent,
  result_rank: index + 1,
  provider_request_id: 'gdelt:' + (article.url ?? index),
  reason_codes: ['GLOBAL_NEWS_DISCOVERY'],
  source_country: article.sourcecountry ?? null,
  language: article.language ?? null
}));

return [{
  json: {
    job,
    provider: 'gdelt_doc',
    candidates,
    provider_error: candidates.length ? null : (response.error ? 'GDELT_REQUEST_FAILED' : 'NO_GDELT_RESULTS')
  },
  pairedItem: { item: 0 }
}];`));

addNode(baseNode('Read Monitored RSS Feed', 'n8n-nodes-base.rssFeedRead', 1.2, [3712, 1168], {
  url: '={{ $json.feed_url }}',
  options: {},
}, {
  alwaysOutputData: true,
  onError: 'continueRegularOutput',
}));

addNode(codeNode('Normalize RSS Discovery', [3952, 1168], String.raw`const job = $('Discovery Job Loop').item.json;
const entries = $input.all().map((item) => item.json ?? {}).filter((entry) => entry.link || entry.guid);
const candidates = entries.slice(0, job.result_limit).map((entry, index) => ({
  original_url: entry.link ?? entry.guid,
  title: entry.title ?? job.feed_name,
  snippet: entry.contentSnippet ?? entry.content ?? entry.description ?? '',
  provider_score: 0.86,
  published_at: entry.isoDate ?? entry.pubDate ?? null,
  author: entry.creator ?? entry.author ?? null,
  source_type: 'article',
  embedded_content: String(entry.content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null,
  discovery_provider: 'rss',
  discovery_channel: 'monitored_feed',
  source_tier: job.source_tier,
  query: job.query,
  query_intent: job.intent,
  result_rank: index + 1,
  provider_request_id: entry.guid ?? entry.link ?? null,
  reason_codes: ['MONITORED_FEED']
}));

return [{
  json: {
    job,
    provider: 'rss',
    candidates,
    provider_error: candidates.length ? null : ($input.first().json?.error ? 'RSS_REQUEST_FAILED' : 'NO_RSS_RESULTS')
  },
  pairedItem: { item: 0 }
}];`));

addNode(codeNode('Discovery Job Complete', [4192, 688], String.raw`const result = $input.first().json ?? {};
return [{ json: result, pairedItem: { item: 0 } }];`));

// Global provider-neutral normalization, scoring, canonicalization and budget gating.
byName('Normalize and Dedupe Candidates').parameters.jsCode = String.raw`const inputRows = $input.all().map((item) => item.json ?? {});
const jobResults = [];
const fanInErrors = [];
for (const row of inputRows) {
  if (Array.isArray(row.candidates)) {
    jobResults.push(row);
    continue;
  }
  if (row.original_url || row.canonical_url) {
    jobResults.push({
      provider: row.discovery_provider ?? 'unknown',
      candidates: [row],
      provider_error: null
    });
    continue;
  }
  fanInErrors.push({
    provider: row.provider ?? row.adapter ?? 'discovery_orchestrator',
    code: row.error ? 'DISCOVERY_ADAPTER_ERROR' : 'INVALID_DISCOVERY_ENVELOPE'
  });
}
const seed = $('Validate and Prepare Run').first().json;
const config = seed.config;
const normalizeText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const tracking = new Set(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','gclid','fbclid','mc_cid','mc_eid','ref','ref_src','source']);
const stopwords = new Set(['about','after','again','against','also','and','are','been','before','being','between','from','into','its','more','most','new','official','other','over','published','the','their','then','there','these','this','those','through','under','very','with']);

function parseHttpUrl(rawUrl) {
  const raw = normalizeText(rawUrl);
  const match = raw.match(/^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(?:#.*)?$/i);
  if (!match) return null;

  const protocol = match[1].toLowerCase() + ':';
  const authority = match[2];
  if (!authority || authority.includes('@') || /\s|\\/.test(authority)) return null;

  let hostname = authority;
  let port = '';
  if (authority.startsWith('[')) {
    const ipv6 = authority.match(/^\[([0-9a-f:.]+)\](?::(\d+))?$/i);
    if (!ipv6) return null;
    hostname = '[' + ipv6[1].toLowerCase() + ']';
    port = ipv6[2] ?? '';
  } else {
    const colon = authority.lastIndexOf(':');
    if (colon >= 0) {
      if (authority.indexOf(':') !== colon) return null;
      hostname = authority.slice(0, colon);
      port = authority.slice(colon + 1);
    }
    hostname = hostname.toLowerCase().replace(/\.$/, '');
    if (!hostname || !/^[a-z0-9.-]+$/i.test(hostname) || hostname.includes('..')) return null;
  }

  if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) return null;
  if ((protocol === 'https:' && port === '443') || (protocol === 'http:' && port === '80')) port = '';

  let pathname = match[3] || '/';
  if (/\s|\\/.test(pathname)) return null;
  pathname = pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';

  const keptParams = [];
  for (const part of (match[4] ?? '').slice(1).split('&').filter(Boolean)) {
    const rawKey = part.split('=', 1)[0];
    let key;
    try { key = decodeURIComponent(rawKey.replace(/\+/g, ' ')).toLowerCase(); }
    catch { key = rawKey.toLowerCase(); }
    if (!tracking.has(key) && !key.startsWith('utm_')) keptParams.push(part);
  }
  keptParams.sort((a, b) => a.localeCompare(b));

  const hostWithPort = hostname + (port ? ':' + port : '');
  const canonicalUrl = protocol + '//' + hostWithPort + pathname + (keptParams.length ? '?' + keptParams.join('&') : '');
  return {
    url: { pathname },
    hostname: hostname.replace(/^www\./, ''),
    canonical_url: canonicalUrl
  };
}

function tokens(value) {
  return new Set((String(value ?? '').toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [])
    .filter((token) => !stopwords.has(token)));
}

function overlap(query, text) {
  const q = tokens(query);
  const t = tokens(text);
  if (!q.size) return 0;
  let matches = 0;
  for (const token of q) if (t.has(token)) matches++;
  return Math.min(1, matches / Math.max(3, Math.min(8, q.size)));
}

function qualityFor(raw, host) {
  if (raw.source_tier === 'primary' || raw.source_tier === 'primary_discovery') return 0.90;
  if (raw.source_tier === 'research') return 0.88;
  if (raw.source_tier === 'structured_community') return 0.68;
  if (raw.source_tier === 'news_aggregator') return 0.62;
  if (raw.source_tier === 'ecosystem') return 0.64;
  if (host.endsWith('.gov') || host.endsWith('.gov.in') || host.endsWith('.edu') || host.endsWith('europa.eu')) return 0.95;
  if (host === 'arxiv.org' || host === 'github.com' || host === 'who.int' || host === 'oecd.org') return 0.88;
  if ((config.preferred_domains ?? []).some((domain) => host === domain || host.endsWith('.' + domain))) return 0.90;
  return 0.65;
}

function sourceType(raw, parsed) {
  if (raw.source_type) return raw.source_type;
  const text = (raw.title + ' ' + parsed.url.pathname).toLowerCase();
  if (parsed.hostname === 'arxiv.org' || /paper|research|whitepaper/.test(text)) return 'paper';
  if (parsed.hostname === 'github.com') return 'repository';
  if (/press-release|newsroom|press_release/.test(text)) return 'press_release';
  if (/filing|10-k|10-q|8-k/.test(text)) return 'filing';
  return 'article';
}

const deduplicated = new Map();
const providerErrors = [...fanInErrors];
for (const result of jobResults) {
  if (result.provider_error) providerErrors.push({ provider: result.provider, code: result.provider_error });
  for (const [index, raw] of (result.candidates ?? []).entries()) {
    const parsed = parseHttpUrl(raw.original_url);
    if (!parsed) {
      providerErrors.push({
        provider: raw.discovery_provider ?? result.provider ?? 'unknown',
        code: 'INVALID_PROVIDER_URL'
      });
      continue;
    }
    const host = parsed.hostname;
    const blocked = (config.blocked_domains ?? []).some((domain) => host === domain || host.endsWith('.' + domain));
    const socialDiscoveryOnly = host === 'reddit.com' || host.endsWith('.reddit.com') || host === 'x.com' || host === 'twitter.com';
    const title = normalizeText(raw.title).slice(0, 500) || host;
    const snippet = normalizeText(raw.snippet).slice(0, 3000);
    const providerScore = Math.max(0, Math.min(1, Number(raw.provider_score ?? 0.5)));
    const lexical = Math.max(
      overlap(raw.query, title + ' ' + snippet),
      overlap(config.topic, title + ' ' + snippet)
    );
    const quality = qualityFor(raw, host);
    const relevance = Math.max(0, Math.min(1, providerScore * 0.55 + lexical * 0.25 + quality * 0.20));
    const reasonCodes = [...new Set(raw.reason_codes ?? [])];
    if (blocked) reasonCodes.push('BLOCKED_DOMAIN');
    if (socialDiscoveryOnly) reasonCodes.push('DISCOVERY_ONLY_SOCIAL_SOURCE');
    if (lexical >= 0.25) reasonCodes.push('TOPIC_MATCH');
    if (quality >= 0.85) reasonCodes.push('PRIMARY_OR_HIGH_QUALITY_SOURCE');
    if (relevance < config.thresholds.min_relevance) reasonCodes.push('LOW_RELEVANCE');

    const candidate = {
      candidate_id: raw.provider_request_id || raw.discovery_provider + ':' + index + ':' + parsed.canonical_url,
      config,
      workspace_id: config.workspace_id,
      workspace_domain_id: config.workspace_domain_id,
      research_run_id: seed.research_run_id,
      request_id: seed.request_id,
      discovery_channel: raw.discovery_channel,
      discovery_provider: raw.discovery_provider,
      discovery_providers: [raw.discovery_provider].filter(Boolean),
      discovery_queries: [raw.query].filter(Boolean),
      query: raw.query,
      query_intent: raw.query_intent,
      result_rank: raw.result_rank ?? index + 1,
      discovered_at: new Date().toISOString(),
      original_url: normalizeText(raw.original_url),
      canonical_url: parsed.canonical_url,
      title,
      snippet,
      publisher: host,
      author: raw.author ?? null,
      published_at: raw.published_at ?? null,
      language: raw.language ?? 'en',
      source_country: raw.source_country ?? null,
      source_type: sourceType(raw, parsed),
      source_tier: raw.source_tier ?? 'search',
      relevance_score: Number(relevance.toFixed(3)),
      source_quality_score: Number(quality.toFixed(3)),
      provider_score: Number(providerScore.toFixed(3)),
      reason_codes: [...new Set(reasonCodes)],
      should_extract: !blocked && !socialDiscoveryOnly && relevance >= config.thresholds.min_relevance && quality >= config.thresholds.min_source_quality,
      embedded_content: normalizeText(raw.embedded_content) || null,
      provider_request_id: raw.provider_request_id ?? null,
      discussion_url: raw.discussion_url ?? null
    };

    const existing = deduplicated.get(candidate.canonical_url);
    if (!existing) {
      deduplicated.set(candidate.canonical_url, candidate);
      continue;
    }
    const queries = [...new Set([...(existing.discovery_queries ?? []), ...candidate.discovery_queries])];
    const providers = [...new Set([
      ...(existing.discovery_providers ?? [existing.discovery_provider]),
      ...(candidate.discovery_providers ?? [candidate.discovery_provider])
    ].filter(Boolean))];
    if (candidate.relevance_score > existing.relevance_score) {
      candidate.discovery_queries = queries;
      candidate.discovery_providers = providers;
      deduplicated.set(candidate.canonical_url, candidate);
    } else {
      existing.discovery_queries = queries;
      existing.discovery_providers = providers;
    }
  }
}

let candidates = [...deduplicated.values()].sort((a, b) =>
  Number(b.should_extract) - Number(a.should_extract) ||
  b.relevance_score - a.relevance_score ||
  b.source_quality_score - a.source_quality_score
);

candidates = candidates.slice(0, config.limits.max_candidates);

const firecrawlLimit = Math.max(0, Math.min(10, Number(config.limits.max_firecrawl_candidates ?? 2)));
let firecrawlAllocated = 0;
for (const candidate of candidates) {
  if (!candidate.should_extract || candidate.embedded_content) continue;
  if (firecrawlAllocated < firecrawlLimit) {
    firecrawlAllocated++;
    candidate.firecrawl_budget_rank = firecrawlAllocated;
  } else {
    candidate.should_extract = false;
    candidate.reason_codes = [...new Set([...(candidate.reason_codes ?? []), 'FIRECRAWL_BUDGET_EXCEEDED'])];
  }
}

if (!candidates.length) {
  candidates = [{
    candidate_id: 'no-results', config,
    workspace_id: config.workspace_id,
    workspace_domain_id: config.workspace_domain_id,
    research_run_id: seed.research_run_id,
    request_id: seed.request_id,
    canonical_url: null, original_url: null,
    title: 'No usable multi-source results', should_extract: false,
    discovery_provider: 'discovery_orchestrator',
    discovery_channel: 'multi_source',
    reason_codes: ['NO_SEARCH_RESULTS'], provider_errors: providerErrors,
    relevance_score: 0, source_quality_score: 0
  }];
}

return candidates.map((candidate, index) => ({
  json: { ...candidate, discovery_provider_errors: providerErrors },
  pairedItem: { item: Math.min(index, Math.max(0, jobResults.length - 1)) }
}));`;

addNode(ifNode('Has Embedded Content?', [5792, 704], "={{ typeof $json.embedded_content === 'string' && $json.embedded_content.length >= 300 }}"));
addNode(codeNode('Normalize Embedded Content', [6032, 576], String.raw`const candidate = $input.first().json;
const maxChars = candidate.config.limits.max_source_chars;
let content = String(candidate.embedded_content ?? '').replace(/\s+/g, ' ').trim();
const wasTruncated = content.length > maxChars;
if (wasTruncated) content = content.slice(0, maxChars);
const tooShort = content.length < Math.min(700, candidate.config.limits.min_content_chars);

return [{
  json: {
    ...candidate,
    content_text: content || null,
    content_status: !content ? 'failed' : (tooShort ? 'partial' : 'success'),
    extraction_method: candidate.discovery_provider + '-embedded-content',
    extracted_at: new Date().toISOString(),
    reason_codes: [...new Set([
      ...(candidate.reason_codes ?? []),
      ...(tooShort ? ['CONTENT_TOO_SHORT'] : []),
      ...(wasTruncated ? ['CONTENT_TRUNCATED'] : [])
    ])]
  },
  pairedItem: { item: 0 }
}];`));

// Native Firecrawl versions may return either { data: { markdown, metadata } }
// or { markdown, metadata }. Truncation is a storage/prompt budget operation,
// not an extraction failure, so sufficiently long content remains eligible for evidence.
byName('Normalize Extracted Content').parameters.jsCode = String.raw`const candidate = $('Resolve Existing Source').item.json;
const response = $input.first().json ?? {};
const data = response.data && typeof response.data === 'object' ? response.data : response;
const metadata = data.metadata ?? response.metadata ?? {};
const raw = String(data.markdown ?? response.markdown ?? data.content ?? response.content ?? '');
const maxChars = candidate.config.limits.max_source_chars;

let content = raw
  .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/g, '')
  .replace(/\[(?:Skip to content|Menu|Search)\]\([^)]*\)/gi, '')
  .replace(/\n{4,}/g, '\n\n\n')
  .replace(/[ \t]{3,}/g, '  ')
  .trim();

const originalLength = content.length;
const wasTruncated = originalLength > maxChars;
if (wasTruncated) content = content.slice(0, maxChars);

const tooShort = content.length < candidate.config.limits.min_content_chars;
const extractionFailed = !content || response.error || data.error || response.success === false || data.success === false;
const contentStatus = extractionFailed ? 'failed' : (tooShort ? 'partial' : 'success');
const reasonCodes = [...new Set([
  ...(candidate.reason_codes ?? []),
  ...(extractionFailed ? ['EXTRACTION_FAILED'] : []),
  ...(tooShort && !extractionFailed ? ['CONTENT_TOO_SHORT'] : []),
  ...(wasTruncated ? ['CONTENT_TRUNCATED'] : [])
])];

return [{
  json: {
    ...candidate,
    content_text: content || null,
    content_status: contentStatus,
    extraction_method: 'firecrawl-v2-markdown',
    extracted_at: new Date().toISOString(),
    extracted_char_count: originalLength,
    publisher: candidate.publisher ?? metadata.ogSiteName ?? metadata.sourceURL ?? null,
    author: candidate.author ?? metadata.author ?? null,
    published_at: candidate.published_at ?? metadata.publishedTime ?? null,
    language: metadata.language ?? candidate.language ?? 'en',
    reason_codes: reasonCodes,
    firecrawl_warning: response.warning ?? data.warning ?? null,
    firecrawl_status_code: metadata.statusCode ?? null
  },
  pairedItem: { item: 0 }
}];`;

// A freshly extracted page may resolve to an existing source by content hash.
// It is still eligible for evidence because the current run has usable content.
// Canonical duplicates remain ineligible because Prepare Source Persistence
// sets eligible_for_evidence=false when no new extraction occurred.
byName('Restore Persisted Source Context').parameters.jsCode = String.raw`const prepared = $('Prepare Source Persistence').first().json;
const persisted = $input.first().json ?? {};
const sourcePersisted = Boolean(persisted.source_id);
const eligibleForEvidence = Boolean(prepared.eligible_for_evidence && sourcePersisted);

return [{
  json: {
    ...prepared,
    source_id: persisted.source_id ?? prepared.source_id,
    source_match_type: persisted.match_type ?? null,
    source_decision: persisted.decision ?? prepared.source_decision,
    source_is_new: Boolean(persisted.is_new),
    source_persisted: sourcePersisted,
    eligible_for_evidence: eligibleForEvidence,
    evidence_reprocessing_reason: eligibleForEvidence && !persisted.is_new
      ? 'CURRENT_EXTRACTION_MATCHED_EXISTING_CONTENT'
      : null
  },
  pairedItem: { item: 0 }
}];`;

// Preserve discovery diagnostics through the per-candidate loop. The original
// completion node intentionally returned a small record, but it dropped the
// fields required to explain empty providers and multi-source routing.
byName('Candidate Complete').parameters.jsCode = String.raw`const incoming = $input.all().map((item) => item.json ?? {});
const original = $('Candidate Loop - One at a Time').item.json ?? {};
const downstream = incoming.find((item) => item.candidate_id === original.candidate_id) ?? incoming[0] ?? {};
const first = { ...original, ...downstream };
const persistedEvidence = incoming.filter((item) => item.evidence_persisted).length;
const invalidUrl = !first.canonical_url;
const reasonCodes = [...new Set(first.reason_codes ?? [])];
const providerErrors = first.discovery_provider_errors ?? first.provider_errors ?? [];
const noDiscoveryResults = first.candidate_id === 'no-results' || reasonCodes.includes('NO_SEARCH_RESULTS');
const errors = [];
if (noDiscoveryResults) errors.push('NO_DISCOVERY_RESULTS');
else if (invalidUrl) errors.push('INVALID_OR_MISSING_CANONICAL_URL');
if (first.evidence_model_error) errors.push(first.evidence_model_error);
if (first.source_lookup_failed) errors.push('SOURCE_LOOKUP_FAILED');
if (first.content_storage_failed) errors.push('CONTENT_STORAGE_FAILED');

return [{
  json: {
    candidate_id: first.candidate_id ?? 'unknown',
    canonical_url: first.canonical_url ?? null,
    source_id: first.source_id ?? null,
    source_decision: first.source_decision ?? (invalidUrl ? 'rejected' : 'unknown'),
    source_persisted: Boolean(first.source_persisted),
    content_status: first.content_status ?? null,
    relevance_score: Number(first.relevance_score ?? 0),
    evidence_persisted: persistedEvidence,
    evidence_rejected: Number(first.evidence_rejected_count ?? 0),
    discovery_provider: first.discovery_provider ?? 'unknown',
    discovery_channel: first.discovery_channel ?? 'unknown',
    discovery_providers: first.discovery_providers ?? [first.discovery_provider].filter(Boolean),
    reason_codes: reasonCodes,
    provider_errors: providerErrors,
    errors
  }
}];`;

// Add provider distribution metrics without changing the database contract.
const summarize = byName('Summarize Research Run');
summarize.parameters.jsCode = summarize.parameters.jsCode.replace(
  "engine_version: seed.config.engine_version",
  "engine_version: seed.config.engine_version,\n  discovery_by_provider: results.reduce((acc, row) => {\n    const key = row.discovery_provider ?? 'unknown';\n    acc[key] = (acc[key] ?? 0) + 1;\n    return acc;\n  }, {}),\n  discovery_by_channel: results.reduce((acc, row) => {\n    const key = row.discovery_channel ?? 'unknown';\n    acc[key] = (acc[key] ?? 0) + 1;\n    return acc;\n  }, {}),\n  discovery_provider_errors: [...new Map(results.flatMap((row) => row.provider_errors ?? []).map((error) => [String(error.provider) + ':' + String(error.code), error])).values()].slice(0, 30),\n  social_weak_signals: results.filter((row) => (row.reason_codes ?? []).includes('DISCOVERY_ONLY_SOCIAL_SOURCE')).length",
);

// Rebuild only the connections touched by scheduled entry, discovery, and extraction routing.
replaceConnections('Manual Trigger', [[{ node: 'Research Request and Limits', type: 'main', index: 0 }]]);
connect('Scheduled Run Trigger', 'Prepare Scheduled Research Request');
connect('Prepare Scheduled Research Request', 'Validate and Prepare Run');
replaceConnections('Research Request and Limits', [[{ node: 'Validate and Prepare Run', type: 'main', index: 0 }]]);
replaceConnections('Validate and Prepare Run', [[{ node: 'Run Already Queued?', type: 'main', index: 0 }]]);
replaceConnections('Run Already Queued?', [
  [{ node: 'Claim Research Run', type: 'main', index: 0 }],
  [{ node: 'Create Research Run', type: 'main', index: 0 }],
]);
replaceConnections('Create Research Run', [[{ node: 'Claim Research Run', type: 'main', index: 0 }]]);

replaceConnections('Record Planner Usage', [[{ node: 'Build Discovery Jobs', type: 'main', index: 0 }]]);
replaceConnections('Build Discovery Jobs', [[{ node: 'Discovery Job Loop', type: 'main', index: 0 }]]);
replaceConnections('Discovery Job Loop', [
  [{ node: 'Normalize and Dedupe Candidates', type: 'main', index: 0 }],
  [{ node: 'Is Tavily Discovery?', type: 'main', index: 0 }],
]);
replaceConnections('Is Tavily Discovery?', [
  [{ node: 'Tavily Search', type: 'main', index: 0 }],
  [{ node: 'Is Hacker News Discovery?', type: 'main', index: 0 }],
]);
replaceConnections('Tavily Search', [[{ node: 'Normalize Tavily Discovery', type: 'main', index: 0 }]]);
replaceConnections('Normalize Tavily Discovery', [[{ node: 'Discovery Job Complete', type: 'main', index: 0 }]]);
replaceConnections('Is Hacker News Discovery?', [
  [{ node: 'Hacker News Search', type: 'main', index: 0 }],
  [{ node: 'Is arXiv Discovery?', type: 'main', index: 0 }],
]);
replaceConnections('Hacker News Search', [[{ node: 'Normalize Hacker News Discovery', type: 'main', index: 0 }]]);
replaceConnections('Normalize Hacker News Discovery', [[{ node: 'Discovery Job Complete', type: 'main', index: 0 }]]);
replaceConnections('Is arXiv Discovery?', [
  [{ node: 'arXiv Search', type: 'main', index: 0 }],
  [{ node: 'Is GDELT Discovery?', type: 'main', index: 0 }],
]);
replaceConnections('arXiv Search', [[{ node: 'Normalize arXiv Discovery', type: 'main', index: 0 }]]);
replaceConnections('Normalize arXiv Discovery', [[{ node: 'Discovery Job Complete', type: 'main', index: 0 }]]);
replaceConnections('Is GDELT Discovery?', [
  [{ node: 'GDELT News Search', type: 'main', index: 0 }],
  [{ node: 'Read Monitored RSS Feed', type: 'main', index: 0 }],
]);
replaceConnections('GDELT News Search', [[{ node: 'Normalize GDELT Discovery', type: 'main', index: 0 }]]);
replaceConnections('Normalize GDELT Discovery', [[{ node: 'Discovery Job Complete', type: 'main', index: 0 }]]);
replaceConnections('Read Monitored RSS Feed', [[{ node: 'Normalize RSS Discovery', type: 'main', index: 0 }]]);
replaceConnections('Normalize RSS Discovery', [[{ node: 'Discovery Job Complete', type: 'main', index: 0 }]]);
replaceConnections('Discovery Job Complete', [[{ node: 'Discovery Job Loop', type: 'main', index: 0 }]]);
replaceConnections('Normalize and Dedupe Candidates', [[{ node: 'Candidate Loop - One at a Time', type: 'main', index: 0 }]]);

replaceConnections('Already Exists?', [
  [{ node: 'Prepare Source Persistence', type: 'main', index: 0 }],
  [{ node: 'Has Embedded Content?', type: 'main', index: 0 }],
]);
replaceConnections('Has Embedded Content?', [
  [{ node: 'Normalize Embedded Content', type: 'main', index: 0 }],
  [{ node: '/scrape', type: 'main', index: 0 }],
]);
replaceConnections('Normalize Embedded Content', [[{ node: 'Prepare Source Persistence', type: 'main', index: 0 }]]);
replaceConnections('/scrape', [[{ node: 'Normalize Extracted Content', type: 'main', index: 0 }]]);

// Update setup notes without replacing the user's provider configuration.
byName('SETUP - READ FIRST').parameters.content = '## Research Engine V2 — safe import\n\n1. This file is generated from your working **Research Engine_current_export.json**.\n2. Existing native **Tavily** and **Firecrawl** nodes and all four stored credentials are preserved.\n3. Import this as a separate workflow; do not overwrite the working workflow yet.\n4. Run the manual path with small limits, then test the scheduled input path.\n5. Reddit/X results are weak-signal discovery only. Hacker News links, arXiv abstracts, GDELT news, monitored RSS, and official/VC/YC web results enter the same global dedupe and evidence pipeline.\n6. Default paid-provider caps: 3 Tavily searches and 2 Firecrawl pages per run.';

workflow.settings = {
  ...(workflow.settings ?? {}),
  executionOrder: 'v1',
  saveManualExecutions: true,
  saveExecutionProgress: true,
  saveDataErrorExecution: 'all',
  saveDataSuccessExecution: 'all',
  executionTimeout: 3600,
};

fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log(outputPath);
