# RE09 Pattern Engine — Nemotron Handoff

## Your assignment

Continue this repository from its current state and implement **RE09: Verified Pattern Engine**. Do not redesign RE01–RE08, reset the database, or start RE10/RE11. Preserve all existing uncommitted files and inspect them before editing.

Repository: `C:\Users\jaksh\OneDrive\Documents\AI-Intelligence System`  
Branch: `main`  
Current workspace ID: `a51b8277-4cd5-4f8a-9ffd-4ddbe56683da`  
Current workspace-domain ID: `11068f00-2e6b-462c-b455-c69384e5e8a8`

## Product architecture already decided

There is exactly **one mandatory human gate**:

```text
Research Engine V2
  -> AI/policy-verified evidence
  -> RE07 draft signals
  -> HUMAN accepts/rejects signals (only human gate)
  -> RE08 auto-accepted observations
  -> RE09 patterns
  -> RE10 gaps/hypotheses
  -> RE11 adversarial validation
  -> draft insights
```

- Evidence verification is automated and provenance is stored.
- Humans review only draft signals after RE07.
- RE08 observations are accepted automatically only when deterministic lineage/diversity rules pass.
- RE09–RE11 must add no new mandatory human review.
- Models propose structured output; PostgreSQL RPCs enforce identity, lineage, diversity, state transitions, and replay safety.

## Current production state

- Research Engine V2 produced 12 eligible evidence records from 6 independent sources.
- RE07 created 4 signals; the human accepted all four.
- Each current signal has confidence `0.750` and `corroboration_status = single_source`.
- RE08 completed correctly but created **0 observations**. It passed its eligibility gate, but the four signals were not coherent enough to form a bounded cross-signal observation. Do not weaken RE08 to force output.
- Therefore RE09 currently has no real observation corpus. Build and validate RE09 with fixtures; it should return zero patterns on current production data until enough coherent observations accumulate.

Operational data will continue accumulating through:

```text
Research Engine V2 -> RE07 -> review only new draft signals -> RE08
```

Never require previously accepted signals to be reviewed again.

## Read these files first

1. `docs/architecture/single_human_gate_pipeline.md`
2. `docs/intelligence_platform_master_plan.md`
3. `supabase/migrations/202609270004_intelligence_and_operations.sql`
4. `supabase/migrations/202609270006_views_seed_and_storage.sql`
5. `supabase/migrations/202609280003_verified_observation_engine.sql`
6. `supabase/migrations/202609280005_single_human_gate.sql`
7. `n8n/build_verified_observation_engine_workflow.js`
8. `n8n/verified_observation_engine.json`
9. `n8n/validate_verified_observation_engine_workflow.js`
10. `n8n/test_verified_observation_engine_logic.js`

Use RE07/RE08 conventions and existing schema foundations rather than creating a parallel architecture. Existing tables include `patterns`, `pattern_observations`, `hypotheses`, `hypothesis_patterns`, `validation_runs`, `validation_evidence`, and `insights`; existing views include `v_pattern_summaries` and `v_hypothesis_validation_status`.

## Exact RE09 contract

### Purpose

Identify a repeated, bounded relationship across accepted observations. RE09 is **not** a news summarizer and must not create patterns directly from signals.

### Minimum eligible input

A proposed pattern must cite:

- at least 3 accepted observations;
- at least 3 independent underlying source families;
- at least 2 distinct events or entities; and
- either recurrence across time or repetition across independent entities.

Full lineage must resolve:

```text
pattern -> observations -> signals -> evidence -> sources
```

Syndicated, mirrored, or republished articles count as one source family.

### Structured output

Each proposal must contain:

- `pattern_type`
- concise `title`
- bounded `statement`
- supporting observation IDs
- contradicting observation IDs, when present
- `strength_score`
- `persistence_score`
- `diversity_score`
- `confidence`
- time window
- first and last confirmation timestamps
- engine version and audit metadata

Initial accepted status is `emerging`. A later run may promote a genuinely recurring pattern to `persistent`. `weakening` and `contradicted` require explicit counter-evidence; silence or missing new data must never change a pattern to either state.

### Safety and correctness rules

- The model may propose patterns, but the database must verify every cited observation and complete lineage.
- Enforce workspace and domain isolation at every boundary.
- Reject invented, cross-workspace, non-accepted, or inaccessible observation IDs.
- No causal or predictive language unless the cited material directly supports it.
- Incoherent or insufficient input returns zero patterns without error.
- Preserve contradictions instead of filtering them away.
- Upserts must be idempotent and semantically deduplicated; replaying identical input must not create duplicates.
- Provider failure must not create or promote a pattern.
- RE09 must add no human gate.

## Required implementation

Inspect migration filenames first, then use the next collision-free migration name (expected: `supabase/migrations/202609280006_verified_pattern_engine.sql`). Implement:

1. A guarded candidate-loader RPC, for example `public.n8n_list_pattern_observation_candidates(...)`, returning accepted observations plus sufficient lineage and source-family information.
2. A guarded pattern-upsert RPC, for example `public.n8n_upsert_verified_pattern(p_pattern jsonb)`, which deterministically validates IDs, lineage, thresholds, scores, status, and deduplication.
3. Deterministic revalidation/promotion logic. The LLM must not promote status merely by asking.
4. Necessary indexes and a stable semantic dedupe key.
5. `n8n/build_verified_pattern_engine_workflow.js`.
6. Generated `n8n/verified_pattern_engine.json`.
7. `n8n/validate_verified_pattern_engine_workflow.js`.
8. `n8n/test_verified_pattern_engine_logic.js`.
9. Concise documentation updates describing import order, credentials, inputs, output summary, and the absence of a new human gate.

The n8n workflow should follow the established shape:

```text
Manual/Schedule Trigger
  -> Configuration
  -> Load Eligible Accepted Observations
  -> Build Diverse Domain Packs
  -> Domain Loop
  -> Build Strict Structured Request
  -> OpenAI Responses API
  -> Validate Model Candidates
  -> Candidate Loop
  -> Has Valid Pattern?
       yes -> Persist Verified Pattern
       no  -> Skip Safely
  -> Domain Complete
  -> Summary
```

## Mandatory tests

Cover at least:

- valid minimum: 3 observations, 3 independent source families, 2 events/entities;
- fewer than 3 observations;
- fake diversity caused by syndicated copies;
- cross-workspace and cross-domain IDs;
- invalid or non-accepted observation IDs;
- duplicate replay and semantic deduplication;
- supporting and contradicting observations together;
- explicit contradiction-driven state change;
- proof that silence does not imply weakening;
- empty, incoherent, and partial input;
- provider failure;
- bounded-language rejection;
- status promotion allowed only by deterministic policy.

Run all existing RE07/RE08 validators and logic tests as regression checks. Do not call RE09 complete until migration validation, workflow validation, logic tests, generated-JSON reproducibility, and diff checks pass.

## Definition of done

RE09 is complete when it safely produces zero or more traceable patterns from accepted observations, never fabricates diversity or lineage, is replay-safe, preserves counter-evidence, and requires no human action. Return a concise change summary, exact migration/application command, n8n import order, tests run, and any remaining operational limitation.

## Later engines — context only, do not implement now

- **RE10 Gap/Hypothesis Engine:** converts persistent patterns, or capped high-strength emerging patterns, into testable hypotheses with target user, problem, proposed value, assumptions, falsifiers, validation questions, cited pattern IDs, and semantic deduplication. Funding alone is not proof of demand.
- **RE11 Adversarial Validation Engine:** uses the shared Research Engine for targeted competitor, demand, adoption, funding, technical, regulatory, incumbent, failed-attempt, and counter-signal research. It preserves supporting/contradicting/neutral evidence; PostgreSQL determines `supported`, `mixed`, `weakened`, or `inconclusive`. Partial failures can never produce false support.

## Repository safety

The working tree already contains substantial valid uncommitted work. Do not run destructive Git commands, clean untracked files, reset the database, rename existing workflows, or overwrite unrelated changes. Make narrowly scoped RE09 additions and preserve the existing single-human-gate architecture.
