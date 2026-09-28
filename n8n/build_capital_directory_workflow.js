const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const researchWorkflow = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'Research Engine_multisource_v2.json'), 'utf8'),
);
const supabaseCredential = structuredClone(
  researchWorkflow.nodes.find((node) => node.name === 'Create Research Run').credentials.supabaseApi,
);

const stableId = (name) => {
  const left = crypto.createHash('sha1').update(name).digest('hex');
  const right = crypto.createHash('sha1').update(`capital-directory:${name}`).digest('hex');
  return `${left.slice(0, 8)}-0000-4000-8000-${right.slice(0, 12)}`;
};
const versions = {
  'n8n-nodes-base.code': 2,
  'n8n-nodes-base.if': 2.2,
  'n8n-nodes-base.httpRequest': 4.2,
  'n8n-nodes-base.manualTrigger': 1,
  'n8n-nodes-base.scheduleTrigger': 1.2,
  'n8n-nodes-base.splitInBatches': 3,
};
const node = (name, type, position, parameters, extra = {}) => ({
  id: stableId(name),
  name,
  type,
  typeVersion: versions[type],
  position,
  parameters,
  ...extra,
});
const code = (name, position, jsCode) => node(
  name,
  'n8n-nodes-base.code',
  position,
  { mode: 'runOnceForAllItems', jsCode },
);
const connect = (workflow, from, to, output = 0) => {
  workflow.connections[from] ??= { main: [] };
  while (workflow.connections[from].main.length <= output) workflow.connections[from].main.push([]);
  workflow.connections[from].main[output].push({ node: to, type: 'main', index: 0 });
};

const workflow = {
  name: 'RE 04 - Capital Directory Refresh',
  nodes: [],
  connections: {},
  pinData: {},
  active: false,
  tags: [],
  settings: {
    executionOrder: 'v1',
    saveManualExecutions: true,
    saveExecutionProgress: true,
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'all',
    executionTimeout: 1800,
  },
};

workflow.nodes.push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', [0, 240], {}));
workflow.nodes.push(node('Every Four Weeks', 'n8n-nodes-base.scheduleTrigger', [0, 400], {
  rule: { interval: [{ field: 'weeks', weeksInterval: 4 }] },
}));
workflow.nodes.push(code('Directory Configuration', [240, 320], `return [{ json: {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co',
  workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  countries: [{ name: 'India', wikidata_qid: 'Q668' }],
  entity_classes: [
    { entity_type: 'investor', name: 'venture capital firm', wikidata_qid: 'Q3487908' },
    { entity_type: 'accelerator', name: 'startup accelerator', wikidata_qid: 'Q4086495' }
  ],
  max_results_per_class: 150,
  registry_version: 'capital-directory-v1.0.0'
} }];`));
workflow.nodes.push(code('Build Wikidata Registry Jobs', [480, 320], `const config = $input.first().json;
const safeQid = (value) => /^Q[1-9][0-9]*$/.test(String(value ?? '')) ? String(value) : null;
const limit = Math.max(1, Math.min(250, Number(config.max_results_per_class ?? 100)));
const jobs = [];
for (const country of (config.countries ?? [])) {
  const countryQid = safeQid(country.wikidata_qid);
  if (!countryQid) continue;
  for (const entityClass of (config.entity_classes ?? [])) {
    const classQid = safeQid(entityClass.wikidata_qid);
    if (!classQid || !['investor', 'accelerator'].includes(entityClass.entity_type)) continue;
    const sparql = [
      'SELECT DISTINCT ?entity ?entityLabel ?website ?inception ?headquartersLabel WHERE {',
      '  ?entity wdt:P31/wdt:P279* wd:' + classQid + ' .',
      '  { ?entity wdt:P17 wd:' + countryQid + ' . }',
      '  UNION',
      '  { ?entity wdt:P159 ?headquarters . ?headquarters wdt:P17 wd:' + countryQid + ' . }',
      '  OPTIONAL { ?entity wdt:P856 ?website . }',
      '  OPTIONAL { ?entity wdt:P571 ?inception . }',
      '  OPTIONAL { ?entity wdt:P159 ?headquarters . }',
      '  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }',
      '}',
      'LIMIT ' + limit
    ].join('\\n');
    jobs.push({
      config,
      country_name: String(country.name ?? countryQid),
      country_qid: countryQid,
      entity_type: entityClass.entity_type,
      class_name: String(entityClass.name ?? classQid),
      class_qid: classQid,
      sparql
    });
  }
}
if (!jobs.length) throw new Error('NO_VALID_CAPITAL_DIRECTORY_JOBS');
return jobs.map((job) => ({ json: job }));`));
workflow.nodes.push(node('Registry Job Loop', 'n8n-nodes-base.splitInBatches', [720, 320], {
  batchSize: 1,
  options: {},
}));
workflow.nodes.push(node('Wikidata SPARQL', 'n8n-nodes-base.httpRequest', [960, 440], {
  url: 'https://query.wikidata.org/sparql',
  sendHeaders: true,
  headerParameters: { parameters: [
    { name: 'Accept', value: 'application/sparql-results+json' },
    { name: 'User-Agent', value: 'AI-Intelligence-Research/1.0 (https://github.com/dbakshatjain23-ux/AI-Intelligence)' },
  ] },
  sendQuery: true,
  queryParameters: { parameters: [
    { name: 'query', value: '={{ $json.sparql }}' },
    { name: 'format', value: 'json' },
  ] },
  options: { timeout: 60000, response: { response: { responseFormat: 'json' } } },
}, {
  retryOnFail: true,
  maxTries: 2,
  waitBetweenTries: 60000,
  alwaysOutputData: true,
  onError: 'continueRegularOutput',
}));
workflow.nodes.push(code('Normalize Wikidata Candidates', [1200, 440], `const job = $('Registry Job Loop').item.json;
const response = $input.first().json ?? {};
const bindings = Array.isArray(response.results?.bindings) ? response.results.bindings : [];
const clean = (value, max = 500) => String(value ?? '').replace(/\\s+/g, ' ').trim().slice(0, max);
const candidates = [];
const seen = new Set();
for (const row of bindings) {
  const wikidataUrl = clean(row.entity?.value, 1000);
  const qid = wikidataUrl.match(/\\/(Q[1-9][0-9]*)$/)?.[1];
  const name = clean(row.entityLabel?.value);
  if (!qid || !name || name === qid || seen.has(qid)) continue;
  seen.add(qid);
  const website = clean(row.website?.value, 1000);
  const inception = clean(row.inception?.value, 100);
  candidates.push({
    registry_candidate: true,
    provider: 'wikidata',
    p_entity: {
      workspace_id: job.config.workspace_id,
      entity_type: job.entity_type,
      name,
      canonical_url: /^https?:\\/\\//i.test(website) ? website : wikidataUrl,
      external_ids: { wikidata_qid: qid },
      attributes: {
        registry_source: 'wikidata',
        registry_status: 'candidate_unverified',
        registry_version: job.config.registry_version,
        registry_country: job.country_name,
        registry_country_qid: job.country_qid,
        registry_class: job.class_name,
        registry_class_qid: job.class_qid,
        registry_last_seen_at: new Date().toISOString(),
        ...(inception ? { inception } : {}),
        ...(clean(row.headquartersLabel?.value) ? { headquarters: clean(row.headquartersLabel.value) } : {})
      }
    }
  });
}
if (!candidates.length) {
  return [{ json: {
    registry_candidate: false,
    provider: 'wikidata',
    provider_error: response.error ? 'WIKIDATA_REQUEST_FAILED' : 'NO_WIKIDATA_RESULTS',
    country_name: job.country_name,
    entity_type: job.entity_type
  } }];
}
return candidates.map((candidate) => ({ json: candidate }));`));
workflow.nodes.push(node('Registry Candidate Loop', 'n8n-nodes-base.splitInBatches', [1440, 440], {
  batchSize: 1,
  options: {},
}));
workflow.nodes.push(node('Is Registry Candidate?', 'n8n-nodes-base.if', [1680, 560], {
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
    conditions: [{
      id: stableId('registry-candidate-condition'),
      leftValue: '={{ $json.registry_candidate }}',
      rightValue: true,
      operator: { type: 'boolean', operation: 'true', singleValue: true },
    }],
    combinator: 'and',
  },
  options: {},
}));
workflow.nodes.push(node('Upsert Directory Entity', 'n8n-nodes-base.httpRequest', [1920, 480], {
  method: 'POST',
  url: "={{ $('Directory Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_upsert_research_entity' }}",
  authentication: 'predefinedCredentialType',
  nodeCredentialType: 'supabaseApi',
  sendHeaders: true,
  headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'Prefer', value: 'return=representation' },
  ] },
  sendBody: true,
  specifyBody: 'json',
  jsonBody: '={{ JSON.stringify({ p_entity: $json.p_entity }) }}',
  options: { timeout: 30000 },
}, {
  credentials: { supabaseApi: supabaseCredential },
  retryOnFail: true,
  maxTries: 2,
  waitBetweenTries: 1000,
}));
workflow.nodes.push(code('Directory Candidate Complete', [2160, 480], `const candidate = $('Is Registry Candidate?').item.json;
const response = $input.first().json ?? {};
const result = Array.isArray(response) ? (response[0] ?? {}) : response;
return [{ json: {
  completed: true,
  provider: candidate.provider,
  entity_id: result.entity_id ?? null,
  entity_type: result.entity_type ?? candidate.p_entity?.entity_type ?? null,
  wikidata_qid: candidate.p_entity?.external_ids?.wikidata_qid ?? null
} }];`));
workflow.nodes.push(code('Skipped Directory Candidate', [1920, 680], `return $input.all().map((item) => ({ json: {
  completed: false,
  skipped: true,
  provider: item.json.provider ?? 'wikidata',
  provider_error: item.json.provider_error ?? 'INVALID_REGISTRY_CANDIDATE'
} }));`));
workflow.nodes.push(code('Directory Job Complete', [1680, 280], `const rows = $input.all().map((item) => item.json ?? {});
return [{ json: {
  completed: true,
  candidates_upserted: rows.filter((row) => row.completed === true).length,
  candidates_skipped: rows.filter((row) => row.skipped === true).length,
  provider_errors: [...new Set(rows.map((row) => row.provider_error).filter(Boolean))]
} }];`));
workflow.nodes.push(code('Capital Directory Summary', [960, 160], `const rows = $input.all().map((item) => item.json ?? {});
const providerErrors = [...new Set(rows.flatMap((row) => row.provider_errors ?? []).filter(Boolean))];
return [{ json: {
  status: providerErrors.length && rows.every((row) => Number(row.candidates_upserted ?? 0) === 0) ? 'failed' : (providerErrors.length ? 'partial' : 'completed'),
  registry_jobs_processed: rows.length,
  candidates_upserted: rows.reduce((sum, row) => sum + Number(row.candidates_upserted ?? 0), 0),
  candidates_skipped: rows.reduce((sum, row) => sum + Number(row.candidates_skipped ?? 0), 0),
  provider_errors: providerErrors,
  activity_claims_created: 0,
  note: 'Directory entries remain candidate_unverified until supported by recent grounded capital evidence.'
} }];`));

connect(workflow, 'Manual Trigger', 'Directory Configuration');
connect(workflow, 'Every Four Weeks', 'Directory Configuration');
connect(workflow, 'Directory Configuration', 'Build Wikidata Registry Jobs');
connect(workflow, 'Build Wikidata Registry Jobs', 'Registry Job Loop');
connect(workflow, 'Registry Job Loop', 'Capital Directory Summary', 0);
connect(workflow, 'Registry Job Loop', 'Wikidata SPARQL', 1);
connect(workflow, 'Wikidata SPARQL', 'Normalize Wikidata Candidates');
connect(workflow, 'Normalize Wikidata Candidates', 'Registry Candidate Loop');
connect(workflow, 'Registry Candidate Loop', 'Directory Job Complete', 0);
connect(workflow, 'Registry Candidate Loop', 'Is Registry Candidate?', 1);
connect(workflow, 'Is Registry Candidate?', 'Upsert Directory Entity', 0);
connect(workflow, 'Is Registry Candidate?', 'Skipped Directory Candidate', 1);
connect(workflow, 'Upsert Directory Entity', 'Directory Candidate Complete');
connect(workflow, 'Directory Candidate Complete', 'Registry Candidate Loop');
connect(workflow, 'Skipped Directory Candidate', 'Registry Candidate Loop');
connect(workflow, 'Directory Job Complete', 'Registry Job Loop');

const outputPath = path.join(__dirname, 'capital_directory_refresh.json');
fs.writeFileSync(outputPath, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(outputPath);
