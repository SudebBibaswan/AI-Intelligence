const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const research = JSON.parse(fs.readFileSync(path.join(__dirname, 'Research Engine_multisource_v2.json'), 'utf8'));
const cloneCredential = (nodeName, credentialName) => structuredClone(
  research.nodes.find((node) => node.name === nodeName).credentials[credentialName],
);
const credentials = {
  supabaseApi: cloneCredential('Create Research Run', 'supabaseApi'),
  tavilyApi: cloneCredential('Tavily Search', 'tavilyApi'),
  firecrawlApi: cloneCredential('/scrape', 'firecrawlApi'),
  openAiApi: cloneCredential('OpenAI Query Planner', 'openAiApi'),
};
const stableId = (name) => {
  const digest = crypto.createHash('sha1').update(`capital-profile:${name}`).digest('hex');
  return `${digest.slice(0, 8)}-0000-4000-8000-${digest.slice(8, 20)}`;
};
const versions = {
  'n8n-nodes-base.code': 2,
  'n8n-nodes-base.httpRequest': 4.2,
  'n8n-nodes-base.if': 2.2,
  'n8n-nodes-base.manualTrigger': 1,
  'n8n-nodes-base.scheduleTrigger': 1.2,
  'n8n-nodes-base.splitInBatches': 3,
  '@tavily/n8n-nodes-tavily.tavily': 1,
  '@mendable/n8n-nodes-firecrawl.firecrawl': 1,
};
const node = (name, type, position, parameters, extra = {}) => ({
  id: stableId(name), name, type, typeVersion: versions[type], position, parameters, ...extra,
});
const code = (name, position, jsCode) => node(name, 'n8n-nodes-base.code', position, {
  mode: 'runOnceForAllItems', jsCode,
});
const condition = (name, position, expression) => node(name, 'n8n-nodes-base.if', position, {
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
    conditions: [{ id: stableId(`${name}:condition`), leftValue: expression, rightValue: true,
      operator: { type: 'boolean', operation: 'true', singleValue: true } }],
    combinator: 'and',
  },
  options: {},
});
const connect = (workflow, from, to, output = 0) => {
  workflow.connections[from] ??= { main: [] };
  while (workflow.connections[from].main.length <= output) workflow.connections[from].main.push([]);
  workflow.connections[from].main[output].push({ node: to, type: 'main', index: 0 });
};

const workflow = {
  name: 'RE 06 - Capital Profile Verification', nodes: [], connections: {}, pinData: {}, active: false, tags: [],
  settings: { executionOrder: 'v1', saveManualExecutions: true, saveExecutionProgress: true,
    saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', executionTimeout: 1800 },
};

workflow.nodes.push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', [0, 240], {}));
workflow.nodes.push(node('Weekly Verification', 'n8n-nodes-base.scheduleTrigger', [0, 400], {
  rule: { interval: [{ field: 'weeks', weeksInterval: 1 }] },
}));
workflow.nodes.push(code('Verification Configuration', [240, 320], `return [{ json: {
  supabase_url: 'https://jaeltkzfjgrzgxgzxlfs.supabase.co',
  workspace_id: 'a51b8277-4cd5-4f8a-9ffd-4ddbe56683da',
  candidate_limit: 3,
  tavily_results_per_candidate: 3,
  max_source_chars: 18000,
  minimum_source_chars: 500,
  model: 'gpt-6-luna',
  minimum_profile_confidence: 0.72,
  profile_version: 'capital-profile-v1.0.0'
} }];`));
workflow.nodes.push(node('Load Verification Queue', 'n8n-nodes-base.httpRequest', [480, 320], {
  method: 'POST',
  url: "={{ $json.supabase_url + '/rest/v1/rpc/n8n_list_capital_profile_candidates' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] },
  sendBody: true, specifyBody: 'json',
  jsonBody: '={{ JSON.stringify({ p_workspace_id: $json.workspace_id, p_limit: $json.candidate_limit }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: credentials.supabaseApi }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Normalize Verification Queue', [720, 320], `const config = $('Verification Configuration').first().json;
const raw = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json]);
const rows = raw.filter((row) => row && row.entity_id && row.name).slice(0, config.candidate_limit);
if (!rows.length) return [{ json: { no_candidate: true, config } }];
return rows.map((row) => ({ json: { ...row, config, no_candidate: false } }));`));
workflow.nodes.push(node('Capital Candidate Loop', 'n8n-nodes-base.splitInBatches', [960, 320], {
  batchSize: 1, options: {},
}));
workflow.nodes.push(condition('Has Verification Candidate?', [1200, 440], '={{ $json.no_candidate !== true }}'));
workflow.nodes.push(code('Build Official Search', [1440, 360], `const candidate = $input.first().json;
const country = candidate.registry_country || 'India';
return [{ json: { ...candidate,
  query: '"' + candidate.name.replace(/"/g, '') + '" official website investment thesis portfolio ' + country,
  result_limit: candidate.config.tavily_results_per_candidate
} }];`));
workflow.nodes.push(node('Tavily Official Search', '@tavily/n8n-nodes-tavily.tavily', [1680, 360], {
  query: '={{ $json.query }}',
  options: { search_depth: 'basic', max_results: '={{ $json.result_limit }}' },
}, { credentials: { tavilyApi: credentials.tavilyApi }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000,
  alwaysOutputData: true, onError: 'continueRegularOutput' }));
workflow.nodes.push(code('Select Credible Official Page', [1920, 360], `const candidate = $('Build Official Search').item.json;
const response = $input.first().json ?? {};
const payload = response.data && Array.isArray(response.data.results) ? response.data : response;
const results = Array.isArray(payload.results) ? payload.results : [];
const blocked = /(^|\.)(linkedin|crunchbase|tracxn|pitchbook|wikipedia|wikidata|reddit|x|twitter|youtube|facebook|instagram|sebi)\./i;
const unsafeHost = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i;
const stopwords = new Set(['venture','ventures','capital','fund','funds','partners','management','india','private','limited','llp']);
const allTokens = String(candidate.name).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
const distinctiveTokens = allTokens.filter((token) => !stopwords.has(token));
const tokens = distinctiveTokens.length ? distinctiveTokens : allTokens;
const assess = (result) => {
  try {
    const url = new URL(String(result.url ?? ''));
    if (!/^https?:$/.test(url.protocol) || blocked.test(url.hostname) || unsafeHost.test(url.hostname)) return null;
    const haystack = (String(result.title ?? '') + ' ' + String(result.content ?? result.snippet ?? '') + ' ' + url.hostname).toLowerCase();
    const tokenMatches = tokens.filter((token) => haystack.includes(token)).length;
    const nameCoverage = tokens.length ? tokenMatches / tokens.length : 0;
    const pathBonus = /\/(about|portfolio|companies|investments?|thesis|strategy|focus)(\/|$)/i.test(url.pathname) ? 0.15 : 0;
    const score = Number(result.score ?? 0) + nameCoverage + pathBonus;
    return nameCoverage >= 0.5 ? { result, url: url.toString(), score } : null;
  } catch { return null; }
};
const ranked = results.map(assess).filter(Boolean).sort((a, b) => b.score - a.score);
let selected = ranked[0] ?? null;
if (!selected && candidate.current_canonical_url) {
  try {
    const url = new URL(candidate.current_canonical_url);
    if (/^https?:$/.test(url.protocol) && !blocked.test(url.hostname) && !unsafeHost.test(url.hostname)) selected = { url: url.toString(), score: 0.5 };
  } catch {}
}
return [{ json: { ...candidate, search_result_count: results.length,
  selected_url: selected?.url ?? null, canonical_url: selected?.url ?? null,
  selected_search_score: selected?.score ?? 0, has_credible_page: Boolean(selected) } }];`));
workflow.nodes.push(condition('Has Credible Official Page?', [2160, 360], '={{ $json.has_credible_page === true }}'));
workflow.nodes.push(node('Firecrawl Official Page', '@mendable/n8n-nodes-firecrawl.firecrawl', [2400, 280], {
  operation: 'scrape', url: '={{ $json.canonical_url }}', requestOptions: {},
}, { credentials: { firecrawlApi: credentials.firecrawlApi }, retryOnFail: true, maxTries: 2,
  waitBetweenTries: 1000, alwaysOutputData: true, onError: 'continueRegularOutput' }));
workflow.nodes.push(code('Normalize Official Page', [2640, 280], `const candidate = $('Select Credible Official Page').item.json;
const response = $input.first().json ?? {};
const data = response.data && typeof response.data === 'object' ? response.data : response;
const raw = String(data.markdown ?? response.markdown ?? data.content ?? response.content ?? '');
let content = raw.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/g, '')
  .replace(/\n{4,}/g, '\n\n\n').trim();
const extracted_char_count = content.length;
if (content.length > candidate.config.max_source_chars) content = content.slice(0, candidate.config.max_source_chars);
const extraction_ok = !response.error && !data.error && content.length >= candidate.config.minimum_source_chars;
return [{ json: { ...candidate, content_text: content, extracted_char_count, extraction_ok,
  extraction_error: extraction_ok ? null : (response.error ? 'FIRECRAWL_REQUEST_FAILED' : 'OFFICIAL_PAGE_CONTENT_INSUFFICIENT') } }];`));
workflow.nodes.push(condition('Official Content Usable?', [2880, 280], '={{ $json.extraction_ok === true }}'));
workflow.nodes.push(code('Build Profile Extraction Request', [3120, 200], `const candidate = $input.first().json;
const stringArray = (maxItems) => ({ type: 'array', maxItems, items: { type: 'string' } });
const schema = { type: 'object', additionalProperties: false, properties: {
  is_official_profile: { type: 'boolean' }, official_name: { type: 'string' }, official_website_url: { type: 'string' },
  stated_thesis_summary: { type: 'string' }, sectors: stringArray(20), stages: stringArray(12),
  geographies: stringArray(15), typical_check_size: { type: 'string' },
  portfolio_company_names: stringArray(30), evidence_quotes: stringArray(6), confidence: { type: 'number' }
}, required: ['is_official_profile','official_name','official_website_url','stated_thesis_summary','sectors','stages','geographies','typical_check_size','portfolio_company_names','evidence_quotes','confidence'] };
const input = { target_name: candidate.name, target_type: candidate.entity_type, selected_url: candidate.selected_url,
  instruction: 'Profile the named capital entity only.', source_text: candidate.content_text };
return [{ json: { ...candidate, openai_request: { model: candidate.config.model, store: false, max_output_tokens: 1400,
  instructions: 'Use only the supplied page text. Confirm whether the page is an official page for the target entity. Extract only explicitly stated investment thesis, sectors, stages, geographies, check size, and portfolio company names. Evidence quotes must be exact short excerpts from the source. Return empty strings or arrays when absent. Do not infer current investing activity, investments, amounts, dates, or relationships. Do not treat navigation, news mentions, directories, or third-party profiles as official.',
  input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(input) }] }],
  text: { format: { type: 'json_schema', name: 'capital_official_profile', strict: true, schema } }
} } }];`));
workflow.nodes.push(node('OpenAI Profile Extraction', 'n8n-nodes-base.httpRequest', [3360, 200], {
  method: 'POST', url: 'https://api.openai.com/v1/responses', authentication: 'predefinedCredentialType',
  nodeCredentialType: 'openAiApi', sendHeaders: true,
  headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.openai_request) }}',
  options: { timeout: 90000 },
}, { credentials: { openAiApi: credentials.openAiApi }, retryOnFail: true, maxTries: 2,
  waitBetweenTries: 1000, alwaysOutputData: true, onError: 'continueRegularOutput' }));
workflow.nodes.push(code('Validate Official Profile', [3600, 200], `const candidate = $('Build Profile Extraction Request').item.json;
const response = $input.first().json ?? {};
const outputText = (response.output ?? []).flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
let parsed = null;
try { if (outputText) parsed = JSON.parse(outputText); } catch {}
const cleanArray = (value, max) => [...new Set((Array.isArray(value) ? value : []).map((item) => String(item ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, max);
const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const content = normalize(candidate.content_text).toLowerCase();
const quotes = cleanArray(parsed?.evidence_quotes, 6).filter((quote) => content.includes(normalize(quote).toLowerCase()));
let outputHost = '';
let selectedHost = '';
try { outputHost = new URL(String(parsed?.official_website_url ?? '')).hostname.replace(/^www\./, ''); } catch {}
try { selectedHost = new URL(candidate.selected_url).hostname.replace(/^www\./, ''); } catch {}
const sameDomain = Boolean(outputHost && selectedHost && (outputHost === selectedHost || outputHost.endsWith('.' + selectedHost) || selectedHost.endsWith('.' + outputHost)));
const confidence = Math.max(0, Math.min(1, Number(parsed?.confidence ?? 0)));
const meaningful = Boolean(normalize(parsed?.stated_thesis_summary) || cleanArray(parsed?.sectors, 20).length || cleanArray(parsed?.portfolio_company_names, 30).length);
const verified = Boolean(parsed?.is_official_profile && sameDomain && quotes.length && meaningful && confidence >= candidate.config.minimum_profile_confidence);
return [{ json: { p_profile: {
  workspace_id: candidate.workspace_id, entity_id: candidate.entity_id, status: verified ? 'verified' : 'needs_review',
  official_website_url: verified ? String(parsed.official_website_url) : '', profile_source_url: candidate.selected_url,
  confidence, stated_thesis_summary: verified ? normalize(parsed.stated_thesis_summary).slice(0, 4000) : '',
  sectors: verified ? cleanArray(parsed.sectors, 20) : [], stages: verified ? cleanArray(parsed.stages, 12) : [],
  geographies: verified ? cleanArray(parsed.geographies, 15) : [], typical_check_size: verified ? normalize(parsed.typical_check_size).slice(0, 500) : '',
  portfolio_company_names: verified ? cleanArray(parsed.portfolio_company_names, 30) : [], evidence_quotes: verified ? quotes : [],
  _workflow_context: { name: candidate.name, outcome: verified ? 'verified' : 'needs_review',
    reason: verified ? null : (!parsed ? 'OPENAI_OUTPUT_INVALID' : 'PROFILE_QUALITY_GATE'), paid_calls: { tavily: 1, firecrawl: 1, openai: 1 } }
} } }];`));
workflow.nodes.push(code('Prepare Search Review', [2400, 520], `const candidate = $input.first().json;
return [{ json: { p_profile: { workspace_id: candidate.workspace_id, entity_id: candidate.entity_id,
  status: 'needs_review', official_website_url: '', profile_source_url: '', confidence: 0,
  stated_thesis_summary: '', sectors: [], stages: [], geographies: [], typical_check_size: '',
  portfolio_company_names: [], evidence_quotes: [], _workflow_context: { name: candidate.name,
    outcome: 'needs_review', reason: 'NO_CREDIBLE_OFFICIAL_PAGE', paid_calls: { tavily: 1, firecrawl: 0, openai: 0 } }
} } }];`));
workflow.nodes.push(code('Prepare Content Review', [3120, 440], `const candidate = $input.first().json;
return [{ json: { p_profile: { workspace_id: candidate.workspace_id, entity_id: candidate.entity_id,
  status: 'needs_review', official_website_url: '', profile_source_url: candidate.selected_url || '', confidence: 0,
  stated_thesis_summary: '', sectors: [], stages: [], geographies: [], typical_check_size: '',
  portfolio_company_names: [], evidence_quotes: [], _workflow_context: { name: candidate.name,
    outcome: 'needs_review', reason: candidate.extraction_error || 'OFFICIAL_PAGE_CONTENT_INSUFFICIENT',
    paid_calls: { tavily: 1, firecrawl: 1, openai: 0 } }
} } }];`));
workflow.nodes.push(node('Persist Official Profile', 'n8n-nodes-base.httpRequest', [3840, 360], {
  method: 'POST',
  url: "={{ $('Verification Configuration').item.json.supabase_url + '/rest/v1/rpc/n8n_update_capital_official_profile' }}",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendHeaders: true, headerParameters: { parameters: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Prefer', value: 'return=representation' },
  ] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ p_profile: $json.p_profile }) }}',
  options: { timeout: 30000 },
}, { credentials: { supabaseApi: credentials.supabaseApi }, retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 }));
workflow.nodes.push(code('Profile Candidate Complete', [4080, 360], `const response = $input.first().json ?? {};
const result = Array.isArray(response) ? (response[0] ?? {}) : response;
const context = result.workflow_context ?? {};
return [{ json: { completed: true, entity_id: result.entity_id ?? null,
  name: result.name ?? context.name ?? null, official_profile_status: result.official_profile_status ?? context.outcome ?? 'needs_review',
  reason: context.reason ?? null, paid_calls: context.paid_calls ?? { tavily: 1, firecrawl: 0, openai: 0 },
  activity_status_changed: result.activity_status_changed ?? false } }];`));
workflow.nodes.push(code('No Candidate Complete', [1440, 600], `return [{ json: { completed: false, no_candidate: true,
  paid_calls: { tavily: 0, firecrawl: 0, openai: 0 }, activity_status_changed: false } }];`));
workflow.nodes.push(code('Capital Profile Summary', [1200, 120], `const rows = $input.all().map((item) => item.json ?? {});
const calls = rows.reduce((sum, row) => ({ tavily: sum.tavily + Number(row.paid_calls?.tavily ?? 0),
  firecrawl: sum.firecrawl + Number(row.paid_calls?.firecrawl ?? 0), openai: sum.openai + Number(row.paid_calls?.openai ?? 0) }),
  { tavily: 0, firecrawl: 0, openai: 0 });
return [{ json: { status: 'completed', candidates_processed: rows.filter((row) => row.completed).length,
  profiles_verified: rows.filter((row) => row.official_profile_status === 'verified').length,
  profiles_needing_review: rows.filter((row) => row.official_profile_status === 'needs_review').length,
  no_candidates_due: rows.some((row) => row.no_candidate), provider_calls: calls,
  activity_status_changes: rows.filter((row) => row.activity_status_changed === true).length,
  note: 'Official profile verification does not assert current investing activity or create investment relationships.' } }];`));

connect(workflow, 'Manual Trigger', 'Verification Configuration');
connect(workflow, 'Weekly Verification', 'Verification Configuration');
connect(workflow, 'Verification Configuration', 'Load Verification Queue');
connect(workflow, 'Load Verification Queue', 'Normalize Verification Queue');
connect(workflow, 'Normalize Verification Queue', 'Capital Candidate Loop');
connect(workflow, 'Capital Candidate Loop', 'Capital Profile Summary', 0);
connect(workflow, 'Capital Candidate Loop', 'Has Verification Candidate?', 1);
connect(workflow, 'Has Verification Candidate?', 'Build Official Search', 0);
connect(workflow, 'Has Verification Candidate?', 'No Candidate Complete', 1);
connect(workflow, 'Build Official Search', 'Tavily Official Search');
connect(workflow, 'Tavily Official Search', 'Select Credible Official Page');
connect(workflow, 'Select Credible Official Page', 'Has Credible Official Page?');
connect(workflow, 'Has Credible Official Page?', 'Firecrawl Official Page', 0);
connect(workflow, 'Has Credible Official Page?', 'Prepare Search Review', 1);
connect(workflow, 'Firecrawl Official Page', 'Normalize Official Page');
connect(workflow, 'Normalize Official Page', 'Official Content Usable?');
connect(workflow, 'Official Content Usable?', 'Build Profile Extraction Request', 0);
connect(workflow, 'Official Content Usable?', 'Prepare Content Review', 1);
connect(workflow, 'Build Profile Extraction Request', 'OpenAI Profile Extraction');
connect(workflow, 'OpenAI Profile Extraction', 'Validate Official Profile');
connect(workflow, 'Validate Official Profile', 'Persist Official Profile');
connect(workflow, 'Prepare Search Review', 'Persist Official Profile');
connect(workflow, 'Prepare Content Review', 'Persist Official Profile');
connect(workflow, 'Persist Official Profile', 'Profile Candidate Complete');
connect(workflow, 'Profile Candidate Complete', 'Capital Candidate Loop');
connect(workflow, 'No Candidate Complete', 'Capital Candidate Loop');

const output = path.join(__dirname, 'capital_profile_verification.json');
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(output);
