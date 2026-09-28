const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const observationWorkflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_observation_engine.json'), 'utf8'));
const supabaseCredential = structuredClone(observationWorkflow.nodes.find((node) => node.name === 'Load Accepted Signals').credentials.supabaseApi);
const openAiCredential = structuredClone(observationWorkflow.nodes.find((node) => node.name === 'OpenAI Observation Synthesis').credentials.openAiApi);
const stableId = (name) => {
  const digest = crypto.createHash('sha1').update(`verified-pattern-engine:${name}`).digest('hex');
  return `${digest.slice(0, 8)}-0000-4000-8000-${digest.slice(8, 20)}`;
};
const versions = {
  'n8n-nodes-base.code': 2,
  'n8n-nodes-base.httpRequest': 4.2,
  'n8n-nodes-base.if': 2.2,
  'n8n-nodes-base.manualTrigger': 1,
  'n8n-nodes-base.scheduleTrigger': 1.2,
  'n8n-nodes-base.splitInBatches': 3,
};
const node = (name, type, position, parameters, extra = {}) => ({
  id: stableId(name), name, type, typeVersion: versions[type], position, parameters, ...extra,
});
const code = (name, position, jsCode) => node(name, 'n8n-nodes-base.code', position, {
  mode: 'runOnceForAllItems', jsCode,
});
const condition = (name, position, expression) => node(name, 'n8n-nodes-base.if', position, {
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
    conditions: [{ id: stableId(`${name}:condition`), leftValue: expression, rightValue: true,
      operator: { type: 'boolean', operation: 'true', singleValue: true } }],
    combinator: 'and',
  }, options: {},
});
const connect = (workflow, from, to, output = 0) => {
  workflow.connections[from] ??= { main: [] };
  while (workflow.connections[from].main.length <= output) workflow.connections[from].main.push([]);
  workflow.connections[from].main[output].push({ node: to, type: 'main', index: 0 });
};

const workflow = {
  name: 'RE 09 - Verified Pattern Engine', nodes: [], connections: {}, pinData: {}, active: false, tags: [],
  settings: { executionOrder: 'v1', saveManualExecutions: true, saveExecutionProgress: true,
    saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', executionTimeout: 1800 },
};

workflow.nodes.push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', [0, 240], {}));
workflow.nodes.push(node('Daily Pattern Check', 'n8n-nodes-base.scheduleTrigger', [0, 400], {
  rule: { interval: [{ field: 'days', daysInterval: 1 }] },
}));
workflow.nodes.push(code('Pattern Engine Configuration', [240, 320], `return [{ json: {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co',
  workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  domain_limit: 3,
  observations_per_domain: 12,
  max_patterns_per_domain: 3,
  model: 'gpt-6-luna',
  engine_version: 'pattern-engine-v1.0.0'
} }];`));
workflow.nodes.push(node('Load Accepted Observations', 'n8n-nodes-base.httpRequest', [480, 320], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/rpc/n8n_list_pattern_observation_candidates' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json',
  jsonBody: '={{ JSON.stringify({ p_workspace_id: $json.workspace_id, p_domain_limit: $json.domain_limit, p_observations_per_domain: $json.observations_per_domain }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Build Diverse Observation Packs', [720, 320], `const config = $('Pattern Engine Configuration').first().json;
const rows = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json])
  .filter((row) => row && row.observation_id && row.workspace_domain_id);
if (!rows.length) return [{ json: { config, no_observations: true, observation_items: [], source_family_count: 0 } }];
const groups = new Map();
for (const row of rows) {
  const key = row.workspace_domain_id;
  if (!groups.has(key)) groups.set(key, { config, no_observations: false, workspace_id: row.workspace_id,
    workspace_domain_id: key, domain_key: row.domain_key, domain_name: row.domain_name, observation_items: [] });
  groups.get(key).observation_items.push({ observation_id: row.observation_id, observation_type: row.observation_type,
    title: row.title, statement: row.statement, time_window_start: row.time_window_start,
    time_window_end: row.time_window_end, confidence: row.confidence,
    signal_count: Number(row.signal_count ?? 0), source_count: Number(row.source_count ?? 0),
    source_ids: Array.isArray(row.source_ids) ? row.source_ids : [], accepted_at: row.accepted_at });
}
return [...groups.values()].map((pack) => ({ json: { ...pack,
  source_family_count: new Set(pack.observation_items.flatMap((item) => item.source_ids)).size } }));`));
workflow.nodes.push(node('Pattern Domain Loop', 'n8n-nodes-base.splitInBatches', [960, 320], { batchSize: 1, options: {} }));
workflow.nodes.push(condition('Has Sufficient Diverse Observations?', [1200, 440],
  '={{ $json.no_observations !== true && $json.observation_items.length >= 3 && $json.source_family_count >= 3 }}'));
workflow.nodes.push(code('Build Pattern Request', [1440, 340], `const pack = $input.first().json;
const observationReference = { type: 'object', additionalProperties: false, properties: {
  observation_id: { type: 'string' }, role: { type: 'string', enum: ['supporting','contradicting','context'] },
  weight: { type: 'number' }
}, required: ['observation_id','role','weight'] };
const pattern = { type: 'object', additionalProperties: false, properties: {
  pattern_type: { type: 'string', enum: ['capital_flow','market_activity','technology_adoption','research_development','regulatory_shift','competitive_movement','operational_change','talent_flow','product_evolution','investment_thesis','other'] },
  title: { type: 'string' }, statement: { type: 'string' },
  time_window_start: { type: 'string' }, time_window_end: { type: 'string' },
  first_detected_at: { type: 'string' }, last_confirmed_at: { type: 'string' },
  strength_score: { type: 'number' }, persistence_score: { type: 'number' }, diversity_score: { type: 'number' }, confidence: { type: 'number' },
  observations: { type: 'array', minItems: 3, maxItems: 12, items: observationReference }
}, required: ['pattern_type','title','statement','time_window_start','time_window_end','first_detected_at','last_confirmed_at','strength_score','persistence_score','diversity_score','confidence','observations'] };
const schema = { type: 'object', additionalProperties: false, properties: {
  patterns: { type: 'array', maxItems: pack.config.max_patterns_per_domain, items: pattern }
}, required: ['patterns'] };
const observationPack = { domain_key: pack.domain_key, domain_name: pack.domain_name,
  independent_source_family_count: pack.source_family_count, accepted_observations: pack.observation_items };
return [{ json: { ...pack, openai_request: { model: pack.config.model, store: false, max_output_tokens: 2000,
  instructions: 'Create only verified patterns using the accepted observations supplied. Every pattern must cite at least three supplied observation_id values backed by at least three independent source families and at least two distinct events or entities. Identify recurrence across time or repetition across independent entities. Do not create patterns directly from signals. Do not claim a trend, causal relationship, prediction, hypothesis, recommendation, or final insight. Do not add facts, entities, dates, amounts, or conclusions absent from the cited observations. Use empty time-window strings when the observations do not establish the boundary. Return an empty patterns array when no defensible multi-observation pattern exists. Valid outputs are automatically persisted; no human gate exists beyond signal review.',
  input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(observationPack) }] }],
  text: { format: { type: 'json_schema', name: 'accepted_observation_patterns', strict: true, schema } }
} } }];`));
workflow.nodes.push(node('OpenAI Pattern Synthesis', 'n8n-nodes-base.httpRequest', [1680, 340], {
  method: 'POST', url: 'https://api.openai.com/v1/responses', authentication: 'predefinedCredentialType',
  nodeCredentialType: 'openAiApi', sendHeaders: true,
  headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.openai_request) }}',
  options: { timeout: 90000 },
}, { credentials: { openAiApi: openAiCredential }, retryOnFail: true, maxTries: 2,
  waitBetweenTries: 1000, alwaysOutputData: true, onError: 'continueRegularOutput' }));
workflow.nodes.push(code('Validate Pattern Candidates', [1920, 340], `const pack = $('Build Pattern Request').item.json;
const response = $input.first().json ?? {};
const outputText = (response.output ?? []).flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
let parsed = null;
try { if (outputText) parsed = JSON.parse(outputText); } catch {}
const allowedTypes = new Set(['capital_flow','market_activity','technology_adoption','research_development','regulatory_shift','competitive_movement','operational_change','talent_flow','product_evolution','investment_thesis','other']);
const observationById = new Map(pack.observation_items.map((item) => [item.observation_id, item]));
const normalizeText = (value, max) => {
  const raw = String(value ?? '');
  let output = '';
  let pendingSpace = false;
  for (const character of raw) {
    if (character.trim() === '') { pendingSpace = output.length > 0; continue; }
    if (pendingSpace) output += ' ';
    output += character;
    pendingSpace = false;
    if (output.length >= max) break;
  }
  return output.trim().slice(0, max);
};
const forbiddenWords = new Set(['trend','trends','predict','predicts','forecast','forecasts','causal','causes','caused','drives','driven','will','should','must','recommend','recommendation']);
const seen = new Set();
const valid = [];
let rejected = 0;
for (const candidate of (Array.isArray(parsed?.patterns) ? parsed.patterns : [])) {
  const title = normalizeText(candidate.title, 240);
  const statement = normalizeText(candidate.statement, 2000);
  const refs = (Array.isArray(candidate.observations) ? candidate.observations : []).filter((ref) => observationById.has(ref.observation_id));
  const uniqueRefs = [...new Map(refs.map((ref) => [ref.observation_id, ref])).values()].slice(0, 12);
  const sourceFamilies = new Set(uniqueRefs.flatMap((ref) => observationById.get(ref.observation_id).source_ids ?? []));
  const start = String(candidate.time_window_start ?? '').trim();
  const end = String(candidate.time_window_end ?? '').trim();
  const firstDetected = String(candidate.first_detected_at ?? '').trim();
  const lastConfirmed = String(candidate.last_confirmed_at ?? '').trim();
  const datesValid = (!start || !Number.isNaN(Date.parse(start))) && (!end || !Number.isNaN(Date.parse(end)))
    && (!start || !end || Date.parse(end) >= Date.parse(start))
    && !Number.isNaN(Date.parse(firstDetected)) && !Number.isNaN(Date.parse(lastConfirmed))
    && Date.parse(lastConfirmed) >= Date.parse(firstDetected);
  const words = new Set((title + ' ' + statement).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean));
  const forbiddenClaim = [...forbiddenWords].some((word) => words.has(word));
  const key = String(candidate.pattern_type) + ':' + title.toLowerCase();
  if (!allowedTypes.has(candidate.pattern_type) || title.length < 8 || statement.length < 30
    || uniqueRefs.length < 3 || sourceFamilies.size < 3 || !datesValid || forbiddenClaim || seen.has(key)) { rejected++; continue; }
  seen.add(key);
  valid.push({ p_pattern: { workspace_id: pack.workspace_id, workspace_domain_id: pack.workspace_domain_id,
    pattern_type: candidate.pattern_type, title, statement,
    time_window_start: start, time_window_end: end,
    first_detected_at: firstDetected, last_confirmed_at: lastConfirmed,
    strength_score: Math.max(0, Math.min(1, Number(candidate.strength_score ?? 0))),
    persistence_score: Math.max(0, Math.min(1, Number(candidate.persistence_score ?? 0))),
    diversity_score: Math.max(0, Math.min(1, Number(candidate.diversity_score ?? 0))),
    confidence: Math.max(0, Math.min(1, Number(candidate.confidence ?? 0))),
    observations: uniqueRefs.map((ref) => ({ observation_id: ref.observation_id,
      role: ['supporting','contradicting','context'].includes(ref.role) ? ref.role : 'supporting',
      weight: Math.max(0, Math.min(1, Number(ref.weight ?? 0.7))) })),
    engine_version: pack.config.engine_version, metadata: { generation_mode: 'accepted_observations_only',
      input_observation_count: uniqueRefs.length, input_source_family_count: sourceFamilies.size, domain_key: pack.domain_key }
  }, candidate_quality: { input_observation_count: uniqueRefs.length, input_source_family_count: sourceFamilies.size } });
}
if (!valid.length) return [{ json: { no_pattern: true, workspace_domain_id: pack.workspace_domain_id,
  domain_key: pack.domain_key, provider_error: response.error ? 'OPENAI_PATTERN_REQUEST_FAILED' : null,
  candidates_rejected: rejected, openai_calls: 1 } }];
return valid.map((item) => ({ json: { ...item, no_pattern: false,
  candidates_rejected: rejected, openai_calls: 1 } }));`));
workflow.nodes.push(node('Pattern Candidate Loop', 'n8n-nodes-base.splitInBatches', [2160, 340], { batchSize: 1, options: {} }));
workflow.nodes.push(condition('Has Valid Pattern?', [2400, 460],
  '={{ $json.no_pattern !== true && Boolean($json.p_pattern) }}'));
workflow.nodes.push(node('Persist Validated Pattern', 'n8n-nodes-base.httpRequest', [2640, 380], {
  method: 'POST',
  url: "={{ $('Pattern Engine Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_upsert_verified_pattern' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ p_pattern: $json.p_pattern }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Pattern Candidate Complete', [2880, 380], `const response = $input.first().json ?? {};
const result = Array.isArray(response) ? (response[0] ?? {}) : response;
return [{ json: { completed: true, pattern_id: result.pattern_id ?? null,
  status: result.status ?? 'emerging', is_new: Boolean(result.is_new),
  observation_count: Number(result.observation_count ?? 0), source_family_count: Number(result.source_family_count ?? 0),
  event_entity_count: Number(result.event_entity_count ?? 0), strength_score: Number(result.strength_score ?? 0),
  persistence_score: Number(result.persistence_score ?? 0), diversity_score: Number(result.diversity_score ?? 0),
  confidence: Number(result.confidence ?? 0), promoted: Boolean(result.promoted), openai_calls: 0 } }];`));
workflow.nodes.push(code('Skipped Pattern Candidate', [2640, 580], `const row = $input.first().json;
return [{ json: { completed: false, skipped: true, provider_error: row.provider_error ?? null,
  candidates_rejected: Number(row.candidates_rejected ?? 0), openai_calls: Number(row.openai_calls ?? 0) } }];`));
workflow.nodes.push(code('Pattern Domain Complete', [2400, 180], `const rows = $input.all().map((item) => item.json ?? {});
return [{ json: { domain_completed: true, patterns_persisted: rows.filter((row) => row.completed).length,
  new_patterns: rows.filter((row) => row.completed && row.is_new).length,
  promoted_patterns: rows.filter((row) => row.completed && row.promoted).length,
  candidates_rejected: rows.reduce((sum, row) => sum + Number(row.candidates_rejected ?? 0), 0),
  provider_errors: [...new Set(rows.map((row) => row.provider_error).filter(Boolean))], openai_calls: 1 } }];`));
workflow.nodes.push(code('No Sufficient Observations Domain Complete', [1440, 600], `return [{ json: { domain_completed: true,
  no_sufficient_diverse_observations: true, patterns_persisted: 0, new_patterns: 0,
  promoted_patterns: 0, candidates_rejected: 0, provider_errors: [], openai_calls: 0 } }];`));
workflow.nodes.push(code('Pattern Engine Summary', [1200, 120], `const rows = $input.all().map((item) => item.json ?? {});
const errors = [...new Set(rows.flatMap((row) => row.provider_errors ?? []).filter(Boolean))];
return [{ json: { status: errors.length && rows.every((row) => Number(row.patterns_persisted ?? 0) === 0)
    ? 'failed' : (errors.length ? 'partial' : 'completed'),
  domains_processed: rows.filter((row) => !row.no_sufficient_diverse_observations).length,
  no_sufficient_diverse_observations: rows.some((row) => row.no_sufficient_diverse_observations),
  patterns_persisted: rows.reduce((sum, row) => sum + Number(row.patterns_persisted ?? 0), 0),
  new_patterns: rows.reduce((sum, row) => sum + Number(row.new_patterns ?? 0), 0),
  promoted_patterns: rows.reduce((sum, row) => sum + Number(row.promoted_patterns ?? 0), 0),
  candidates_rejected: rows.reduce((sum, row) => sum + Number(row.candidates_rejected ?? 0), 0),
  openai_calls: rows.reduce((sum, row) => sum + Number(row.openai_calls ?? 0), 0), provider_errors: errors,
  output_status: 'emerging', note: 'Signal approval is the only human gate. Patterns are automatically persisted from accepted observations only. No new human review is introduced. Emerging patterns may be promoted to persistent by deterministic revalidation when thresholds are met.' } }];`));

connect(workflow, 'Manual Trigger', 'Pattern Engine Configuration');
connect(workflow, 'Daily Pattern Check', 'Pattern Engine Configuration');
connect(workflow, 'Pattern Engine Configuration', 'Load Accepted Observations');
connect(workflow, 'Load Accepted Observations', 'Build Diverse Observation Packs');
connect(workflow, 'Build Diverse Observation Packs', 'Pattern Domain Loop');
connect(workflow, 'Pattern Domain Loop', 'Pattern Engine Summary', 0);
connect(workflow, 'Pattern Domain Loop', 'Has Sufficient Diverse Observations?', 1);
connect(workflow, 'Has Sufficient Diverse Observations?', 'Build Pattern Request', 0);
connect(workflow, 'Has Sufficient Diverse Observations?', 'No Sufficient Observations Domain Complete', 1);
connect(workflow, 'Build Pattern Request', 'OpenAI Pattern Synthesis');
connect(workflow, 'OpenAI Pattern Synthesis', 'Validate Pattern Candidates');
connect(workflow, 'Validate Pattern Candidates', 'Pattern Candidate Loop');
connect(workflow, 'Pattern Candidate Loop', 'Pattern Domain Complete', 0);
connect(workflow, 'Pattern Candidate Loop', 'Has Valid Pattern?', 1);
connect(workflow, 'Has Valid Pattern?', 'Persist Validated Pattern', 0);
connect(workflow, 'Has Valid Pattern?', 'Skipped Pattern Candidate', 1);
connect(workflow, 'Persist Validated Pattern', 'Pattern Candidate Complete');
connect(workflow, 'Pattern Candidate Complete', 'Pattern Candidate Loop');
connect(workflow, 'Skipped Pattern Candidate', 'Pattern Candidate Loop');
connect(workflow, 'Pattern Domain Complete', 'Pattern Domain Loop');
connect(workflow, 'No Sufficient Observations Domain Complete', 'Pattern Domain Loop');

const output = path.join(__dirname, 'verified_pattern_engine.json');
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(output);