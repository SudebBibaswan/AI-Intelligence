# Research Engine Generalization and Department Readiness

The Research Engine is reusable across departments only at the pipeline and contract level. A provider route that performs well for AI news is not automatically valid for investments, regulation, enterprise adoption, scientific research, or another department. Each department needs a versioned domain profile and its own reviewed evaluation slice.

Status: common architecture approved for Phase 0 preparation; department approvals pending

## What is shared

These parts should remain department-neutral:

- Run lifecycle, idempotency, budgets, retries, and failure states.
- Provider adapter interface.
- URL normalization, canonicalization, hashing, and exact deduplication.
- Research source and evidence contracts.
- Lineage, audit, storage expiry, and cost accounting.
- Schema validation and deterministic evidence checks.
- Credential handling and environment separation.
- Human-review state machine.

These are infrastructure rules. They should not encode AI-specific publishers, keywords, or thresholds.

## What each department must define

| Domain profile field | Example for AI intelligence | Why it cannot be global |
|---|---|---|
| Topics and exclusions | Models, agents, infrastructure; exclude generic consumer AI tips | Relevance changes by department |
| Entity types | Model, lab, startup, fund, product, regulator | Entity identity and merge risk differ |
| Geography | Global plus India | Source authority and language differ |
| Source catalogue | Labs, arXiv, GitHub, regulators, reporting | Credible sources differ |
| Query families | Releases, funding, safety, adoption | Discovery vocabulary differs |
| Freshness windows | Hours for releases, months for research | Materiality decays differently |
| Evidence requirements | Exact release claim, benchmark, price, date | Claims need different fields |
| Source-proximity rules | Official release versus independent verification | Self-reporting risk differs |
| Storage classes | Public release text versus paywalled reporting | Rights and privacy differ |
| Acceptance thresholds | High precision for automatic acceptance | Error cost differs |
| Completion requirements | Minimum sources, publishers, geographies | Coverage expectations differ |

## Department profile contract

Before a department receives an automated workflow, create a versioned profile containing:

```yaml
domain_id: department-slug
profile_version: 1.0.0
owners: []
topics: []
exclusions: []
entity_types: []
geographies: []
languages: []
source_catalog_version: 1.0.0
query_set_version: 1.0.0
freshness_windows: {}
evidence_requirements: {}
storage_policy_version: 1.0.0
accept_review_reject_thresholds: {}
run_limits: {}
completion_requirements: {}
evaluation_dataset_version: null
review_by: null
```

This is a design contract, not a secret-bearing configuration file.

## Generalization gates

Use the following progression for every new department:

### Gate 1: Domain definition

- Named product question and user decision supported by the research.
- Positive, negative, and borderline examples.
- Required entities, geographies, languages, and time windows.
- Explicit exclusions and unacceptable failure modes.

### Gate 2: Source and policy fit

- At least ten credible publishers or structured sources where the domain permits it.
- No single publisher group dominates the evaluation set.
- Source authority and independence rules defined.
- Storage, display, privacy, and deletion behavior assigned.
- Blocked and paywalled behavior defined.

### Gate 3: Evaluation slice

- A 30-case human-reviewed pilot for adapter compatibility and obvious failure discovery.
- A department-specific 100-case reviewed set before automatic acceptance.
- Difficult extraction, duplicates, irrelevant/spam, and evidence cases represented.
- Two human reviews and adjudication completed.

Shared infrastructure cases may be reused to test mechanics, but they cannot replace department-specific relevance and evidence cases.

### Gate 4: Provider and model benchmark

- Same approved inputs for every candidate route.
- Quality, coverage, terms, retention, cost, reliability, and latency recorded.
- Mandatory gates applied before weighted scoring.
- Defaults, fallbacks, and stop conditions approved per capability.

### Gate 5: Limited rollout

- Runs remain review-only.
- Every false acceptance, false rejection, false merge, unsupported claim, wrong date, and wrong number is classified.
- Thresholds change only through a new evaluation result.

### Gate 6: Automatic acceptance

- Department dataset passes its mandatory gates.
- Credential, retention, logging, and budget controls are approved.
- Product owner accepts the user-visible error risk.
- Review-by date and rollback condition are recorded.

## Initial department matrix

| Department/use case | Reusable core | New evaluation needed | Special risk |
|---|---:|---:|---|
| AI ecosystem intelligence | Yes | Current 100-row set after repair and human review | Vendor announcements and fast-moving dates |
| Investment and funding intelligence | Yes | Yes | Currency, round stage, participant roles, rumours, and paywalled reporting |
| Enterprise adoption intelligence | Yes | Yes | Marketing claims versus measured deployment outcomes |
| Policy and regulation | Yes | Yes | Jurisdiction, effective dates, amendments, and primary legal text |
| Scientific and technical research | Yes | Yes | Preprint status, versions, methods, benchmarks, and retractions |
| Product and competitor intelligence | Yes | Yes | Pricing changes, regional availability, feature naming, and terms |

Do not combine these into one universal gold set. Maintain a shared mechanical test pack plus a separate reviewed domain set for each department.

## Current AI-set generalization findings

The current seed validates file shape and bucket counts, but it is not a general benchmark:

- OpenAI and Anthropic together account for 54 of 100 rows.
- OpenAI exceeds the 15% publisher limit by 18 rows; Anthropic exceeds it by 6.
- All 15 irrelevant examples come from Wikipedia, so the set does not represent realistic web noise.
- No row is explicitly India-focused despite the evaluation requirement.
- Evidence cases are concentrated in three model providers.
- The set contains useful extraction edge cases but needs broader event, geography, publisher, and source-type coverage.

The remediation belongs before human review. After replacements, both reviewers must review the entire frozen set rather than only the changed rows, because duplicate and publisher-distribution judgments depend on the collection as a whole.

## Readiness decision

The first n8n Research Engine workflow may begin only when:

```text
[ ] AI dataset sampling defects repaired
[ ] Two independent human reviews complete
[ ] Adjudication complete
[ ] Credential smoke tests pass
[ ] Provider terms and retention entries complete
[ ] At least the AI department profile is versioned
[ ] Phase 0 benchmark plan names exact versions and budgets
```

Other departments do not block the AI vertical slice, but their profiles and evaluation sets must pass the same gates before they reuse automatic acceptance.

## Related

- [How to Review and Approve the Research Gold Set](how_to_review_research_gold_set.md)
- [Research Evaluation Reference](research_evaluation_reference.md)
- [Research Engine Architecture and Build Plan](research_engine_architecture_and_build_plan.md)
- [How to Configure Research Provider Credentials in n8n Cloud](../operations/how_to_configure_n8n_provider_credentials.md)

