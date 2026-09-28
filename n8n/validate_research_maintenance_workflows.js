const fs = require('fs');
const path = require('path');

const files = ['evidence_backfill.json', 'capital_entity_registry.json'];
const failures = [];
for (const file of files) {
  const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  const names = new Set(workflow.nodes.map((node) => node.name));
  const ids = new Set();
  for (const node of workflow.nodes) {
    if (ids.has(node.id)) failures.push(`${file}: duplicate node id ${node.id}`);
    ids.add(node.id);
    if (node.type === 'n8n-nodes-base.code') {
      try { new Function('$input', '$', 'require', node.parameters.jsCode); }
      catch (error) { failures.push(`${file}: ${node.name} code does not parse: ${error.message}`); }
    }
  }
  for (const [from, outputs] of Object.entries(workflow.connections)) {
    if (!names.has(from)) failures.push(`${file}: missing connection source ${from}`);
    for (const group of outputs.main ?? []) for (const edge of group ?? []) {
      if (!names.has(edge.node)) failures.push(`${file}: missing connection target ${edge.node}`);
    }
  }
  if (workflow.active !== false) failures.push(`${file}: workflow must import inactive`);
  if (workflow.nodes.some((node) => node.type.includes('firecrawl') || /firecrawl/i.test(node.name))) failures.push(`${file}: paid Firecrawl must not be present`);
  for (const node of workflow.nodes) for (const reference of Object.values(node.credentials ?? {})) {
    if (!reference.id || !reference.name) failures.push(`${file}: ${node.name} has an incomplete credential reference`);
  }
  const serialized = JSON.stringify(workflow);
  if (/sk-[A-Za-z0-9_-]{20,}|tvly-[A-Za-z0-9]{20,}|fc-[A-Za-z0-9]{20,}/.test(serialized)) failures.push(`${file}: possible embedded secret`);
}

const backfill = JSON.parse(fs.readFileSync(path.join(__dirname, files[0]), 'utf8'));
if (!backfill.nodes.some((node) => node.name === 'Download Stored Content')) failures.push('Backfill storage download missing');
if (!backfill.nodes.some((node) => node.name === 'OpenAI Evidence Extraction')) failures.push('Backfill evidence extraction missing');
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, files[1]), 'utf8'));
if (!registry.nodes.some((node) => node.name === 'Upsert Capital Graph')) failures.push('Capital graph RPC missing');
if (!JSON.stringify(registry).includes('n8n_upsert_research_graph')) failures.push('Capital graph does not use idempotent RPC');
const graphRequest = registry.nodes.find((node) => node.name === 'Build Capital Graph Request')?.parameters?.jsCode ?? '';
if (graphRequest.includes('additionalProperties: true')) failures.push('Capital graph strict schema contains an open object');
if (!graphRequest.includes("attributes: { type: 'array'")) failures.push('Capital graph attributes are not strict key/value arrays');
if (graphRequest.includes("'product'") || graphRequest.includes("'market'") || graphRequest.includes("'other'")) failures.push('Capital registry schema still permits generic entity or relationship types');
const graphParser = registry.nodes.find((node) => node.name === 'Parse Capital Graph')?.parameters?.jsCode ?? '';
if (!graphParser.includes('OPENAI_CAPITAL_GRAPH_REQUEST_FAILED') || !graphParser.includes('attributesObject')) failures.push('Capital graph parser still hides API failures or does not normalize attributes');
const registrySummary = registry.nodes.find((node) => node.name === 'Registry Summary')?.parameters?.jsCode ?? '';
if (!registrySummary.includes('entities_upserted') || !registrySummary.includes('relationships_upserted')) failures.push('Registry summary does not report database output');

const requestNode = registry.nodes.find((node) => node.name === 'Build Capital Graph Request');
const evidenceFixture = { id: 'evidence-1', workspace_id: 'workspace-1', claim_text: 'Fund Alpha invested in Company Beta.', excerpt: 'Fund Alpha invested in Company Beta.', config: { model: 'test-model' } };
const requestOutput = new Function('$input', '$', 'require', requestNode.parameters.jsCode)(
  { first: () => ({ json: evidenceFixture }) },
  () => { throw new Error('Unexpected node reference'); },
  require,
)[0].json;
const schema = requestOutput.openai_request.text.format.schema;
const inspectSchema = (value, location = 'schema') => {
  if (!value || typeof value !== 'object') return;
  if (value.type === 'object' && value.additionalProperties !== false) failures.push(`Capital graph ${location} must set additionalProperties=false`);
  for (const [key, child] of Object.entries(value)) inspectSchema(child, `${location}.${key}`);
};
inspectSchema(schema);

const parserNode = registry.nodes.find((node) => node.name === 'Parse Capital Graph');
const modelGraph = { entities: [{ entity_type: 'fund', name: 'Fund Alpha', canonical_url: '', role: 'investor', confidence: 0.9, attributes: [{ key: 'stage', value: 'seed' }] }], relationships: [] };
const responseFixture = { output: [{ content: [{ type: 'output_text', text: JSON.stringify(modelGraph) }] }] };
const parserOutput = new Function('$input', '$', 'require', parserNode.parameters.jsCode)(
  { first: () => ({ json: responseFixture }) },
  (name) => ({ item: { json: name === 'Build Capital Graph Request' ? evidenceFixture : {} } }),
  require,
)[0].json;
if (parserOutput.p_graph.entities[0]?.attributes?.stage !== 'seed') failures.push('Capital graph attribute normalization failed');
const genericGraph = { entities: [{ entity_type: 'company', name: 'Follow-on financings', canonical_url: '', role: 'subject', confidence: 0.99, attributes: [] }], relationships: [] };
const genericOutput = new Function('$input', '$', 'require', parserNode.parameters.jsCode)(
  { first: () => ({ json: { output: [{ content: [{ type: 'output_text', text: JSON.stringify(genericGraph) }] }] } }) },
  (name) => ({ item: { json: name === 'Build Capital Graph Request' ? evidenceFixture : {} } }),
  require,
)[0].json;
if (genericOutput.p_graph.entities.length !== 0 || genericOutput.quality.entities_rejected !== 1) failures.push('Capital graph generic-name quality gate failed');
let parserRejectedApiError = false;
try {
  new Function('$input', '$', 'require', parserNode.parameters.jsCode)(
    { first: () => ({ json: { error: { description: 'invalid schema' } } }) },
    () => ({ item: { json: evidenceFixture } }),
    require,
  );
} catch (error) {
  parserRejectedApiError = String(error.message).includes('OPENAI_CAPITAL_GRAPH_REQUEST_FAILED');
}
if (!parserRejectedApiError) failures.push('Capital graph parser does not fail closed on API errors');

if (failures.length) {
  console.error('RESEARCH MAINTENANCE VALIDATION FAILED');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exit(1);
}
console.log('RESEARCH MAINTENANCE VALIDATION PASSED');
console.log(JSON.stringify({
  backfillNodes: backfill.nodes.length,
  registryNodes: registry.nodes.length,
  backfillUsesFirecrawl: false,
  credentialNames: ['Supabase account', 'OpenAI account']
}, null, 2));
