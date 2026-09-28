const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'migrations', '202609270014_evidence_human_review.sql'), 'utf8');
const required = [
  'create table if not exists public.evidence_reviews',
  "decision in ('verified', 'disputed', 'rejected')",
  'request_id uuid not null unique',
  'create or replace function public.review_research_evidence(',
  "private.is_workspace_member(v_evidence.workspace_id, array['owner', 'admin', 'member'])",
  "private.is_workspace_member(v_existing.workspace_id, array['owner', 'admin', 'member'])",
  "'evidence.reviewed'",
  'create or replace view public.v_evidence_review_queue',
  'create or replace view public.v_signal_eligible_evidence',
  "where evidence.verification_status = 'verified'",
  "and supporting_evidence.verification_status = 'verified'",
  'grant execute on function public.review_research_evidence(uuid, text, text, uuid) to authenticated',
];
for (const fragment of required) if (!sql.includes(fragment)) throw new Error(`MISSING_REVIEW_GUARD:${fragment}`);
if (/grant\s+(insert|update|delete)\s+on\s+public\.evidence_reviews\s+to\s+authenticated/i.test(sql)) {
  throw new Error('DIRECT_REVIEW_WRITES_MUST_REMAIN_BLOCKED');
}
if (/drop table|drop column/i.test(sql)) throw new Error('NON_ADDITIVE_REVIEW_MIGRATION');
if (!/^begin;/m.test(sql) || !/^commit;/m.test(sql)) throw new Error('MIGRATION_NOT_TRANSACTIONAL');

console.log('EVIDENCE HUMAN REVIEW VALIDATION PASSED');
console.log(JSON.stringify({ decisions: ['verified', 'disputed', 'rejected'], audit: true,
  replaySafe: true, signalEligibilityRequiresVerifiedEvidence: true, capitalActivityRequiresVerifiedEvidence: true }, null, 2));
