const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const hypothesisWorkflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_hypothesis_engine.json'), 'utf8'));
const supabaseCredential = structuredClone(hypothesisWorkflow.nodes.find((node) => node.name === 'Load Eligible Patterns').credentials.supabaseApi);
const openAiCredential = structuredClone(hypothesisWorkflow.nodes.find((node) => node.name === 'OpenAI Hypothesis Synthesis').credentials.openAiApi);
const stableId = (name) => {
  const digest = crypto.createHash('sha1').update(`verified-validation-engine:${name}`).digest('hex');
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
  name: 'RE 11 - Adversarial Validation Engine', nodes: [], connections: {}, pinData: {}, active: false, tags: [],
  settings: { executionOrder: 'v1', saveManualExecutions: true, saveExecutionProgress: true,
    saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', executionTimeout: 3600 },
};

workflow.nodes.push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', [0, 240], {}));
workflow.nodes.push(node('Daily Validation Check', 'n8n-nodes-base.scheduleTrigger', [0, 400], {
  rule: { interval: [{ field: 'days', daysInterval: 1 }] },
}));
workflow.nodes.push(code('Validation Engine Configuration', [240, 320], `return [{ json: {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co',
  workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  domain_limit: 3,
  hypotheses_per_domain: 10,
  max_validations_per_domain: 5,
  model: 'gpt-6-luna',
  engine_version: 'validation-engine-v1.0.0',
  research_budget_usd: 0.15
} }];`));
workflow.nodes.push(node('Load Hypotheses Ready for Validation', 'n8n-nodes-base.httpRequest', [480, 320], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/rpc/n8n_list_validation_hypothesis_candidates' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json',
  jsonBody: '={{ JSON.stringify({ p_workspace_id: $json.workspace_id, p_domain_limit: $json.domain_limit, p_hypotheses_per_domain: $json.hypotheses_per_domain }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Build Validation Packs', [720, 320], `const config = $('Validation Engine Configuration').first().json;
const rows = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json])
  .filter((row) => row && row.hypothesis_id && row.workspace_domain_id);
if (!rows.length) return [{ json: { config, no_hypotheses: true, hypothesis_items: [] } }];
const groups = new Map();
for (const row of rows) {
  const key = row.workspace_domain_id;
  if (!groups.has(key)) groups.set(key, { config, no_hypotheses: false, workspace_id: row.workspace_id,
    workspace_domain_id: key, domain_key: row.domain_key, domain_name: row.domain_name, hypothesis_items: [] });
  groups.get(key).hypothesis_items.push({ hypothesis_id: row.hypothesis_id, title: row.title,
    statement: row.statement, target_user: row.target_user, problem: row.problem,
    proposed_value: row.proposed_value, assumptions: row.assumptions, falsifiers: row.falsifiers,
    validation_questions: row.validation_questions, confidence: row.confidence,
    pattern_ids: row.pattern_ids, pattern_titles: row.pattern_titles, pattern_types: row.pattern_types,
    engine_version: row.engine_version });
}
return [...groups.values()].map((pack) => ({ json: { ...pack, hypothesis_count: pack.hypothesis_items.length } }));`));
workflow.nodes.push(node('Validation Domain Loop', 'n8n-nodes-base.splitInBatches', [960, 320], { batchSize: 1, options: {} }));
workflow.nodes.push(condition('Has Hypotheses to Validate?', [1200, 440],
  '={{ $json.no_hypotheses !== true && $json.hypothesis_items.length >= 1 }}'));
workflow.nodes.push(code('Build Validation Research Plan', [1440, 340], `const pack = $input.first().json;
const hypothesis = pack.hypothesis_items[0];
const dimensions = ['competitor', 'demand', 'adoption', 'funding', 'technical', 'regulatory', 'incumbent', 'failed_attempt', 'counter_signal'];
const researchPlan = dimensions.map((dimension) => {
  let query = '';
  switch (dimension) {
    case 'competitor':
      query = 'competitors ' + hypothesis.target_user + ' ' + hypothesis.problem + ' existing solutions market';
      break;
    case 'demand':
      query = 'market demand ' + hypothesis.target_user + ' ' + hypothesis.problem + ' willingness to pay';
      break;
    case 'adoption':
      query = 'adoption rate ' + hypothesis.target_user + ' ' + hypothesis.problem + ' technology adoption curve';
      break;
    case 'funding':
      query = 'funding rounds ' + hypothesis.target_user + ' ' + hypothesis.problem + ' VC investment';
      break;
    case 'technical':
      query = 'technical feasibility ' + hypothesis.problem + ' ' + (hypothesis.proposed_value ?? '') + ' challenges';
      break;
    case 'regulatory':
      query = 'regulatory barriers ' + hypothesis.target_user + ' ' + hypothesis.problem + ' compliance';
      break;
    case 'incumbent':
      query = 'incumbent response ' + hypothesis.target_user + ' ' + hypothesis.problem + ' market defense';
      break;
    case 'failed_attempt':
      query = 'failed startups ' + hypothesis.target_user + ' ' + hypothesis.problem + ' shutdown postmortem';
      break;
    case 'counter_signal':
      query = 'counter evidence ' + hypothesis.problem + ' ' + ((hypothesis.falsifiers ?? []).join(' ') ?? '') + ' not a problem';
      break;
  }
  return { dimension, query, hypothesis_id: hypothesis.hypothesis_id };
});
const validationRunId = 'RUN_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
return [{ json: { ...pack, research_plan: researchPlan, validation_run_id: validationRunId } }];`));
workflow.nodes.push(node('Research Dimension Loop', 'n8n-nodes-base.splitInBatches', [1680, 340], { batchSize: 1, options: {} }));
workflow.nodes.push(code('Build Research Request', [1920, 340], `const pack = $('Build Validation Research Plan').item.json;
const dimensionItem = $input.first().json;
const config = pack.config;
const schema = {
  type: 'object', additionalProperties: false, properties: {
    evidence: { type: 'array', minItems: 1, maxItems: 5, items: {
      type: 'object', additionalProperties: false, properties: {
        claim_text: { type: 'string' }, excerpt: { type: 'string' }, polarity: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
        confidence: { type: 'number' }, source_url: { type: 'string' }, source_title: { type: 'string' }
      }, required: ['claim_text', 'excerpt', 'polarity', 'confidence', 'source_url', 'source_title']
    }}
  }, required: ['evidence']
};
return [{ json: { ...pack, ...dimensionItem, openai_request: { model: config.model, store: false, max_output_tokens: 2000,
  instructions: 'Research the specific validation dimension for the hypothesis. Find concrete evidence (not opinions). Return exact excerpts with source URLs. Evidence must be verifiable. Stance will be determined by the validation engine.',
  input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify({
    hypothesis: { title: pack.hypothesis_items[0].title, statement: pack.hypothesis_items[0].statement,
      target_user: pack.hypothesis_items[0].target_user, problem: pack.hypothesis_items[0].problem,
      proposed_value: pack.hypothesis_items[0].proposed_value, assumptions: pack.hypothesis_items[0].assumptions,
      falsifiers: pack.hypothesis_items[0].falsifiers, validation_questions: pack.hypothesis_items[0].validation_questions },
    dimension: dimensionItem.dimension, query: dimensionItem.query
  }) }] }],
  text: { format: { type: 'json_schema', name: 'validation_evidence', strict: true, schema } }
} } }];`));
workflow.nodes.push(node('OpenAI Validation Research', 'n8n-nodes-base.httpRequest', [2160, 340], {
  method: 'POST', url: 'https://api.openai.com/v1/responses', authentication: 'predefinedCredentialType',
  nodeCredentialType: 'openAiApi', sendHeaders: true,
  headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.openai_request) }}',
  options: { timeout: 90000 },
}, { credentials: { openAiApi: openAiCredential }, retryOnFail: true, maxTries: 2,
  waitBetweenTries: 1000, alwaysOutputData: true, onError: 'continueRegularOutput' }));
workflow.nodes.push(code('Process Validation Evidence', [2400, 340], `const pack = $('Build Validation Research Plan').item.json;
const dimensionItem = $('Research Dimension Loop').item.json;
const response = $input.first().json ?? {};
const outputText = (response.output ?? []).flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
let parsed = null;
try { if (outputText) parsed = JSON.parse(outputText); } catch {}
const evidenceItems = Array.isArray(parsed?.evidence) ? parsed.evidence : [];
const hypothesis = pack.hypothesis_items[0];
const validEvidence = [];
for (const item of evidenceItems) {
  const claimText = String(item.claim_text ?? '').trim().slice(0, 2000);
  const excerpt = String(item.excerpt ?? '').trim().slice(0, 3000);
  const polarity = ['positive', 'negative', 'neutral'].includes(item.polarity) ? item.polarity : 'neutral';
  const confidence = Math.max(0, Math.min(1, Number(item.confidence ?? 0)));
  const sourceUrl = String(item.source_url ?? '').trim();
  const sourceTitle = String(item.source_title ?? '').trim().slice(0, 500);
  if (!claimText || !excerpt || !sourceUrl || confidence < 0.4) continue;
  let stance = 'neutral';
  const lowerText = (claimText + ' ' + excerpt).toLowerCase();
  const falsifierWords = (Array.isArray(hypothesis.falsifiers) ? hypothesis.falsifiers : []).flatMap(f => String(f).toLowerCase().split(' ').filter(w => w.length > 3));
  const supportingSignals = ['growth', 'increasing', 'demand', 'adoption', 'funding raised', 'investment', 'success', 'traction', 'product-market fit'];
  const contradictingSignals = ['decline', 'failed', 'shutdown', 'no demand', 'no market', 'regulatory block', 'technical barrier', 'incumbent', 'saturated'];
  const hasSupporting = supportingSignals.some(s => lowerText.includes(s));
  const hasContradicting = contradictingSignals.some(s => lowerText.includes(s)) || falsifierWords.some(f => lowerText.includes(f));
  if (hasSupporting && !hasContradicting) stance = 'supporting';
  else if (hasContradicting && !hasSupporting) stance = 'contradicting';
  else stance = 'neutral';
  validEvidence.push({ evidence_text: claimText, excerpt, stance, confidence, source_url: sourceUrl, source_title: sourceTitle });
}
return [{ json: { ...pack, ...dimensionItem, valid_evidence: validEvidence, evidence_count: validEvidence.length, openai_calls: 1 } }];`));
workflow.nodes.push(node('Upsert Validation Evidence', 'n8n-nodes-base.httpRequest', [2640, 340], {
  method: 'POST',
  url: "={{ $('Validation Engine Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_upsert_validation_evidence' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ p_evidence: { workspace_id: $json.workspace_id, validation_run_id: $json.validation_run_id, evidence_id: $json.valid_evidence[0].evidence_id ?? ("EVID_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10)), dimension: $json.dimension, stance: $json.valid_evidence[0].stance, weight: $json.valid_evidence[0].confidence, reasoning_summary: $json.valid_evidence[0].evidence_text } }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(node('Evidence Loop', 'n8n-nodes-base.splitInBatches', [2880, 340], { batchSize: 1, options: {} }));
workflow.nodes.push(condition('Has Valid Evidence?', [3120, 460],
  '={{ $json.valid_evidence.length > 0 }}'));
workflow.nodes.push(code('Next Evidence', [3360, 340], `const pack = $('Process Validation Evidence').item.json;
const dimensionItem = $('Research Dimension Loop').item.json;
const evidence = $input.first().json.valid_evidence;
return [{ json: { ...pack, ...dimensionItem, valid_evidence: evidence.slice(1), evidence_count: evidence.length - 1, openai_calls: 0 } }];`));
workflow.nodes.push(code('Dimension Complete', [3120, 180], `const pack = $('Process Validation Evidence').item.json;
const dimensionItem = $('Research Dimension Loop').item.json;
return [{ json: { ...pack, ...dimensionItem, dimension_completed: true, openai_calls: $json.openai_calls ?? 1 } }];`));
workflow.nodes.push(code('All Dimensions Complete', [2400, 180], `const rows = $input.all().map((item) => item.json ?? {});
return [{ json: { ...rows[0], all_dimensions_completed: true, total_evidence: rows.reduce((sum, r) => sum + (r.evidence_count ?? 0), 0), openai_calls: rows.reduce((sum, r) => sum + (r.openai_calls ?? 0), 0) } }];`));
workflow.nodes.push(node('Finalize Validation Run', 'n8n-nodes-base.httpRequest', [2400, 600], {
  method: 'POST',
  url: "={{ $('Validation Engine Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_upsert_validation_run' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ p_validation_run: { workspace_id: $json.workspace_id, hypothesis_id: $json.hypothesis_id, research_run_id: $json.research_run_id ?? null, dimensions: $json.research_plan.map(r => r.dimension), methodology: { research_mode: "adversarial", dimensions_researched: $json.research_plan.length, evidence_per_dimension: Math.round($json.total_evidence / $json.research_plan.length) }, engine_version: $json.config.engine_version, idempotency_key: $json.validation_run_id } }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Validation Complete', [2640, 600], `const result = $input.first().json ?? {};
return [{ json: { completed: true, validation_run_id: result.validation_run_id ?? null, result: result.result ?? 'inconclusive', confidence: result.confidence ?? 0, evidence_supported: result.evidence_supported ?? 0, evidence_contradicting: result.evidence_contradicting ?? 0, evidence_neutral: result.evidence_neutral ?? 0 } }];`));

workflow.nodes.push(code('No Hypotheses Domain Complete', [1440, 600], `return [{ json: { domain_completed: true, no_hypotheses: true, validations_completed: 0 } }];`));
workflow.nodes.push(code('Validation Engine Summary', [1200, 120], `const rows = $input.all().map((item) => item.json ?? {});
const errors = [...new Set(rows.flatMap((row) => row.provider_errors ?? []).filter(Boolean))];
const allResults = rows.flatMap(r => r.results ?? []);
return [{ json: { status: errors.length && allResults.length === 0 ? 'failed' : (errors.length ? 'partial' : 'completed'),
  domains_processed: rows.filter((row) => !row.no_hypotheses).length,
  no_hypotheses: rows.some((row) => row.no_hypotheses),
  validations_completed: allResults.length,
  supported: allResults.filter(r => r.result === 'supported').length,
  mixed: allResults.filter(r => r.result === 'mixed').length,
  weakened: allResults.filter(r => r.result === 'weakened').length,
  inconclusive: allResults.filter(r => r.result === 'inconclusive').length,
  provider_errors: errors,
  output_status: 'validated', note: 'Adversarial validation complete. Hypothesis status updated to supported/mixed/weakened/inconclusive. Partial failures never produce false support.' } }];`));

connect(workflow, 'Manual Trigger', 'Validation Engine Configuration');
connect(workflow, 'Daily Validation Check', 'Validation Engine Configuration');
connect(workflow, 'Validation Engine Configuration', 'Load Hypotheses Ready for Validation');
connect(workflow, 'Load Hypotheses Ready for Validation', 'Build Validation Packs');
connect(workflow, 'Build Validation Packs', 'Validation Domain Loop');
connect(workflow, 'Validation Domain Loop', 'Validation Engine Summary', 0);
connect(workflow, 'Validation Domain Loop', 'Has Hypotheses to Validate?', 1);
connect(workflow, 'Has Hypotheses to Validate?', 'Build Validation Research Plan', 0);
connect(workflow, 'Has Hypotheses to Validate?', 'No Hypotheses Domain Complete', 1);
connect(workflow, 'Build Validation Research Plan', 'Research Dimension Loop');
connect(workflow, 'Research Dimension Loop', 'All Dimensions Complete', 0);
connect(workflow, 'Research Dimension Loop', 'Build Research Request', 1);
connect(workflow, 'Build Research Request', 'OpenAI Validation Research');
connect(workflow, 'OpenAI Validation Research', 'Process Validation Evidence');
connect(workflow, 'Process Validation Evidence', 'Evidence Loop');
connect(workflow, 'Evidence Loop', 'Dimension Complete', 0);
connect(workflow, 'Evidence Loop', 'Has Valid Evidence?', 1);
connect(workflow, 'Has Valid Evidence?', 'Upsert Validation Evidence', 0);
connect(workflow, 'Has Valid Evidence?', 'Next Evidence', 1);
connect(workflow, 'Upsert Validation Evidence', 'Next Evidence');
connect(workflow, 'Next Evidence', 'Evidence Loop');
connect(workflow, 'Dimension Complete', 'Research Dimension Loop');
connect(workflow, 'All Dimensions Complete', 'Finalize Validation Run');
connect(workflow, 'Finalize Validation Run', 'Validation Complete');
connect(workflow, 'Validation Complete', 'Validation Domain Loop');
connect(workflow, 'Validation Domain Complete', 'Validation Domain Loop');
connect(workflow, 'No Hypotheses Domain Complete', 'Validation Domain Loop');

const output = path.join(__dirname, 'verified_validation_engine.json');
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(output);