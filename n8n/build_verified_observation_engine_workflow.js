const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const signalWorkflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_signal_engine.json'), 'utf8'));
const supabaseCredential = structuredClone(signalWorkflow.nodes.find((node) => node.name === 'Load Verified Evidence').credentials.supabaseApi);
const openAiCredential = structuredClone(signalWorkflow.nodes.find((node) => node.name === 'OpenAI Signal Extraction').credentials.openAiApi);
const stableId = (name) => {
  const digest = crypto.createHash('sha1').update(`verified-observation-engine:${name}`).digest('hex');
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
  name: 'RE 08 - Accepted Signal Observation Engine', nodes: [], connections: {}, pinData: {}, active: false, tags: [],
  settings: { executionOrder: 'v1', saveManualExecutions: true, saveExecutionProgress: true,
    saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', executionTimeout: 1800 },
};

workflow.nodes.push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', [0, 240], {}));
workflow.nodes.push(node('Daily Observation Check', 'n8n-nodes-base.scheduleTrigger', [0, 400], {
  rule: { interval: [{ field: 'days', daysInterval: 1 }] },
}));
workflow.nodes.push(code('Observation Engine Configuration', [240, 320], `return [{ json: {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co',
  workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  domain_limit: 3,
  signals_per_domain: 12,
  max_observations_per_domain: 4,
  model: 'gpt-6-luna',
  engine_version: 'observation-engine-v1.1.0'
} }];`));
workflow.nodes.push(node('Load Accepted Signals', 'n8n-nodes-base.httpRequest', [480, 320], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/rpc/n8n_list_observation_signal_candidates' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json',
  jsonBody: '={{ JSON.stringify({ p_workspace_id: $json.workspace_id, p_domain_limit: $json.domain_limit, p_signals_per_domain: $json.signals_per_domain }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Build Diverse Signal Packs', [720, 320], `const config = $('Observation Engine Configuration').first().json;
const rows = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json])
  .filter((row) => row && row.signal_id && row.workspace_domain_id);
if (!rows.length) return [{ json: { config, no_signals: true, signal_items: [], source_count: 0 } }];
const groups = new Map();
for (const row of rows) {
  const key = row.workspace_domain_id;
  if (!groups.has(key)) groups.set(key, { config, no_signals: false, workspace_id: row.workspace_id,
    workspace_domain_id: key, domain_key: row.domain_key, domain_name: row.domain_name, signal_items: [] });
  groups.get(key).signal_items.push({ signal_id: row.signal_id, signal_type: row.signal_type,
    title: row.title, summary: row.summary, event_at: row.event_at, confidence: row.confidence,
    novelty_score: row.novelty_score, importance_score: row.importance_score,
    geographies: row.geographies ?? [], topics: row.topics ?? [], evidence_count: Number(row.evidence_count ?? 0),
    independent_source_count: Number(row.independent_source_count ?? 0),
    source_ids: Array.isArray(row.source_ids) ? row.source_ids : [] });
}
return [...groups.values()].map((pack) => ({ json: { ...pack,
  source_count: new Set(pack.signal_items.flatMap((item) => item.source_ids)).size } }));`));
workflow.nodes.push(node('Observation Domain Loop', 'n8n-nodes-base.splitInBatches', [960, 320], { batchSize: 1, options: {} }));
workflow.nodes.push(condition('Has Diverse Accepted Signals?', [1200, 440],
  '={{ $json.no_signals !== true && $json.signal_items.length >= 2 && $json.source_count >= 2 }}'));
workflow.nodes.push(code('Build Observation Request', [1440, 340], `const pack = $input.first().json;
const signalReference = { type: 'object', additionalProperties: false, properties: {
  signal_id: { type: 'string' }, role: { type: 'string', enum: ['supporting','contradicting','context'] },
  weight: { type: 'number' }
}, required: ['signal_id','role','weight'] };
const observation = { type: 'object', additionalProperties: false, properties: {
  observation_type: { type: 'string', enum: ['capital_flow','market_activity','technology_adoption','research_development','regulatory_shift','competitive_movement','operational_change','other'] },
  title: { type: 'string' }, statement: { type: 'string' },
  time_window_start: { type: 'string' }, time_window_end: { type: 'string' }, confidence: { type: 'number' },
  signals: { type: 'array', minItems: 2, maxItems: 8, items: signalReference }
}, required: ['observation_type','title','statement','time_window_start','time_window_end','confidence','signals'] };
const schema = { type: 'object', additionalProperties: false, properties: {
  observations: { type: 'array', maxItems: pack.config.max_observations_per_domain, items: observation }
}, required: ['observations'] };
const signalPack = { domain_key: pack.domain_key, domain_name: pack.domain_name,
  independent_source_count: pack.source_count, accepted_signals: pack.signal_items };
return [{ json: { ...pack, openai_request: { model: pack.config.model, store: false, max_output_tokens: 1800,
  instructions: 'Create only bounded descriptive observations using the accepted signals supplied. Every observation must cite at least two supplied signal_id values backed by at least two independent source IDs. Combine signals only when they describe a coherent shared development or condition. Do not force unrelated signals together. Do not claim a trend, recurring pattern, causal relationship, prediction, thesis, recommendation, or final insight. Do not add facts, entities, dates, amounts, or conclusions absent from the cited signals. Use empty time-window strings when the signals do not establish the boundary. Return an empty observations array when no defensible multi-signal observation exists. Valid outputs are automatically policy-accepted; signal review is the only human gate.',
  input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(signalPack) }] }],
  text: { format: { type: 'json_schema', name: 'accepted_signal_observations', strict: true, schema } }
} } }];`));
workflow.nodes.push(node('OpenAI Observation Synthesis', 'n8n-nodes-base.httpRequest', [1680, 340], {
  method: 'POST', url: 'https://api.openai.com/v1/responses', authentication: 'predefinedCredentialType',
  nodeCredentialType: 'openAiApi', sendHeaders: true,
  headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.openai_request) }}',
  options: { timeout: 90000 },
}, { credentials: { openAiApi: openAiCredential }, retryOnFail: true, maxTries: 2,
  waitBetweenTries: 1000, alwaysOutputData: true, onError: 'continueRegularOutput' }));
workflow.nodes.push(code('Validate Observation Candidates', [1920, 340], `const pack = $('Build Observation Request').item.json;
const response = $input.first().json ?? {};
const outputText = (response.output ?? []).flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
let parsed = null;
try { if (outputText) parsed = JSON.parse(outputText); } catch {}
const allowedTypes = new Set(['capital_flow','market_activity','technology_adoption','research_development','regulatory_shift','competitive_movement','operational_change','other']);
const signalById = new Map(pack.signal_items.map((item) => [item.signal_id, item]));
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
const forbiddenWords = new Set(['trend','trends','pattern','patterns','hypothesis','predict','predicts','forecast','forecasts','causal','causes','caused','drives','driven']);
const seen = new Set();
const valid = [];
let rejected = 0;
for (const candidate of (Array.isArray(parsed?.observations) ? parsed.observations : [])) {
  const title = normalizeText(candidate.title, 240);
  const statement = normalizeText(candidate.statement, 2000);
  const refs = (Array.isArray(candidate.signals) ? candidate.signals : []).filter((ref) => signalById.has(ref.signal_id));
  const uniqueRefs = [...new Map(refs.map((ref) => [ref.signal_id, ref])).values()].slice(0, 8);
  const sourceIds = new Set(uniqueRefs.flatMap((ref) => signalById.get(ref.signal_id).source_ids ?? []));
  const start = String(candidate.time_window_start ?? '').trim();
  const end = String(candidate.time_window_end ?? '').trim();
  const datesValid = (!start || !Number.isNaN(Date.parse(start))) && (!end || !Number.isNaN(Date.parse(end)))
    && (!start || !end || Date.parse(end) >= Date.parse(start));
  const words = new Set((title + ' ' + statement).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean));
  const forbiddenClaim = [...forbiddenWords].some((word) => words.has(word));
  const key = String(candidate.observation_type) + ':' + title.toLowerCase();
  if (!allowedTypes.has(candidate.observation_type) || title.length < 8 || statement.length < 30
    || uniqueRefs.length < 2 || sourceIds.size < 2 || !datesValid || forbiddenClaim || seen.has(key)) { rejected++; continue; }
  seen.add(key);
  valid.push({ p_observation: { workspace_id: pack.workspace_id, workspace_domain_id: pack.workspace_domain_id,
    observation_type: candidate.observation_type, title, statement,
    time_window_start: start, time_window_end: end,
    confidence: Math.max(0, Math.min(1, Number(candidate.confidence ?? 0))),
    signals: uniqueRefs.map((ref) => ({ signal_id: ref.signal_id,
      role: ['supporting','contradicting','context'].includes(ref.role) ? ref.role : 'supporting',
      weight: Math.max(0, Math.min(1, Number(ref.weight ?? 0.7))) })),
    engine_version: pack.config.engine_version, metadata: { generation_mode: 'accepted_signals_only',
      input_signal_count: uniqueRefs.length, input_source_count: sourceIds.size, domain_key: pack.domain_key }
  }, candidate_quality: { input_signal_count: uniqueRefs.length, input_source_count: sourceIds.size } });
}
if (!valid.length) return [{ json: { no_observation: true, workspace_domain_id: pack.workspace_domain_id,
  domain_key: pack.domain_key, provider_error: response.error ? 'OPENAI_OBSERVATION_REQUEST_FAILED' : null,
  candidates_rejected: rejected, openai_calls: 1 } }];
return valid.map((item) => ({ json: { ...item, no_observation: false,
  candidates_rejected: rejected, openai_calls: 1 } }));`));
workflow.nodes.push(node('Observation Candidate Loop', 'n8n-nodes-base.splitInBatches', [2160, 340], { batchSize: 1, options: {} }));
workflow.nodes.push(condition('Has Valid Observation?', [2400, 460],
  '={{ $json.no_observation !== true && Boolean($json.p_observation) }}'));
workflow.nodes.push(node('Persist Validated Observation', 'n8n-nodes-base.httpRequest', [2640, 380], {
  method: 'POST',
  url: "={{ $('Observation Engine Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_upsert_verified_observation' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ p_observation: $json.p_observation }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(node('Auto-Accept Observation', 'n8n-nodes-base.httpRequest', [2880, 380], {
  method: 'POST',
  url: "={{ $('Observation Engine Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_accept_verified_observation' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json',
  jsonBody: '={{ JSON.stringify({ p_observation_id: ($json.observation_id ?? $json[0]?.observation_id), p_is_new: Boolean($json.is_new ?? $json[0]?.is_new) }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Observation Candidate Complete', [3120, 380], `const response = $input.first().json ?? {};
const result = Array.isArray(response) ? (response[0] ?? {}) : response;
return [{ json: { completed: true, observation_id: result.observation_id ?? null,
  status: result.status ?? 'accepted', is_new: Boolean(result.is_new),
  signal_count: Number(result.signal_count ?? 0), source_count: Number(result.source_count ?? 0),
  corroboration_status: result.corroboration_status ?? 'multi_source', openai_calls: 0 } }];`));
workflow.nodes.push(code('Skipped Observation Candidate', [2640, 580], `const row = $input.first().json;
return [{ json: { completed: false, skipped: true, provider_error: row.provider_error ?? null,
  candidates_rejected: Number(row.candidates_rejected ?? 0), openai_calls: Number(row.openai_calls ?? 0) } }];`));
workflow.nodes.push(code('Observation Domain Complete', [2400, 180], `const rows = $input.all().map((item) => item.json ?? {});
return [{ json: { domain_completed: true, observations_persisted: rows.filter((row) => row.completed).length,
  new_observations: rows.filter((row) => row.completed && row.is_new).length,
  multi_source_observations: rows.filter((row) => row.completed && row.source_count >= 2).length,
  candidates_rejected: rows.reduce((sum, row) => sum + Number(row.candidates_rejected ?? 0), 0),
  provider_errors: [...new Set(rows.map((row) => row.provider_error).filter(Boolean))], openai_calls: 1 } }];`));
workflow.nodes.push(code('No Diverse Signals Domain Complete', [1440, 600], `return [{ json: { domain_completed: true,
  no_diverse_accepted_signals: true, observations_persisted: 0, new_observations: 0,
  multi_source_observations: 0, candidates_rejected: 0, provider_errors: [], openai_calls: 0 } }];`));
workflow.nodes.push(code('Observation Engine Summary', [1200, 120], `const rows = $input.all().map((item) => item.json ?? {});
const errors = [...new Set(rows.flatMap((row) => row.provider_errors ?? []).filter(Boolean))];
return [{ json: { status: errors.length && rows.every((row) => Number(row.observations_persisted ?? 0) === 0)
    ? 'failed' : (errors.length ? 'partial' : 'completed'),
  domains_processed: rows.filter((row) => !row.no_diverse_accepted_signals).length,
  no_diverse_accepted_signals: rows.some((row) => row.no_diverse_accepted_signals),
  observations_persisted: rows.reduce((sum, row) => sum + Number(row.observations_persisted ?? 0), 0),
  new_observations: rows.reduce((sum, row) => sum + Number(row.new_observations ?? 0), 0),
  multi_source_observations: rows.reduce((sum, row) => sum + Number(row.multi_source_observations ?? 0), 0),
  candidates_rejected: rows.reduce((sum, row) => sum + Number(row.candidates_rejected ?? 0), 0),
  openai_calls: rows.reduce((sum, row) => sum + Number(row.openai_calls ?? 0), 0), provider_errors: errors,
  output_status: 'accepted', note: 'Signal approval is the only human gate. Observations are automatically accepted only after two-signal, two-source, and bounded-language validation.' } }];`));

connect(workflow, 'Manual Trigger', 'Observation Engine Configuration');
connect(workflow, 'Daily Observation Check', 'Observation Engine Configuration');
connect(workflow, 'Observation Engine Configuration', 'Load Accepted Signals');
connect(workflow, 'Load Accepted Signals', 'Build Diverse Signal Packs');
connect(workflow, 'Build Diverse Signal Packs', 'Observation Domain Loop');
connect(workflow, 'Observation Domain Loop', 'Observation Engine Summary', 0);
connect(workflow, 'Observation Domain Loop', 'Has Diverse Accepted Signals?', 1);
connect(workflow, 'Has Diverse Accepted Signals?', 'Build Observation Request', 0);
connect(workflow, 'Has Diverse Accepted Signals?', 'No Diverse Signals Domain Complete', 1);
connect(workflow, 'Build Observation Request', 'OpenAI Observation Synthesis');
connect(workflow, 'OpenAI Observation Synthesis', 'Validate Observation Candidates');
connect(workflow, 'Validate Observation Candidates', 'Observation Candidate Loop');
connect(workflow, 'Observation Candidate Loop', 'Observation Domain Complete', 0);
connect(workflow, 'Observation Candidate Loop', 'Has Valid Observation?', 1);
connect(workflow, 'Has Valid Observation?', 'Persist Validated Observation', 0);
connect(workflow, 'Has Valid Observation?', 'Skipped Observation Candidate', 1);
connect(workflow, 'Persist Validated Observation', 'Auto-Accept Observation');
connect(workflow, 'Auto-Accept Observation', 'Observation Candidate Complete');
connect(workflow, 'Observation Candidate Complete', 'Observation Candidate Loop');
connect(workflow, 'Skipped Observation Candidate', 'Observation Candidate Loop');
connect(workflow, 'Observation Domain Complete', 'Observation Domain Loop');
connect(workflow, 'No Diverse Signals Domain Complete', 'Observation Domain Loop');

const output = path.join(__dirname, 'verified_observation_engine.json');
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(output);
