const fs = require('fs');
const path = require('path');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'sebi_capital_registry.json'), 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const required = [
  'Manual Trigger', 'Every Four Weeks', 'SEBI Registry Configuration',
  'Download SEBI VCF Registry', 'Extract SEBI Spreadsheet', 'Normalize SEBI Funds',
  'SEBI Fund Loop', 'Upsert Regulated Fund', 'Regulated Fund Complete', 'SEBI Registry Summary',
];
for (const name of required) if (!nodes.has(name)) throw new Error(`MISSING_NODE:${name}`);

const download = nodes.get('Download SEBI VCF Registry');
if (!String(download.parameters.url).includes('registry_export_url')) throw new Error('SEBI_EXPORT_URL_NOT_USED');
if (download.parameters.options?.response?.response?.responseFormat !== 'file') throw new Error('SEBI_EXPORT_NOT_BINARY');
if (download.credentials) throw new Error('PUBLIC_SEBI_EXPORT_MUST_NOT_USE_CREDENTIALS');
const extract = nodes.get('Extract SEBI Spreadsheet');
if (extract.type !== 'n8n-nodes-base.extractFromFile' || extract.parameters.operation !== 'xls') {
  throw new Error('SEBI_XLS_EXTRACTOR_MISSING');
}

const normalizer = nodes.get('Normalize SEBI Funds').parameters.jsCode;
for (const fragment of [
  "registry_status: 'regulated_identity'",
  "regulatory_status: 'registered'",
  "activity_verification_status: 'unverified'",
  "registration_number: registrationNumber",
]) {
  if (!normalizer.includes(fragment)) throw new Error(`MISSING_NORMALIZER_GUARD:${fragment}`);
}
const upsert = nodes.get('Upsert Regulated Fund');
if (!String(upsert.parameters.url).includes('/rpc/n8n_upsert_regulated_capital_entity')) throw new Error('REGULATED_RPC_NOT_USED');
if (upsert.credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('SUPABASE_CREDENTIAL_NOT_REUSED');
const summary = nodes.get('SEBI Registry Summary').parameters.jsCode;
if (!summary.includes('activity_claims_created: 0')) throw new Error('UNSUPPORTED_ACTIVITY_CLAIM');

const paidNodes = workflow.nodes.filter((node) => /tavily|firecrawl|openai/i.test(`${node.name} ${node.type}`));
if (paidNodes.length) throw new Error(`PAID_PROVIDER_PRESENT:${paidNodes.map((node) => node.name).join(',')}`);

const reachable = new Set();
const pending = ['Manual Trigger', 'Every Four Weeks'];
while (pending.length) {
  const name = pending.pop();
  if (reachable.has(name)) continue;
  reachable.add(name);
  for (const output of (workflow.connections[name]?.main ?? [])) {
    for (const edge of output) pending.push(edge.node);
  }
}
const unreachable = workflow.nodes.map((node) => node.name).filter((name) => !reachable.has(name));
if (unreachable.length) throw new Error(`UNREACHABLE_NODES:${unreachable.join(',')}`);

console.log('SEBI CAPITAL REGISTRY VALIDATION PASSED');
console.log(JSON.stringify({
  workflow: workflow.name,
  nodes: workflow.nodes.length,
  source: 'SEBI official export',
  expectedRegistryRows: 149,
  paidProviderNodes: paidNodes.length,
  reachableNodes: reachable.size,
  supabaseCredentialName: upsert.credentials.supabaseApi.name,
}, null, 2));
