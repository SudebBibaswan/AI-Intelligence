const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'migrations', '202609280001_signal_human_review.sql'), 'utf8');
const required = [
  'create table if not exists public.signal_reviews',
  "decision in ('accepted', 'rejected')",
  'request_id uuid not null unique',
  'create or replace function public.review_intelligence_signal(',
  "private.is_workspace_member(v_signal.workspace_id, array['owner', 'admin', 'member'])",
  'REVIEW_REQUEST_ID_CONFLICT',
  'SIGNAL_REQUIRES_LINKED_EVIDENCE',
  'SIGNAL_REQUIRES_CURRENT_VERIFIED_EVIDENCE',
  "'signal.reviewed'",
  'create or replace view public.v_signal_review_queue',
  'create or replace view public.v_observation_eligible_signals',
  "where signal.status = 'accepted'",
  'and evidence_stats.invalid_evidence_count = 0',
  'grant execute on function public.review_intelligence_signal(uuid, text, text, uuid) to authenticated',
];
for (const fragment of required) if (!sql.includes(fragment)) throw new Error(`MISSING_SIGNAL_REVIEW_GUARD:${fragment}`);
if (/grant\s+(insert|update|delete)\s+on\s+public\.signal_reviews\s+to\s+authenticated/i.test(sql)) {
  throw new Error('DIRECT_SIGNAL_REVIEW_WRITES_MUST_REMAIN_BLOCKED');
}
if (/grant\s+update\s+on\s+public\.signals\s+to\s+authenticated/i.test(sql)) {
  throw new Error('DIRECT_SIGNAL_STATUS_WRITES_MUST_REMAIN_BLOCKED');
}
if (/drop table|drop column/i.test(sql)) throw new Error('NON_ADDITIVE_SIGNAL_REVIEW_MIGRATION');
if (!/^begin;/m.test(sql) || !/^commit;/m.test(sql)) throw new Error('MIGRATION_NOT_TRANSACTIONAL');

console.log('SIGNAL HUMAN REVIEW VALIDATION PASSED');
console.log(JSON.stringify({ decisions: ['accepted', 'rejected'], audit: true, replaySafe: true,
  acceptanceRevalidatesEvidence: true, observationEligibilityRequiresAcceptedSignals: true }, null, 2));
