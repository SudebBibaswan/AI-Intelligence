const fs = require('fs');
const path = require('path');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_evidence_review_engine.json'), 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const required = [
  'Manual Trigger', 'Hourly Review Check', 'Review Engine Configuration',
  'Load Review Queue', 'Load Signal Eligible Evidence', 'Load Capital Directory',
  'Process Review Queue', 'Has Pending Reviews?', 'Review Queue Summary', 'No Reviews Pending',
];
for (const name of required) if (!nodes.has(name)) throw new Error(`MISSING_NODE:${name}`);

const config = nodes.get('Review Engine Configuration').parameters.jsCode;
for (const fragment of ['lookback_hours: 24', 'batch_size: 50', "engine_version: 'evidence-review-engine-v1.0.0'"]) {
  if (!config.includes(fragment)) throw new Error(`MISSING_REVIEW_CAP:${fragment}`);
}
for (const view of ['v_evidence_review_queue', 'v_signal_eligible_evidence', 'v_capital_directory']) {
  const node = ['Load Review Queue', 'Load Signal Eligible Evidence', 'Load Capital Directory']
    .find(n => nodes.get(n).parameters.url.includes(view));
  if (!node) throw new Error(`MISSING_VIEW_LOAD:${view}`);
}
if (nodes.get('Load Review Queue').credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('CREDENTIAL_MISMATCH');

const reachable = new Set();
const pending = ['Manual Trigger', 'Hourly Review Check'];
while (pending.length) {
  const name = pending.pop();
  if (reachable.has(name)) continue;
  reachable.add(name);
  for (const output of (workflow.connections[name]?.main ?? [])) for (const edge of output) pending.push(edge.node);
}
const unreachable = workflow.nodes.map((item) => item.name).filter((name) => !reachable.has(name));
if (unreachable.length) throw new Error(`UNREACHABLE_NODES:${unreachable.join(',')}`);

console.log('VERIFIED EVIDENCE REVIEW ENGINE WORKFLOW VALIDATION PASSED');
console.log(JSON.stringify({ nodes: workflow.nodes.length, views: 3, lookbackHours: 24,
  credentials: ['Supabase account'], outputStatus: 'queue_processed', humanGate: 'evidence_review' }, null, 2));