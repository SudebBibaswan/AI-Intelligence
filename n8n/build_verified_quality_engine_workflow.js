const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const signalWorkflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_signal_engine.json'), 'utf8'));
const supabaseCredential = structuredClone(signalWorkflow.nodes.find((node) => node.name === 'Load Verified Evidence').credentials.supabaseApi);
const stableId = (name) => {
  const digest = crypto.createHash('sha1').update(`verified-quality-engine:${name}`).digest('hex');
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
  name: 'RE05 - Research Quality Observability', nodes: [], connections: {}, pinData: {}, active: false, tags: [],
  settings: { executionOrder: 'v1', saveManualExecutions: true, saveExecutionProgress: true,
    saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', executionTimeout: 1800 },
};

workflow.nodes.push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', [0, 240], {}));
workflow.nodes.push(node('Hourly Quality Check', 'n8n-nodes-base.scheduleTrigger', [0, 400], {
  rule: { interval: [{ field: 'hours', hoursInterval: 1 }] },
}));
workflow.nodes.push(code('Quality Engine Configuration', [240, 320], `return [{ json: {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co',
  workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  lookback_hours: 24,
  model: 'gpt-6-luna',
  engine_version: 'quality-engine-v1.0.0'
} }];`));
workflow.nodes.push(node('Load Research Run Quality', 'n8n-nodes-base.httpRequest', [480, 200], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/v_research_quality_runs' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' },
  ] }, options: { timeout: 30000 },
  queryParameters: { parameters: [
    { name: 'workspace_id', value: '={{ $json.workspace_id }}' },
    { name: 'created_at', value: '={{ "gte." + (new Date(Date.now() - $json.lookback_hours * 3600000).toISOString()) }}' },
    { name: 'order', value: 'created_at.desc' },
    { name: 'limit', value: '100' },
  ] },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(node('Load Provider Quality', 'n8n-nodes-base.httpRequest', [480, 350], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/v_research_provider_quality' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' },
  ] }, options: { timeout: 30000 },
  queryParameters: { parameters: [
    { name: 'workspace_id', value: '={{ $json.workspace_id }}' },
  ] },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(node('Load Review Backlog', 'n8n-nodes-base.httpRequest', [480, 500], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/v_research_review_backlog' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' },
  ] }, options: { timeout: 30000 },
  queryParameters: { parameters: [
    { name: 'workspace_id', value: '={{ $json.workspace_id }}' },
  ] },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(node('Load Capital Graph Health', 'n8n-nodes-base.httpRequest', [480, 650], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/v_capital_graph_health' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' },
  ] }, options: { timeout: 30000 },
  queryParameters: { parameters: [
    { name: 'workspace_id', value: '={{ $json.workspace_id }}' },
  ] },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Aggregate Quality Metrics', [720, 350], `const config = $('Quality Engine Configuration').first().json;
const runs = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json]);
const providers = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json]);
const backlog = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json]);
const graph = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json]);

const recentRuns = runs.filter(r => r.workspace_id === config.workspace_id);
const failedRuns = recentRuns.filter(r => r.status === 'failed').length;
const completedRuns = recentRuns.filter(r => r.status === 'completed').length;
const totalEvidence = recentRuns.reduce((sum, r) => sum + Number(r.evidence_count || 0), 0);
const totalVerified = recentRuns.reduce((sum, r) => sum + Number(r.verified_evidence || 0), 0);
const avgYield = recentRuns.length ? (recentRuns.reduce((sum, r) => sum + Number(r.source_to_evidence_yield || 0), 0) / recentRuns.length) : 0;
const totalCost = recentRuns.reduce((sum, r) => sum + Number(r.estimated_cost_usd || 0), 0);
const totalLlmCalls = recentRuns.reduce((sum, r) => sum + Number(r.llm_calls || 0), 0);

const providerStats = providers.filter(p => p.workspace_id === config.workspace_id);
const providerCount = providerStats.length;
const avgProviderQuality = providerStats.length ? (providerStats.reduce((sum, p) => sum + Number(p.average_source_quality || 0), 0) / providerStats.length) : 0;
const extractionSuccessRate = providerStats.length ? (providerStats.reduce((sum, p) => sum + Number(p.extraction_success_count || 0), 0) / providerStats.reduce((sum, p) => sum + Number(p.discovered_source_count || 0), 1)) : 0;

const backlogItems = backlog.filter(b => b.workspace_id === config.workspace_id).length;
const backlogEvidence = backlog.reduce((sum, b) => sum + Number(b.evidence_count || 0), 0);

const graphStats = graph.filter(g => g.workspace_id === config.workspace_id)[0] || {};

return [{ json: {
  config,
  summary: {
    period_hours: config.lookback_hours,
    runs_completed: completedRuns,
    runs_failed: failedRuns,
    total_evidence: totalEvidence,
    total_verified: totalVerified,
    verification_rate: totalEvidence ? totalVerified / totalEvidence : 0,
    source_to_evidence_yield: avgYield,
    total_llm_calls: totalLlmCalls,
    total_cost_usd: totalCost,
    providers_monitored: providerCount,
    avg_provider_quality: avgProviderQuality,
    extraction_success_rate: extractionSuccessRate,
    review_backlog_count: backlogItems,
    review_backlog_evidence: backlogEvidence,
    capital_entities: graphStats.capital_entity_count || 0,
    capital_relationships: graphStats.capital_relationship_count || 0,
    entity_provenance_coverage: graphStats.entity_provenance_coverage || 0,
    relationship_provenance_coverage: graphStats.relationship_provenance_coverage || 0,
  },
  runs_detail: recentRuns.slice(0, 10),
  providers_detail: providerStats,
  backlog_detail: backlog.slice(0, 20),
  graph_detail: graphStats,
} }];`));
workflow.nodes.push(node('Store Quality Snapshot', 'n8n-nodes-base.httpRequest', [960, 350], {
  method: 'POST',
  url: "={{ $('Quality Engine Configuration').item.json.supabase_url + '/rest/v1/research_quality_snapshots' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json',
  jsonBody: '={{ JSON.stringify({ workspace_id: $json.config.workspace_id, snapshot_at: new Date().toISOString(), metrics: $json.summary, runs_detail: $json.runs_detail, providers_detail: $json.providers_detail, backlog_detail: $json.backlog_detail, graph_detail: $json.graph_detail }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Quality Summary', [1200, 350], `const snap = $input.first().json ?? {};
const metrics = $('Aggregate Quality Metrics').item.json.summary ?? {};
return [{ json: { status: 'completed',
  workspace_id: metrics.workspace_id ?? snap.workspace_id,
  snapshot_stored: !!snap.id,
  period_hours: metrics.period_hours,
  runs_completed: metrics.runs_completed,
  runs_failed: metrics.runs_failed,
  evidence_collected: metrics.total_evidence,
  evidence_verified: metrics.total_verified,
  verification_rate: Math.round((metrics.verification_rate || 0) * 10000) / 100,
  source_yield: Math.round((metrics.source_to_evidence_yield || 0) * 10000) / 100,
  cost_usd: Math.round((metrics.total_cost_usd || 0) * 1000000) / 1000000,
  providers: metrics.providers_monitored,
  backlog: metrics.review_backlog_count,
  capital_entities: metrics.capital_entities,
  note: 'Research quality snapshot stored. Dashboard can query research_quality_snapshots table.' } }];`));

connect(workflow, 'Manual Trigger', 'Quality Engine Configuration');
connect(workflow, 'Hourly Quality Check', 'Quality Engine Configuration');
connect(workflow, 'Quality Engine Configuration', 'Load Research Run Quality');
connect(workflow, 'Quality Engine Configuration', 'Load Provider Quality');
connect(workflow, 'Quality Engine Configuration', 'Load Review Backlog');
connect(workflow, 'Quality Engine Configuration', 'Load Capital Graph Health');
connect(workflow, 'Load Research Run Quality', 'Aggregate Quality Metrics');
connect(workflow, 'Load Provider Quality', 'Aggregate Quality Metrics');
connect(workflow, 'Load Review Backlog', 'Aggregate Quality Metrics');
connect(workflow, 'Load Capital Graph Health', 'Aggregate Quality Metrics');
connect(workflow, 'Aggregate Quality Metrics', 'Store Quality Snapshot');
connect(workflow, 'Store Quality Snapshot', 'Quality Summary');

const output = path.join(__dirname, 'verified_quality_engine.json');
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(output);