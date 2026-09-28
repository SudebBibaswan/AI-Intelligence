const fs = require('fs');
const path = require('path');

const workflowPath = path.join(__dirname, 'Research Engine_multisource_v2.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const failures = [];
const fail = (message) => failures.push(message);
const names = new Set();
const ids = new Set();

for (const node of workflow.nodes ?? []) {
  if (!node.name || names.has(node.name)) fail(`Duplicate or missing node name: ${node.name}`);
  if (!node.id || ids.has(node.id)) fail(`Duplicate or missing node id: ${node.id}`);
  names.add(node.name);
  ids.add(node.id);

  if (node.type === 'n8n-nodes-base.code') {
    try {
      new Function('$input', '$', 'require', node.parameters.jsCode);
    } catch (error) {
      fail(`Code node ${node.name} does not parse: ${error.message}`);
    }
  }
}

for (const [from, outputs] of Object.entries(workflow.connections ?? {})) {
  if (!names.has(from)) fail(`Connection source does not exist: ${from}`);
  for (const group of outputs.main ?? []) {
    for (const connection of group ?? []) {
      if (!names.has(connection.node)) fail(`Connection target does not exist: ${connection.node}`);
    }
  }
}

const reachable = new Set(['Manual Trigger', 'Scheduled Run Trigger']);
let changed = true;
while (changed) {
  changed = false;
  for (const [from, outputs] of Object.entries(workflow.connections ?? {})) {
    if (!reachable.has(from)) continue;
    for (const group of outputs.main ?? []) {
      for (const connection of group ?? []) {
        if (!reachable.has(connection.node)) {
          reachable.add(connection.node);
          changed = true;
        }
      }
    }
  }
}

for (const node of workflow.nodes ?? []) {
  if (node.type !== 'n8n-nodes-base.stickyNote' && !reachable.has(node.name)) {
    fail(`Executable node is unreachable: ${node.name}`);
  }
}

const required = [
  'Scheduled Run Trigger',
  'Prepare Scheduled Research Request',
  'Run Already Queued?',
  'Build Discovery Jobs',
  'Discovery Job Loop',
  'Tavily Search',
  'Normalize Tavily Discovery',
  'Hacker News Search',
  'Normalize Hacker News Discovery',
  'arXiv Search',
  'Normalize arXiv Discovery',
  'GDELT News Search',
  'Normalize GDELT Discovery',
  'Read Monitored RSS Feed',
  'Normalize RSS Discovery',
  'Normalize and Dedupe Candidates',
  'Has Embedded Content?',
  'Normalize Embedded Content',
  '/scrape',
  'OpenAI Evidence Extraction',
  'Finalize Research Run',
];
for (const name of required) if (!names.has(name)) fail(`Required node missing: ${name}`);

const discoveryOutputs = workflow.connections?.['Discovery Job Loop']?.main ?? [];
if (!discoveryOutputs[0]?.some((item) => item.node === 'Normalize and Dedupe Candidates')) {
  fail('Discovery loop done output does not reach global dedupe');
}
if (!discoveryOutputs[1]?.some((item) => item.node === 'Is Tavily Discovery?')) {
  fail('Discovery loop item output does not reach provider routing');
}
if (!(workflow.connections?.['Discovery Job Complete']?.main?.[0] ?? []).some((item) => item.node === 'Discovery Job Loop')) {
  fail('Discovery jobs do not return to discovery loop');
}
if (!(workflow.connections?.['Is GDELT Discovery?']?.main?.[0] ?? []).some((item) => item.node === 'GDELT News Search')) {
  fail('GDELT discovery route is missing');
}
if (!(workflow.connections?.['Normalize GDELT Discovery']?.main?.[0] ?? []).some((item) => item.node === 'Discovery Job Complete')) {
  fail('Normalized GDELT results do not return to discovery loop');
}

const extractOutputs = workflow.connections?.['Has Embedded Content?']?.main ?? [];
if (!extractOutputs[0]?.some((item) => item.node === 'Normalize Embedded Content')) fail('Embedded content path missing');
if (!extractOutputs[1]?.some((item) => item.node === '/scrape')) fail('Firecrawl fallback path missing');

const expectedCredentials = new Map([
  ['supabaseApi', 'Supabase account'],
  ['openAiApi', 'OpenAI account'],
  ['tavilyApi', 'Tavily account'],
  ['firecrawlApi', 'Firecrawl account'],
]);
const foundCredentials = new Map();
for (const node of workflow.nodes ?? []) {
  for (const [type, reference] of Object.entries(node.credentials ?? {})) {
    foundCredentials.set(type, reference.name);
  }
}
for (const [type, name] of expectedCredentials) {
  if (foundCredentials.get(type) !== name) fail(`Credential binding changed: ${type} should remain ${name}`);
}

const tavily = workflow.nodes.find((node) => node.name === 'Tavily Search');
if (tavily?.type !== '@tavily/n8n-nodes-tavily.tavily') fail('Native Tavily node was replaced');
const firecrawl = workflow.nodes.find((node) => node.name === '/scrape');
if (firecrawl?.type !== '@mendable/n8n-nodes-firecrawl.firecrawl') fail('Native Firecrawl node was replaced');

const arxiv = workflow.nodes.find((node) => node.name === 'arXiv Search');
const arxivHeaders = arxiv?.parameters?.headerParameters?.parameters ?? [];
if (arxiv?.parameters?.url !== 'https://api.openalex.org/works') fail('Scholarly adapter must use OpenAlex');
if (!arxivHeaders.some((header) => header.name === 'Accept' && header.value === 'application/json')) {
  fail('OpenAlex Accept header is missing');
}
if (!arxivHeaders.some((header) => header.name === 'User-Agent' && header.value)) {
  fail('arXiv User-Agent header is missing');
}
const arxivQuery = arxiv?.parameters?.queryParameters?.parameters?.find((item) => item.name === 'search');
if (arxivQuery?.value !== '={{ $json.query }}') fail('OpenAlex must receive the planned search query');

const normalizerCode = workflow.nodes.find((node) => node.name === 'Normalize and Dedupe Candidates')?.parameters?.jsCode ?? '';
if (!normalizerCode.includes('INVALID_DISCOVERY_ENVELOPE')) fail('Central normalizer lacks malformed fan-in diagnostics');
if (normalizerCode.includes("require('url')") || normalizerCode.includes('new URL(') || normalizerCode.includes('new NodeUrl(')) {
  fail('Central normalizer must not depend on URL globals or modules unavailable in restricted n8n task runners');
}
if (!normalizerCode.includes('function parseHttpUrl(rawUrl)')) fail('Central normalizer lacks its self-contained URL parser');
const extractedContentCode = workflow.nodes.find((node) => node.name === 'Normalize Extracted Content')?.parameters?.jsCode ?? '';
if (!extractedContentCode.includes('response.markdown') || !extractedContentCode.includes('data.markdown')) {
  fail('Firecrawl normalizer must support both native response envelopes');
}
if (!extractedContentCode.includes("...(wasTruncated ? ['CONTENT_TRUNCATED'] : [])") || !extractedContentCode.includes("tooShort ? 'partial' : 'success'")) {
  fail('Firecrawl normalizer must record truncation without blocking evidence eligibility');
}
const hackerNewsCode = workflow.nodes.find((node) => node.name === 'Normalize Hacker News Discovery')?.parameters?.jsCode ?? '';
if (hackerNewsCode.includes("'community_post'") || !hackerNewsCode.includes("? 'post' : 'article'")) {
  fail('Hacker News discussion source type must satisfy the database source_type constraint');
}
const restoredSourceCode = workflow.nodes.find((node) => node.name === 'Restore Persisted Source Context')?.parameters?.jsCode ?? '';
if (restoredSourceCode.includes('&& persisted.is_new') || !restoredSourceCode.includes('CURRENT_EXTRACTION_MATCHED_EXISTING_CONTENT')) {
  fail('Content-hash duplicates with fresh extracted content must remain eligible for evidence');
}
const completionCode = workflow.nodes.find((node) => node.name === 'Candidate Complete')?.parameters?.jsCode ?? '';
if (!completionCode.includes('NO_DISCOVERY_RESULTS')) fail('Candidate completion loses empty-discovery diagnostics');
if (!completionCode.includes("$('Candidate Loop - One at a Time').item.json")) fail('Candidate completion does not restore original attribution');

const serialized = JSON.stringify(workflow);
const forbiddenSecretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /\btvly-[A-Za-z0-9]{20,}\b/,
  /\bfc-[A-Za-z0-9]{20,}\b/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
];
for (const pattern of forbiddenSecretPatterns) if (pattern.test(serialized)) fail(`Possible embedded secret matched ${pattern}`);

if (workflow.active !== false) fail('Workflow must import inactive');
if (workflow.id) fail('V2 import file must not reuse the existing workflow ID');
if (workflow.settings?.executionOrder !== 'v1') fail('Workflow execution order must be v1');

const manualConfigCode = workflow.nodes.find((node) => node.name === 'Research Request and Limits')?.parameters?.jsCode ?? '';
const scheduledConfigCode = workflow.nodes.find((node) => node.name === 'Prepare Scheduled Research Request')?.parameters?.jsCode ?? '';
if (!manualConfigCode.includes("engine_version: 'research-engine-v2.1.0'")) fail('Manual path reports the wrong engine version');
if (!scheduledConfigCode.includes("engine_version: 'research-engine-v2.1.0'")) fail('Scheduled path reports the wrong engine version');
if (!manualConfigCode.includes("automation_mode: 'automatic'")) fail('Manual path must use automatic evidence verification');
if (!scheduledConfigCode.includes("automation_mode: 'automatic'")) fail('Scheduled path must use automatic evidence verification');
const preparationCode = workflow.nodes.find((node) => node.name === 'Validate and Prepare Run')?.parameters?.jsCode ?? '';
if (!preparationCode.includes("config.automation_mode !== 'automatic'")) fail('Run validation does not enforce automatic evidence verification');

if (failures.length) {
  console.error('MULTI-SOURCE VALIDATION FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MULTI-SOURCE VALIDATION PASSED');
console.log(JSON.stringify({
  workflow: workflow.name,
  nodes: workflow.nodes.length,
  codeNodes: workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.code').length,
  nativeTavily: tavily.type,
  nativeFirecrawl: firecrawl.type,
  credentialNames: Object.fromEntries(foundCredentials),
  reachableExecutableNodes: [...reachable].filter((name) => names.has(name)).length,
  active: workflow.active,
}, null, 2));
