const fs = require('fs');
const path = require('path');

const workflowPath = path.join(__dirname, 'capital_directory_refresh.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const required = [
  'Manual Trigger',
  'Every Four Weeks',
  'Directory Configuration',
  'Build Wikidata Registry Jobs',
  'Registry Job Loop',
  'Wikidata SPARQL',
  'Normalize Wikidata Candidates',
  'Registry Candidate Loop',
  'Is Registry Candidate?',
  'Upsert Directory Entity',
  'Capital Directory Summary',
];
for (const name of required) {
  if (!nodes.has(name)) throw new Error(`MISSING_NODE:${name}`);
}

const wikidata = nodes.get('Wikidata SPARQL');
if (wikidata.parameters.url !== 'https://query.wikidata.org/sparql') throw new Error('INVALID_WIKIDATA_ENDPOINT');
const headers = wikidata.parameters.headerParameters.parameters;
if (!headers.some((header) => header.name === 'User-Agent' && /AI-Intelligence-Research/.test(header.value))) {
  throw new Error('MISSING_WIKIMEDIA_USER_AGENT');
}
if (!wikidata.retryOnFail || wikidata.maxTries > 2 || wikidata.waitBetweenTries < 60000) {
  throw new Error('UNSAFE_WIKIDATA_RETRY_POLICY');
}
if (wikidata.credentials) throw new Error('PUBLIC_WIKIDATA_REQUEST_MUST_NOT_USE_CREDENTIALS');

const upsert = nodes.get('Upsert Directory Entity');
if (!String(upsert.parameters.url).includes('/rpc/n8n_upsert_research_entity')) throw new Error('DIRECTORY_RPC_NOT_USED');
if (!upsert.credentials?.supabaseApi) throw new Error('SUPABASE_CREDENTIAL_NOT_REUSED');

const configuration = nodes.get('Directory Configuration').parameters.jsCode;
if (!configuration.includes("wikidata_qid: 'Q668'")) throw new Error('INITIAL_COUNTRY_PROFILE_MISSING');
if (!configuration.includes("wikidata_qid: 'Q3487908'") || !configuration.includes("wikidata_qid: 'Q4086495'")) {
  throw new Error('CAPITAL_CLASSES_MISSING');
}
const normalizer = nodes.get('Normalize Wikidata Candidates').parameters.jsCode;
if (!normalizer.includes("registry_status: 'candidate_unverified'")) throw new Error('UNVERIFIED_STATUS_GATE_MISSING');
const summary = nodes.get('Capital Directory Summary').parameters.jsCode;
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
const unreachable = workflow.nodes.map((item) => item.name).filter((name) => !reachable.has(name));
if (unreachable.length) throw new Error(`UNREACHABLE_NODES:${unreachable.join(',')}`);

console.log('CAPITAL DIRECTORY VALIDATION PASSED');
console.log(JSON.stringify({
  workflow: workflow.name,
  nodes: workflow.nodes.length,
  publicProvider: 'wikidata',
  initialCountry: 'India',
  paidProviderNodes: paidNodes.length,
  reachableNodes: reachable.size,
  supabaseCredentialName: upsert.credentials.supabaseApi.name,
}, null, 2));
