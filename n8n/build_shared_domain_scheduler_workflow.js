const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outputPath = path.join(__dirname, 'shared_domain_scheduler.json');

function stableUuid(value) {
  const hash = crypto.createHash('sha256').update(value).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function node(name, type, typeVersion, position, parameters, extra = {}) {
  return {
    parameters,
    id: stableUuid(`shared-domain-scheduler:${name}`),
    name,
    type,
    typeVersion,
    position,
    ...extra,
  };
}

function code(name, position, jsCode, mode = 'runOnceForAllItems') {
  const parameters = { jsCode };
  if (mode === 'runOnceForEachItem') parameters.mode = mode;
  return node(name, 'n8n-nodes-base.code', 2, position, parameters);
}

function sticky(name, position, content, width, height, color = 5) {
  return node(name, 'n8n-nodes-base.stickyNote', 1, position, {
    content,
    width,
    height,
    color,
  });
}

function boolIf(name, position, expression) {
  return node(name, 'n8n-nodes-base.if', 2.2, position, {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'strict',
        version: 2,
      },
      conditions: [{
        id: stableUuid(`condition:${name}`),
        leftValue: expression,
        rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  });
}

const supabaseCredential = {
  supabaseApi: {
    id: 'REPLACE_WITH_SUPABASE_CREDENTIAL_ID',
    name: 'supabase',
  },
};

function supabaseRequest(name, position, parameters, extra = {}) {
  return node(name, 'n8n-nodes-base.httpRequest', 4.2, position, parameters, {
    credentials: supabaseCredential,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 1000,
    ...extra,
  });
}

const nodes = [
  sticky(
    'SETUP - READ FIRST',
    [-1120, -500],
    '## Shared Domain Scheduler — one-time setup\n\n1. In **Scheduler Configuration**, replace `REPLACE_PROJECT_REF`.\n2. Re-select the existing **supabase** credential if any HTTP node is red.\n3. In **Execute Research Engine**, select the imported **Research Engine** workflow once.\n4. Keep both workflows inactive while running one manual test.\n5. Publish/activate the Research Engine first, then publish this scheduler.\n\nThe database remains the authority for eligible domains, subscribers, slot idempotency, and collector workspace IDs.',
    750,
    390,
    4,
  ),
  sticky(
    'OPERATING MODEL',
    [-320, -500],
    '## Cost-controlled behavior\n\nThe trigger checks hourly at minute 5, but Supabase returns work only at configured domain slots (default **00:00 and 12:00 UTC**).\n\nA run is queued only when at least one real workspace actively subscribes to that domain. Repeated calls for the same domain and slot return `created=false`, so the workflow does not pay providers twice.\n\nEvery queued domain runs sequentially through the existing Research Engine.',
    700,
    390,
    5,
  ),
  node('Manual Test Trigger', 'n8n-nodes-base.manualTrigger', 1, [-1120, 0], {}),
  node('Hourly Schedule Trigger', 'n8n-nodes-base.scheduleTrigger', 1.2, [-1120, 180], {
    rule: {
      interval: [{ field: 'cronExpression', expression: '5 * * * *' }],
    },
  }),
  code(
    'Scheduler Configuration',
    [-880, 80],
    String.raw`// EDIT ONLY the Supabase project URL here.
const supabaseUrl = 'https://REPLACE_PROJECT_REF.supabase.co'.replace(/\/$/, '');
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) || supabaseUrl.includes('REPLACE_')) {
  throw new Error('CONFIG_REQUIRED_SUPABASE_URL');
}

const now = new Date();
now.setUTCMinutes(0, 0, 0);

return [{
  json: {
    supabase_url: supabaseUrl,
    slot_start: now.toISOString(),
    scheduler_version: 'shared-domain-scheduler-v1.0.0'
  }
}];`,
  ),
  supabaseRequest(
    'Queue Eligible Domain Runs',
    [-620, 80],
    {
      method: 'POST',
      url: "={{ $json.supabase_url + '/rest/v1/rpc/n8n_schedule_domain_collection_runs' }}",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=representation' },
        ],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ p_slot_start: $json.slot_start }) }}",
      options: { timeout: 30000 },
    },
    { alwaysOutputData: true },
  ),
  code(
    'Normalize Queued Runs',
    [-360, 80],
    String.raw`const settings = $('Scheduler Configuration').first().json;
const rows = [];

for (const item of $input.all()) {
  const value = item.json;
  if (Array.isArray(value)) rows.push(...value);
  else if (Array.isArray(value?.body)) rows.push(...value.body);
  else if (value?.research_run_id) rows.push(value);
}

const created = rows.filter((row) => row?.created === true);
if (!created.length) {
  return [{
    json: {
      has_new_runs: false,
      slot_start: settings.slot_start,
      message: 'No new eligible domain runs for this slot.'
    }
  }];
}

return created.map((row, index) => ({
  json: {
    ...row,
    has_new_runs: true,
    supabase_url: settings.supabase_url,
    workspace_id: row.collector_workspace_id,
    workspace_domain_id: row.collector_workspace_domain_id
  },
  pairedItem: { item: Math.min(index, Math.max(0, $input.all().length - 1)) }
}));`,
  ),
  boolIf('Has New Domain Runs?', [-100, 80], '={{ $json.has_new_runs === true }}'),
  code(
    'No New Runs Result',
    [160, 220],
    String.raw`return [{ json: { ok: true, dispatched: 0, ...$input.first().json } }];`,
  ),
  node('Domain Run Loop', 'n8n-nodes-base.splitInBatches', 3, [160, 20], {
    batchSize: 1,
    options: {},
  }),
  supabaseRequest(
    'Load Domain Profile',
    [420, 80],
    {
      url: "={{ $json.supabase_url + '/rest/v1/domains?id=eq.' + encodeURIComponent($json.domain_id) + '&select=id,key,name,description,default_config,config_version' }}",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Accept', value: 'application/json' }] },
      options: { timeout: 30000 },
    },
  ),
  code(
    'Build Research Engine Input',
    [680, 80],
    String.raw`const queued = $('Domain Run Loop').item.json;
const response = $input.first().json;
const domain = Array.isArray(response) ? response[0] : response;

if (!domain?.id || domain.id !== queued.domain_id) {
  throw new Error('DOMAIN_PROFILE_NOT_FOUND_' + queued.domain_id);
}

return [{
  json: {
    supabase_url: queued.supabase_url,
    research_run_id: queued.research_run_id,
    request_id: queued.request_id,
    domain_id: queued.domain_id,
    domain_key: domain.key,
    domain_name: domain.name,
    domain_description: domain.description,
    domain_default_config: domain.default_config ?? {},
    domain_config_version: domain.config_version ?? 1,
    collector_workspace_id: queued.collector_workspace_id,
    collector_workspace_domain_id: queued.collector_workspace_domain_id,
    workspace_id: queued.workspace_id,
    workspace_domain_id: queued.workspace_domain_id,
    subscriber_count: queued.subscriber_count,
    slot_start: queued.slot_start,
    engine_version: 'research-engine-v1.0.0',
    schedule_config: {}
  },
  pairedItem: { item: 0 }
}];`,
  ),
  node(
    'Execute Research Engine',
    'n8n-nodes-base.executeWorkflow',
    1.3,
    [940, 80],
    {
      workflowId: {
        __rl: true,
        value: 'REPLACE_WITH_RESEARCH_ENGINE_WORKFLOW_ID',
        mode: 'id',
        cachedResultName: 'Research Engine',
      },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {},
        matchingColumns: [],
        schema: [],
        attemptToConvertTypes: false,
        convertFieldsToString: true,
      },
      options: { waitForSubWorkflow: true },
    },
  ),
  code(
    'Record Domain Result',
    [1200, 80],
    String.raw`const queued = $('Domain Run Loop').item.json;
const result = $input.first().json;

return [{
  json: {
    domain_key: queued.domain_key,
    research_run_id: queued.research_run_id,
    request_id: queued.request_id,
    subscriber_count: queued.subscriber_count,
    status: result.status ?? (result.ok ? 'completed' : 'unknown'),
    child_result: result
  },
  pairedItem: { item: 0 }
}];`,
  ),
  code(
    'Scheduler Result',
    [420, -80],
    String.raw`const results = $input.all().map((item) => item.json);
return [{
  json: {
    ok: results.every((item) => !['failed', 'unknown'].includes(item.status)),
    dispatched: results.length,
    completed_at: new Date().toISOString(),
    runs: results
  }
}];`,
  ),
];

const connections = {};
function connect(from, to, outputIndex = 0) {
  if (!connections[from]) connections[from] = { main: [] };
  while (connections[from].main.length <= outputIndex) connections[from].main.push([]);
  connections[from].main[outputIndex].push({ node: to, type: 'main', index: 0 });
}

connect('Manual Test Trigger', 'Scheduler Configuration');
connect('Hourly Schedule Trigger', 'Scheduler Configuration');
connect('Scheduler Configuration', 'Queue Eligible Domain Runs');
connect('Queue Eligible Domain Runs', 'Normalize Queued Runs');
connect('Normalize Queued Runs', 'Has New Domain Runs?');
connect('Has New Domain Runs?', 'Domain Run Loop', 0);
connect('Has New Domain Runs?', 'No New Runs Result', 1);
connect('Domain Run Loop', 'Scheduler Result', 0);
connect('Domain Run Loop', 'Load Domain Profile', 1);
connect('Load Domain Profile', 'Build Research Engine Input');
connect('Build Research Engine Input', 'Execute Research Engine');
connect('Execute Research Engine', 'Record Domain Result');
connect('Record Domain Result', 'Domain Run Loop');

const workflow = {
  name: 'RE 01 Shared Domain Scheduler',
  nodes,
  pinData: {},
  connections,
  active: false,
  settings: {
    executionOrder: 'v1',
    timezone: 'UTC',
    saveManualExecutions: true,
    saveExecutionProgress: true,
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'all',
    executionTimeout: 10800,
  },
  versionId: stableUuid('shared-domain-scheduler-workflow-version-1.0.0'),
  meta: { templateCredsSetupCompleted: false },
  tags: [],
};

fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log(outputPath);
