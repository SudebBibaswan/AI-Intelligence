const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const signalWorkflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_signal_engine.json'), 'utf8'));
const supabaseCredential = structuredClone(signalWorkflow.nodes.find((node) => node.name === 'Load Verified Evidence').credentials.supabaseApi);
const stableId = (name) => {
  const digest = crypto.createHash('sha1').update(`verified-evidence-review-engine:${name}`).digest('hex');
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
  name: 'RE14 - Evidence Human Review', nodes: [], connections: {}, pinData: {}, active: false, tags: [],
  settings: { executionOrder: 'v1', saveManualExecutions: true, saveExecutionProgress: true,
    saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', executionTimeout: 1800 },
};

workflow.nodes.push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', [0, 240], {}));
workflow.nodes.push(node('Hourly Review Check', 'n8n-nodes-base.scheduleTrigger', [0, 400], {
  rule: { interval: [{ field: 'hours', hoursInterval: 1 }] },
}));
workflow.nodes.push(code('Review Engine Configuration', [240, 320], `return [{ json: {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co',
  workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  lookback_hours: 24,
  batch_size: 50,
  engine_version: 'evidence-review-engine-v1.0.0'
} }];`));
workflow.nodes.push(node('Load Review Queue', 'n8n-nodes-base.httpRequest', [480, 200], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/v_evidence_review_queue' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' },
  ] }, options: { timeout: 30000 },
  queryParameters: { parameters: [
    { name: 'workspace_id', value: '={{ $json.workspace_id }}' },
    { name: 'order', value: 'created_at.asc' },
    { name: 'limit', value: '={{ $json.batch_size }}' },
  ] },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(node('Load Signal Eligible Evidence', 'n8n-nodes-base.httpRequest', [480, 400], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/v_signal_eligible_evidence' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' },
  ] }, options: { timeout: 30000 },
  queryParameters: { parameters: [
    { name: 'workspace_id', value: '={{ $json.workspace_id }}' },
    { name: 'order', value: 'created_at.desc' },
    { name: 'limit', value: '100' },
  ] },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(node('Load Capital Directory', 'n8n-nodes-base.httpRequest', [480, 600], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/v_capital_directory' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' },
  ] }, options: { timeout: 30000 },
  queryParameters: { parameters: [
    { name: 'workspace_id', value: '={{ $json.workspace_id }}' },
  ] },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Process Review Queue', [720, 300], `const config = $('Review Engine Configuration').first().json;
const queue = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json])
  .filter(r => r.workspace_id === config.workspace_id);
const eligible = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json])
  .filter(r => r.workspace_id === config.workspace_id);
const capital = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json])
  .filter(r => r.workspace_id === config.workspace_id);

const pendingReview = queue.length;
const highConfidencePending = queue.filter(r => Number(r.confidence || 0) >= 0.8).length;
const disputedCount = queue.filter(r => r.verification_status === 'disputed').length;
const signalReady = eligible.length;

const capitalActive = capital.filter(c => c.activity_status === 'active_evidenced').length;
const capitalEvidenced = capital.filter(c => c.activity_status === 'evidenced').length;
const capitalCandidates = capital.filter(c => c.activity_status === 'candidate_unverified').length;

return [{ json: {
  config,
  review_queue: queue.slice(0, 20),
  summary: {
    pending_review: pendingReview,
    high_confidence_pending: highConfidencePending,
    disputed_count: disputedCount,
    signal_ready_evidence: signalReady,
    capital_active_evidenced: capitalActive,
    capital_evidenced: capitalEvidenced,
    capital_candidates: capitalCandidates,
  },
} }];`));
workflow.nodes.push(condition('Has Pending Reviews?', [960, 300],
  '={{ $json.summary.pending_review > 0 }}'));
workflow.nodes.push(code('Review Queue Summary', [1200, 200], `const data = $('Process Review Queue').item.json;
return [{ json: { status: 'completed',
  pending_reviews: data.summary.pending_review,
  high_confidence: data.summary.high_confidence_pending,
  disputed: data.summary.disputed_count,
  signal_ready: data.summary.signal_ready_evidence,
  capital_active: data.summary.capital_active_evidenced,
  capital_evidenced: data.summary.capital_evidenced,
  capital_candidates: data.summary.capital_candidates,
  note: 'Evidence review queue processed. Frontend can query v_evidence_review_queue for actionable items. Capital directory available in v_capital_directory.' } }];`));
workflow.nodes.push(code('No Reviews Pending', [1200, 400], `const data = $('Process Review Queue').item.json;
return [{ json: { status: 'completed',
  pending_reviews: 0,
  high_confidence: 0,
  disputed: 0,
  signal_ready: data.summary.signal_ready_evidence,
  capital_active: data.summary.capital_active_evidenced,
  capital_evidenced: data.summary.capital_evidenced,
  capital_candidates: data.summary.capital_candidates,
  note: 'No evidence pending review. Capital directory available in v_capital_directory.' } }];`));

connect(workflow, 'Manual Trigger', 'Review Engine Configuration');
connect(workflow, 'Hourly Review Check', 'Review Engine Configuration');
connect(workflow, 'Review Engine Configuration', 'Load Review Queue');
connect(workflow, 'Review Engine Configuration', 'Load Signal Eligible Evidence');
connect(workflow, 'Review Engine Configuration', 'Load Capital Directory');
connect(workflow, 'Load Review Queue', 'Process Review Queue');
connect(workflow, 'Load Signal Eligible Evidence', 'Process Review Queue');
connect(workflow, 'Load Capital Directory', 'Process Review Queue');
connect(workflow, 'Process Review Queue', 'Has Pending Reviews?');
connect(workflow, 'Has Pending Reviews?', 'Review Queue Summary', 0);
connect(workflow, 'Has Pending Reviews?', 'No Reviews Pending', 1);

const output = path.join(__dirname, 'verified_evidence_review_engine.json');
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(output);