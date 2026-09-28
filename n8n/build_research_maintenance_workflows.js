const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const source = JSON.parse(fs.readFileSync(path.join(__dirname, 'Research Engine_multisource_v2.json'), 'utf8'));
const sourceNode = (name) => structuredClone(source.nodes.find((node) => node.name === name));
const credentialRefs = {
  supabaseApi: sourceNode('Create Research Run').credentials.supabaseApi,
  openAiApi: sourceNode('OpenAI Evidence Extraction').credentials.openAiApi,
};
const id = (name) => crypto.createHash('sha1').update(name).digest('hex').slice(0, 8) + '-0000-4000-8000-' + crypto.createHash('sha1').update('x:' + name).digest('hex').slice(0, 12);
const versions = { 'n8n-nodes-base.code': 2, 'n8n-nodes-base.manualTrigger': 1, 'n8n-nodes-base.scheduleTrigger': 1.2, 'n8n-nodes-base.splitInBatches': 3 };
const node = (name, type, position, parameters, credentials) => ({ id: id(name), name, type, typeVersion: versions[type] ?? 4.2, position, parameters, ...(credentials ? { credentials } : {}) });
const code = (name, position, jsCode) => node(name, 'n8n-nodes-base.code', position, { jsCode });
const http = (name, position, parameters, credentialType = 'supabaseApi') => node(name, 'n8n-nodes-base.httpRequest', position, parameters, { [credentialType]: structuredClone(credentialRefs[credentialType]) });
const connect = (connections, from, to, output = 0) => {
  connections[from] ??= { main: [] };
  while (connections[from].main.length <= output) connections[from].main.push([]);
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
};

function baseWorkflow(name) {
  return { name, nodes: [], connections: {}, pinData: {}, settings: { executionOrder: 'v1' }, active: false, tags: [] };
}

function buildBackfill() {
  const w = baseWorkflow('RE 02 - Stored Content Evidence Backfill');
  w.nodes.push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', [0, 240], {}));
  w.nodes.push(node('Twice Daily Backfill', 'n8n-nodes-base.scheduleTrigger', [0, 400], { rule: { interval: [{ field: 'hours', hoursInterval: 12 }] } }));
  w.nodes.push(code('Backfill Configuration', [240, 320], `const uuid = () => {
  const h = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  h[12] = '4'; h[16] = (8 + Math.floor(Math.random() * 4)).toString(16);
  return h.slice(0,8).join('') + '-' + h.slice(8,12).join('') + '-' + h.slice(12,16).join('') + '-' + h.slice(16,20).join('') + '-' + h.slice(20).join('');
};
const research_run_id = uuid();
const request_id = uuid();
const config = {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co',
  workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  workspace_domain_id: '11068f00-2e6b-462c-b455-c69384e5e8a8',
  domain_key: 'maintenance-backfill', objective: 'Extract grounded evidence from previously stored research content.',
  automation_mode: 'review_only', contract_version: '1.0.0', engine_version: 'research-backfill-v1.0.0',
  evidence_model: 'gpt-6-luna', prompt_version: 'research-evidence-v1.0.0',
  limits: { batch_size: 20, max_source_chars: 24000, max_evidence_per_source: 5, max_openai_output_tokens: 1600, max_estimated_openai_cost_usd: 0.10 },
  thresholds: { min_evidence_confidence: 0.55 }, pricing_per_million_tokens: { input: 0.1, output: 0.5 }
};
return [{ json: { config, research_run_id, request_id, run_payload: {
  id: research_run_id, workspace_id: config.workspace_id, workspace_domain_id: config.workspace_domain_id,
  trigger_type: 'schedule', status: 'queued', request_id, idempotency_key: 'backfill:' + research_run_id,
  contract_version: config.contract_version, config_snapshot: config,
  metrics: { engine_version: config.engine_version, started_from: 'stored-content-backfill' }, error_summary: {}
} } }];`));

  const create = sourceNode('Create Research Run'); create.name = 'Create Backfill Run'; create.id = id(create.name); create.position = [520, 320];
  create.parameters.url = "={{ $('Backfill Configuration').item.json.config.supabase_url + '/rest/v1/research_runs' }}";
  create.parameters.jsonBody = "={{ JSON.stringify($('Backfill Configuration').item.json.run_payload) }}";
  const claim = sourceNode('Claim Research Run'); claim.name = 'Claim Backfill Run'; claim.id = id(claim.name); claim.position = [760, 320];
  claim.parameters.url = "={{ $('Backfill Configuration').item.json.config.supabase_url + '/rest/v1/rpc/n8n_claim_research_run' }}";
  claim.parameters.jsonBody = "={{ JSON.stringify({ p_research_run_id: $('Backfill Configuration').item.json.research_run_id, p_request_id: $('Backfill Configuration').item.json.request_id }) }}";
  w.nodes.push(create, claim);
  w.nodes.push(http('List Stored Sources Needing Evidence', [1000, 320], {
    method: 'POST', url: "={{ $('Backfill Configuration').item.json.config.supabase_url + '/rest/v1/rpc/n8n_list_evidence_backfill_sources' }}",
    authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] }, sendBody: true, specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ p_workspace_id: $('Backfill Configuration').item.json.config.workspace_id, p_limit: $('Backfill Configuration').item.json.config.limits.batch_size }) }}", options: { timeout: 30000 }
  }));
  w.nodes.push(code('Normalize Backfill Queue', [1240, 320], `const seed = $('Backfill Configuration').first().json;
const rows = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json]).filter((row) => row?.source_id);
return rows.map((row) => ({ json: { ...row, config: seed.config, research_run_id: seed.research_run_id, request_id: seed.request_id,
  workspace_id: seed.config.workspace_id, workspace_domain_id: seed.config.workspace_domain_id,
  source_persisted: true, source_decision: 'needs_review', content_status: 'success' } }));`));
  w.nodes.push(node('Stored Source Loop', 'n8n-nodes-base.splitInBatches', [1480, 320], { batchSize: 1, options: {} }));
  w.nodes.push(http('Download Stored Content', [1720, 440], {
    url: "={{ $json.config.supabase_url + '/storage/v1/object/authenticated/research-content/' + $json.content_storage_path }}",
    authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'data' } } }
  }));
  w.nodes.push(code('Restore Stored Source Context', [1960, 440], `const source = $('Stored Source Loop').item.json;
const response = $input.first().json ?? {};
const content = String(response.data ?? response.body ?? '').slice(0, source.config.limits.max_source_chars).trim();
return [{ json: { ...source, content_text: content, content_status: content.length >= 700 ? 'success' : 'partial' } }];`));

  for (const name of ['Build Evidence Request', 'OpenAI Evidence Extraction', 'Parse and Verify Evidence', 'Record Evidence LLM Usage', 'Expand Evidence', 'Has Grounded Evidence?', 'Persist Evidence via RPC', 'Restore Evidence Context']) {
    const cloned = sourceNode(name); cloned.id = id(name); cloned.position = [2200 + w.nodes.length * 24, 440];
    if (cloned.parameters?.url?.includes('Validate and Prepare Run')) cloned.parameters.url = cloned.parameters.url.replace("$('Validate and Prepare Run')", "$('Backfill Configuration')");
    w.nodes.push(cloned);
  }
  w.nodes.push(node('Evidence Loop', 'n8n-nodes-base.splitInBatches', [3400, 440], { batchSize: 1, options: {} }));
  w.nodes.push(code('Backfill Source Complete', [3880, 320], `return [{ json: { source_id: $('Stored Source Loop').item.json.source_id, completed: true } }];`));
  w.nodes.push(code('Backfill Summary', [1720, 200], `const seed = $('Backfill Configuration').first().json;
return [{ json: { research_run_id: seed.research_run_id, request_id: seed.request_id, final_status: 'completed', metrics: { backfill_sources_processed: $input.all().length }, error_patch: {} } }];`));
  const finalize = sourceNode('Finalize Research Run'); finalize.name = 'Finalize Backfill Run'; finalize.id = id(finalize.name); finalize.position = [1960, 200];
  finalize.parameters.url = finalize.parameters.url.replace("$('Validate and Prepare Run')", "$('Backfill Configuration')"); w.nodes.push(finalize);

  connect(w.connections, 'Manual Trigger', 'Backfill Configuration'); connect(w.connections, 'Twice Daily Backfill', 'Backfill Configuration');
  connect(w.connections, 'Backfill Configuration', 'Create Backfill Run'); connect(w.connections, 'Create Backfill Run', 'Claim Backfill Run');
  connect(w.connections, 'Claim Backfill Run', 'List Stored Sources Needing Evidence'); connect(w.connections, 'List Stored Sources Needing Evidence', 'Normalize Backfill Queue');
  connect(w.connections, 'Normalize Backfill Queue', 'Stored Source Loop'); connect(w.connections, 'Stored Source Loop', 'Backfill Summary', 0); connect(w.connections, 'Stored Source Loop', 'Download Stored Content', 1);
  connect(w.connections, 'Download Stored Content', 'Restore Stored Source Context'); connect(w.connections, 'Restore Stored Source Context', 'Build Evidence Request');
  connect(w.connections, 'Build Evidence Request', 'OpenAI Evidence Extraction'); connect(w.connections, 'OpenAI Evidence Extraction', 'Parse and Verify Evidence');
  connect(w.connections, 'Parse and Verify Evidence', 'Record Evidence LLM Usage'); connect(w.connections, 'Record Evidence LLM Usage', 'Expand Evidence'); connect(w.connections, 'Expand Evidence', 'Evidence Loop');
  connect(w.connections, 'Evidence Loop', 'Backfill Source Complete', 0); connect(w.connections, 'Evidence Loop', 'Has Grounded Evidence?', 1);
  connect(w.connections, 'Has Grounded Evidence?', 'Persist Evidence via RPC', 0); connect(w.connections, 'Has Grounded Evidence?', 'Evidence Loop', 1);
  connect(w.connections, 'Persist Evidence via RPC', 'Restore Evidence Context'); connect(w.connections, 'Restore Evidence Context', 'Evidence Loop');
  connect(w.connections, 'Backfill Source Complete', 'Stored Source Loop'); connect(w.connections, 'Backfill Summary', 'Finalize Backfill Run');
  return w;
}

function buildCapitalRegistry() {
  const w = baseWorkflow('RE 03 - Capital and Entity Registry');
  w.nodes.push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', [0, 240], {}));
  w.nodes.push(node('Daily Capital Registry', 'n8n-nodes-base.scheduleTrigger', [0, 400], { rule: { interval: [{ field: 'days', daysInterval: 1 }] } }));
  w.nodes.push(code('Registry Configuration', [240, 320], `return [{ json: {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co', workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  model: 'gpt-6-luna', batch_size: 40, min_confidence: 0.55
} }];`));
  w.nodes.push(http('Load Grounded Evidence', [480, 320], {
    url: "={{ $('Registry Configuration').item.json.supabase_url + '/rest/v1/evidence' }}", authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', sendQuery: true,
    queryParameters: { parameters: [
      { name: 'select', value: 'id,workspace_id,source_id,evidence_type,claim_text,excerpt,confidence,verification_status,created_at' },
      { name: 'workspace_id', value: "=eq.{{ $('Registry Configuration').item.json.workspace_id }}" },
      { name: 'verification_status', value: 'in.(verified,unverified)' }, { name: 'order', value: 'created_at.desc' },
      { name: 'limit', value: "={{ $('Registry Configuration').item.json.batch_size }}" }
    ] }, options: { timeout: 30000 }
  }));
  w.nodes.push(code('Normalize Evidence Queue', [720, 320], `const config = $('Registry Configuration').first().json;
return $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json])
  .filter((row) => row?.id && Number(row.confidence) >= config.min_confidence)
  .map((row) => ({ json: { ...row, config } }));`));
  w.nodes.push(node('Evidence Graph Loop', 'n8n-nodes-base.splitInBatches', [960, 320], { batchSize: 1, options: {} }));
  w.nodes.push(code('Build Capital Graph Request', [1200, 440], `const evidence = $input.first().json;
const attribute = { type: 'object', additionalProperties: false, properties: {
  key: { type: 'string' }, value: { type: 'string' }
}, required: ['key','value'] };
const entity = { type: 'object', additionalProperties: false, properties: {
  entity_type: { type: 'string', enum: ['company','investor','fund','accelerator','person'] },
  name: { type: 'string' }, canonical_url: { type: 'string' }, role: { type: 'string' }, confidence: { type: 'number' },
  attributes: { type: 'array', maxItems: 16, items: attribute }
}, required: ['entity_type','name','canonical_url','role','confidence','attributes'] };
const relationship = { type: 'object', additionalProperties: false, properties: {
  from_entity: entity, to_entity: entity,
  relationship_type: { type: 'string', enum: ['invested_in','founded','partnered_with','acquired'] },
  valid_from: { type: 'string' }, confidence: { type: 'number' }, attributes: { type: 'array', maxItems: 16, items: attribute }
}, required: ['from_entity','to_entity','relationship_type','valid_from','confidence','attributes'] };
const schema = { type: 'object', additionalProperties: false, properties: {
  entities: { type: 'array', maxItems: 12, items: entity }, relationships: { type: 'array', maxItems: 8, items: relationship }
}, required: ['entities','relationships'] };
return [{ json: { ...evidence, openai_request: { model: evidence.config.model, store: false, max_output_tokens: 1800,
  instructions: 'Build a capital graph using only explicitly named companies, investors, funds, accelerators, and people. A named entity must be a proper name appearing verbatim in the claim or exact excerpt. Never create entities from generic concepts, categories, report titles, article titles, metrics, financing types, stages, or market descriptions. Return an empty graph when no named capital actor is present. Return canonical_url and valid_from as empty strings when absent. Encode attributes as key/value string pairs. Use invested_in only when an explicitly named investor, fund, or accelerator invested in an explicitly named company. Use founded only for a named person and named company, acquired only between named companies, and partnered_with only when the partnership is explicit. Investment attributes may contain amount, currency, stage, lead, announced_at, geography, sector, and thesis_tags. Never infer missing parties, amounts, dates, or relationships.',
  input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify({ claim: evidence.claim_text, exact_excerpt: evidence.excerpt }) }] }],
  text: { format: { type: 'json_schema', name: 'capital_entity_graph', strict: true, schema } }
} } }];`));
  const openai = sourceNode('OpenAI Evidence Extraction'); openai.name = 'OpenAI Capital Graph Extraction'; openai.id = id(openai.name); openai.position = [1440, 440]; w.nodes.push(openai);
  w.nodes.push(code('Parse Capital Graph', [1680, 440], `const evidence = $('Build Capital Graph Request').item.json;
const response = $input.first().json ?? {};
if (response.error) {
  const message = response.error.description || response.error.message || 'OPENAI_CAPITAL_GRAPH_REQUEST_FAILED';
  throw new Error('OPENAI_CAPITAL_GRAPH_REQUEST_FAILED: ' + message);
}
const text = (response.output ?? []).flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
if (!text) throw new Error('OPENAI_CAPITAL_GRAPH_OUTPUT_MISSING');
let parsed;
try { parsed = JSON.parse(text); }
catch { throw new Error('OPENAI_CAPITAL_GRAPH_OUTPUT_INVALID_JSON'); }
if (!Array.isArray(parsed.entities) || !Array.isArray(parsed.relationships)) throw new Error('OPENAI_CAPITAL_GRAPH_OUTPUT_INVALID_SHAPE');
const attributesObject = (items) => Object.fromEntries((Array.isArray(items) ? items : [])
  .filter((item) => item && typeof item.key === 'string' && item.key.trim())
  .map((item) => [item.key.trim().slice(0, 100), String(item.value ?? '').slice(0, 1000)]));
const normalizeEntity = (entity) => ({ ...entity, canonical_url: entity.canonical_url || null, attributes: attributesObject(entity.attributes) });
const allowedEntityTypes = new Set(['company','investor','fund','accelerator','person']);
const genericNames = /^(market|industry|sector|funding|financing|funding round|investment|investments|investors|companies|startups|portfolio companies|follow-on financings|first financings|seed|series [a-z]|venture capital)$/i;
const evidenceText = (String(evidence.claim_text ?? '') + ' ' + String(evidence.excerpt ?? '')).toLowerCase();
const rejectedEntities = [];
const entities = parsed.entities.map(normalizeEntity).filter((entity) => {
  const name = String(entity.name ?? '').trim();
  const accepted = allowedEntityTypes.has(entity.entity_type) && name.length >= 2 && !genericNames.test(name) && evidenceText.includes(name.toLowerCase()) && Number(entity.confidence ?? 0) >= 0.65;
  if (!accepted) rejectedEntities.push({ name, reason: 'ENTITY_QUALITY_GATE' });
  return accepted;
});
const entityKey = (entity) => String(entity.entity_type) + ':' + String(entity.name ?? '').trim().toLowerCase();
const acceptedKeys = new Set(entities.map(entityKey));
let rejectedRelationships = 0;
const relationships = parsed.relationships.map((relationship) => ({
  ...relationship,
  from_entity: normalizeEntity(relationship.from_entity),
  to_entity: normalizeEntity(relationship.to_entity),
  valid_from: relationship.valid_from || null,
  attributes: attributesObject(relationship.attributes)
})).filter((relationship) => {
  const fromAccepted = acceptedKeys.has(entityKey(relationship.from_entity));
  const toAccepted = acceptedKeys.has(entityKey(relationship.to_entity));
  const typeValid = (
    relationship.relationship_type === 'invested_in' && ['investor','fund','accelerator'].includes(relationship.from_entity.entity_type) && relationship.to_entity.entity_type === 'company'
  ) || (
    relationship.relationship_type === 'founded' && relationship.from_entity.entity_type === 'person' && relationship.to_entity.entity_type === 'company'
  ) || (
    relationship.relationship_type === 'acquired' && relationship.from_entity.entity_type === 'company' && relationship.to_entity.entity_type === 'company'
  ) || relationship.relationship_type === 'partnered_with';
  const accepted = fromAccepted && toAccepted && typeValid && Number(relationship.confidence ?? 0) >= 0.65;
  if (!accepted) rejectedRelationships++;
  return accepted;
});
return [{ json: { p_graph: { workspace_id: evidence.workspace_id, evidence_id: evidence.id,
  entities, relationships }, quality: { entities_rejected: rejectedEntities.length, relationships_rejected: rejectedRelationships } } }];`));
  w.nodes.push(http('Upsert Capital Graph', [1920, 440], {
    method: 'POST', url: "={{ $('Registry Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_upsert_research_graph' }}",
    authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi', sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' }] },
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ p_graph: $json.p_graph }) }}', options: { timeout: 30000 }
  }));
  w.nodes.push(code('Registry Item Complete', [2160, 440], `const response = $input.first().json ?? {};
const result = Array.isArray(response) ? (response[0] ?? {}) : response;
return [{ json: {
  completed: true,
  entities_upserted: Number(result.entities_upserted ?? 0),
  relationships_upserted: Number(result.relationships_upserted ?? 0),
  entities_rejected: Number($('Parse Capital Graph').item.json.quality?.entities_rejected ?? 0),
  relationships_rejected: Number($('Parse Capital Graph').item.json.quality?.relationships_rejected ?? 0),
  empty_graph: Number(result.entities_upserted ?? 0) === 0 && Number(result.relationships_upserted ?? 0) === 0
} }];`));
  w.nodes.push(code('Registry Summary', [1200, 200], `const rows = $input.all().map((item) => item.json ?? {});
return [{ json: {
  status: 'completed',
  evidence_processed: rows.length,
  entities_upserted: rows.reduce((sum, row) => sum + Number(row.entities_upserted ?? 0), 0),
  relationships_upserted: rows.reduce((sum, row) => sum + Number(row.relationships_upserted ?? 0), 0),
  entities_rejected: rows.reduce((sum, row) => sum + Number(row.entities_rejected ?? 0), 0),
  relationships_rejected: rows.reduce((sum, row) => sum + Number(row.relationships_rejected ?? 0), 0),
  evidence_with_empty_graph: rows.filter((row) => row.empty_graph).length
} }];`));
  connect(w.connections, 'Manual Trigger', 'Registry Configuration'); connect(w.connections, 'Daily Capital Registry', 'Registry Configuration');
  connect(w.connections, 'Registry Configuration', 'Load Grounded Evidence'); connect(w.connections, 'Load Grounded Evidence', 'Normalize Evidence Queue'); connect(w.connections, 'Normalize Evidence Queue', 'Evidence Graph Loop');
  connect(w.connections, 'Evidence Graph Loop', 'Registry Summary', 0); connect(w.connections, 'Evidence Graph Loop', 'Build Capital Graph Request', 1);
  connect(w.connections, 'Build Capital Graph Request', 'OpenAI Capital Graph Extraction'); connect(w.connections, 'OpenAI Capital Graph Extraction', 'Parse Capital Graph');
  connect(w.connections, 'Parse Capital Graph', 'Upsert Capital Graph'); connect(w.connections, 'Upsert Capital Graph', 'Registry Item Complete'); connect(w.connections, 'Registry Item Complete', 'Evidence Graph Loop');
  return w;
}

fs.writeFileSync(path.join(__dirname, 'evidence_backfill.json'), JSON.stringify(buildBackfill(), null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'capital_entity_registry.json'), JSON.stringify(buildCapitalRegistry(), null, 2) + '\n');
console.log(path.join(__dirname, 'evidence_backfill.json'));
console.log(path.join(__dirname, 'capital_entity_registry.json'));
