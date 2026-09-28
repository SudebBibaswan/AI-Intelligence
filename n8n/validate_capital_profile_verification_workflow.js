const fs = require('fs');
const path = require('path');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'capital_profile_verification.json'), 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const required = [
  'Manual Trigger', 'Weekly Verification', 'Verification Configuration', 'Load Verification Queue',
  'Normalize Verification Queue', 'Capital Candidate Loop', 'Build Official Search', 'Tavily Official Search',
  'Select Credible Official Page', 'Firecrawl Official Page', 'Normalize Official Page',
  'Build Profile Extraction Request', 'OpenAI Profile Extraction', 'Validate Official Profile',
  'Persist Official Profile', 'Profile Candidate Complete', 'Capital Profile Summary',
];
for (const name of required) if (!nodes.has(name)) throw new Error(`MISSING_NODE:${name}`);

const config = nodes.get('Verification Configuration').parameters.jsCode;
if (!config.includes('candidate_limit: 3')) throw new Error('DEFAULT_CANDIDATE_CAP_CHANGED');
if (!config.includes('tavily_results_per_candidate: 3')) throw new Error('TAVILY_RESULT_CAP_CHANGED');
const tavily = nodes.get('Tavily Official Search');
if (tavily.type !== '@tavily/n8n-nodes-tavily.tavily' || tavily.credentials?.tavilyApi?.name !== 'Tavily account') {
  throw new Error('CENTRAL_TAVILY_CREDENTIAL_NOT_REUSED');
}
const firecrawl = nodes.get('Firecrawl Official Page');
if (firecrawl.type !== '@mendable/n8n-nodes-firecrawl.firecrawl' || firecrawl.credentials?.firecrawlApi?.name !== 'Firecrawl account') {
  throw new Error('CENTRAL_FIRECRAWL_CREDENTIAL_NOT_REUSED');
}
const openai = nodes.get('OpenAI Profile Extraction');
if (openai.credentials?.openAiApi?.name !== 'OpenAI account') throw new Error('CENTRAL_OPENAI_CREDENTIAL_NOT_REUSED');
for (const name of ['Load Verification Queue', 'Persist Official Profile']) {
  if (nodes.get(name).credentials?.supabaseApi?.name !== 'Supabase account') throw new Error(`CENTRAL_SUPABASE_CREDENTIAL_NOT_REUSED:${name}`);
}
const request = nodes.get('Build Profile Extraction Request').parameters.jsCode;
for (const fragment of ['additionalProperties: false', "name: 'capital_official_profile'", 'Do not infer current investing activity']) {
  if (!request.includes(fragment)) throw new Error(`PROFILE_SCHEMA_GUARD_MISSING:${fragment}`);
}
const validation = nodes.get('Validate Official Profile').parameters.jsCode;
for (const fragment of ['sameDomain', 'quotes.length', 'minimum_profile_confidence', "status: verified ? 'verified' : 'needs_review'"]) {
  if (!validation.includes(fragment)) throw new Error(`PROFILE_QUALITY_GATE_MISSING:${fragment}`);
}
const selector = nodes.get('Select Credible Official Page').parameters.jsCode;
for (const fragment of ['unsafeHost', 'distinctiveTokens', 'nameCoverage >= 0.5']) {
  if (!selector.includes(fragment)) throw new Error(`OFFICIAL_PAGE_SELECTION_GUARD_MISSING:${fragment}`);
}
const summary = nodes.get('Capital Profile Summary').parameters.jsCode;
if (!summary.includes('activity_status_changes')) throw new Error('ACTIVITY_SEPARATION_NOT_OBSERVABLE');

const reachable = new Set();
const pending = ['Manual Trigger', 'Weekly Verification'];
while (pending.length) {
  const name = pending.pop();
  if (reachable.has(name)) continue;
  reachable.add(name);
  for (const output of (workflow.connections[name]?.main ?? [])) for (const edge of output) pending.push(edge.node);
}
const unreachable = workflow.nodes.map((item) => item.name).filter((name) => !reachable.has(name));
if (unreachable.length) throw new Error(`UNREACHABLE_NODES:${unreachable.join(',')}`);

console.log('CAPITAL PROFILE VERIFICATION WORKFLOW VALIDATION PASSED');
console.log(JSON.stringify({ nodes: workflow.nodes.length, candidateCap: 3, nativeTavily: true,
  nativeFirecrawl: true, centralCredentials: 4, activityClaimsCreated: 0 }, null, 2));
