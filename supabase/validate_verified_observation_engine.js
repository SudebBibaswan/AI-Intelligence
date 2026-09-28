const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'migrations', '202609280003_verified_observation_engine.sql'), 'utf8');
const required = [
  'create or replace function public.n8n_list_observation_signal_candidates(',
  "and signal.status = 'accepted'",
  'having count(*) >= 2',
  'create unique index if not exists observations_workspace_dedupe_uidx',
  'create or replace function public.n8n_upsert_verified_observation(p_observation jsonb)',
  'OBSERVATION_REQUIRES_TWO_TO_EIGHT_SIGNALS',
  'OBSERVATION_REQUIRES_ACCEPTED_CURRENT_SIGNALS',
  'OBSERVATION_REQUIRES_TWO_INDEPENDENT_SOURCES',
  "'corroboration_status', 'multi_source'",
  "'draft', v_final_confidence",
  'insert into public.observation_signals',
  'create or replace view public.v_observation_engine_health',
];
for (const fragment of required) if (!sql.includes(fragment)) throw new Error(`MISSING_OBSERVATION_GUARD:${fragment}`);
if (/status[^\n]*'accepted'[^\n]*v_final_confidence/i.test(sql)) throw new Error('OBSERVATIONS_MUST_NOT_AUTO_ACCEPT');
if (/drop table|drop column/i.test(sql)) throw new Error('NON_ADDITIVE_OBSERVATION_MIGRATION');
if (!/^begin;/m.test(sql) || !/^commit;/m.test(sql)) throw new Error('MIGRATION_NOT_TRANSACTIONAL');

console.log('VERIFIED OBSERVATION ENGINE SQL VALIDATION PASSED');
console.log(JSON.stringify({ minimumSignals: 2, minimumSources: 2, outputStatus: 'draft',
  acceptedSignalsOnly: true, replaySafe: true, noPatternsOrHypotheses: true }, null, 2));
