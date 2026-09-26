# How to Review and Approve the Research Gold Set

This procedure turns the AI-seeded research dataset into a human-approved evaluation set that can be used to compare discovery, extraction, and model routes. It covers dataset repair, two independent reviews, adjudication, and final sign-off. It does not permit automated provider acceptance until every exit gate passes.

Status: ready to execute; human reviewers not yet assigned  
Dataset: `evaluation/research_gold_set_v1.csv`  
Workbook: `outputs/research-engine-phase0/research_gold_set_v1.xlsx`  
Evaluation contract: `research-gold-v1` / `1.0.0`

## Roles

| Role | Responsibility | May approve own disputed label? |
|---|---|---:|
| Dataset coordinator | Creates reviewer copies, freezes versions, merges decisions, runs completeness checks | No |
| Reviewer A | Reviews all 100 rows independently | No |
| Reviewer B | Reviews all 100 rows independently without seeing Reviewer A's decisions | No |
| Adjudicator | Resolves disagreements using source evidence and the domain rules | Yes, if not the reviewer whose label is being challenged |
| Intelligence Lead | Signs the completed dataset and records its permitted uses | No unresolved disputes may remain |

`codex_seed` is a machine-prepared suggestion, not a human reviewer. It must be replaced by stable human reviewer identifiers before approval.

## Current readiness assessment

The file has 100 unique items, 24 required columns, no blank URLs, and the intended 25/15/20/20/20 bucket split. It is not ready for provider scoring yet.

Mandatory repairs:

1. Reduce OpenAI from 33 rows to no more than 15 and Anthropic from 21 rows to no more than 15. Replace at least 24 concentrated rows while preserving bucket counts.
2. Add explicit India-focused AI cases covering policy, startups, research, infrastructure, and adoption.
3. Diversify the 15 irrelevant/spam cases. They currently all come from Wikipedia and do not test SEO spam, scraped copies, stale pages, fake announcements, or off-topic pages that contain AI keywords.
4. Add broader event coverage, including funding, regulation, open-weight releases, enterprise adoption, infrastructure, security incidents, and credible negative results.
5. Confirm at least five PDFs and five dynamic or script-heavy pages after replacements.
6. Recheck every current URL, publication date, publisher, access state, and storage class immediately before review.

These repairs enforce the sampling rules in the [Research Evaluation Reference](research_evaluation_reference.md). Do not begin provider comparisons on the current seed.

## Prerequisites

- Two human reviewers who understand the target department.
- One adjudicator with authority to interpret the domain configuration.
- A frozen copy of the dataset for each reviewer.
- Access to the original public sources.
- The [Content Storage and Retention Policy](content_storage_and_retention_policy.md).
- The department's domain profile described in [Research Engine Generalization and Department Readiness](research_engine_generalization_and_department_readiness.md).

Reviewers must not use a model to decide the gold label. They may use tools to open, translate, or search within a source, but the final judgment and reviewer identity must be human.

## Step 1: Repair and freeze the candidate set

1. Replace concentrated or weak rows while preserving stable `item_id` values only if the row tests the same case. Assign a new ID when the tested case changes materially.
2. Record every replacement in a change log with old URL, new URL, reason, editor, and date.
3. Run the sampling checks in the evaluation reference.
4. Save the repaired file as a new pre-review version, such as `research_gold_set_v1_1.csv`.
5. Create a checksum and record the review start time. After this point, do not edit source rows in place.

If a source disappears during review, mark the row `blocked` or replace it in a new dataset version. Never silently substitute another page.

## Step 2: Create blind reviewer copies

Give each reviewer a separate copy containing the source fields and blank expected-label fields. Hide the seed labels and the other reviewer's work.

Each copy must retain:

- `item_id`, `bucket`, `input_type`, `query`, `url`, observed title, publisher, and publication date.
- Blank expected fields for the reviewer to complete.
- A reviewer identifier and review timestamp.
- A notes field for uncertainty, access problems, and policy concerns.

Reviewer identifiers should be stable internal IDs, not email addresses.

## Step 3: Review every row

For each row, both reviewers independently:

1. Open the source from the stored URL.
2. Confirm that the observed title, publisher, and publication date are accurate.
3. Assign `expected_relevance`: `relevant`, `irrelevant`, or `borderline`.
4. Record the preferred canonical URL without tracking parameters or fragments.
5. Assign duplicate family and preferred representative when applicable.
6. Assign extraction status and minimum completeness.
7. Assign source proximity and storage class.
8. Complete evidence fields when the row tests evidence grounding.
9. Select stable reason codes and write a short note for any non-obvious decision.
10. Enter their reviewer ID. Do not copy `codex_seed` into a human reviewer field.

### Bucket-specific checks

| Bucket | Reviewer must verify |
|---|---|
| Relevant current AI | Materiality, date, domain fit, source identity, and whether the event is genuinely current for the frozen collection window |
| Irrelevant or spam | Why it should be rejected and whether an AI-keyword lure could fool a classifier |
| Duplicate or syndicated | Canonical URL, family membership, preferred source, and that distinct events are not falsely merged |
| Difficult extraction | Expected access result, legal/policy boundary, meaningful sections, and whether partial output is acceptable |
| Evidence grounding | Atomic claim, exact bounded excerpt, stable locator, dates, numbers, and absence of unsupported inference |

### Evidence-row rule

An evidence excerpt must occur verbatim in the approved normalized source content. The claim may normalize wording but cannot add a fact, causal relationship, number, or date that the excerpt does not support.

## Step 4: Merge and compare reviews

The coordinator merges reviewer copies by `item_id` and compares every expected field.

Mark `needs_adjudication=true` when:

- Relevance differs.
- Canonical URLs differ after normalization.
- Reviewers disagree on duplicate family or preferred representative.
- Extraction status differs between `success`, `partial`, `blocked`, and `failed`.
- Storage classes differ.
- Evidence claim, excerpt, locator, date, or number differs.
- A reviewer reports that the source changed during the review window.

Formatting-only differences may be normalized deterministically, but the coordinator must not resolve semantic differences.

## Step 5: Adjudicate disagreements

For every disputed row, the adjudicator reads the source and both rationales, then records:

- Final value for each disputed field.
- Disagreement category: label, source change, extraction, duplicate, evidence, policy, or unclear domain scope.
- Short decision rationale.
- Adjudicator ID and timestamp.
- Whether the domain profile or reviewer instructions need updating.

If the domain itself is ambiguous, leave the row unresolved and update the domain profile first. Do not force a label merely to reach 100 completed rows.

## Step 6: Run approval checks

The dataset passes only when all checks below are true:

```text
[ ] Exactly 100 intended evaluation rows
[ ] Bucket counts remain 25 / 15 / 20 / 20 / 20
[ ] At least 10 publishers
[ ] No publisher or controlled publisher group exceeds 15 rows
[ ] Global and India-focused material are represented
[ ] Required topic families are represented
[ ] At least 5 PDFs and 5 dynamic/script-heavy pages
[ ] Two human reviewer IDs on every approved row
[ ] No unresolved adjudication
[ ] Every evidence excerpt and locator manually verified
[ ] Every row has a reviewed storage class
[ ] Broken, moved, and blocked sources have explicit outcomes
[ ] Change log and dataset checksum recorded
```

Rows that remain unresolved must be excluded from threshold calculations. If excluding them breaks a sampling requirement, replace them in a new dataset version and review the replacements.

## Step 7: Approve permitted uses

The Intelligence Lead records one of these states:

- `approved_for_discovery_benchmark`
- `approved_for_extraction_benchmark`
- `approved_for_model_benchmark`
- `approved_for_all_phase0_benchmarks`
- `rejected_for_repair`
- `expired`

Approval must include dataset checksum, reviewer IDs, adjudicator ID, approval date, collection window, department/domain profile version, and review-by date.

An AI-domain approval does not approve the set for another department.

## Verification

Before calling any paid provider, a person not involved in the merge should confirm:

1. The approved checksum matches the benchmark input.
2. Hidden seed columns are not being scored as human truth.
3. No unresolved row is included in a denominator.
4. Provider-specific response data will follow the approved retention policy.
5. The benchmark configuration names the exact evaluation version.

## Troubleshooting

### A reviewer cannot access a page

Record the observed access state. Do not bypass a paywall, login wall, CAPTCHA, robots restriction, or other control. Adjudicate whether `blocked` is the correct expected outcome.

### The source changed after the first review

Preserve the original review evidence when permitted, mark the row changed, and either review a permitted snapshot or replace the row in a new dataset version.

### Reviewers repeatedly disagree

The problem is probably an unclear domain rule, not reviewer quality. Pause that label family, update the domain profile with positive and negative examples, then re-review affected rows.

### A row is useful in more than one bucket

Assign the bucket for the behavior being scored. The same URL may appear in another bucket only when it tests a distinct behavior and does not create prohibited publisher concentration.

## Related

- [Research Evaluation Reference](research_evaluation_reference.md)
- [How to Complete Research Engine Phase 0](phase0_execution_plan.md)
- [Research Engine Generalization and Department Readiness](research_engine_generalization_and_department_readiness.md)
- [Content Storage and Retention Policy](content_storage_and_retention_policy.md)

