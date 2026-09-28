const fs = require('fs');
const path = require('path');

const workflowPath = path.join(__dirname, 'shared_domain_scheduler.json');
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
      new Function('$input', '$', node.parameters.jsCode);
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

const required = [
  'Hourly Schedule Trigger',
  'Queue Eligible Domain Runs',
  'Normalize Queued Runs',
  'Has New Domain Runs?',
  'Domain Run Loop',
  'Load Domain Profile',
  'Build Research Engine Input',
  'Execute Research Engine',
  'Record Domain Result',
  'Scheduler Result',
];
for (const name of required) if (!names.has(name)) fail(`Required node missing: ${name}`);

const loopOutputs = workflow.connections?.['Domain Run Loop']?.main ?? [];
if (!loopOutputs[0]?.some((item) => item.node === 'Scheduler Result')) fail('Loop done output is not connected to scheduler result');
if (!loopOutputs[1]?.some((item) => item.node === 'Load Domain Profile')) fail('Loop item output is not connected to profile loading');
if (!(workflow.connections?.['Record Domain Result']?.main?.[0] ?? []).some((item) => item.node === 'Domain Run Loop')) {
  fail('Domain result does not return to loop');
}

const schedule = workflow.nodes.find((item) => item.name === 'Hourly Schedule Trigger');
const cron = schedule?.parameters?.rule?.interval?.[0];
if (cron?.field !== 'cronExpression' || cron?.expression !== '5 * * * *') fail('Scheduler cron must be hourly at minute 5');

const execute = workflow.nodes.find((item) => item.name === 'Execute Research Engine');
if (execute?.parameters?.workflowId?.value !== 'REPLACE_WITH_RESEARCH_ENGINE_WORKFLOW_ID') {
  fail('Research Engine workflow placeholder is missing');
}
if (execute?.parameters?.options?.waitForSubWorkflow !== true) fail('Scheduler must wait for each Research Engine run');

const credentialNodes = workflow.nodes.filter((item) => item.credentials?.supabaseApi);
if (!credentialNodes.length) fail('No Supabase credential nodes found');
for (const item of credentialNodes) {
  if (item.credentials.supabaseApi.name !== 'supabase') fail(`Supabase credential renamed in ${item.name}`);
}

const serialized = JSON.stringify(workflow);
if (/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(serialized)) fail('Possible embedded JWT secret');
if (workflow.active !== false) fail('Workflow must import inactive');
if (workflow.settings?.timezone !== 'UTC') fail('Workflow timezone must be UTC');

if (failures.length) {
  console.error('SCHEDULER VALIDATION FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('SCHEDULER VALIDATION PASSED');
console.log(JSON.stringify({
  workflow: workflow.name,
  nodes: workflow.nodes.length,
  codeNodes: workflow.nodes.filter((item) => item.type === 'n8n-nodes-base.code').length,
  httpNodes: workflow.nodes.filter((item) => item.type === 'n8n-nodes-base.httpRequest').length,
  cron: cron.expression,
  active: workflow.active,
}, null, 2));
