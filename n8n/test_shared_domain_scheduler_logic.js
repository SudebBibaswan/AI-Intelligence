const assert = require('assert');
const workflow = require('./shared_domain_scheduler.json');

const byName = new Map(workflow.nodes.map((node) => [node.name, node]));

function runCode(name, inputJson, references = {}) {
  const node = byName.get(name);
  assert(node, `Missing node ${name}`);
  const inputItems = Array.isArray(inputJson) ? inputJson.map((json) => ({ json })) : [{ json: inputJson }];
  const $input = {
    all: () => inputItems,
    first: () => inputItems[0],
    item: inputItems[0],
  };
  const $ = (referenceName) => {
    const value = references[referenceName];
    if (value === undefined) throw new Error(`Missing test reference ${referenceName}`);
    const items = (Array.isArray(value) ? value : [value]).map((json) => ({ json }));
    return { all: () => items, first: () => items[0], item: items[0] };
  };
  return new Function('$input', '$', node.parameters.jsCode)($input, $);
}

const settings = {
  supabase_url: 'https://example.supabase.co',
  slot_start: '2026-09-27T00:00:00.000Z',
};

const queuedRows = [
  {
    research_run_id: '11111111-1111-4111-a111-111111111111',
    request_id: '22222222-2222-4222-a222-222222222222',
    domain_id: '33333333-3333-4333-a333-333333333333',
    domain_key: 'cybersecurity',
    collector_workspace_id: '44444444-4444-4444-a444-444444444444',
    collector_workspace_domain_id: '55555555-5555-4555-a555-555555555555',
    subscriber_count: 4,
    slot_start: settings.slot_start,
    created: true,
  },
  {
    research_run_id: '66666666-6666-4666-a666-666666666666',
    request_id: '77777777-7777-4777-a777-777777777777',
    domain_id: '88888888-8888-4888-a888-888888888888',
    domain_key: 'healthcare',
    collector_workspace_id: '44444444-4444-4444-a444-444444444444',
    collector_workspace_domain_id: '99999999-9999-4999-a999-999999999999',
    subscriber_count: 2,
    slot_start: settings.slot_start,
    created: false,
  },
];

const normalized = runCode('Normalize Queued Runs', queuedRows, { 'Scheduler Configuration': settings });
assert.equal(normalized.length, 1);
assert.equal(normalized[0].json.has_new_runs, true);
assert.equal(normalized[0].json.domain_key, 'cybersecurity');
assert.equal(normalized[0].json.workspace_id, queuedRows[0].collector_workspace_id);

const domain = {
  id: queuedRows[0].domain_id,
  key: 'cybersecurity',
  name: 'Cybersecurity',
  description: 'Security products, threats, regulation, and investment activity.',
  default_config: {
    profile_version: '1.0.0',
    topics: ['cloud-security', 'funding-and-ma'],
    query_focus: ['product launches', 'funding and acquisitions'],
  },
  config_version: 1,
};

const childInput = runCode(
  'Build Research Engine Input',
  domain,
  { 'Domain Run Loop': normalized[0].json },
)[0].json;

assert.equal(childInput.research_run_id, queuedRows[0].research_run_id);
assert.equal(childInput.domain_key, 'cybersecurity');
assert.deepEqual(childInput.domain_default_config.topics, domain.default_config.topics);
assert.equal(childInput.workspace_domain_id, queuedRows[0].collector_workspace_domain_id);

const noRuns = runCode('Normalize Queued Runs', {}, { 'Scheduler Configuration': settings });
assert.equal(noRuns.length, 1);
assert.equal(noRuns[0].json.has_new_runs, false);

console.log('SCHEDULER LOGIC TESTS PASSED');
console.log(JSON.stringify({
  queuedRows: queuedRows.length,
  newlyDispatched: normalized.length,
  duplicateSlotsIgnored: queuedRows.length - normalized.length,
  childDomain: childInput.domain_key,
}, null, 2));
