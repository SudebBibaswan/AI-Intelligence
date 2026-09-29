const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const signalWorkflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_signal_engine.json'), 'utf8'));
const supabaseCredential = structuredClone(signalWorkflow.nodes.find((node) => node.name === 'Load Verified Evidence').credentials.supabaseApi);
const openAiCredential = structuredClone(signalWorkflow.nodes.find((node) => node.name === 'OpenAI Signal Extraction').credentials.openAiApi);
const stableId = (name) => {
  const digest = crypto.createHash('sha1').update(`verified-thesis-engine:${name}`).digest('hex');
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
  name: 'RE-Thesis - Verified Thesis Extraction Engine', nodes: [], connections: {}, pinData: {}, active: false, tags: [],
  settings: { executionOrder: 'v1', saveManualExecutions: true, saveExecutionProgress: true,
    saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', executionTimeout: 1800 },
};

workflow.nodes.push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', [0, 240], {}));
workflow.nodes.push(node('Daily Thesis Extraction', 'n8n-nodes-base.scheduleTrigger', [0, 400], {
  rule: { interval: [{ field: 'days', daysInterval: 1 }] },
}));
workflow.nodes.push(code('Thesis Engine Configuration', [240, 320], `return [{ json: {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co',
  workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  workspace_domain_id: '11068f00-2e6b-462c-b455-c69384e5e8a8',
  entity_types: ['organization'],
  max_evidence_per_entity: 20,
  model: 'gpt-6-luna',
  engine_version: 'thesis-engine-v1.0.0'
} }];`));
workflow.nodes.push(node('Load Thesis Evidence Candidates', 'n8n-nodes-base.httpRequest', [480, 320], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/rpc/n8n_list_thesis_evidence_candidates' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json',
  jsonBody: '={{ JSON.stringify({ p_workspace_id: $json.workspace_id, p_workspace_domain_id: $json.workspace_domain_id, p_entity_types: $json.entity_types, p_max_evidence_per_entity: $json.max_evidence_per_entity }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Group Evidence by Entity', [720, 320], `const config = $('Thesis Engine Configuration').first().json;
const rows = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json])
  .filter((row) => row && row.entity_id && row.evidence_id);
if (!rows.length) return [{ json: { config, no_evidence: true, entity_items: [] } }];
const groups = new Map();
for (const row of rows) {
  const key = row.entity_id;
  if (!groups.has(key)) groups.set(key, { config, no_evidence: false, workspace_id: row.workspace_id,
    workspace_domain_id: config.workspace_domain_id, entity_id: key, entity_name: row.entity_name,
    entity_type: row.entity_type, entity_metadata: row.entity_metadata, evidence_items: [] });
  groups.get(key).evidence_items.push({ evidence_id: row.evidence_id, source_id: row.source_id,
    source_title: row.source_title, canonical_url: row.canonical_url, publisher: row.publisher,
    published_at: row.published_at, source_type: row.source_type, source_quality_score: row.source_quality_score,
    evidence_type: row.evidence_type, claim_text: row.claim_text, excerpt: row.excerpt,
    polarity: row.polarity, confidence: row.confidence, linked_entities: row.linked_entities });
}
return [...groups.values()].map((pack) => ({ json: { ...pack, evidence_count: pack.evidence_items.length } }));`));
workflow.nodes.push(node('Entity Loop', 'n8n-nodes-base.splitInBatches', [960, 320], { batchSize: 1, options: {} }));
workflow.nodes.push(condition('Has Evidence for Entity?', [1200, 440],
  '={{ $json.no_evidence !== true && $json.evidence_items.length >= 3 }}'));
workflow.nodes.push(code('Build Stated Thesis Request', [1440, 240], `const pack = $input.first().json;
const evidenceRef = { type: 'object', additionalProperties: false, properties: {
  evidence_id: { type: 'string' }, role: { type: 'string', enum: ['supporting','contradicting','context'] },
  weight: { type: 'number' }
}, required: ['evidence_id','role','weight'] };
const thesis = { type: 'object', additionalProperties: false, properties: {
  thesis_type: { type: 'string', enum: ['stated'] },
  statement: { type: 'string' },
  time_window_start: { type: 'string' }, time_window_end: { type: 'string' },
  methodology: { type: 'string' }, confidence: { type: 'number' },
  evidence: { type: 'array', minItems: 1, maxItems: 20, items: evidenceRef }
}, required: ['thesis_type','statement','methodology','confidence','evidence'] };
const schema = { type: 'object', additionalProperties: false, properties: {
  theses: { type: 'array', maxItems: 1, items: thesis }
}, required: ['theses'] };
const entityPack = { entity_name: pack.entity_name, entity_type: pack.entity_type,
  entity_metadata: pack.entity_metadata, evidence_items: pack.evidence_items };
return [{ json: { ...pack, openai_request: { model: pack.config.model, store: false, max_output_tokens: 2000,
  instructions: 'Extract the STATED thesis (what this entity publicly claims as their investment thesis) from the supplied evidence. Only use direct quotes, public statements, blog posts, interviews, tweets, or official communications. Do not infer from investments. If no clear stated thesis exists, return empty array.',
  input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(entityPack) }] }],
  text: { format: { type: 'json_schema', name: 'entity_stated_thesis', strict: true, schema } }
} } }];`));
workflow.nodes.push(code('Build Revealed Thesis Request', [1440, 440], `const pack = $input.first().json;
const evidenceRef = { type: 'object', additionalProperties: false, properties: {
  evidence_id: { type: 'string' }, role: { type: 'string', enum: ['supporting','contradicting','context'] },
  weight: { type: 'number' }
}, required: ['evidence_id','role','weight'] };
const thesis = { type: 'object', additionalProperties: false, properties: {
  thesis_type: { type: 'string', enum: ['revealed'] },
  statement: { type: 'string' },
  time_window_start: { type: 'string' }, time_window_end: { type: 'string' },
  methodology: { type: 'string' }, confidence: { type: 'number' },
  evidence: { type: 'array', minItems: 1, maxItems: 20, items: evidenceRef }
}, required: ['thesis_type','statement','methodology','confidence','evidence'] };
const schema = { type: 'object', additionalProperties: false, properties: {
  theses: { type: 'array', maxItems: 1, items: thesis }
}, required: ['theses'] };
const entityPack = { entity_name: pack.entity_name, entity_type: pack.entity_type,
  entity_metadata: pack.entity_metadata, evidence_items: pack.evidence_items };
return [{ json: { ...pack, openai_request: { model: pack.config.model, store: false, max_output_tokens: 2000,
  instructions: 'Extract the REVEALED thesis (what this entity\'s actual investments reveal about their true thesis) from the supplied evidence. Analyze investment patterns: sectors, stages, geographies, check sizes, follow-on behavior. Infer thesis from behavior, not statements. If investments are too sparse or diverse, return empty array.',
  input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(entityPack) }] }],
  text: { format: { type: 'json_schema', name: 'entity_revealed_thesis', strict: true, schema } }
} } }];`));
workflow.nodes.push(node('OpenAI Stated Thesis', 'n8n-nodes-base.httpRequest', [1680, 240], {
  method: 'POST', url: 'https://api.openai.com/v1/responses', authentication: 'predefinedCredentialType',
  nodeCredentialType: 'openAiApi', sendHeaders: true,
  headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.openai_request) }}',
  options: { timeout: 90000 },
}, { credentials: { openAiApi: openAiCredential }, retryOnFail: true, maxTries: 2,
  waitBetweenTries: 1000, alwaysOutputData: true, onError: 'continueRegularOutput' }));
workflow.nodes.push(node('OpenAI Revealed Thesis', 'n8n-nodes-base.httpRequest', [1680, 440], {
  method: 'POST', url: 'https://api.openai.com/v1/responses', authentication: 'predefinedCredentialType',
  nodeCredentialType: 'openAiApi', sendHeaders: true,
  headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.openai_request) }}',
  options: { timeout: 90000 },
}, { credentials: { openAiApi: openAiCredential }, retryOnFail: true, maxTries: 2,
  waitBetweenTries: 1000, alwaysOutputData: true, onError: 'continueRegularOutput' }));
workflow.nodes.push(code('Validate Stated Thesis', [1920, 240], `const pack = $('Build Stated Thesis Request').item.json;
const response = $input.first().json ?? {};
const outputText = (response.output ?? []).flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
let parsed = null;
try { if (outputText) parsed = JSON.parse(outputText); } catch {}
const entityPack = { entity_id: pack.entity_id, entity_name: pack.entity_name, evidence_items: pack.evidence_items };
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
const valid = [];
let rejected = 0;
for (const candidate of (Array.isArray(parsed?.theses) ? parsed.theses : [])) {
  const statement = normalizeText(candidate.statement, 5000);
  const methodology = normalizeText(candidate.methodology, 1000);
  const refs = (Array.isArray(candidate.evidence) ? candidate.evidence : []).filter((ref) => entityPack.evidence_items.some(e => e.evidence_id === ref.evidence_id));
  const uniqueRefs = [...new Map(refs.map((ref) => [ref.evidence_id, ref])).values()].slice(0, 20);
  const start = String(candidate.time_window_start ?? '').trim();
  const end = String(candidate.time_window_end ?? '').trim();
  const datesValid = (!start || !Number.isNaN(Date.parse(start))) && (!end || !Number.isNaN(Date.parse(end)))
    && (!start || !end || Date.parse(end) >= Date.parse(start));
  const confidence = Math.max(0, Math.min(1, Number(candidate.confidence ?? 0)));
  if (!statement || statement.length < 50 || !methodology || uniqueRefs.length < 2 || !datesValid || confidence < 0.4) { rejected++; continue; }
  valid.push({ p_thesis: { workspace_id: pack.workspace_id, workspace_domain_id: pack.workspace_domain_id,
    subject_entity_id: pack.entity_id, thesis_type: 'stated', statement,
    time_window_start: start, time_window_end: end, methodology,
    confidence, evidence: uniqueRefs.map((ref) => ({ evidence_id: ref.evidence_id,
      role: ['supporting','contradicting','context'].includes(ref.role) ? ref.role : 'supporting',
      weight: Math.max(0, Math.min(1, Number(ref.weight ?? 0.7))) })),
    engine_version: pack.config.engine_version, metadata: { generation_mode: 'stated_thesis_extraction',
      entity_name: pack.entity_name, input_evidence_count: uniqueRefs.length } }
  });
}
if (!valid.length) return [{ json: { no_thesis: true, thesis_type: 'stated', entity_id: pack.entity_id, entity_name: pack.entity_name, candidates_rejected: rejected } }];
return valid.map((item) => ({ json: { ...item, no_thesis: false, candidates_rejected: rejected } }));`));
workflow.nodes.push(code('Validate Revealed Thesis', [1920, 440], `const pack = $('Build Revealed Thesis Request').item.json;
const response = $input.first().json ?? {};
const outputText = (response.output ?? []).flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
let parsed = null;
try { if (outputText) parsed = JSON.parse(outputText); } catch {}
const entityPack = { entity_id: pack.entity_id, entity_name: pack.entity_name, evidence_items: pack.evidence_items };
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
const valid = [];
let rejected = 0;
for (const candidate of (Array.isArray(parsed?.theses) ? parsed.theses : [])) {
  const statement = normalizeText(candidate.statement, 5000);
  const methodology = normalizeText(candidate.methodology, 1000);
  const refs = (Array.isArray(candidate.evidence) ? candidate.evidence : []).filter((ref) => entityPack.evidence_items.some(e => e.evidence_id === ref.evidence_id));
  const uniqueRefs = [...new Map(refs.map((ref) => [ref.evidence_id, ref])).values()].slice(0, 20);
  const start = String(candidate.time_window_start ?? '').trim();
  const end = String(candidate.time_window_end ?? '').trim();
  const datesValid = (!start || !Number.isNaN(Date.parse(start))) && (!end || !Number.isNaN(Date.parse(end)))
    && (!start || !end || Date.parse(end) >= Date.parse(start));
  const confidence = Math.max(0, Math.min(1, Number(candidate.confidence ?? 0)));
  if (!statement || statement.length < 50 || !methodology || uniqueRefs.length < 2 || !datesValid || confidence < 0.4) { rejected++; continue; }
  valid.push({ p_thesis: { workspace_id: pack.workspace_id, workspace_domain_id: pack.workspace_domain_id,
    subject_entity_id: pack.entity_id, thesis_type: 'revealed', statement,
    time_window_start: start, time_window_end: end, methodology,
    confidence, evidence: uniqueRefs.map((ref) => ({ evidence_id: ref.evidence_id,
      role: ['supporting','contradicting','context'].includes(ref.role) ? ref.role : 'supporting',
      weight: Math.max(0, Math.min(1, Number(ref.weight ?? 0.7))) })),
    engine_version: pack.config.engine_version, metadata: { generation_mode: 'revealed_thesis_extraction',
      entity_name: pack.entity_name, input_evidence_count: uniqueRefs.length } }
  });
}
if (!valid.length) return [{ json: { no_thesis: true, thesis_type: 'revealed', entity_id: pack.entity_id, entity_name: pack.entity_name, candidates_rejected: rejected } }];
return valid.map((item) => ({ json: { ...item, no_thesis: false, candidates_rejected: rejected } }));`));
workflow.nodes.push(node('Persist Stated Thesis', 'n8n-nodes-base.httpRequest', [2160, 240], {
  method: 'POST',
  url: "={{ $('Thesis Engine Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_upsert_verified_thesis' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ p_thesis: $json.p_thesis }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(node('Persist Revealed Thesis', 'n8n-nodes-base.httpRequest', [2160, 440], {
  method: 'POST',
  url: "={{ $('Thesis Engine Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_upsert_verified_thesis' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ p_thesis: $json.p_thesis }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Stated Thesis Complete', [2400, 240], `const response = $input.first().json ?? {};
const result = Array.isArray(response) ? (response[0] ?? {}) : response;
return [{ json: { completed: true, thesis_id: result.thesis_id ?? null, thesis_type: 'stated',
  is_new: Boolean(result.is_new), evidence_count: Number(result.evidence_count ?? 0),
  confidence: Number(result.confidence ?? 0) } }];`));
workflow.nodes.push(code('Revealed Thesis Complete', [2400, 440], `const response = $input.first().json ?? {};
const result = Array.isArray(response) ? (response[0] ?? {}) : response;
return [{ json: { completed: true, thesis_id: result.thesis_id ?? null, thesis_type: 'revealed',
  is_new: Boolean(result.is_new), evidence_count: Number(result.evidence_count ?? 0),
  confidence: Number(result.confidence ?? 0) } }];`));
workflow.nodes.push(code('Skipped Stated Thesis', [1920, 600], `const row = $input.first().json;
return [{ json: { completed: false, skipped: true, thesis_type: 'stated', entity_id: row.entity_id, entity_name: row.entity_name,
  candidates_rejected: Number(row.candidates_rejected ?? 0) } }];`));
workflow.nodes.push(code('Skipped Revealed Thesis', [1920, 600], `const row = $input.first().json;
return [{ json: { completed: false, skipped: true, thesis_type: 'revealed', entity_id: row.entity_id, entity_name: row.entity_name,
  candidates_rejected: Number(row.candidates_rejected ?? 0) } }];`));
workflow.nodes.push(code('Entity Complete', [2400, 340], `const rows = $input.all().map((item) => item.json ?? {});
const completed = rows.filter(r => r.completed);
const stated = completed.filter(r => r.thesis_type === 'stated');
const revealed = completed.filter(r => r.thesis_type === 'revealed');
return [{ json: { entity_completed: true, entity_id: rows[0]?.entity_id, entity_name: rows[0]?.entity_name,
  theses_persisted: completed.length, stated_theses: stated.length, revealed_theses: revealed.length,
  stated_new: stated.filter(r => r.is_new).length, revealed_new: revealed.filter(r => r.is_new).length,
  candidates_rejected: rows.reduce((sum, r) => sum + Number(r.candidates_rejected ?? 0), 0) } }];`));
workflow.nodes.push(code('No Evidence Entity Complete', [1440, 600], `return [{ json: { entity_completed: true, no_evidence: true, entity_id: $json.entity_id, entity_name: $json.entity_name,
  theses_persisted: 0, stated_theses: 0, revealed_theses: 0 } }];`));
workflow.nodes.push(code('Thesis Engine Summary', [1200, 120], `const rows = $input.all().map((item) => item.json ?? {});
return [{ json: { status: 'completed',
  entities_processed: rows.filter(r => !r.no_evidence).length,
  no_evidence_entities: rows.filter(r => r.no_evidence).length,
  theses_persisted: rows.reduce((sum, r) => sum + Number(r.theses_persisted ?? 0), 0),
  stated_theses: rows.reduce((sum, r) => sum + Number(r.stated_theses ?? 0), 0),
  revealed_theses: rows.reduce((sum, r) => sum + Number(r.revealed_theses ?? 0), 0),
  new_theses: rows.reduce((sum, r) => sum + Number(r.stated_new ?? 0) + Number(r.revealed_new ?? 0), 0),
  candidates_rejected: rows.reduce((sum, r) => sum + Number(r.candidates_rejected ?? 0), 0),
  output_status: 'draft', note: 'Thesis extraction complete. Stated theses from public statements; revealed theses from investment patterns. Both are draft until human review.' } }];`));

connect(workflow, 'Manual Trigger', 'Thesis Engine Configuration');
connect(workflow, 'Daily Thesis Extraction', 'Thesis Engine Configuration');
connect(workflow, 'Thesis Engine Configuration', 'Load Thesis Evidence Candidates');
connect(workflow, 'Load Thesis Evidence Candidates', 'Group Evidence by Entity');
connect(workflow, 'Group Evidence by Entity', 'Entity Loop');
connect(workflow, 'Entity Loop', 'Thesis Engine Summary', 0);
connect(workflow, 'Entity Loop', 'Has Evidence for Entity?', 1);
connect(workflow, 'Has Evidence for Entity?', 'Build Stated Thesis Request', 0);
connect(workflow, 'Has Evidence for Entity?', 'Build Revealed Thesis Request', 1);
connect(workflow, 'Has Evidence for Entity?', 'No Evidence Entity Complete', 1);
connect(workflow, 'Build Stated Thesis Request', 'OpenAI Stated Thesis');
connect(workflow, 'Build Revealed Thesis Request', 'OpenAI Revealed Thesis');
connect(workflow, 'OpenAI Stated Thesis', 'Validate Stated Thesis');
connect(workflow, 'OpenAI Revealed Thesis', 'Validate Revealed Thesis');
connect(workflow, 'Validate Stated Thesis', 'Persist Stated Thesis', 0);
connect(workflow, 'Validate Stated Thesis', 'Skipped Stated Thesis', 1);
connect(workflow, 'Validate Revealed Thesis', 'Persist Revealed Thesis', 0);
connect(workflow, 'Validate Revealed Thesis', 'Skipped Revealed Thesis', 1);
connect(workflow, 'Persist Stated Thesis', 'Stated Thesis Complete');
connect(workflow, 'Persist Revealed Thesis', 'Revealed Thesis Complete');
connect(workflow, 'Stated Thesis Complete', 'Entity Complete');
connect(workflow, 'Revealed Thesis Complete', 'Entity Complete');
connect(workflow, 'Skipped Stated Thesis', 'Entity Complete');
connect(workflow, 'Skipped Revealed Thesis', 'Entity Complete');
connect(workflow, 'Entity Complete', 'Entity Loop');
connect(workflow, 'No Evidence Entity Complete', 'Entity Loop');

const output = path.join(__dirname, 'verified_thesis_engine.json');
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(output);