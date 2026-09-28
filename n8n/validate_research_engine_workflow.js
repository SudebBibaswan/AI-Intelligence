const fs = require('fs');
const path = require('path');

const workflowPath = path.join(__dirname, 'research_engine_complete.json');
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
      new Function(node.parameters.jsCode);
    } catch (error) {
      fail(`Code node ${node.name} does not parse: ${error.message}`);
    }
    if (node.parameters.mode === 'runOnceForEachItem' && /return\s*\[/.test(node.parameters.jsCode)) {
      fail(`Code node ${node.name} returns an array in per-item mode`);
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

const triggerRoots = ['Manual Trigger', 'Scheduled Run Trigger'];
const reachable = new Set(triggerRoots);
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
    fail(`Executable node is unreachable from a supported trigger: ${node.name}`);
  }
}

const requiredNodes = [
  'Scheduled Run Trigger',
  'Prepare Scheduled Research Request',
  'Run Already Queued?',
  'OpenAI Query Planner',
  'Tavily Search',
  'Candidate Loop - One at a Time',
  'Lookup Existing Source',
  'Firecrawl Scrape',
  'Persist Source via RPC',
  'Upload Source Content',
  'Update Source Storage Path',
  'OpenAI Evidence Extraction',
  'Persist Evidence via RPC',
  'Finalize Research Run',
];
for (const name of requiredNodes) if (!names.has(name)) fail(`Required node missing: ${name}`);

if (!(workflow.connections?.['Scheduled Run Trigger']?.main?.[0] ?? []).some((item) => item.node === 'Prepare Scheduled Research Request')) {
  fail('Scheduled trigger is not connected to scheduled input preparation');
}
if (!(workflow.connections?.['Run Already Queued?']?.main?.[0] ?? []).some((item) => item.node === 'Claim Research Run')) {
  fail('Existing scheduled runs do not bypass run creation');
}
if (!(workflow.connections?.['Run Already Queued?']?.main?.[1] ?? []).some((item) => item.node === 'Create Research Run')) {
  fail('Manual runs do not reach run creation');
}

const loopOutputs = workflow.connections?.['Candidate Loop - One at a Time']?.main ?? [];
if (!loopOutputs[0]?.some((item) => item.node === 'Summarize Research Run')) fail('Loop done output is not connected to finalization');
if (!loopOutputs[1]?.some((item) => item.node === 'Has Valid Canonical URL?')) fail('Loop batch output is not connected to candidate processing');
if (!(workflow.connections?.['Candidate Complete']?.main?.[0] ?? []).some((item) => item.node === 'Candidate Loop - One at a Time')) fail('Candidate completion does not return to loop');

const credentialMap = new Map();
for (const node of workflow.nodes ?? []) {
  for (const [type, ref] of Object.entries(node.credentials ?? {})) {
    credentialMap.set(type, ref.name);
  }
}
const expectedCredentials = new Map([
  ['supabaseApi', 'supabase'],
  ['openAiApi', 'openai'],
  ['httpBearerAuth', 'bearer auth for tavily'],
  ['httpHeaderAuth', 'firecrawl'],
]);
for (const [type, name] of expectedCredentials) {
  if (credentialMap.get(type) !== name) fail(`Credential binding missing or renamed: ${type} -> ${name}`);
}

const serialized = JSON.stringify(workflow);
const forbiddenSecretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /\btvly-[A-Za-z0-9]{20,}\b/,
  /\bfc-[A-Za-z0-9]{20,}\b/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
];
for (const pattern of forbiddenSecretPatterns) if (pattern.test(serialized)) fail(`Possible embedded secret matched ${pattern}`);

const allowedHosts = new Set([
  'api.openai.com',
  'api.tavily.com',
  'api.firecrawl.dev',
]);
for (const node of workflow.nodes ?? []) {
  const url = node.parameters?.url;
  if (typeof url !== 'string' || url.startsWith('=')) continue;
  try {
    const host = new URL(url).hostname;
    if (!allowedHosts.has(host)) fail(`Unexpected fixed external host in ${node.name}: ${host}`);
  } catch {
    fail(`Invalid fixed URL in ${node.name}: ${url}`);
  }
}

if (workflow.active !== false) fail('Workflow must import inactive');
if (workflow.settings?.executionOrder !== 'v1') fail('Workflow execution order must be v1');

if (failures.length) {
  console.error('VALIDATION FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const summary = {
  workflow: workflow.name,
  nodes: workflow.nodes.length,
  executableNodes: workflow.nodes.filter((node) => node.type !== 'n8n-nodes-base.stickyNote').length,
  codeNodes: workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.code').length,
  httpNodes: workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.httpRequest').length,
  credentialTypes: [...credentialMap.keys()].sort(),
  reachableExecutableNodes: [...reachable].filter((name) => names.has(name)).length,
  active: workflow.active,
};

console.log('VALIDATION PASSED');
console.log(JSON.stringify(summary, null, 2));
