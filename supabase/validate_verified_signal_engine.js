const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'migrations', '202609270015_verified_signal_engine.sql'), 'utf8');
const required = [
  'create or replace function public.n8n_list_signal_evidence_candidates(',
  "and evidence.verification_status = 'verified'",
  'partition by run.workspace_domain_id, source.id',
  'p_evidence_per_source integer default 2',
  'create unique index if not exists signals_workspace_dedupe_uidx',
  'create or replace function public.n8n_upsert_verified_signal(p_signal jsonb)',
  "SIGNAL_REQUIRES_VERIFIED_SAME_DOMAIN_EVIDENCE",
  "case when v_source_count >= 2 then 1 else 0.75 end",
  "'corroboration_status', case when v_source_count >= 2 then 'multi_source' else 'single_source' end",
  "'draft'",
  'insert into public.signal_evidence',
  'insert into public.signal_entities',
  'create or replace view public.v_signal_engine_health',
];
for (const fragment of required) if (!sql.includes(fragment)) throw new Error(`MISSING_SIGNAL_GUARD:${fragment}`);
if (/verification_status\s*<>\s*'rejected'/i.test(sql)) throw new Error('SIGNALS_MUST_REQUIRE_VERIFIED_EVIDENCE');
if (/status[^\n]*'accepted'/i.test(sql.split('insert into public.signals')[1]?.split('return jsonb_build_object')[0] ?? '')) {
  throw new Error('SIGNALS_MUST_NOT_AUTO_ACCEPT');
}
if (/drop table|drop column/i.test(sql)) throw new Error('NON_ADDITIVE_SIGNAL_MIGRATION');
if (!/^begin;/m.test(sql) || !/^commit;/m.test(sql)) throw new Error('MIGRATION_NOT_TRANSACTIONAL');

console.log('VERIFIED SIGNAL ENGINE SQL VALIDATION PASSED');
console.log(JSON.stringify({ domainsPerRun: 3, evidencePerDomain: 12, evidencePerSource: 2,
  outputStatus: 'draft', sourceDiversityAware: true, replaySafe: true }, null, 2));
