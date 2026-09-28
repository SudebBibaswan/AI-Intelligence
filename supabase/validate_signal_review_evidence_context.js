const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'migrations', '202609280002_signal_review_evidence_context.sql'), 'utf8');
const required = [
  'create or replace view public.v_signal_review_details',
  'with (security_invoker = true)',
  'signal.title as signal_title',
  'evidence.claim_text',
  'evidence.excerpt',
  'source.canonical_url',
  'source.source_quality_score',
  'evidence_currently_eligible',
  "where signal.status = 'draft'",
  'grant select on public.v_signal_review_details to authenticated',
];
for (const fragment of required) if (!sql.includes(fragment)) throw new Error(`MISSING_SIGNAL_REVIEW_CONTEXT:${fragment}`);
if (/grant\s+(insert|update|delete)/i.test(sql)) throw new Error('REVIEW_CONTEXT_MUST_BE_READ_ONLY');
if (/drop table|drop column/i.test(sql)) throw new Error('NON_ADDITIVE_REVIEW_CONTEXT_MIGRATION');
if (!/^begin;/m.test(sql) || !/^commit;/m.test(sql)) throw new Error('MIGRATION_NOT_TRANSACTIONAL');

console.log('SIGNAL REVIEW EVIDENCE CONTEXT VALIDATION PASSED');
console.log(JSON.stringify({ readOnly: true, sourceContext: true, evidenceEligibilityVisible: true }, null, 2));
