const fs = require('fs');
const path = require('path');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'verified_quality_engine.json'), 'utf8'));
const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
const required = [
  'Manual Trigger', 'Hourly Quality Check', 'Quality Engine Configuration',
  'Load Research Run Quality', 'Load Provider Quality', 'Load Review Backlog',
  'Load Capital Graph Health', 'Aggregate Quality Metrics', 'Store Quality Snapshot',
  'Quality Summary',
];
for (const name of required) if (!nodes.has(name)) throw new Error(`MISSING_NODE:${name}`);

const config = nodes.get('Quality Engine Configuration').parameters.jsCode;
for (const fragment of ['lookback_hours: 24', "engine_version: 'quality-engine-v1.0.0'"]) {
  if (!config.includes(fragment)) throw new Error(`MISSING_QUALITY_CAP:${fragment}`);
}
for (const view of ['v_research_quality_runs', 'v_research_provider_quality', 'v_research_review_backlog', 'v_capital_graph_health']) {
  const node = ['Load Research Run Quality', 'Load Provider Quality', 'Load Review Backlog', 'Load Capital Graph Health']
    .find(n => nodes.get(n).parameters.url.includes(view));
  if (!node) throw new Error(`MISSING_VIEW_LOAD:${view}`);
}
if (nodes.get('Load Research Run Quality').credentials?.supabaseApi?.name !== 'Supabase account') throw new Error('CREDENTIAL_MISMATCH');
if (!nodes.get('Store Quality Snapshot').parameters.url.includes('/rest/v1/research_quality_snapshots')) throw new Error('SNAPSHOT_TABLE_NOT_USED');

const reachable = new Set();
const pending = ['Manual Trigger', 'Hourly Quality Check'];
while (pending.length) {
  const name = pending.pop();
  if (reachable.has(name)) continue;
  reachable.add(name);
  for (const output of (workflow.connections[name]?.main ?? [])) for (const edge of output) pending.push(edge.node);
}
const unreachable = workflow.nodes.map((item) => item.name).filter((name) => !reachable.has(name));
if (unreachable.length) throw new Error(`UNREACHABLE_NODES:${unreachable.join(',')}`);

console.log('VERIFIED QUALITY ENGINE WORKFLOW VALIDATION PASSED');
console.log(JSON.stringify({ nodes: workflow.nodes.length, views: 4, lookbackHours: 24,
  credentials: ['Supabase account'], outputStatus: 'snapshot', humanGate: 'none' }, null, 2));