const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const research = JSON.parse(fs.readFileSync(path.join(__dirname, 'Research Engine_multisource_v2.json'), 'utf8'));
const supabaseCredential = structuredClone(research.nodes.find((node) => node.name === 'Create Research Run').credentials.supabaseApi);
const openAiCredential = structuredClone(research.nodes.find((node) => node.name === 'OpenAI Query Planner').credentials.openAiApi);
const stableId = (name) => {
  const digest = crypto.createHash('sha1').update(`verified-signal-engine:${name}`).digest('hex');
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
  name: 'RE 07 - Verified Evidence Signal Engine', nodes: [], connections: {}, pinData: {}, active: false, tags: [],
  settings: { executionOrder: 'v1', saveManualExecutions: true, saveExecutionProgress: true,
    saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', executionTimeout: 1800 },
};

workflow.nodes.push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', [0, 240], {}));
workflow.nodes.push(node('Daily Signal Check', 'n8n-nodes-base.scheduleTrigger', [0, 400], {
  rule: { interval: [{ field: 'days', daysInterval: 1 }] },
}));
workflow.nodes.push(code('Signal Engine Configuration', [240, 320], `return [{ json: {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co',
  workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  domain_limit: 3,
  evidence_per_domain: 12,
  evidence_per_source: 2,
  max_signals_per_domain: 5,
  model: 'gpt-6-luna',
  engine_version: 'signal-engine-v1.0.2'
} }];`));
workflow.nodes.push(node('Load Verified Evidence', 'n8n-nodes-base.httpRequest', [480, 320], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/rpc/n8n_list_signal_evidence_candidates' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json',
  jsonBody: '={{ JSON.stringify({ p_workspace_id: $json.workspace_id, p_domain_limit: $json.domain_limit, p_evidence_per_domain: $json.evidence_per_domain, p_evidence_per_source: $json.evidence_per_source }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Build Diverse Evidence Packs', [720, 320], `const config = $('Signal Engine Configuration').first().json;
const rows = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json])
  .filter((row) => row && row.evidence_id && row.workspace_domain_id);
if (!rows.length) return [{ json: { config, no_evidence: true, evidence_items: [], source_count: 0 } }];
const groups = new Map();
for (const row of rows) {
  const key = row.workspace_domain_id;
  if (!groups.has(key)) groups.set(key, { config, no_evidence: false, workspace_id: row.workspace_id,
    workspace_domain_id: key, domain_key: row.domain_key, domain_name: row.domain_name, evidence_items: [] });
  groups.get(key).evidence_items.push({ evidence_id: row.evidence_id, source_id: row.source_id,
    source_title: row.source_title, canonical_url: row.canonical_url, publisher: row.publisher,
    published_at: row.published_at, source_type: row.source_type, source_quality_score: row.source_quality_score,
    evidence_type: row.evidence_type, claim_text: row.claim_text, excerpt: row.excerpt,
    polarity: row.polarity, confidence: row.confidence, linked_entities: row.linked_entities ?? [] });
}
return [...groups.values()].map((pack) => ({ json: { ...pack,
  source_count: new Set(pack.evidence_items.map((item) => item.source_id)).size } }));`));
workflow.nodes.push(node('Domain Pack Loop', 'n8n-nodes-base.splitInBatches', [960, 320], { batchSize: 1, options: {} }));
workflow.nodes.push(condition('Has Verified Evidence Pack?', [1200, 440], '={{ $json.no_evidence !== true && $json.evidence_items.length > 0 }}'));
workflow.nodes.push(code('Build Signal Request', [1440, 340], `const pack = $input.first().json;
const evidenceReference = { type: 'object', additionalProperties: false, properties: {
  evidence_id: { type: 'string' }, role: { type: 'string', enum: ['supporting','contradicting','context'] },
  weight: { type: 'number' }
}, required: ['evidence_id','role','weight'] };
const signal = { type: 'object', additionalProperties: false, properties: {
  signal_type: { type: 'string', enum: ['funding','launch','partnership','acquisition','founder_movement','hiring','research','technology','regulation','market','shutdown','investment_thesis','other'] },
  title: { type: 'string' }, summary: { type: 'string' }, event_at: { type: 'string' },
  confidence: { type: 'number' }, novelty_score: { type: 'number' }, importance_score: { type: 'number' },
  geographies: { type: 'array', maxItems: 10, items: { type: 'string' } },
  topics: { type: 'array', maxItems: 12, items: { type: 'string' } },
  evidence: { type: 'array', minItems: 1, maxItems: 6, items: evidenceReference }
}, required: ['signal_type','title','summary','event_at','confidence','novelty_score','importance_score','geographies','topics','evidence'] };
const schema = { type: 'object', additionalProperties: false, properties: {
  signals: { type: 'array', maxItems: pack.config.max_signals_per_domain, items: signal }
}, required: ['signals'] };
const evidencePack = { domain_key: pack.domain_key, domain_name: pack.domain_name,
  independent_source_count: pack.source_count, evidence_items: pack.evidence_items };
return [{ json: { ...pack, openai_request: { model: pack.config.model, store: false, max_output_tokens: 2200,
  instructions: 'Create concise intelligence signals using only the verified evidence items supplied. Every signal must cite one or more supplied evidence_id values. Do not add facts, entities, dates, amounts, causality, or conclusions absent from the cited evidence. Keep separate events as separate signals. Multiple claims from one source are not independent corroboration. Set event_at to an empty string when no complete event date exists. Otherwise event_at must use ISO 8601 and include an explicit four-digit year, month, and day (for example 2026-09-14); never return partial dates such as September 14. Use contradicting evidence when it directly weakens the signal. Return an empty signals array when the evidence is not decision-useful or is unrelated to the configured domain. Signals remain drafts and are not patterns, hypotheses, or final insights.',
  input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(evidencePack) }] }],
  text: { format: { type: 'json_schema', name: 'verified_evidence_signals', strict: true, schema } }
} } }];`));
workflow.nodes.push(node('OpenAI Signal Extraction', 'n8n-nodes-base.httpRequest', [1680, 340], {
  method: 'POST', url: 'https://api.openai.com/v1/responses', authentication: 'predefinedCredentialType',
  nodeCredentialType: 'openAiApi', sendHeaders: true,
  headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.openai_request) }}',
  options: { timeout: 90000 },
}, { credentials: { openAiApi: openAiCredential }, retryOnFail: true, maxTries: 2,
  waitBetweenTries: 1000, alwaysOutputData: true, onError: 'continueRegularOutput' }));
workflow.nodes.push(code('Validate Signal Candidates', [1920, 340], `const pack = $('Build Signal Request').item.json;
const response = $input.first().json ?? {};
const outputText = (response.output ?? []).flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
let parsed = null;
try { if (outputText) parsed = JSON.parse(outputText); } catch {}
const allowedTypes = new Set(['funding','launch','partnership','acquisition','founder_movement','hiring','research','technology','regulation','market','shutdown','investment_thesis','other']);
const evidenceById = new Map(pack.evidence_items.map((item) => [item.evidence_id, item]));
const normalizeText = (value, max) => {
  const raw = String(value ?? '');
  let output = '';
  let pendingSpace = false;
  for (const character of raw) {
    if (character.trim() === '') {
      pendingSpace = output.length > 0;
      continue;
    }
    if (pendingSpace) output += ' ';
    output += character;
    pendingSpace = false;
    if (output.length >= max) break;
  }
  return output.trim().slice(0, max);
};
const cleanArray = (value, max) => [...new Set((Array.isArray(value) ? value : []).map((item) => normalizeText(item, 300)).filter(Boolean))].slice(0, max);
const seen = new Set();
const valid = [];
let rejected = 0;
for (const candidate of (Array.isArray(parsed?.signals) ? parsed.signals : [])) {
  const title = normalizeText(candidate.title, 240);
  const summary = normalizeText(candidate.summary, 2000);
  const refs = (Array.isArray(candidate.evidence) ? candidate.evidence : []).filter((ref) => evidenceById.has(ref.evidence_id));
  const uniqueRefs = [...new Map(refs.map((ref) => [ref.evidence_id + ':' + ref.role, ref])).values()].slice(0, 6);
  const rawEventAt = String(candidate.event_at ?? '').trim();
  const dateDigits = rawEventAt.length >= 10
    ? rawEventAt.slice(0, 4) + rawEventAt.slice(5, 7) + rawEventAt.slice(8, 10)
    : '';
  const hasExplicitDate = rawEventAt.length >= 10 && rawEventAt[4] === '-' && rawEventAt[7] === '-'
    && dateDigits.length === 8 && [...dateDigits].every((character) => character >= '0' && character <= '9');
  const parsedEventMs = rawEventAt ? Date.parse(rawEventAt) : NaN;
  const eventValid = !rawEventAt || (hasExplicitDate && !Number.isNaN(parsedEventMs));
  const eventAt = rawEventAt && eventValid ? new Date(parsedEventMs).toISOString() : '';
  const key = String(candidate.signal_type) + ':' + title.toLowerCase();
  if (!allowedTypes.has(candidate.signal_type) || title.length < 8 || summary.length < 30 || !uniqueRefs.length || !eventValid || seen.has(key)) { rejected++; continue; }
  seen.add(key);
  const citedSources = new Set(uniqueRefs.map((ref) => evidenceById.get(ref.evidence_id).source_id));
  valid.push({ p_signal: { workspace_id: pack.workspace_id, workspace_domain_id: pack.workspace_domain_id,
    signal_type: candidate.signal_type, title, summary, event_at: eventAt,
    confidence: Math.max(0, Math.min(1, Number(candidate.confidence ?? 0))),
    novelty_score: Math.max(0, Math.min(1, Number(candidate.novelty_score ?? 0))),
    importance_score: Math.max(0, Math.min(1, Number(candidate.importance_score ?? 0))),
    geographies: cleanArray(candidate.geographies, 10), topics: cleanArray(candidate.topics, 12),
    evidence: uniqueRefs.map((ref) => ({ evidence_id: ref.evidence_id,
      role: ['supporting','contradicting','context'].includes(ref.role) ? ref.role : 'supporting',
      weight: Math.max(0, Math.min(1, Number(ref.weight ?? 0.7))) })),
    engine_version: pack.config.engine_version, metadata: { generation_mode: 'verified_evidence_only',
      input_source_count: citedSources.size, domain_key: pack.domain_key }
  }, candidate_quality: { input_source_count: citedSources.size } });
}
if (!valid.length) return [{ json: { no_signal: true, workspace_domain_id: pack.workspace_domain_id,
  domain_key: pack.domain_key, provider_error: response.error ? 'OPENAI_SIGNAL_REQUEST_FAILED' : null,
  candidates_rejected: rejected, openai_calls: 1 } }];
return valid.map((item) => ({ json: { ...item, no_signal: false, candidates_rejected: rejected, openai_calls: 1 } }));`));
workflow.nodes.push(node('Signal Candidate Loop', 'n8n-nodes-base.splitInBatches', [2160, 340], { batchSize: 1, options: {} }));
workflow.nodes.push(condition('Has Valid Signal?', [2400, 460], '={{ $json.no_signal !== true && Boolean($json.p_signal) }}'));
workflow.nodes.push(node('Persist Draft Signal', 'n8n-nodes-base.httpRequest', [2640, 380], {
  method: 'POST',
  url: "={{ $('Signal Engine Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_upsert_verified_signal' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ p_signal: $json.p_signal }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Signal Candidate Complete', [2880, 380], `const response = $input.first().json ?? {};
const result = Array.isArray(response) ? (response[0] ?? {}) : response;
return [{ json: { completed: true, signal_id: result.signal_id ?? null, status: result.status ?? 'draft',
  is_new: Boolean(result.is_new), evidence_count: Number(result.evidence_count ?? 0),
  source_count: Number(result.source_count ?? 0), corroboration_status: result.corroboration_status ?? 'single_source',
  openai_calls: 0 } }];`));
workflow.nodes.push(code('Skipped Signal Candidate', [2640, 580], `const row = $input.first().json;
return [{ json: { completed: false, skipped: true, provider_error: row.provider_error ?? null,
  candidates_rejected: Number(row.candidates_rejected ?? 0), openai_calls: Number(row.openai_calls ?? 0) } }];`));
workflow.nodes.push(code('Signal Domain Complete', [2400, 180], `const rows = $input.all().map((item) => item.json ?? {});
return [{ json: { domain_completed: true, signals_persisted: rows.filter((row) => row.completed).length,
  new_signals: rows.filter((row) => row.completed && row.is_new).length,
  multi_source_signals: rows.filter((row) => row.corroboration_status === 'multi_source').length,
  candidates_rejected: rows.reduce((sum, row) => sum + Number(row.candidates_rejected ?? 0), 0),
  provider_errors: [...new Set(rows.map((row) => row.provider_error).filter(Boolean))], openai_calls: 1 } }];`));
workflow.nodes.push(code('No Evidence Domain Complete', [1440, 600], `return [{ json: { domain_completed: true,
  no_verified_evidence: true, signals_persisted: 0, new_signals: 0, multi_source_signals: 0,
  candidates_rejected: 0, provider_errors: [], openai_calls: 0 } }];`));
workflow.nodes.push(code('Signal Engine Summary', [1200, 120], `const rows = $input.all().map((item) => item.json ?? {});
const errors = [...new Set(rows.flatMap((row) => row.provider_errors ?? []).filter(Boolean))];
return [{ json: { status: errors.length && rows.every((row) => Number(row.signals_persisted ?? 0) === 0) ? 'failed' : (errors.length ? 'partial' : 'completed'),
  domains_processed: rows.filter((row) => !row.no_verified_evidence).length,
  no_verified_evidence: rows.some((row) => row.no_verified_evidence),
  signals_persisted: rows.reduce((sum, row) => sum + Number(row.signals_persisted ?? 0), 0),
  new_signals: rows.reduce((sum, row) => sum + Number(row.new_signals ?? 0), 0),
  multi_source_signals: rows.reduce((sum, row) => sum + Number(row.multi_source_signals ?? 0), 0),
  candidates_rejected: rows.reduce((sum, row) => sum + Number(row.candidates_rejected ?? 0), 0),
  openai_calls: rows.reduce((sum, row) => sum + Number(row.openai_calls ?? 0), 0), provider_errors: errors,
  output_status: 'draft', note: 'Signals use verified evidence only; single-source evidence is confidence-capped and no patterns or hypotheses are created.' } }];`));

connect(workflow, 'Manual Trigger', 'Signal Engine Configuration');
connect(workflow, 'Daily Signal Check', 'Signal Engine Configuration');
connect(workflow, 'Signal Engine Configuration', 'Load Verified Evidence');
connect(workflow, 'Load Verified Evidence', 'Build Diverse Evidence Packs');
connect(workflow, 'Build Diverse Evidence Packs', 'Domain Pack Loop');
connect(workflow, 'Domain Pack Loop', 'Signal Engine Summary', 0);
connect(workflow, 'Domain Pack Loop', 'Has Verified Evidence Pack?', 1);
connect(workflow, 'Has Verified Evidence Pack?', 'Build Signal Request', 0);
connect(workflow, 'Has Verified Evidence Pack?', 'No Evidence Domain Complete', 1);
connect(workflow, 'Build Signal Request', 'OpenAI Signal Extraction');
connect(workflow, 'OpenAI Signal Extraction', 'Validate Signal Candidates');
connect(workflow, 'Validate Signal Candidates', 'Signal Candidate Loop');
connect(workflow, 'Signal Candidate Loop', 'Signal Domain Complete', 0);
connect(workflow, 'Signal Candidate Loop', 'Has Valid Signal?', 1);
connect(workflow, 'Has Valid Signal?', 'Persist Draft Signal', 0);
connect(workflow, 'Has Valid Signal?', 'Skipped Signal Candidate', 1);
connect(workflow, 'Persist Draft Signal', 'Signal Candidate Complete');
connect(workflow, 'Signal Candidate Complete', 'Signal Candidate Loop');
connect(workflow, 'Skipped Signal Candidate', 'Signal Candidate Loop');
connect(workflow, 'Signal Domain Complete', 'Domain Pack Loop');
connect(workflow, 'No Evidence Domain Complete', 'Domain Pack Loop');

const output = path.join(__dirname, 'verified_signal_engine.json');
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(output);
