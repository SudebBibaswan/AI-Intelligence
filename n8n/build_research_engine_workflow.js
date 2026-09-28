const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outputPath = path.join(__dirname, 'research_engine_complete.json');

function stableUuid(value) {
  const hash = crypto.createHash('sha256').update(value).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function baseNode(name, type, typeVersion, position, parameters, extra = {}) {
  return {
    parameters,
    id: stableUuid(`research-engine:${name}`),
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

function httpNode(name, position, parameters, credentialType, credentialId, credentialName, extra = {}) {
  return baseNode(
    name,
    'n8n-nodes-base.httpRequest',
    4.2,
    position,
    parameters,
    {
      credentials: {
        [credentialType]: {
          id: credentialId,
          name: credentialName,
        },
      },
      ...extra,
    },
  );
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
      conditions: [
        {
          id: stableUuid(`condition:${name}`),
          leftValue: expression,
          rightValue: '',
          operator: {
            type: 'boolean',
            operation: 'true',
            singleValue: true,
          },
        },
      ],
      combinator: 'and',
    },
    options: {},
  });
}

function sticky(name, position, content, width, height, color = 5) {
  return baseNode(name, 'n8n-nodes-base.stickyNote', 1, position, {
    content,
    width,
    height,
    color,
  });
}

const SUPABASE_CREDENTIAL = {
  type: 'supabaseApi',
  id: 'REPLACE_WITH_SUPABASE_CREDENTIAL_ID',
  name: 'supabase',
};
const OPENAI_CREDENTIAL = {
  type: 'openAiApi',
  id: 'REPLACE_WITH_OPENAI_CREDENTIAL_ID',
  name: 'openai',
};
const TAVILY_CREDENTIAL = {
  type: 'httpBearerAuth',
  id: 'REPLACE_WITH_TAVILY_CREDENTIAL_ID',
  name: 'bearer auth for tavily',
};
const FIRECRAWL_CREDENTIAL = {
  type: 'httpHeaderAuth',
  id: 'REPLACE_WITH_FIRECRAWL_CREDENTIAL_ID',
  name: 'firecrawl',
};

const supabasePost = (name, position, url, bodyExpression, extra = {}) =>
  httpNode(
    name,
    position,
    {
      method: 'POST',
      url,
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=representation' },
        ],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: bodyExpression,
      options: { timeout: 30000 },
    },
    SUPABASE_CREDENTIAL.type,
    SUPABASE_CREDENTIAL.id,
    SUPABASE_CREDENTIAL.name,
    { retryOnFail: true, maxTries: 2, waitBetweenTries: 1000, ...extra },
  );

const nodes = [];

nodes.push(
  sticky(
    'SETUP - READ FIRST',
    [-1180, -620],
    '## Research Engine — import setup\n\n1. Open **Research Request and Limits** and replace the three `REPLACE_...` values.\n2. If any credential is red, re-select your existing credential once:\n   - `supabase`\n   - `openai`\n   - `bearer auth for tavily`\n   - `firecrawl`\n3. Run the manual path once with limits `3 queries / 10 candidates / 5 evidence items`.\n4. Confirm rows in `research_runs`, `sources`, `research_run_sources`, `evidence`, and `llm_usage`.\n5. Shared scheduling is handled only by **RE 01 Shared Domain Scheduler**, which enters through **Scheduled Run Trigger** and reuses the queued run ID.',
    760,
    430,
    4,
  ),
  sticky(
    'PIPELINE MAP',
    [-380, -620],
    '## What this workflow actually does\n\n**Run control** → creates and atomically claims a Supabase research run.\n\n**Query planning** → bounded OpenAI Structured Output with deterministic fallback.\n\n**Discovery** → Tavily searches all planned queries; candidates are canonicalized and deduplicated across queries.\n\n**Candidate loop** → one URL at a time, with relevance gates, existing-source lookup, Firecrawl extraction, quality checks, and SHA-256 hashing.\n\n**Evidence** → bounded OpenAI extraction; excerpts are deterministically checked against source text before persistence.\n\n**Persistence** → service-only Supabase RPCs enforce lineage, replay safety, and review-only status.\n\n**Finalization** → metrics and terminal state are written to `research_runs`.',
    900,
    430,
    5,
  ),
);

nodes.push(
  baseNode('Manual Trigger', 'n8n-nodes-base.manualTrigger', 1, [-1120, 0], {}),
  baseNode(
    'Scheduled Run Trigger',
    'n8n-nodes-base.executeWorkflowTrigger',
    1.1,
    [-1120, 220],
    { inputSource: 'passthrough' },
  ),
);

nodes.push(
  codeNode(
    'Research Request and Limits',
    [-900, 0],
    String.raw`// EDIT ONLY THIS NODE for a manual research run.
// Credentials remain in n8n's credential store and are never placed here.

const now = new Date();
const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

return [{
  json: {
    config: {
      supabase_url: 'https://REPLACE_PROJECT_REF.supabase.co',
      workspace_id: 'REPLACE_WITH_WORKSPACE_UUID',
      workspace_domain_id: 'REPLACE_WITH_WORKSPACE_DOMAIN_UUID',
      domain_key: 'core-ai-it-infrastructure',
      topic: 'AI agents, model infrastructure, funding, product launches, safety and regulation',
      objective: 'Find material, current, source-grounded developments that may become evidence for intelligence analysis.',
      geographies: [],
      entities: [],
      preferred_domains: [],
      blocked_domains: [
        'pinterest.com',
        'quora.com',
        'medium.com'
      ],
      date_from: from.toISOString(),
      date_to: now.toISOString(),
      automation_mode: 'review_only',
      query_model: 'gpt-6-luna',
      evidence_model: 'gpt-6-luna',
      prompt_version: 'research-evidence-v1.0.0',
      query_prompt_version: 'research-query-plan-v1.0.0',
      contract_version: '1.0.0',
      engine_version: 'research-engine-v1.0.0',
      limits: {
        max_queries: 3,
        results_per_query: 5,
        max_candidates: 10,
        max_source_chars: 24000,
        min_content_chars: 700,
        max_evidence_per_source: 5,
        max_openai_output_tokens: 1600,
        max_estimated_openai_cost_usd: 0.10
      },
      thresholds: {
        min_relevance: 0.45,
        min_source_quality: 0.40,
        min_evidence_confidence: 0.55
      },
      pricing_per_million_tokens: {
        input: 0.10,
        output: 0.50
      }
    }
  }
}];`,
  ),
);

nodes.push(
  codeNode(
    'Prepare Scheduled Research Request',
    [-900, 220],
    String.raw`// Input is supplied only by RE 01 Shared Domain Scheduler.
// The scheduler has already created the queued research_runs row.

const input = $input.first().json;
const profile = input.domain_default_config ?? {};
const schedule = input.schedule_config ?? {};
const now = new Date();
const from = new Date(now.getTime() - 14 * 60 * 60 * 1000);

const topics = Array.isArray(profile.topics) ? profile.topics : [];
const queryFocus = Array.isArray(profile.query_focus) ? profile.query_focus : [];
const geographies = Array.isArray(profile.geographies) ? profile.geographies : ['global'];

return [{
  json: {
    existing_research_run: true,
    research_run_id: input.research_run_id,
    request_id: input.request_id,
    schedule_metadata: {
      domain_id: input.domain_id,
      slot_start: input.slot_start,
      subscriber_count: input.subscriber_count,
      profile_version: profile.profile_version ?? '1.0.0',
      domain_config_version: input.domain_config_version ?? 1
    },
    config: {
      supabase_url: input.supabase_url,
      workspace_id: input.workspace_id ?? input.collector_workspace_id,
      workspace_domain_id: input.workspace_domain_id ?? input.collector_workspace_domain_id,
      domain_key: input.domain_key,
      topic: [input.domain_name, input.domain_description, ...topics].filter(Boolean).join('; '),
      objective: queryFocus.length
        ? 'Find current, primary-source developments for: ' + queryFocus.join('; ') + '. Emphasize capital flows, adoption, measurable outcomes, and material risks.'
        : 'Find current, source-grounded developments, capital flows, adoption signals, and material risks for this domain.',
      geographies,
      entities: [],
      preferred_domains: Array.isArray(schedule.preferred_domains) ? schedule.preferred_domains : [],
      blocked_domains: Array.isArray(schedule.blocked_domains)
        ? schedule.blocked_domains
        : ['pinterest.com', 'quora.com', 'medium.com'],
      date_from: from.toISOString(),
      date_to: now.toISOString(),
      automation_mode: 'review_only',
      query_model: schedule.query_model ?? 'gpt-6-luna',
      evidence_model: schedule.evidence_model ?? 'gpt-6-luna',
      prompt_version: 'research-evidence-v1.0.0',
      query_prompt_version: 'research-query-plan-v1.0.0',
      contract_version: '1.0.0',
      engine_version: input.engine_version ?? 'research-engine-v1.0.0',
      limits: {
        max_queries: schedule.max_queries ?? 3,
        results_per_query: schedule.results_per_query ?? 5,
        max_candidates: schedule.max_candidates ?? 10,
        max_source_chars: schedule.max_source_chars ?? 24000,
        min_content_chars: schedule.min_content_chars ?? 700,
        max_evidence_per_source: schedule.max_evidence_per_source ?? 5,
        max_openai_output_tokens: schedule.max_openai_output_tokens ?? 1600,
        max_estimated_openai_cost_usd: schedule.max_estimated_openai_cost_usd ?? 0.10
      },
      thresholds: {
        min_relevance: schedule.min_relevance ?? 0.45,
        min_source_quality: schedule.min_source_quality ?? 0.40,
        min_evidence_confidence: schedule.min_evidence_confidence ?? 0.55
      },
      pricing_per_million_tokens: {
        input: 0.10,
        output: 0.50
      }
    }
  },
  pairedItem: { item: 0 }
}];`,
  ),
);

nodes.push(
  codeNode(
    'Validate and Prepare Run',
    [-660, 0],
    String.raw`const input = $input.first().json;
const config = input.config ?? {};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuid = () => {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = '4';
  hex[16] = (8 + Math.floor(Math.random() * 4)).toString(16);
  return hex.slice(0, 8).join('') + '-' + hex.slice(8, 12).join('') + '-' + hex.slice(12, 16).join('') + '-' + hex.slice(16, 20).join('') + '-' + hex.slice(20).join('');
};

const requiredStrings = ['supabase_url', 'workspace_id', 'workspace_domain_id', 'domain_key', 'topic', 'objective'];
for (const key of requiredStrings) {
  if (typeof config[key] !== 'string' || !config[key].trim() || config[key].includes('REPLACE_')) {
    throw new Error('CONFIG_REQUIRED_' + key.toUpperCase());
  }
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.supabase_url)) {
  throw new Error('INVALID_SUPABASE_URL');
}
if (!uuidPattern.test(config.workspace_id) || !uuidPattern.test(config.workspace_domain_id)) {
  throw new Error('INVALID_WORKSPACE_UUID');
}
if (config.automation_mode !== 'review_only') {
  throw new Error('FIRST_WORKFLOW_MUST_REMAIN_REVIEW_ONLY');
}

config.supabase_url = config.supabase_url.replace(/\/$/, '');
config.limits = config.limits ?? {};
config.thresholds = config.thresholds ?? {};
config.pricing_per_million_tokens = config.pricing_per_million_tokens ?? {};
config.limits.max_queries = Math.max(1, Math.min(5, Number(config.limits.max_queries || 3)));
config.limits.results_per_query = Math.max(1, Math.min(10, Number(config.limits.results_per_query || 5)));
config.limits.max_candidates = Math.max(1, Math.min(20, Number(config.limits.max_candidates || 10)));
config.limits.max_evidence_per_source = Math.max(1, Math.min(8, Number(config.limits.max_evidence_per_source || 5)));
config.limits.max_source_chars = Math.max(4000, Math.min(50000, Number(config.limits.max_source_chars || 24000)));

const run_already_created = input.existing_research_run === true;
const research_run_id = run_already_created ? input.research_run_id : uuid();
const request_id = run_already_created ? input.request_id : uuid();

if (!uuidPattern.test(research_run_id) || !uuidPattern.test(request_id)) {
  throw new Error('INVALID_RESEARCH_RUN_OR_REQUEST_UUID');
}

const created_at = new Date().toISOString();

return [{
  json: {
    config,
    research_run_id,
    request_id,
    run_already_created,
    schedule_metadata: input.schedule_metadata ?? null,
    created_at,
    run_payload: {
      id: research_run_id,
      workspace_id: config.workspace_id,
      workspace_domain_id: config.workspace_domain_id,
      trigger_type: run_already_created ? 'schedule' : 'manual',
      status: 'queued',
      request_id,
      idempotency_key: 'n8n:' + research_run_id,
      contract_version: config.contract_version,
      config_snapshot: config,
      metrics: {
        engine_version: config.engine_version,
        started_from: run_already_created ? 'shared-domain-scheduler-v1' : 'n8n-manual-import-v1'
      },
      error_summary: {}
    }
  }
}];`,
  ),
);

nodes.push(
  ifNode('Run Already Queued?', [-410, 0], '={{ $json.run_already_created === true }}'),
  supabasePost(
    'Create Research Run',
    [-160, 100],
    "={{ $('Validate and Prepare Run').item.json.config.supabase_url + '/rest/v1/research_runs' }}",
    "={{ JSON.stringify($('Validate and Prepare Run').item.json.run_payload) }}",
  ),
  supabasePost(
    'Claim Research Run',
    [80, 0],
    "={{ $('Validate and Prepare Run').item.json.config.supabase_url + '/rest/v1/rpc/n8n_claim_research_run' }}",
    "={{ JSON.stringify({ p_research_run_id: $('Validate and Prepare Run').item.json.research_run_id, p_request_id: $('Validate and Prepare Run').item.json.request_id }) }}",
  ),
);

nodes.push(
  codeNode(
    'Build Query Planner Request',
    [320, 0],
    String.raw`const claimed = $input.first().json;
const seed = $('Validate and Prepare Run').first().json;
const config = seed.config;

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    queries: {
      type: 'array',
      minItems: 1,
      maxItems: config.limits.max_queries,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string' },
          intent: { type: 'string', enum: ['current_news', 'official_sources', 'research_and_technical', 'market_activity', 'regulation_and_safety'] },
          recency_days: { type: 'integer', minimum: 1, maximum: 365 },
          result_limit: { type: 'integer', minimum: 1, maximum: 10 }
        },
        required: ['query', 'intent', 'recency_days', 'result_limit']
      }
    }
  },
  required: ['queries']
};

const planningContext = {
  domain: config.domain_key,
  topic: config.topic,
  objective: config.objective,
  geographies: config.geographies,
  entities: config.entities,
  preferred_domains: config.preferred_domains,
  date_from: config.date_from,
  date_to: config.date_to,
  maximum_queries: config.limits.max_queries,
  maximum_results_per_query: config.limits.results_per_query
};

return [{
  json: {
    ...seed,
    claimed_run: claimed,
    openai_request: {
      model: config.query_model,
      instructions: 'Create a compact web-search plan for a research intelligence pipeline. Queries must be non-overlapping, concrete, time-aware, and optimized for source discovery rather than answering the question. Include official or primary-source language where useful. Do not invent entities. Return only the required structured output.',
      input: [{
        role: 'user',
        content: [{ type: 'input_text', text: JSON.stringify(planningContext) }]
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'research_query_plan',
          strict: true,
          schema
        }
      },
      max_output_tokens: 1000,
      store: false
    }
  }
}];`,
  ),
);

nodes.push(
  httpNode(
    'OpenAI Query Planner',
    [330, 0],
    {
      method: 'POST',
      url: 'https://api.openai.com/v1/responses',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.openai_request) }}',
      options: { timeout: 60000 },
    },
    OPENAI_CREDENTIAL.type,
    OPENAI_CREDENTIAL.id,
    OPENAI_CREDENTIAL.name,
    {
      retryOnFail: true,
      maxTries: 2,
      waitBetweenTries: 1500,
      alwaysOutputData: true,
      onError: 'continueRegularOutput',
    },
  ),
);

nodes.push(
  codeNode(
    'Parse Query Plan',
    [580, 0],
    String.raw`const response = $input.first().json ?? {};
const seed = $('Validate and Prepare Run').first().json;
const config = seed.config;

const uuid = () => {
  const h = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  h[12] = '4'; h[16] = (8 + Math.floor(Math.random() * 4)).toString(16);
  return h.slice(0,8).join('') + '-' + h.slice(8,12).join('') + '-' + h.slice(12,16).join('') + '-' + h.slice(16,20).join('') + '-' + h.slice(20).join('');
};

const outputText = (response.output ?? [])
  .flatMap((item) => item.content ?? [])
  .find((content) => content.type === 'output_text')?.text;

let parsed = null;
let plannerError = null;
try {
  parsed = outputText ? JSON.parse(outputText) : null;
} catch (error) {
  plannerError = 'QUERY_PLAN_INVALID_JSON';
}

const allowedIntents = new Set(['current_news', 'official_sources', 'research_and_technical', 'market_activity', 'regulation_and_safety']);
let queries = Array.isArray(parsed?.queries) ? parsed.queries : [];
queries = queries
  .filter((q) => q && typeof q.query === 'string' && q.query.trim())
  .map((q) => ({
    query: q.query.trim().slice(0, 300),
    intent: allowedIntents.has(q.intent) ? q.intent : 'current_news',
    recency_days: Math.max(1, Math.min(365, Number(q.recency_days || 30))),
    result_limit: Math.max(1, Math.min(config.limits.results_per_query, Number(q.result_limit || config.limits.results_per_query)))
  }));

if (!queries.length) {
  plannerError = plannerError || 'QUERY_PLANNER_FALLBACK_USED';
  const topic = config.topic;
  queries = [
    { query: topic + ' latest news announcements', intent: 'current_news', recency_days: 30, result_limit: config.limits.results_per_query },
    { query: topic + ' official release funding acquisition partnership', intent: 'official_sources', recency_days: 60, result_limit: config.limits.results_per_query },
    { query: topic + ' research paper benchmark technical report', intent: 'research_and_technical', recency_days: 90, result_limit: config.limits.results_per_query }
  ].slice(0, config.limits.max_queries);
}

const seen = new Set();
queries = queries.filter((q) => {
  const key = q.query.toLowerCase().replace(/\s+/g, ' ');
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}).slice(0, config.limits.max_queries);

const usage = response.usage ?? {};
const inputTokens = Number(usage.input_tokens ?? 0);
const outputTokens = Number(usage.output_tokens ?? 0);
const estimatedCost = (inputTokens * config.pricing_per_million_tokens.input + outputTokens * config.pricing_per_million_tokens.output) / 1000000;

return [{
  json: {
    ...seed,
    query_items: queries.map((query, index) => ({ ...query, query_index: index + 1 })),
    planner_fallback_used: Boolean(plannerError),
    planner_error_code: plannerError,
    planner_usage: {
      workspace_id: config.workspace_id,
      research_run_id: seed.research_run_id,
      request_id: uuid(),
      workflow: 'RE 00 Research Engine',
      agent: 'query_planner',
      operation: 'structured_query_plan',
      provider: 'openai',
      model: response.model ?? config.query_model,
      model_tier: 0,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: Number(estimatedCost.toFixed(6)),
      latency_ms: 0,
      success: !plannerError,
      error_code: plannerError,
      prompt_version: config.query_prompt_version,
      schema_version: 'query-plan-v1.0.0'
    }
  }
}];`,
  ),
);

nodes.push(
  supabasePost(
    'Record Planner Usage',
    [830, 0],
    "={{ $('Validate and Prepare Run').item.json.config.supabase_url + '/rest/v1/llm_usage' }}",
    "={{ JSON.stringify($('Parse Query Plan').item.json.planner_usage) }}",
    { onError: 'continueRegularOutput', alwaysOutputData: true },
  ),
);

nodes.push(
  codeNode(
    'Expand Queries',
    [1080, 0],
    String.raw`const plan = $('Parse Query Plan').first().json;
return plan.query_items.map((query, index) => ({
  json: {
    config: plan.config,
    research_run_id: plan.research_run_id,
    request_id: plan.request_id,
    ...query
  },
  pairedItem: { item: 0 }
}));`,
  ),
);

nodes.push(
  httpNode(
    'Tavily Search',
    [1320, 0],
    {
      method: 'POST',
      url: 'https://api.tavily.com/search',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ query: $json.query, topic: 'general', search_depth: 'basic', max_results: $json.result_limit, include_answer: false, include_raw_content: false, include_images: false, include_favicon: false, start_date: $json.config.date_from.slice(0, 10), end_date: $json.config.date_to.slice(0, 10) }) }}",
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 750 } },
        timeout: 30000,
      },
    },
    TAVILY_CREDENTIAL.type,
    TAVILY_CREDENTIAL.id,
    TAVILY_CREDENTIAL.name,
    {
      retryOnFail: true,
      maxTries: 2,
      waitBetweenTries: 1200,
      alwaysOutputData: true,
      onError: 'continueRegularOutput',
    },
  ),
);

nodes.push(
  codeNode(
    'Normalize and Dedupe Candidates',
    [1570, 0],
    String.raw`const responses = $input.all().map((item) => item.json ?? {});
const queryItems = $('Expand Queries').all().map((item) => item.json);
const seed = $('Validate and Prepare Run').first().json;
const config = seed.config;

const tracking = new Set([
  'utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id',
  'gclid','fbclid','mc_cid','mc_eid','ref','ref_src','source'
]);

function canonicalize(raw) {
  try {
    const url = new URL(String(raw ?? '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (tracking.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/{2,}/g, '/');
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
    return url.toString();
  } catch {
    return null;
  }
}

function tokenize(value) {
  return new Set(String(value ?? '').toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []);
}

function overlapScore(query, text) {
  const queryTokens = tokenize(query);
  const textTokens = tokenize(text);
  if (!queryTokens.size) return 0;
  let matches = 0;
  for (const token of queryTokens) if (textTokens.has(token)) matches++;
  return Math.min(1, matches / Math.max(3, queryTokens.size));
}

function sourceQuality(hostname) {
  const host = hostname.replace(/^www\./, '');
  if (/\.(gov|edu)$/.test(host) || host.endsWith('.gov.in')) return 0.95;
  if (host === 'arxiv.org' || host === 'github.com') return 0.88;
  if (config.preferred_domains.some((domain) => host === domain || host.endsWith('.' + domain))) return 0.90;
  if (host.includes('substack.com')) return 0.55;
  return 0.65;
}

function sourceType(url, title) {
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname.toLowerCase();
  const text = (title + ' ' + path).toLowerCase();
  if (host === 'arxiv.org' || /paper|research|whitepaper/.test(text)) return 'paper';
  if (host === 'github.com') return 'repository';
  if (/press-release|newsroom|press_release/.test(text)) return 'press_release';
  if (/filing|10-k|10-q|8-k/.test(text)) return 'filing';
  if (/jobs?|careers?/.test(text)) return 'job_posting';
  if (/youtube\.com|youtu\.be/.test(host)) return 'video';
  return 'article';
}

const deduped = new Map();
let providerErrors = 0;

responses.forEach((response, responseIndex) => {
  const queryContext = queryItems[responseIndex] ?? queryItems[0] ?? {};
  const results = Array.isArray(response.results) ? response.results : [];
  if (!results.length && (response.error || response.message)) providerErrors++;

  results.forEach((result, resultIndex) => {
    const originalUrl = String(result.url ?? '').trim();
    const canonicalUrl = canonicalize(originalUrl);
    if (!canonicalUrl) return;

    const url = new URL(canonicalUrl);
    const host = url.hostname.replace(/^www\./, '');
    const blocked = config.blocked_domains.some((domain) => host === domain || host.endsWith('.' + domain));
    const title = String(result.title ?? host).trim().slice(0, 500) || host;
    const snippet = String(result.content ?? result.snippet ?? '').trim().slice(0, 3000);
    const providerScore = Math.max(0, Math.min(1, Number(result.score ?? 0)));
    const lexical = overlapScore(queryContext.query, title + ' ' + snippet);
    const quality = sourceQuality(host);
    const relevance = Math.max(0, Math.min(1, providerScore * 0.55 + lexical * 0.30 + quality * 0.15));
    const reasonCodes = [];
    if (lexical >= 0.30) reasonCodes.push('TOPIC_MATCH');
    if (quality >= 0.85) reasonCodes.push('PRIMARY_SOURCE');
    if (blocked) reasonCodes.push('POSSIBLE_SPAM');
    if (relevance < config.thresholds.min_relevance) reasonCodes.push('LOW_RELEVANCE');

    const candidate = {
      candidate_id: 'candidate:' + responseIndex + ':' + resultIndex,
      config,
      workspace_id: config.workspace_id,
      workspace_domain_id: config.workspace_domain_id,
      research_run_id: seed.research_run_id,
      request_id: seed.request_id,
      discovery_channel: 'web_search',
      discovery_provider: 'tavily',
      query: queryContext.query ?? '',
      query_intent: queryContext.intent ?? 'current_news',
      result_rank: resultIndex + 1,
      discovered_at: new Date().toISOString(),
      original_url: originalUrl,
      canonical_url: canonicalUrl,
      title,
      snippet,
      publisher: null,
      author: null,
      published_at: result.published_date ?? null,
      language: 'en',
      source_type: sourceType(url, title),
      relevance_score: Number(relevance.toFixed(3)),
      source_quality_score: Number(quality.toFixed(3)),
      reason_codes: reasonCodes,
      should_extract: !blocked && relevance >= config.thresholds.min_relevance && quality >= config.thresholds.min_source_quality,
      discovery_queries: [queryContext.query].filter(Boolean),
      provider_request_id: response.request_id ?? null,
      tavily_score: providerScore
    };

    const existing = deduped.get(canonicalUrl);
    if (!existing || candidate.relevance_score > existing.relevance_score) {
      candidate.discovery_queries = [...new Set([...(existing?.discovery_queries ?? []), ...candidate.discovery_queries])];
      deduped.set(canonicalUrl, candidate);
    } else {
      existing.discovery_queries = [...new Set([...existing.discovery_queries, ...candidate.discovery_queries])];
    }
  });
});

let candidates = [...deduped.values()]
  .sort((a, b) => b.relevance_score - a.relevance_score || b.source_quality_score - a.source_quality_score)
  .slice(0, config.limits.max_candidates);

if (!candidates.length) {
  candidates = [{
    candidate_id: 'no-results',
    config,
    workspace_id: config.workspace_id,
    workspace_domain_id: config.workspace_domain_id,
    research_run_id: seed.research_run_id,
    request_id: seed.request_id,
    canonical_url: null,
    original_url: null,
    title: 'No usable Tavily results',
    should_extract: false,
    reason_codes: ['NO_SEARCH_RESULTS'],
    discovery_provider_errors: providerErrors,
    relevance_score: 0,
    source_quality_score: 0
  }];
}

return candidates.map((candidate, index) => ({ json: candidate, pairedItem: { item: 0 } }));`,
  ),
);

nodes.push(
  baseNode('Candidate Loop - One at a Time', 'n8n-nodes-base.splitInBatches', 3, [1810, 0], {
    batchSize: 1,
    options: { reset: false },
  }),
  ifNode('Has Valid Canonical URL?', [2050, 120], '={{ Boolean($json.canonical_url) }}'),
  ifNode('Meets Relevance Gate?', [2280, 120], '={{ Boolean($json.should_extract) }}'),
);

nodes.push(
  httpNode(
    'Lookup Existing Source',
    [2510, 40],
    {
      url: "={{ $json.config.supabase_url + '/rest/v1/sources' }}",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'select', value: 'id,canonical_url,content_hash' },
          { name: 'workspace_id', value: '=eq.{{ $json.workspace_id }}' },
          { name: 'canonical_url', value: '=eq.{{ $json.canonical_url }}' },
          { name: 'deleted_at', value: 'is.null' },
          { name: 'limit', value: '1' },
        ],
      },
      options: { timeout: 20000 },
    },
    SUPABASE_CREDENTIAL.type,
    SUPABASE_CREDENTIAL.id,
    SUPABASE_CREDENTIAL.name,
    {
      retryOnFail: true,
      maxTries: 2,
      waitBetweenTries: 800,
      alwaysOutputData: true,
      onError: 'continueRegularOutput',
    },
  ),
  codeNode(
    'Resolve Existing Source',
    [2740, 40],
    String.raw`const candidate = $('Candidate Loop - One at a Time').item.json;
const response = $input.first().json;
const rows = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
const existing = rows[0] ?? null;

return [{
  json: {
    ...candidate,
    existing_source_id: existing?.id ?? null,
    existing_content_hash: existing?.content_hash ?? null,
    source_lookup_failed: Boolean(response?.error && !existing)
  }
}];`,
  ),
  ifNode('Already Exists?', [2970, 40], '={{ Boolean($json.existing_source_id) }}'),
);

nodes.push(
  httpNode(
    'Firecrawl Scrape',
    [3210, 180],
    {
      method: 'POST',
      url: 'https://api.firecrawl.dev/v2/scrape',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ url: $json.canonical_url, formats: ['markdown'], onlyMainContent: true, timeout: 30000 }) }}",
      options: { timeout: 45000 },
    },
    FIRECRAWL_CREDENTIAL.type,
    FIRECRAWL_CREDENTIAL.id,
    FIRECRAWL_CREDENTIAL.name,
    {
      retryOnFail: true,
      maxTries: 2,
      waitBetweenTries: 1500,
      alwaysOutputData: true,
      onError: 'continueRegularOutput',
    },
  ),
  codeNode(
    'Normalize Extracted Content',
    [3450, 180],
    String.raw`const candidate = $('Resolve Existing Source').item.json;
const response = $input.first().json ?? {};
const data = response.data ?? {};
const metadata = data.metadata ?? {};
const raw = String(data.markdown ?? '');
const maxChars = candidate.config.limits.max_source_chars;

let content = raw
  .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/g, '')
  .replace(/\[(?:Skip to content|Menu|Search)\]\([^)]*\)/gi, '')
  .replace(/\n{4,}/g, '\n\n\n')
  .replace(/[ \t]{3,}/g, '  ')
  .trim();

const wasTruncated = content.length > maxChars;
if (wasTruncated) content = content.slice(0, maxChars);

let contentStatus = 'success';
const reasonCodes = [...(candidate.reason_codes ?? [])];
if (!content || response.error || response.success === false) {
  contentStatus = 'failed';
  reasonCodes.push('EXTRACTION_FAILED');
} else if (content.length < candidate.config.limits.min_content_chars) {
  contentStatus = 'partial';
  reasonCodes.push('CONTENT_TOO_SHORT');
} else if (wasTruncated) {
  contentStatus = 'partial';
  reasonCodes.push('CONTENT_TRUNCATED');
}

return [{
  json: {
    ...candidate,
    content_text: content || null,
    content_status: contentStatus,
    extraction_method: 'firecrawl-v2-markdown',
    extracted_at: new Date().toISOString(),
    publisher: candidate.publisher ?? metadata.ogSiteName ?? metadata.sourceURL ?? null,
    author: candidate.author ?? metadata.author ?? null,
    published_at: candidate.published_at ?? metadata.publishedTime ?? null,
    language: metadata.language ?? candidate.language ?? 'en',
    reason_codes: [...new Set(reasonCodes)],
    firecrawl_warning: response.warning ?? null,
    firecrawl_status_code: metadata.statusCode ?? null
  }
}];`,
  ),
);

nodes.push(
  codeNode(
    'Prepare Source Persistence',
    [3690, 40],
    String.raw`const crypto = require('crypto');
const item = $input.first().json;
const config = item.config;

const uuid = () => {
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return h.slice(0,8) + '-' + h.slice(8,12) + '-' + h.slice(12,16) + '-' + h.slice(16,20) + '-' + h.slice(20);
};

const isDuplicate = Boolean(item.existing_source_id);
const hasContent = typeof item.content_text === 'string' && item.content_text.length > 0;
const hash = hasContent ? 'sha256:' + crypto.createHash('sha256').update(item.content_text, 'utf8').digest('hex') : null;
const contentStatus = isDuplicate ? 'pending' : (item.content_status ?? 'pending');

let decision = 'needs_review';
const reasons = [...new Set(item.reason_codes ?? [])];
if (isDuplicate) {
  decision = 'duplicate';
  reasons.push('DUPLICATE_CANONICAL_URL');
} else if (!item.should_extract) {
  decision = 'rejected';
  if (!reasons.includes('LOW_RELEVANCE')) reasons.push('LOW_RELEVANCE');
} else if (!hasContent || contentStatus === 'failed' || contentStatus === 'blocked') {
  decision = 'rejected';
  reasons.push('EXTRACTION_FAILED');
} else if (contentStatus === 'partial') {
  decision = 'needs_review';
} else {
  decision = 'needs_review';
}

const sourceId = item.existing_source_id ?? uuid();
const eligible = !isDuplicate && hasContent && contentStatus === 'success' && item.relevance_score >= config.thresholds.min_relevance;

const sourceContract = {
  schema_version: config.contract_version,
  source_id: sourceId,
  workspace_id: item.workspace_id,
  workspace_domain_id: item.workspace_domain_id,
  collection_run_id: item.research_run_id,
  source_type: item.source_type ?? 'article',
  discovery: {
    channel: item.discovery_channel ?? 'web_search',
    provider: item.discovery_provider ?? 'tavily',
    query: item.query ?? null,
    result_rank: Number(item.result_rank || 1),
    external_result_id: item.provider_request_id ?? null,
    discovered_at: item.discovered_at ?? new Date().toISOString()
  },
  identity: {
    original_url: item.original_url,
    canonical_url: item.canonical_url,
    title: item.title,
    publisher: item.publisher ?? null,
    author: item.author ?? null,
    language: item.language ?? 'en',
    published_at: item.published_at ?? null
  },
  content: {
    text: hasContent ? item.content_text : null,
    summary: null,
    content_hash: hash,
    extraction_method: hasContent ? (item.extraction_method ?? 'firecrawl-v2-markdown') : null,
    extracted_at: hasContent ? (item.extracted_at ?? new Date().toISOString()) : null,
    status: contentStatus
  },
  classification: {
    domain_key: config.domain_key,
    topics: [config.topic],
    geographies: config.geographies,
    entity_types: [],
    relevance_score: Number(item.relevance_score ?? 0),
    source_quality_score: Number(item.source_quality_score ?? 0),
    decision,
    reason_codes: [...new Set(reasons)]
  },
  verification: {
    status: hasContent ? 'partially_verified' : 'unverified',
    checked_at: new Date().toISOString(),
    checks: [
      { type: 'canonical_url_present', passed: Boolean(item.canonical_url), details: null },
      { type: 'content_extracted', passed: hasContent, details: contentStatus }
    ]
  },
  metadata: {
    storage_class: 'S0',
    provider: {
      search_request_id: item.provider_request_id ?? null,
      firecrawl_status_code: item.firecrawl_status_code ?? null,
      warning: item.firecrawl_warning ?? null
    },
    discovery_queries: item.discovery_queries ?? [item.query].filter(Boolean),
    engine_version: config.engine_version
  }
};

return [{
  json: {
    ...item,
    source_id: sourceId,
    content_hash: hash,
    source_decision: decision,
    eligible_for_evidence: eligible,
    source_contract: sourceContract
  }
}];`,
  ),
);

nodes.push(
  supabasePost(
    'Persist Source via RPC',
    [3930, 40],
    "={{ $('Validate and Prepare Run').item.json.config.supabase_url + '/rest/v1/rpc/n8n_record_research_source' }}",
    '={{ JSON.stringify({ p_source: $json.source_contract }) }}',
  ),
  codeNode(
    'Restore Persisted Source Context',
    [4170, 40],
    String.raw`const prepared = $('Prepare Source Persistence').item.json;
const persisted = $input.first().json ?? {};
return [{
  json: {
    ...prepared,
    source_id: persisted.source_id ?? prepared.source_id,
    source_match_type: persisted.match_type ?? null,
    source_decision: persisted.decision ?? prepared.source_decision,
    source_is_new: Boolean(persisted.is_new),
    source_persisted: Boolean(persisted.source_id),
    eligible_for_evidence: Boolean(prepared.eligible_for_evidence && persisted.source_id && persisted.is_new)
  }
}];`,
  ),
  ifNode('Should Store Source Content?', [4410, 40], '={{ Boolean($json.source_is_new && $json.content_text) }}'),
);

nodes.push(
  httpNode(
    'Upload Source Content',
    [4650, 80],
    {
      method: 'POST',
      url: "={{ $json.config.supabase_url + '/storage/v1/object/research-content/' + $json.workspace_id + '/' + $json.research_run_id + '/' + $json.source_id + '.md' }}",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          { name: 'x-upsert', value: 'false' },
        ],
      },
      sendBody: true,
      contentType: 'raw',
      rawContentType: 'text/markdown; charset=utf-8',
      body: '={{ $json.content_text }}',
      options: { timeout: 30000 },
    },
    SUPABASE_CREDENTIAL.type,
    SUPABASE_CREDENTIAL.id,
    SUPABASE_CREDENTIAL.name,
    {
      retryOnFail: true,
      maxTries: 2,
      waitBetweenTries: 1000,
      alwaysOutputData: true,
      onError: 'continueRegularOutput',
    },
  ),
  codeNode(
    'Evaluate Content Upload',
    [4890, 80],
    String.raw`const source = $('Restore Persisted Source Context').item.json;
const response = $input.first().json ?? {};
const expectedPath = source.workspace_id + '/' + source.research_run_id + '/' + source.source_id + '.md';
const stored = Boolean(response.Key || response.key || response.Id || response.id);

return [{
  json: {
    ...source,
    content_stored: stored,
    content_storage_path: stored ? expectedPath : null,
    content_storage_failed: !stored
  }
}];`,
  ),
  ifNode('Content Stored?', [5130, 80], '={{ Boolean($json.content_stored) }}'),
  httpNode(
    'Update Source Storage Path',
    [5370, 20],
    {
      method: 'PATCH',
      url: "={{ $json.config.supabase_url + '/rest/v1/sources?id=eq.' + $json.source_id + '&workspace_id=eq.' + $json.workspace_id }}",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=representation' },
        ],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify({ content_storage_path: $json.content_storage_path }) }}',
      options: { timeout: 20000 },
    },
    SUPABASE_CREDENTIAL.type,
    SUPABASE_CREDENTIAL.id,
    SUPABASE_CREDENTIAL.name,
    { retryOnFail: true, maxTries: 2, waitBetweenTries: 800 },
  ),
  codeNode(
    'Restore Stored Source Context',
    [5610, 20],
    String.raw`const source = $('Evaluate Content Upload').item.json;
return [{ json: { ...source, content_stored: true, content_storage_failed: false } }];`,
  ),
  ifNode('Eligible for Evidence?', [5850, 40], '={{ Boolean($json.eligible_for_evidence) }}'),
);

nodes.push(
  codeNode(
    'Build Evidence Request',
    [6090, -60],
    String.raw`const source = $input.first().json;
const config = source.config;

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      minItems: 0,
      maxItems: config.limits.max_evidence_per_source,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          evidence_type: { type: 'string', enum: ['fact', 'quote', 'metric', 'event', 'claim', 'counter_claim'] },
          claim_text: { type: 'string' },
          excerpt: { type: 'string' },
          locator: {
            type: 'object',
            additionalProperties: false,
            properties: {
              section: { type: 'string' },
              paragraph: { type: 'integer' }
            },
            required: ['section', 'paragraph']
          },
          polarity: { type: 'string', enum: ['supports', 'contradicts', 'neutral'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['evidence_type', 'claim_text', 'excerpt', 'locator', 'polarity', 'confidence']
      }
    }
  },
  required: ['items']
};

const sourceInput = {
  title: source.title,
  canonical_url: source.canonical_url,
  publisher: source.publisher,
  published_at: source.published_at,
  research_objective: config.objective,
  maximum_items: config.limits.max_evidence_per_source,
  source_text: source.content_text
};

return [{
  json: {
    ...source,
    openai_request: {
      model: config.evidence_model,
      instructions: 'Extract only decision-useful evidence explicitly supported by the supplied source. Every excerpt must be copied from the supplied source text, with no paraphrasing inside excerpt. Claims must be concise normalized propositions. Do not use outside knowledge. Do not infer missing dates, actors, amounts, or causality. Return an empty items array when the source contains no suitable evidence.',
      input: [{
        role: 'user',
        content: [{ type: 'input_text', text: JSON.stringify(sourceInput) }]
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'research_evidence_items',
          strict: true,
          schema
        }
      },
      max_output_tokens: config.limits.max_openai_output_tokens,
      store: false
    }
  }
}];`,
  ),
);

nodes.push(
  httpNode(
    'OpenAI Evidence Extraction',
    [6330, -60],
    {
      method: 'POST',
      url: 'https://api.openai.com/v1/responses',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.openai_request) }}',
      options: { timeout: 90000 },
    },
    OPENAI_CREDENTIAL.type,
    OPENAI_CREDENTIAL.id,
    OPENAI_CREDENTIAL.name,
    {
      retryOnFail: true,
      maxTries: 2,
      waitBetweenTries: 1800,
      alwaysOutputData: true,
      onError: 'continueRegularOutput',
    },
  ),
  codeNode(
    'Parse and Verify Evidence',
    [6570, -60],
    String.raw`const response = $input.first().json ?? {};
const source = $('Build Evidence Request').item.json;
const config = source.config;
const crypto = require('crypto');

const uuid = () => {
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return h.slice(0,8) + '-' + h.slice(8,12) + '-' + h.slice(12,16) + '-' + h.slice(16,20) + '-' + h.slice(20);
};

const outputText = (response.output ?? [])
  .flatMap((item) => item.content ?? [])
  .find((content) => content.type === 'output_text')?.text;

let parsed = null;
let modelError = null;
try {
  parsed = outputText ? JSON.parse(outputText) : null;
} catch {
  modelError = 'EVIDENCE_OUTPUT_INVALID_JSON';
}
if (!Array.isArray(parsed?.items)) modelError = modelError || 'EVIDENCE_OUTPUT_MISSING';

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalizedSource = normalizeWhitespace(source.content_text);
const allowedTypes = new Set(['fact', 'quote', 'metric', 'event', 'claim', 'counter_claim']);
const allowedPolarity = new Set(['supports', 'contradicts', 'neutral']);
const grounded = [];
let rejectedCount = 0;

for (const raw of (parsed?.items ?? []).slice(0, config.limits.max_evidence_per_source)) {
  const excerpt = normalizeWhitespace(raw.excerpt);
  const claim = normalizeWhitespace(raw.claim_text);
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence ?? 0)));
  const exactGrounding = excerpt.length >= 20 && normalizedSource.includes(excerpt);
  const structurallyValid = allowedTypes.has(raw.evidence_type) && allowedPolarity.has(raw.polarity) && claim.length >= 10 && claim.length <= 1000;
  if (!exactGrounding || !structurallyValid || confidence < config.thresholds.min_evidence_confidence) {
    rejectedCount++;
    continue;
  }

  grounded.push({
    id: uuid(),
    workspace_id: source.workspace_id,
    source_id: source.source_id,
    research_run_id: source.research_run_id,
    evidence_type: raw.evidence_type,
    claim_text: claim,
    excerpt,
    locator: {
      section: String(raw.locator?.section ?? '').slice(0, 300),
      paragraph: Math.max(0, Number(raw.locator?.paragraph ?? 0))
    },
    polarity: raw.polarity,
    confidence,
    verification_status: 'verified',
    extractor_version: config.prompt_version,
    metadata: {
      schema_version: 'evidence-v1.0.0',
      model_request_id: response.id ?? null,
      model: response.model ?? config.evidence_model,
      exact_excerpt_match: true,
      review_mode: config.automation_mode
    }
  });
}

const usage = response.usage ?? {};
const inputTokens = Number(usage.input_tokens ?? 0);
const outputTokens = Number(usage.output_tokens ?? 0);
const estimatedCost = (inputTokens * config.pricing_per_million_tokens.input + outputTokens * config.pricing_per_million_tokens.output) / 1000000;
if (estimatedCost > config.limits.max_estimated_openai_cost_usd) modelError = modelError || 'RUN_OPENAI_COST_CAP_EXCEEDED';

return [{
  json: {
    ...source,
    evidence_items: grounded,
    evidence_rejected_count: rejectedCount,
    evidence_model_error: modelError,
    evidence_usage: {
      workspace_id: source.workspace_id,
      research_run_id: source.research_run_id,
      request_id: uuid(),
      workflow: 'RE 00 Research Engine',
      agent: 'evidence_extractor',
      operation: 'structured_evidence_extraction',
      provider: 'openai',
      model: response.model ?? config.evidence_model,
      model_tier: 0,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: Number(estimatedCost.toFixed(6)),
      latency_ms: 0,
      success: !modelError,
      error_code: modelError,
      prompt_version: config.prompt_version,
      schema_version: 'evidence-v1.0.0'
    }
  }
}];`,
  ),
);

nodes.push(
  supabasePost(
    'Record Evidence LLM Usage',
    [6810, -60],
    "={{ $('Validate and Prepare Run').item.json.config.supabase_url + '/rest/v1/llm_usage' }}",
    "={{ JSON.stringify($('Parse and Verify Evidence').item.json.evidence_usage) }}",
    { onError: 'continueRegularOutput', alwaysOutputData: true },
  ),
  codeNode(
    'Expand Evidence',
    [7050, -60],
    String.raw`const parsed = $('Parse and Verify Evidence').item.json;
if (!parsed.evidence_items.length) {
  return [{
    json: {
      ...parsed,
      has_evidence: false,
      evidence_contract: null
    }
  }];
}

return parsed.evidence_items.map((evidence, index) => ({
  json: {
    candidate_id: parsed.candidate_id,
    config: parsed.config,
    workspace_id: parsed.workspace_id,
    workspace_domain_id: parsed.workspace_domain_id,
    research_run_id: parsed.research_run_id,
    request_id: parsed.request_id,
    source_id: parsed.source_id,
    canonical_url: parsed.canonical_url,
    source_decision: parsed.source_decision,
    source_persisted: parsed.source_persisted,
    content_status: parsed.content_status,
    content_storage_failed: Boolean(parsed.content_storage_failed),
    evidence_rejected_count: parsed.evidence_rejected_count,
    evidence_model_error: parsed.evidence_model_error,
    has_evidence: true,
    evidence_contract: evidence
  },
  pairedItem: { item: 0 }
}));`,
  ),
  ifNode('Has Grounded Evidence?', [7290, -60], '={{ Boolean($json.has_evidence) }}'),
);

nodes.push(
  supabasePost(
    'Persist Evidence via RPC',
    [7530, -140],
    "={{ $('Validate and Prepare Run').item.json.config.supabase_url + '/rest/v1/rpc/n8n_record_research_evidence' }}",
    '={{ JSON.stringify({ p_evidence: $json.evidence_contract }) }}',
  ),
  codeNode(
    'Restore Evidence Context',
    [7770, -140],
    String.raw`const evidence = $('Expand Evidence').item.json;
const persisted = $input.item.json ?? {};
return {
  json: {
    ...evidence,
    evidence_id: persisted.evidence_id ?? evidence.evidence_contract?.id ?? null,
    evidence_persisted: Boolean(persisted.evidence_id),
    evidence_is_new: Boolean(persisted.is_new)
  }
};`,
    'runOnceForEachItem',
  ),
);

nodes.push(
  codeNode(
    'Candidate Complete',
    [8010, 120],
    String.raw`const incoming = $input.all().map((item) => item.json ?? {});
const first = incoming[0] ?? {};
const persistedEvidence = incoming.filter((item) => item.evidence_persisted).length;
const invalidUrl = !first.canonical_url;
const errors = [];
if (invalidUrl) errors.push('INVALID_OR_MISSING_CANONICAL_URL');
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
    errors
  }
}];`,
  ),
);

nodes.push(
  codeNode(
    'Summarize Research Run',
    [2050, -180],
    String.raw`const results = $input.all().map((item) => item.json ?? {});
const seed = $('Validate and Prepare Run').first().json;
const plan = $('Parse Query Plan').first().json;

const metrics = {
  queries_planned: plan.query_items.length,
  planner_fallback_used: Boolean(plan.planner_fallback_used),
  candidates_processed: results.length,
  sources_persisted: results.filter((r) => r.source_persisted).length,
  sources_duplicate: results.filter((r) => r.source_decision === 'duplicate').length,
  sources_rejected: results.filter((r) => r.source_decision === 'rejected').length,
  sources_needing_review: results.filter((r) => r.source_decision === 'needs_review').length,
  crawl_success: results.filter((r) => r.content_status === 'success').length,
  crawl_partial: results.filter((r) => r.content_status === 'partial').length,
  crawl_failed: results.filter((r) => r.content_status === 'failed').length,
  evidence_persisted: results.reduce((sum, r) => sum + Number(r.evidence_persisted || 0), 0),
  evidence_rejected: results.reduce((sum, r) => sum + Number(r.evidence_rejected || 0), 0),
  candidate_errors: results.reduce((sum, r) => sum + (Array.isArray(r.errors) ? r.errors.length : 0), 0),
  automation_mode: seed.config.automation_mode,
  engine_version: seed.config.engine_version
};

let finalStatus = 'completed';
if (metrics.sources_persisted === 0) finalStatus = 'failed';
else if (metrics.candidate_errors > 0 || metrics.crawl_failed > 0 || plan.planner_fallback_used) finalStatus = 'partial';

return [{
  json: {
    config: seed.config,
    research_run_id: seed.research_run_id,
    request_id: seed.request_id,
    final_status: finalStatus,
    metrics,
    error_patch: {
      planner_error: plan.planner_error_code ?? null,
      candidate_errors: results.filter((r) => Array.isArray(r.errors) && r.errors.length).map((r) => ({ candidate_id: r.candidate_id, codes: r.errors })).slice(0, 20)
    }
  }
}];`,
  ),
);

nodes.push(
  supabasePost(
    'Finalize Research Run',
    [2290, -180],
    "={{ $('Validate and Prepare Run').item.json.config.supabase_url + '/rest/v1/rpc/n8n_set_research_run_status' }}",
    "={{ JSON.stringify({ p_research_run_id: $json.research_run_id, p_request_id: $json.request_id, p_status: $json.final_status, p_metrics_patch: $json.metrics, p_error_patch: $json.error_patch }) }}",
  ),
  codeNode(
    'Final Result',
    [2530, -180],
    String.raw`const summary = $('Summarize Research Run').first().json;
const finalized = $input.first().json ?? {};
return [{
  json: {
    ok: summary.final_status === 'completed' || summary.final_status === 'partial',
    research_run_id: summary.research_run_id,
    request_id: summary.request_id,
    status: finalized.status ?? summary.final_status,
    metrics: summary.metrics,
    review_required: true,
    next_action: 'Review source and evidence records in Supabase before any downstream signal generation.'
  }
}];`,
  ),
);

const connections = {};
function connect(from, to, outputIndex = 0, inputIndex = 0) {
  if (!connections[from]) connections[from] = { main: [] };
  while (connections[from].main.length <= outputIndex) connections[from].main.push([]);
  connections[from].main[outputIndex].push({ node: to, type: 'main', index: inputIndex });
}

connect('Manual Trigger', 'Research Request and Limits');
connect('Scheduled Run Trigger', 'Prepare Scheduled Research Request');
connect('Research Request and Limits', 'Validate and Prepare Run');
connect('Prepare Scheduled Research Request', 'Validate and Prepare Run');
connect('Validate and Prepare Run', 'Run Already Queued?');
connect('Run Already Queued?', 'Claim Research Run', 0);
connect('Run Already Queued?', 'Create Research Run', 1);
connect('Create Research Run', 'Claim Research Run');
connect('Claim Research Run', 'Build Query Planner Request');
connect('Build Query Planner Request', 'OpenAI Query Planner');
connect('OpenAI Query Planner', 'Parse Query Plan');
connect('Parse Query Plan', 'Record Planner Usage');
connect('Record Planner Usage', 'Expand Queries');
connect('Expand Queries', 'Tavily Search');
connect('Tavily Search', 'Normalize and Dedupe Candidates');
connect('Normalize and Dedupe Candidates', 'Candidate Loop - One at a Time');

// Loop Over Items: output 0 = done, output 1 = current batch.
connect('Candidate Loop - One at a Time', 'Summarize Research Run', 0);
connect('Candidate Loop - One at a Time', 'Has Valid Canonical URL?', 1);

connect('Has Valid Canonical URL?', 'Meets Relevance Gate?', 0);
connect('Has Valid Canonical URL?', 'Candidate Complete', 1);
connect('Meets Relevance Gate?', 'Lookup Existing Source', 0);
connect('Meets Relevance Gate?', 'Prepare Source Persistence', 1);
connect('Lookup Existing Source', 'Resolve Existing Source');
connect('Resolve Existing Source', 'Already Exists?');
connect('Already Exists?', 'Prepare Source Persistence', 0);
connect('Already Exists?', 'Firecrawl Scrape', 1);
connect('Firecrawl Scrape', 'Normalize Extracted Content');
connect('Normalize Extracted Content', 'Prepare Source Persistence');
connect('Prepare Source Persistence', 'Persist Source via RPC');
connect('Persist Source via RPC', 'Restore Persisted Source Context');
connect('Restore Persisted Source Context', 'Should Store Source Content?');
connect('Should Store Source Content?', 'Upload Source Content', 0);
connect('Should Store Source Content?', 'Eligible for Evidence?', 1);
connect('Upload Source Content', 'Evaluate Content Upload');
connect('Evaluate Content Upload', 'Content Stored?');
connect('Content Stored?', 'Update Source Storage Path', 0);
connect('Content Stored?', 'Eligible for Evidence?', 1);
connect('Update Source Storage Path', 'Restore Stored Source Context');
connect('Restore Stored Source Context', 'Eligible for Evidence?');
connect('Eligible for Evidence?', 'Build Evidence Request', 0);
connect('Eligible for Evidence?', 'Candidate Complete', 1);
connect('Build Evidence Request', 'OpenAI Evidence Extraction');
connect('OpenAI Evidence Extraction', 'Parse and Verify Evidence');
connect('Parse and Verify Evidence', 'Record Evidence LLM Usage');
connect('Record Evidence LLM Usage', 'Expand Evidence');
connect('Expand Evidence', 'Has Grounded Evidence?');
connect('Has Grounded Evidence?', 'Persist Evidence via RPC', 0);
connect('Has Grounded Evidence?', 'Candidate Complete', 1);
connect('Persist Evidence via RPC', 'Restore Evidence Context');
connect('Restore Evidence Context', 'Candidate Complete');
connect('Candidate Complete', 'Candidate Loop - One at a Time');

connect('Summarize Research Run', 'Finalize Research Run');
connect('Finalize Research Run', 'Final Result');

const workflow = {
  name: 'Research Engine',
  nodes,
  pinData: {},
  connections,
  active: false,
  settings: {
    executionOrder: 'v1',
    saveManualExecutions: true,
    saveExecutionProgress: true,
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'all',
    executionTimeout: 1800,
  },
  versionId: stableUuid('research-engine-workflow-version-1.0.0'),
  meta: {
    templateCredsSetupCompleted: false,
  },
  tags: [],
};

fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log(outputPath);
