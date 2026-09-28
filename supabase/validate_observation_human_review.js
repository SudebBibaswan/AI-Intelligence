const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'migrations', '202609280004_observation_human_review.sql'), 'utf8');
const required = [
  'create table if not exists public.observation_reviews',
  "decision in ('accepted', 'rejected')",
  'request_id uuid not null unique',
  'create or replace function public.review_intelligence_observation(',
  "private.is_workspace_member(v_observation.workspace_id, array['owner', 'admin', 'member'])",
  'OBSERVATION_REQUIRES_TWO_ACCEPTED_SIGNALS',
  'OBSERVATION_REQUIRES_TWO_CURRENT_SOURCES',
  'OBSERVATION_REQUIRES_CURRENT_ACCEPTED_SIGNALS',
  "'observation.reviewed'",
  'create or replace view public.v_observation_review_queue',
  'create or replace view public.v_observation_review_details',
  'create or replace view public.v_pattern_eligible_observations',
  "where observation.status = 'accepted'",
  'and link_stats.invalid_signal_count = 0',
  'grant execute on function public.review_intelligence_observation(uuid, text, text, uuid) to authenticated',
];
for (const fragment of required) if (!sql.includes(fragment)) throw new Error(`MISSING_OBSERVATION_REVIEW_GUARD:${fragment}`);
if (/grant\s+(insert|update|delete)\s+on\s+public\.observation_reviews\s+to\s+authenticated/i.test(sql)) {
  throw new Error('DIRECT_OBSERVATION_REVIEW_WRITES_MUST_REMAIN_BLOCKED');
}
if (/grant\s+update\s+on\s+public\.observations\s+to\s+authenticated/i.test(sql)) {
  throw new Error('DIRECT_OBSERVATION_STATUS_WRITES_MUST_REMAIN_BLOCKED');
}
if (/drop table|drop column/i.test(sql)) throw new Error('NON_ADDITIVE_OBSERVATION_REVIEW_MIGRATION');
if (!/^begin;/m.test(sql) || !/^commit;/m.test(sql)) throw new Error('MIGRATION_NOT_TRANSACTIONAL');

console.log('OBSERVATION HUMAN REVIEW VALIDATION PASSED');
console.log(JSON.stringify({ decisions: ['accepted', 'rejected'], audit: true, replaySafe: true,
  acceptanceRevalidatesSignalsAndEvidence: true, patternEligibilityRequiresAcceptedObservations: true }, null, 2));
