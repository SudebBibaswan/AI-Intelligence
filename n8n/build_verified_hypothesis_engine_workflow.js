const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const patternWorkflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_pattern_engine.json'), 'utf8'));
const supabaseCredential = structuredClone(patternWorkflow.nodes.find((node) => node.name === 'Load Accepted Observations').credentials.supabaseApi);
const openAiCredential = structuredClone(patternWorkflow.nodes.find((node) => node.name === 'OpenAI Pattern Synthesis').credentials.openAiApi);
const stableId = (name) => {
  const digest = crypto.createHash('sha1').update(`verified-hypothesis-engine:${name}`).digest('hex');
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
  name: 'RE 10 - Verified Hypothesis Engine', nodes: [], connections: {}, pinData: {}, active: false, tags: [],
  settings: { executionOrder: 'v1', saveManualExecutions: true, saveExecutionProgress: true,
    saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', executionTimeout: 1800 },
};

workflow.nodes.push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', [0, 240], {}));
workflow.nodes.push(node('Daily Hypothesis Check', 'n8n-nodes-base.scheduleTrigger', [0, 400], {
  rule: { interval: [{ field: 'days', daysInterval: 1 }] },
}));
workflow.nodes.push(code('Hypothesis Engine Configuration', [240, 320], `return [{ json: {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co',
  workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  domain_limit: 3,
  patterns_per_domain: 10,
  max_hypotheses_per_domain: 3,
  min_strength_score: 0.7,
  model: 'gpt-6-luna',
  engine_version: 'hypothesis-engine-v1.0.0'
} }];`));
workflow.nodes.push(node('Load Eligible Patterns', 'n8n-nodes-base.httpRequest', [480, 320], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/rpc/n8n_list_hypothesis_pattern_candidates' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json',
  jsonBody: '={{ JSON.stringify({ p_workspace_id: $json.workspace_id, p_domain_limit: $json.domain_limit, p_patterns_per_domain: $json.patterns_per_domain, p_min_strength_score: $json.min_strength_score }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Build Diverse Pattern Packs', [720, 320], `const config = $('Hypothesis Engine Configuration').first().json;
const rows = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json])
  .filter((row) => row && row.pattern_id && row.workspace_domain_id);
if (!rows.length) return [{ json: { config, no_patterns: true, pattern_items: [], pattern_count: 0 } }];
const groups = new Map();
for (const row of rows) {
  const key = row.workspace_domain_id;
  if (!groups.has(key)) groups.set(key, { config, no_patterns: false, workspace_id: row.workspace_id,
    workspace_domain_id: key, domain_key: row.domain_key, domain_name: row.domain_name, pattern_items: [] });
  groups.get(key).pattern_items.push({ pattern_id: row.pattern_id, pattern_type: row.pattern_type,
    title: row.title, statement: row.statement, strength_score: row.strength_score,
    persistence_score: row.persistence_score, diversity_score: row.evidence_diversity_score,
    confidence: row.confidence, status: row.status, observation_count: Number(row.observation_count ?? 0),
    source_family_count: Number(row.source_family_count ?? 0), event_entity_count: Number(row.event_entity_count ?? 0),
    has_contradictions: Boolean(row.has_contradictions), first_detected_at: row.first_detected_at,
    last_confirmed_at: row.last_confirmed_at, metadata: row.metadata ?? {} });
}
return [...groups.values()].map((pack) => ({ json: { ...pack, pattern_count: pack.pattern_items.length } }));`));
workflow.nodes.push(node('Hypothesis Domain Loop', 'n8n-nodes-base.splitInBatches', [960, 320], { batchSize: 1, options: {} }));
workflow.nodes.push(condition('Has Eligible Patterns?', [1200, 440],
  '={{ $json.no_patterns !== true && $json.pattern_items.length >= 1 }}'));
workflow.nodes.push(code('Build Hypothesis Request', [1440, 340], `const pack = $input.first().json;
const patternReference = { type: 'object', additionalProperties: false, properties: {
  pattern_id: { type: 'string' }, role: { type: 'string', enum: ['primary','supporting','contradicting','context'] },
  weight: { type: 'number' }
}, required: ['pattern_id','role','weight'] };
const hypothesis = { type: 'object', additionalProperties: false, properties: {
  pattern_type: { type: 'string' },
  title: { type: 'string' }, statement: { type: 'string' },
  target_user: { type: 'string' }, problem: { type: 'string' }, proposed_value: { type: 'string' },
  assumptions: { type: 'array', minItems: 1, items: { type: 'string' } },
  falsifiers: { type: 'array', minItems: 1, items: { type: 'string' } },
  validation_questions: { type: 'array', minItems: 1, items: { type: 'string' } },
  confidence: { type: 'number' },
  patterns: { type: 'array', minItems: 1, maxItems: 10, items: patternReference }
}, required: ['pattern_type','title','statement','target_user','problem','assumptions','falsifiers','validation_questions','confidence','patterns'] };
const schema = { type: 'object', additionalProperties: false, properties: {
  hypotheses: { type: 'array', maxItems: pack.config.max_hypotheses_per_domain, items: hypothesis }
}, required: ['hypotheses'] };
const patternPack = { domain_key: pack.domain_key, domain_name: pack.domain_name,
  eligible_patterns: pack.pattern_items };
return [{ json: { ...pack, openai_request: { model: pack.config.model, store: false, max_output_tokens: 2200,
  instructions: 'Create testable hypotheses from the eligible patterns supplied. Every hypothesis must cite at least one pattern_id. Identify a specific target user, a concrete problem, and explicit assumptions, falsifiers, and validation questions. Funding alone is not proof of demand. Do not declare facts, make predictions, or claim causation. Return an empty hypotheses array when no defensible hypothesis exists. Valid outputs are automatically advanced to ready_for_validation; signal review remains the only human gate.',
  input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(patternPack) }] }],
  text: { format: { type: 'json_schema', name: 'pattern_hypotheses', strict: true, schema } }
} } }];`));
workflow.nodes.push(node('OpenAI Hypothesis Synthesis', 'n8n-nodes-base.httpRequest', [1680, 340], {
  method: 'POST', url: 'https://api.openai.com/v1/responses', authentication: 'predefinedCredentialType',
  nodeCredentialType: 'openAiApi', sendHeaders: true,
  headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.openai_request) }}',
  options: { timeout: 90000 },
}, { credentials: { openAiApi: openAiCredential }, retryOnFail: true, maxTries: 2,
  waitBetweenTries: 1000, alwaysOutputData: true, onError: 'continueRegularOutput' }));
workflow.nodes.push(code('Validate Hypothesis Candidates', [1920, 340], `const pack = $('Build Hypothesis Request').item.json;
const response = $input.first().json ?? {};
const outputText = (response.output ?? []).flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
let parsed = null;
try { if (outputText) parsed = JSON.parse(outputText); } catch {}
const patternById = new Map(pack.pattern_items.map((item) => [item.pattern_id, item]));
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
const forbiddenWords = new Set(['funding proves','funding alone','capital proves','investment proves','proves demand','validates demand','confirms demand']);
const seen = new Set();
const valid = [];
let rejected = 0;
for (const candidate of (Array.isArray(parsed?.hypotheses) ? parsed.hypotheses : [])) {
  const title = normalizeText(candidate.title, 240);
  const statement = normalizeText(candidate.statement, 2000);
  const targetUser = normalizeText(candidate.target_user, 500);
  const problem = normalizeText(candidate.problem, 2000);
  const proposedValue = normalizeText(candidate.proposed_value, 2000);
  const refs = (Array.isArray(candidate.patterns) ? candidate.patterns : []).filter((ref) => patternById.has(ref.pattern_id));
  const uniqueRefs = [...new Map(refs.map((ref) => [ref.pattern_id, ref])).values()].slice(0, 10);
  const assumptions = (Array.isArray(candidate.assumptions) ? candidate.assumptions : []).map((a) => normalizeText(a, 500)).filter(Boolean);
  const falsifiers = (Array.isArray(candidate.falsifiers) ? candidate.falsifiers : []).map((f) => normalizeText(f, 500)).filter(Boolean);
  const validationQuestions = (Array.isArray(candidate.validation_questions) ? candidate.validation_questions : []).map((q) => normalizeText(q, 500)).filter(Boolean);
  const confidence = Math.max(0, Math.min(1, Number(candidate.confidence ?? 0)));
  const words = (title + ' ' + statement + ' ' + targetUser + ' ' + problem).toLowerCase();
  const fundingOnlyClaim = [...forbiddenWords].some((phrase) => words.includes(phrase));
  const key = (candidate.pattern_type ?? '') + ':' + targetUser.toLowerCase() + ':' + problem.toLowerCase() + ':' + uniqueRefs.map(r => r.pattern_id).sort().join(',');
  if (!title || title.length < 8 || !statement || statement.length < 30
    || !targetUser || targetUser.length < 3
    || !problem || problem.length < 10
    || uniqueRefs.length < 1
    || assumptions.length < 1 || falsifiers.length < 1 || validationQuestions.length < 1
    || fundingOnlyClaim || seen.has(key)) { rejected++; continue; }
  seen.add(key);
  valid.push({ p_hypothesis: { workspace_id: pack.workspace_id, workspace_domain_id: pack.workspace_domain_id,
    pattern_type: candidate.pattern_type ?? pack.pattern_items[0]?.pattern_type ?? 'other',
    title, statement, target_user: targetUser, problem, proposed_value: proposedValue,
    assumptions, falsifiers, validation_questions: validationQuestions, confidence,
    patterns: uniqueRefs.map((ref) => ({ pattern_id: ref.pattern_id,
      role: ['primary','supporting','contradicting','context'].includes(ref.role) ? ref.role : 'supporting',
      weight: Math.max(0, Math.min(1, Number(ref.weight ?? 0.7))) })),
    engine_version: pack.config.engine_version, metadata: { generation_mode: 'eligible_patterns_only',
      input_pattern_count: uniqueRefs.length, domain_key: pack.domain_key }
  }, candidate_quality: { input_pattern_count: uniqueRefs.length } });
}
if (!valid.length) return [{ json: { no_hypothesis: true, workspace_domain_id: pack.workspace_domain_id,
  domain_key: pack.domain_key, provider_error: response.error ? 'OPENAI_HYPOTHESIS_REQUEST_FAILED' : null,
  candidates_rejected: rejected, openai_calls: 1 } }];
return valid.map((item) => ({ json: { ...item, no_hypothesis: false,
  candidates_rejected: rejected, openai_calls: 1 } }));`));
workflow.nodes.push(node('Hypothesis Candidate Loop', 'n8n-nodes-base.splitInBatches', [2160, 340], { batchSize: 1, options: {} }));
workflow.nodes.push(condition('Has Valid Hypothesis?', [2400, 460],
  '={{ $json.no_hypothesis !== true && Boolean($json.p_hypothesis) }}'));
workflow.nodes.push(node('Persist Validated Hypothesis', 'n8n-nodes-base.httpRequest', [2640, 380], {
  method: 'POST',
  url: "={{ $('Hypothesis Engine Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_upsert_verified_hypothesis' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ p_hypothesis: $json.p_hypothesis }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Hypothesis Candidate Complete', [2880, 380], `const response = $input.first().json ?? {};
const result = Array.isArray(response) ? (response[0] ?? {}) : response;
return [{ json: { completed: true, hypothesis_id: result.hypothesis_id ?? null,
  status: result.status ?? 'ready_for_validation', is_new: Boolean(result.is_new),
  pattern_count: Number(result.pattern_count ?? 0), confidence: Number(result.confidence ?? 0),
  openai_calls: 0 } }];`));
workflow.nodes.push(code('Skipped Hypothesis Candidate', [2640, 580], `const row = $input.first().json;
return [{ json: { completed: false, skipped: true, provider_error: row.provider_error ?? null,
  candidates_rejected: Number(row.candidates_rejected ?? 0), openai_calls: Number(row.openai_calls ?? 0) } }];`));
workflow.nodes.push(code('Hypothesis Domain Complete', [2400, 180], `const rows = $input.all().map((item) => item.json ?? {});
return [{ json: { domain_completed: true, hypotheses_persisted: rows.filter((row) => row.completed).length,
  new_hypotheses: rows.filter((row) => row.completed && row.is_new).length,
  candidates_rejected: rows.reduce((sum, row) => sum + Number(row.candidates_rejected ?? 0), 0),
  provider_errors: [...new Set(rows.map((row) => row.provider_error).filter(Boolean))], openai_calls: 1 } }];`));
workflow.nodes.push(code('No Eligible Patterns Domain Complete', [1440, 600], `return [{ json: { domain_completed: true,
  no_eligible_patterns: true, hypotheses_persisted: 0, new_hypotheses: 0,
  candidates_rejected: 0, provider_errors: [], openai_calls: 0 } }];`));
workflow.nodes.push(code('Hypothesis Engine Summary', [1200, 120], `const rows = $input.all().map((item) => item.json ?? {});
const errors = [...new Set(rows.flatMap((row) => row.provider_errors ?? []).filter(Boolean))];
return [{ json: { status: errors.length && rows.every((row) => Number(row.hypotheses_persisted ?? 0) === 0)
    ? 'failed' : (errors.length ? 'partial' : 'completed'),
  domains_processed: rows.filter((row) => !row.no_eligible_patterns).length,
  no_eligible_patterns: rows.some((row) => row.no_eligible_patterns),
  hypotheses_persisted: rows.reduce((sum, row) => sum + Number(row.hypotheses_persisted ?? 0), 0),
  new_hypotheses: rows.reduce((sum, row) => sum + Number(row.new_hypotheses ?? 0), 0),
  candidates_rejected: rows.reduce((sum, row) => sum + Number(row.candidates_rejected ?? 0), 0),
  openai_calls: rows.reduce((sum, row) => sum + Number(row.openai_calls ?? 0), 0), provider_errors: errors,
  output_status: 'ready_for_validation', note: 'Signal approval is the only human gate. Hypotheses are auto-advanced to ready_for_validation from eligible patterns. No new human review is introduced. RE11 Adversarial Validation will determine final result.' } }];`));

connect(workflow, 'Manual Trigger', 'Hypothesis Engine Configuration');
connect(workflow, 'Daily Hypothesis Check', 'Hypothesis Engine Configuration');
connect(workflow, 'Hypothesis Engine Configuration', 'Load Eligible Patterns');
connect(workflow, 'Load Eligible Patterns', 'Build Diverse Pattern Packs');
connect(workflow, 'Build Diverse Pattern Packs', 'Hypothesis Domain Loop');
connect(workflow, 'Hypothesis Domain Loop', 'Hypothesis Engine Summary', 0);
connect(workflow, 'Hypothesis Domain Loop', 'Has Eligible Patterns?', 1);
connect(workflow, 'Has Eligible Patterns?', 'Build Hypothesis Request', 0);
connect(workflow, 'Has Eligible Patterns?', 'No Eligible Patterns Domain Complete', 1);
connect(workflow, 'Build Hypothesis Request', 'OpenAI Hypothesis Synthesis');
connect(workflow, 'OpenAI Hypothesis Synthesis', 'Validate Hypothesis Candidates');
connect(workflow, 'Validate Hypothesis Candidates', 'Hypothesis Candidate Loop');
connect(workflow, 'Hypothesis Candidate Loop', 'Hypothesis Domain Complete', 0);
connect(workflow, 'Hypothesis Candidate Loop', 'Has Valid Hypothesis?', 1);
connect(workflow, 'Has Valid Hypothesis?', 'Persist Validated Hypothesis', 0);
connect(workflow, 'Has Valid Hypothesis?', 'Skipped Hypothesis Candidate', 1);
connect(workflow, 'Persist Validated Hypothesis', 'Hypothesis Candidate Complete');
connect(workflow, 'Hypothesis Candidate Complete', 'Hypothesis Candidate Loop');
connect(workflow, 'Skipped Hypothesis Candidate', 'Hypothesis Candidate Loop');
connect(workflow, 'Hypothesis Domain Complete', 'Hypothesis Domain Loop');
connect(workflow, 'No Eligible Patterns Domain Complete', 'Hypothesis Domain Loop');

const output = path.join(__dirname, 'verified_hypothesis_engine.json');
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(output);