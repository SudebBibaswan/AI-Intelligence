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
  const digest = crypto.createHash('sha1').update(`sebi-registry:${name}`).digest('hex');
  return `${digest.slice(0, 8)}-0000-4000-8000-${digest.slice(8, 20)}`;
};
const versions = {
  'n8n-nodes-base.code': 2,
  'n8n-nodes-base.extractFromFile': 1,
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
  name: 'RE 05 - SEBI Regulated Capital Registry',
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
workflow.nodes.push(code('SEBI Registry Configuration', [240, 320], `return [{ json: {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co',
  workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  country: 'India',
  registry_source_url: 'https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=21',
  registry_export_url: 'https://www.sebi.gov.in/sebiweb/other/IntmExportAction.do?intmId=21',
  registry_version: 'sebi-vcf-registry-v1.0.0',
  max_rows: 500
} }];`));
workflow.nodes.push(node('Download SEBI VCF Registry', 'n8n-nodes-base.httpRequest', [500, 320], {
  url: "={{ $('SEBI Registry Configuration').item.json.registry_export_url }}",
  sendHeaders: true,
  headerParameters: { parameters: [
    { name: 'Accept', value: 'application/vnd.ms-excel' },
    { name: 'User-Agent', value: 'AI-Intelligence-Research/1.0 (https://github.com/dbakshatjain23-ux/AI-Intelligence)' },
  ] },
  options: {
    timeout: 60000,
    response: { response: { responseFormat: 'file', outputPropertyName: 'data' } },
  },
}, {
  retryOnFail: true,
  maxTries: 2,
  waitBetweenTries: 60000,
}));
workflow.nodes.push(node('Extract SEBI Spreadsheet', 'n8n-nodes-base.extractFromFile', [760, 320], {
  operation: 'xls',
  binaryPropertyName: 'data',
  options: {},
}));
workflow.nodes.push(code('Normalize SEBI Funds', [1020, 320], `const config = $('SEBI Registry Configuration').first().json;
const rows = $input.all().map((item) => item.json ?? {}).slice(0, Math.max(1, Math.min(1000, Number(config.max_rows ?? 500))));
const clean = (value, max = 2000) => String(value ?? '').replace(/\\s+/g, ' ').trim().slice(0, max);
const lookup = (row, ...names) => {
  const entries = Object.entries(row);
  for (const name of names) {
    const match = entries.find(([key]) => clean(key).toLowerCase() === name.toLowerCase());
    if (match) return match[1];
  }
  return '';
};
const deduplicated = new Map();
let invalidRows = 0;
for (const row of rows) {
  const name = clean(lookup(row, 'Name'));
  const registrationNumber = clean(lookup(row, 'Registration No.', 'Registration No')).toUpperCase();
  if (!name || !/^IN\\/(VCF|VC)\\/[0-9]{2}-[0-9]{2}\\/[0-9]+$/.test(registrationNumber)) {
    invalidRows++;
    continue;
  }
  const validity = clean(lookup(row, 'Validity'));
  const registrationFrom = clean(lookup(row, 'From'));
  const registrationTo = clean(lookup(row, 'To'));
  const address = clean(lookup(row, 'Address'));
  const city = clean(lookup(row, 'City'));
  const state = clean(lookup(row, 'State'));
  const pincode = clean(lookup(row, 'Pincode'));
  const key = registrationNumber;
  deduplicated.set(key, {
    registration_number: registrationNumber,
    workspace_id: config.workspace_id,
    entity_type: 'fund',
    name,
    canonical_url: null,
    external_ids: { sebi_registration_no: registrationNumber },
    attributes: {
      registry_source: 'sebi',
      registry_source_url: config.registry_source_url,
      registry_country: config.country,
      registry_status: 'regulated_identity',
      regulatory_status: 'registered',
      activity_verification_status: 'unverified',
      registry_version: config.registry_version,
      registry_last_seen_at: new Date().toISOString(),
      ...(validity ? { registry_validity: validity } : {}),
      ...(registrationFrom ? { registration_from: registrationFrom } : {}),
      ...(registrationTo ? { registration_to: registrationTo } : {}),
      ...(address ? { registry_address: address } : {}),
      ...(city ? { registry_city: city } : {}),
      ...(state ? { registry_state: state } : {}),
      ...(pincode ? { registry_pincode: pincode } : {})
    }
  });
}
if (!deduplicated.size) throw new Error('NO_VALID_SEBI_VCF_ROWS');
return [...deduplicated.values()].map((entity) => ({ json: {
  p_entity: entity,
  import_quality: { source_rows: rows.length, invalid_rows: invalidRows, valid_rows: deduplicated.size }
} }));`));
workflow.nodes.push(node('SEBI Fund Loop', 'n8n-nodes-base.splitInBatches', [1280, 320], {
  batchSize: 1,
  options: {},
}));
workflow.nodes.push(node('Upsert Regulated Fund', 'n8n-nodes-base.httpRequest', [1540, 440], {
  method: 'POST',
  url: "={{ $('SEBI Registry Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_upsert_regulated_capital_entity' }}",
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
workflow.nodes.push(code('Regulated Fund Complete', [1800, 440], `const source = $('SEBI Fund Loop').item.json;
const response = $input.first().json ?? {};
const result = Array.isArray(response) ? (response[0] ?? {}) : response;
return [{ json: {
  completed: true,
  entity_id: result.entity_id ?? null,
  registration_number: result.registration_number ?? source.p_entity.registration_number,
  regulatory_status: result.regulatory_status ?? null,
  activity_verification_status: result.activity_verification_status ?? null,
  import_quality: source.import_quality
} }];`));
workflow.nodes.push(code('SEBI Registry Summary', [1540, 160], `const rows = $input.all().map((item) => item.json ?? {});
const quality = rows.find((row) => row.import_quality)?.import_quality ?? {};
return [{ json: {
  status: rows.length ? 'completed' : 'failed',
  source: 'SEBI Registered Venture Capital Funds',
  source_rows: Number(quality.source_rows ?? 0),
  valid_registry_rows: Number(quality.valid_rows ?? rows.length),
  invalid_registry_rows: Number(quality.invalid_rows ?? 0),
  regulated_funds_upserted: rows.filter((row) => row.completed).length,
  activity_claims_created: 0,
  note: 'SEBI registration resolves fund identity; recent investment activity still requires grounded evidence.'
} }];`));

connect(workflow, 'Manual Trigger', 'SEBI Registry Configuration');
connect(workflow, 'Every Four Weeks', 'SEBI Registry Configuration');
connect(workflow, 'SEBI Registry Configuration', 'Download SEBI VCF Registry');
connect(workflow, 'Download SEBI VCF Registry', 'Extract SEBI Spreadsheet');
connect(workflow, 'Extract SEBI Spreadsheet', 'Normalize SEBI Funds');
connect(workflow, 'Normalize SEBI Funds', 'SEBI Fund Loop');
connect(workflow, 'SEBI Fund Loop', 'SEBI Registry Summary', 0);
connect(workflow, 'SEBI Fund Loop', 'Upsert Regulated Fund', 1);
connect(workflow, 'Upsert Regulated Fund', 'Regulated Fund Complete');
connect(workflow, 'Regulated Fund Complete', 'SEBI Fund Loop');

const outputPath = path.join(__dirname, 'sebi_capital_registry.json');
fs.writeFileSync(outputPath, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(outputPath);
