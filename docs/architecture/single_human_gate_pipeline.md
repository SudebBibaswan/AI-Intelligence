# Single-human-gate intelligence pipeline

## Decision

The only mandatory human intervention is the review of draft signals produced
by RE 07. Evidence verification, observation acceptance, pattern detection,
and hypothesis generation are automated policy decisions with recorded provenance.

## Runtime flow

1. Research workflows discover, extract, normalize, and deduplicate sources.
2. Evidence is automatically verified only when the excerpt is an exact match
   to extracted source text, the payload is structurally valid, and confidence
   meets the minimum threshold. Failed evidence is rejected or quarantined.
3. RE 07 consumes automatically verified evidence and creates draft signals.
4. A human reviews each material signal together with its evidence and makes the
   single `accepted` or `rejected` decision.
5. RE 08 consumes only accepted signals. It requires at least two accepted
   signals backed collectively by at least two current independent sources.
6. Valid bounded observations are automatically accepted and become eligible
   for later pattern analysis. Invalid or incoherent candidates are discarded.
7. RE 09 consumes only accepted observations. It requires at least three
   accepted observations backed by at least three independent source families
   and at least two distinct events or entities, with recurrence across time or
   repetition across independent entities. Valid patterns are persisted as
   `emerging`; a later deterministic revalidation may promote genuinely
   recurring patterns to `persistent`. No human gate is added.
8. RE 10 consumes `persistent` patterns (or capped high-strength `emerging`).
   It produces testable hypotheses with `target_user`, `problem`, `assumptions`,
   `falsifiers`, and `validation_questions`. Funding alone is not proof of demand.
   Hypotheses auto-advance to `ready_for_validation`. No human gate is added.

## Trust boundaries

| Layer | Decision maker | Mandatory checks | Result |
|---|---|---|---|
| Evidence | Automated policy | Exact excerpt grounding, supported type and polarity, confidence threshold, current source | `verified` or excluded |
| Signal | Human reviewer | Claim fidelity, materiality, correct interpretation, linked evidence | `accepted` or `rejected` |
| Observation | Automated policy | Two accepted signals, two independent sources, current inputs, bounded non-causal language | `accepted` or excluded |
| Pattern | Automated policy | Three accepted observations, three independent source families, two distinct events/entities, recurrence or repetition, bounded non-causal language | `emerging`/`persistent`/`contradicted` or excluded |
| Hypothesis | Automated policy | Eligible pattern(s), target_user, problem, assumptions[], falsifiers[], validation_questions[], funding≠demand, semantic dedupe | `ready_for_validation` or excluded |

Evidence and observation review tables remain available for audit, correction,
and exceptional intervention. They are not gates in the normal agent path.

## Provenance

- Evidence records store `verification_method`, `verification_score`,
  `verified_at`, and `verifier_version`.
- Observation records store `acceptance_method` and `accepted_at`.
- Pattern records store `first_detected_at`, `last_confirmed_at`, and deterministic
  `status` transitions (`emerging` → `persistent` on thresholds, `contradicted`
  on explicit counter-evidence). Silence never changes status.
- Hypothesis records store `origin='engine'`, `dedupe_key` (target_user + problem + pattern_ids),
  and auto-transition to `ready_for_validation`. RE11 determines final result.
- Automatic observation acceptance writes an audit-log event using policy
  `single-human-gate-v1`.
- Signal review continues to use the audited `signal_reviews` table and
  `review_intelligence_signal` RPC.

## Failure behavior

- Evidence that fails automatic grounding does not enter RE 07.
- A rejected signal never enters RE 08.
- RE 08 returns no observation when accepted signals are unrelated or lack
  source diversity; it must not force a synthesis.
- RE 09 returns no pattern when accepted observations are insufficient,
  lack source-family diversity, lack distinct events/entities, or contain
  forbidden causal/predictive language; it must not force a synthesis.
- RE 10 returns no hypothesis when eligible patterns lack target_user/problem,
  assumptions/falsifiers/validation_questions are missing, funding-only language
  is used, or semantic duplicate exists; it must not force a synthesis.
- Automatic observation acceptance is idempotent and refuses drafts whose
  linked inputs no longer meet policy.
- Pattern upserts are idempotent and semantically deduplicated; replaying
  identical input never creates duplicates.
- Hypothesis upserts are idempotent and semantically deduplicated; replaying
  identical input never creates duplicates.
- Provider failure must not create or promote a pattern or hypothesis.

## Fresh-start order

1. Apply all migrations through `202609280007_verified_hypothesis_engine.sql`.
2. Import the regenerated Research Engine, RE 07, RE 08, RE 09, and RE 10 workflow JSON files.
3. Back up Supabase.
4. Preview and execute `supabase/reset_workspace_generated_data.sql`.
5. Run collection workflows from the beginning.
6. Human-review draft signals after RE 07.
7. Run RE 08; valid observations continue automatically.
8. Run RE 09; valid patterns continue automatically.
9. Run RE 10; valid hypotheses continue automatically. Previously accepted signals
   are never re-reviewed.
