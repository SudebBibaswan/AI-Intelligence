const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const patternWorkflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_pattern_engine.json'), 'utf8'));
const supabaseCredential = structuredClone(patternWorkflow.nodes.find((node) => node.name === 'Load Accepted Observations').credentials.supabaseApi);
const openAiCredential = structuredClone(patternWorkflow.nodes.find((node) => node.name === 'OpenAI Pattern Synthesis').credentials.openAiApi);
const stableId = (name) => {
  const digest = crypto.createHash('sha1').update(`verified-capital-flow-engine:${name}`).digest('hex');
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
  name: 'RE-Capital - Verified Capital Flow Engine', nodes: [], connections: {}, pinData: {}, active: false, tags: [],
  settings: { executionOrder: 'v1', saveManualExecutions: true, saveExecutionProgress: true,
    saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', executionTimeout: 1800 },
};

workflow.nodes.push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', [0, 240], {}));
workflow.nodes.push(node('Daily Capital Flow', 'n8n-nodes-base.scheduleTrigger', [0, 400], {
  rule: { interval: [{ field: 'days', daysInterval: 1 }] },
}));
workflow.nodes.push(code('Capital Flow Configuration', [240, 320], `return [{ json: {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co',
  workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  workspace_domain_id: '11068f00-2e6b-462c-b455-c69384e5e8a8',
  min_pattern_strength: 0.5,
  max_patterns: 50,
  model: 'gpt-6-luna',
  engine_version: 'capital-flow-engine-v1.0.0'
} }];`));
workflow.nodes.push(node('Load Pattern-Entity Candidates', 'n8n-nodes-base.httpRequest', [480, 320], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/rpc/n8n_list_capital_flow_candidates' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json',
  jsonBody: '={{ JSON.stringify({ p_workspace_id: $json.workspace_id, p_workspace_domain_id: $json.workspace_domain_id, p_min_pattern_strength: $json.min_pattern_strength, p_max_patterns: $json.max_patterns }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Group by Entity', [720, 320], `const config = $('Capital Flow Configuration').first().json;
const rows = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json])
  .filter((row) => row && row.pattern_id && row.entity_id);
if (!rows.length) return [{ json: { config, no_matches: true, entity_items: [] } }];
const groups = new Map();
for (const row of rows) {
  const key = row.entity_id;
  if (!groups.has(key)) groups.set(key, { config, no_matches: false, workspace_id: config.workspace_id,
    workspace_domain_id: config.workspace_domain_id, entity_id: key, entity_name: row.entity_name,
    entity_type: row.entity_type, entity_metadata: row.entity_metadata, pattern_items: [] });
  groups.get(key).pattern_items.push({ pattern_id: row.pattern_id, pattern_type: row.pattern_type,
    pattern_title: row.pattern_title, pattern_statement: row.pattern_statement,
    pattern_strength_score: row.pattern_strength_score, pattern_persistence_score: row.pattern_persistence_score,
    pattern_diversity_score: row.pattern_diversity_score, pattern_confidence: row.pattern_confidence,
    pattern_status: row.pattern_status, time_window_start: row.time_window_start,
    time_window_end: row.time_window_end, observation_count: row.observation_count,
    source_family_count: row.source_family_count, event_entity_count: row.event_entity_count,
    thesis_id: row.thesis_id, thesis_type: row.thesis_type, thesis_statement: row.thesis_statement,
    thesis_confidence: row.thesis_confidence, thesis_methodology: row.thesis_methodology,
    match_type: row.match_type, match_confidence: row.match_confidence });
}
return [...groups.values()].map((pack) => ({ json: { ...pack, pattern_count: pack.pattern_items.length } }));`));
workflow.nodes.push(node('Entity Capital Flow Loop', 'n8n-nodes-base.splitInBatches', [960, 320], { batchSize: 1, options: {} }));
workflow.nodes.push(condition('Has Pattern Matches?', [1200, 440],
  '={{ $json.no_matches !== true && $json.pattern_items.length >= 1 }}'));
workflow.nodes.push(code('Build Capital Flow Request', [1440, 340], `const pack = $input.first().json;
const mapping = { type: 'object', additionalProperties: false, properties: {
  pattern_id: { type: 'string' }, entity_id: { type: 'string' }, thesis_id: { type: 'string' },
  match_type: { type: 'string', enum: ['revealed_thesis_match','stated_thesis_match','pattern_entity_overlap','thesis_driven'] },
  match_confidence: { type: 'number' }, capital_direction: { type: 'string', enum: ['inflow','outflow','bidirectional'] },
  sector_tags: { type: 'array', items: { type: 'string' } },
  stage_tags: { type: 'array', items: { type: 'string' } },
  geography_tags: { type: 'array', items: { type: 'string' } },
  check_size_min_usd: { type: 'number' }, check_size_max_usd: { type: 'number' },
  deal_count: { type: 'integer' }, confidence: { type: 'number' }
}, required: ['pattern_id','entity_id','match_type','match_confidence','capital_direction','confidence'] };
const schema = { type: 'object', additionalProperties: false, properties: {
  mappings: { type: 'array', maxItems: 10, items: mapping }
}, required: ['mappings'] };
const entityPack = { entity_name: pack.entity_name, entity_type: pack.entity_type,
  entity_metadata: pack.entity_metadata, pattern_items: pack.pattern_items };
return [{ json: { ...pack, openai_request: { model: pack.config.model, store: false, max_output_tokens: 2000,
  instructions: 'Map patterns to this VC/YC entity. For each pattern, determine capital direction (inflow=entity invests in this pattern, outflow=entity divests, bidirectional=both). Infer sector/stage/geography tags. Estimate check sizes and deal count from thesis methodology. Return high-confidence mappings only.',
  input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(entityPack) }] }],
  text: { format: { type: 'json_schema', name: 'entity_capital_flow_mappings', strict: true, schema } }
} } }];`));
workflow.nodes.push(node('OpenAI Capital Flow Mapping', 'n8n-nodes-base.httpRequest', [1680, 340], {
  method: 'POST', url: 'https://api.openai.com/v1/responses', authentication: 'predefinedCredentialType',
  nodeCredentialType: 'openAiApi', sendHeaders: true,
  headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.openai_request) }}',
  options: { timeout: 90000 },
}, { credentials: { openAiApi: openAiCredential }, retryOnFail: true, maxTries: 2,
  waitBetweenTries: 1000, alwaysOutputData: true, onError: 'continueRegularOutput' }));
workflow.nodes.push(code('Validate Capital Flow Mappings', [1920, 340], `const pack = $('Build Capital Flow Request').item.json;
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
const valid = [];
let rejected = 0;
for (const candidate of (Array.isArray(parsed?.mappings) ? parsed.mappings : [])) {
  const patternRef = patternById.get(candidate.pattern_id);
  if (!patternRef) { rejected++; continue; }
  const matchType = ['revealed_thesis_match','stated_thesis_match','pattern_entity_overlap','thesis_driven'].includes(candidate.match_type)
    ? candidate.match_type : 'pattern_entity_overlap';
  const capitalDirection = ['inflow','outflow','bidirectional'].includes(candidate.capital_direction)
    ? candidate.capital_direction : 'inflow';
  const matchConfidence = Math.max(0, Math.min(1, Number(candidate.match_confidence ?? 0)));
  const confidence = Math.max(0, Math.min(1, Number(candidate.confidence ?? 0)));
  const sectorTags = (Array.isArray(candidate.sector_tags) ? candidate.sector_tags : []).map(t => normalizeText(t, 100)).filter(Boolean);
  const stageTags = (Array.isArray(candidate.stage_tags) ? candidate.stage_tags : []).map(t => normalizeText(t, 100)).filter(Boolean);
  const geographyTags = (Array.isArray(candidate.geography_tags) ? candidate.geography_tags : []).map(t => normalizeText(t, 100)).filter(Boolean);
  const dealCount = Math.max(1, Number(candidate.deal_count ?? 1));
  const checkMin = candidate.check_size_min_usd ? Math.max(0, Number(candidate.check_size_min_usd)) : null;
  const checkMax = candidate.check_size_max_usd ? Math.max(0, Number(candidate.check_size_max_usd)) : null;
  if (matchConfidence < 0.4 || confidence < 0.4) { rejected++; continue; }
  valid.push({ p_mapping: { workspace_id: pack.workspace_id, workspace_domain_id: pack.workspace_domain_id,
    pattern_id: candidate.pattern_id, entity_id: pack.entity_id,
    thesis_id: candidate.thesis_id ?? null, match_type: matchType,
    match_confidence: matchConfidence, capital_direction: capitalDirection,
    sector_tags: sectorTags, stage_tags: stageTags, geography_tags: geographyTags,
    check_size_min_usd: checkMin, check_size_max_usd: checkMax, deal_count: dealCount,
    confidence: confidence,
    engine_version: pack.config.engine_version, metadata: { generation_mode: 'capital_flow_mapping',
      entity_name: pack.entity_name, input_pattern_count: 1 } }
  });
}
if (!valid.length) return [{ json: { no_mapping: true, entity_id: pack.entity_id, entity_name: pack.entity_name,
  candidates_rejected: rejected, openai_calls: 1 } }];
return valid.map((item) => ({ json: { ...item, no_mapping: false, candidates_rejected: rejected, openai_calls: 1 } }));`));
workflow.nodes.push(node('Mapping Loop', 'n8n-nodes-base.splitInBatches', [2160, 340], { batchSize: 1, options: {} }));
workflow.nodes.push(condition('Has Valid Mapping?', [2400, 460],
  '={{ $json.no_mapping !== true && Boolean($json.p_mapping) }}'));
workflow.nodes.push(node('Persist Capital Flow Mapping', 'n8n-nodes-base.httpRequest', [2640, 340], {
  method: 'POST',
  url: "={{ $('Capital Flow Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_upsert_capital_flow_mapping' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ p_mapping: $json.p_mapping }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: supabaseCredential }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Mapping Complete', [2880, 340], `const response = $input.first().json ?? {};
const result = Array.isArray(response) ? (response[0] ?? {}) : response;
return [{ json: { completed: true, mapping_id: result.mapping_id ?? null,
  pattern_id: result.pattern_id ?? null, entity_id: result.entity_id ?? null,
  match_type: result.match_type ?? null, confidence: Number(result.confidence ?? 0) } }];`));
workflow.nodes.push(code('Skipped Mapping', [2640, 580], `const row = $input.first().json;
return [{ json: { completed: false, skipped: true, entity_id: row.entity_id, entity_name: row.entity_name,
  candidates_rejected: Number(row.candidates_rejected ?? 0), openai_calls: Number(row.openai_calls ?? 0) } }];`));
workflow.nodes.push(code('Entity Capital Flow Complete', [2400, 180], `const rows = $input.all().map((item) => item.json ?? {});
const completed = rows.filter(r => r.completed);
return [{ json: { entity_completed: true, entity_id: rows[0]?.entity_id, entity_name: rows[0]?.entity_name,
  mappings_persisted: completed.length, new_mappings: completed.filter(r => r.is_new).length,
  candidates_rejected: rows.reduce((sum, r) => sum + Number(r.candidates_rejected ?? 0), 0),
  openai_calls: rows.reduce((sum, r) => sum + Number(r.openai_calls ?? 0), 0) } }];`));
workflow.nodes.push(code('No Matches Entity Complete', [1440, 600], `return [{ json: { entity_completed: true, no_matches: true, entity_id: $json.entity_id, entity_name: $json.entity_name,
  mappings_persisted: 0 } }];`));
workflow.nodes.push(code('Capital Flow Engine Summary', [1200, 120], `const rows = $input.all().map((item) => item.json ?? {});
return [{ json: { status: 'completed',
  entities_processed: rows.filter(r => !r.no_matches).length,
  no_matches_entities: rows.filter(r => r.no_matches).length,
  mappings_persisted: rows.reduce((sum, r) => sum + Number(r.mappings_persisted ?? 0), 0),
  new_mappings: rows.reduce((sum, r) => sum + Number(r.new_mappings ?? 0), 0),
  candidates_rejected: rows.reduce((sum, r) => sum + Number(r.candidates_rejected ?? 0), 0),
  openai_calls: rows.reduce((sum, r) => sum + Number(r.openai_calls ?? 0), 0),
  output_status: 'draft', note: 'Capital flow mapping complete. Patterns mapped to VC/YC entities with capital direction, sector/stage/geography tags, and check size estimates.' } }];`));

connect(workflow, 'Manual Trigger', 'Capital Flow Configuration');
connect(workflow, 'Daily Capital Flow', 'Capital Flow Configuration');
connect(workflow, 'Capital Flow Configuration', 'Load Pattern-Entity Candidates');
connect(workflow, 'Load Pattern-Entity Candidates', 'Group by Entity');
connect(workflow, 'Group by Entity', 'Entity Capital Flow Loop');
connect(workflow, 'Entity Capital Flow Loop', 'Capital Flow Engine Summary', 0);
connect(workflow, 'Entity Capital Flow Loop', 'Has Pattern Matches?', 1);
connect(workflow, 'Has Pattern Matches?', 'Build Capital Flow Request', 0);
connect(workflow, 'Has Pattern Matches?', 'No Matches Entity Complete', 1);
connect(workflow, 'Build Capital Flow Request', 'OpenAI Capital Flow Mapping');
connect(workflow, 'OpenAI Capital Flow Mapping', 'Validate Capital Flow Mappings');
connect(workflow, 'Validate Capital Flow Mappings', 'Mapping Loop');
connect(workflow, 'Mapping Loop', 'Entity Capital Flow Complete', 0);
connect(workflow, 'Mapping Loop', 'Has Valid Mapping?', 1);
connect(workflow, 'Has Valid Mapping?', 'Persist Capital Flow Mapping', 0);
connect(workflow, 'Has Valid Mapping?', 'Skipped Mapping', 1);
connect(workflow, 'Persist Capital Flow Mapping', 'Mapping Complete');
connect(workflow, 'Mapping Complete', 'Entity Capital Flow Complete');
connect(workflow, 'Skipped Mapping', 'Entity Capital Flow Complete');
connect(workflow, 'Entity Capital Flow Complete', 'Entity Capital Flow Loop');
connect(workflow, 'No Matches Entity Complete', 'Entity Capital Flow Loop');

const output = path.join(__dirname, 'verified_capital_flow_engine.json');
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(output);