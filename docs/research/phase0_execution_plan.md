# How to Complete Research Engine Phase 0

This guide takes the Intelligence Lead from an approved architecture to evidence-based provider and model choices. Phase 0 produces evaluation data and configuration; it does not build production n8n workflows.

## Prerequisites

- Access to the development repository.
- Development credentials for the providers being evaluated.
- One reviewer who understands the AI domain and one second reviewer for disputed labels.
- The [Research Engine Architecture and Build Plan](research_engine_architecture_and_build_plan.md).
- The [Research Evaluation Reference](research_evaluation_reference.md).
- The [Initial AI Source Catalogue](initial_ai_source_catalog.md).
- The [Content Storage and Retention Policy](content_storage_and_retention_policy.md).

Provider credentials belong in provider dashboards or the n8n credential store. Never add them to evaluation files, screenshots, workflow exports, or Git.

## Required outputs

| Output | Owner | Approval |
|---|---|---|
| Reviewed 100-item gold set | Intelligence Lead | Second reviewer resolves disputes |
| Search provider comparison | Intelligence Lead | Backend reviews terms and quotas |
| Extraction route comparison | Intelligence Lead | Backend reviews storage behavior |
| Model capability comparison | Intelligence Lead | Product reviews quality threshold |
| Approved monitored-source list | Intelligence Lead | Product confirms coverage priorities |
| Signed retention classes | Backend/Product | Founder or authorized owner approves |
| Provider routing recommendation | Intelligence Lead | Backend approves operational fit |

## Step 1: Freeze the evaluation version

Copy `evaluation/research_gold_set_template.csv` to a versioned working file such as:

```text
evaluation/research_gold_set_v1.csv
```

Record:

- Evaluation version: `research-gold-v1`.
- Domain configuration version.
- Collection window.
- Query-set version.
- Reviewer names or stable reviewer identifiers.
- Date that provider prices, quotas, and terms were checked.

Do not change labels or examples silently after a benchmark starts. Correct errors in a new dataset version and explain the change.

## Step 2: Populate the sampling buckets

Fill all 100 rows using the assigned bucket in the template.

| Bucket | Rows | Purpose |
|---|---:|---|
| Relevant current AI items | 25 | Measures useful discovery and freshness |
| Irrelevant or spam | 15 | Measures false acceptance |
| Exact or syndicated duplicates | 20 | Measures canonicalization and duplicate handling |
| Difficult extraction | 20 | Covers dynamic pages, PDFs, long pages, tables, and blocked content |
| Evidence-grounding cases | 20 | Measures claim, excerpt, locator, date, and number faithfulness |

Use a mix of official announcements, research papers, repositories, company pages, independent reporting, and deliberately noisy results. Do not let one publisher or one topic dominate the set.

## Step 3: Label the gold answers

For every row, a human records:

- Whether the item is relevant to the configured domain.
- The preferred canonical URL.
- Duplicate family and preferred source, if applicable.
- Expected extraction status and minimum completeness.
- Source-proximity class: primary, authoritative secondary, independent secondary, community, or unknown.
- Storage class from the retention policy.
- Expected evidence claim, exact supporting excerpt, and locator when the row tests evidence extraction.
- Any exclusion reason, dispute, or special handling.

Use `needs_adjudication=true` when reviewers disagree. Do not train thresholds on unresolved rows.

## Step 4: Run discovery provider tests

Send the same query set, time windows, language, geography, and result limits to each candidate search provider. Save provider-native responses privately only for the evaluation retention window. Normalize their results before scoring.

For each provider, calculate:

- Precision among the top five and top ten results.
- Coverage of the gold relevant URLs or equivalent events.
- Freshness and publication-date accuracy.
- Primary-source discovery rate.
- Canonical URL correctness.
- Duplicate rate.
- p50 and p95 latency.
- Failed, empty, and rate-limited request counts.
- Credits and currency per accepted source.
- Storage and display restrictions.

Recommended first comparison: Tavily versus Exa. Keep Firecrawl search as a fallback candidate rather than combining discovery and extraction into one dependency by default.

## Step 5: Run extraction route tests

Test the same eligible URLs in this order:

1. Direct HTTP and deterministic readability.
2. Jina Reader for eligible public pages.
3. Firecrawl basic mode.
4. Firecrawl enhanced mode only on cases where cheaper routes failed and policy permits retry.

Score metadata accuracy, meaningful-text completeness, layout preservation, noise, locator stability, latency, cost, and access status. A blocked page is not an extraction failure if policy says the page should not be bypassed.

## Step 6: Run model capability tests

Evaluate models by capability, not by general chat quality:

- `classify_relevance`
- `extract_evidence`
- `label_topic`
- `extract_source_metadata`

Benchmark at least one hosted open-weight model and one inexpensive commercial model. Use identical prompts, JSON Schemas, temperature, retry policy, and token limits. Record first-pass validity separately from repair success.

Do not include pattern detection, hypothesis generation, or final validation in this benchmark. Those are later capability tests.

## Step 7: Review errors, not only averages

Inspect every false acceptance, false rejection, duplicate miss, unsupported claim, wrong date, wrong number, and invalid locator. Classify the cause as provider, extraction, prompt, model, deterministic rule, label, or policy.

Automatic acceptance is allowed only when the candidate route meets all mandatory gates in the evaluation reference. A provider can remain useful for `needs_review` even if it does not qualify for automatic acceptance.

## Step 8: Approve routing and limits

Create the first routing decision with:

- Default and fallback provider per capability.
- Approved model ID and provider per capability.
- Maximum results, pages, retries, tokens, latency, and cost.
- Data classes allowed for each provider.
- Conditions that stop rather than fall back.
- Evaluation version supporting the decision.
- Review-by date.

Keep provider/model IDs in configuration. Workflows request stable capability names.

## Step 9: Confirm storage behavior

Product and Backend approve the retention policy before full-text tests leave the local evaluation environment. Any provider or publisher restriction overrides the default retention period.

Confirm that deletion removes the content object, cache, and derived display material while retaining only the minimum audit record legally and operationally required.

## Step 10: Hold the Phase 0 exit review

Phase 0 passes when:

- All 100 rows are populated and reviewed.
- No unresolved label affects a mandatory threshold.
- Search, extraction, and model results include quality, latency, cost, and terms.
- The monitored-source list is marked approved or deferred item by item.
- Retention classes and provider data policies are approved.
- Defaults and fallbacks have explicit stop conditions.
- The projected vertical-slice cost is inside the configured budget.

## Verification

Use this checklist:

```text
[ ] 100/100 rows populated
[ ] 0 unresolved rows used in threshold calculations
[ ] Search comparison complete
[ ] Extraction comparison complete
[ ] Model comparison complete
[ ] Storage/terms review complete
[ ] Routing decision approved
[ ] Initial source catalogue approved
[ ] Per-run limits approved
[ ] Ready to write RE 00 through RE 50 n8n guide
```

## Troubleshooting

### Provider results cannot legally be retained

Score them during the shortest permitted evaluation window, retain only allowed aggregate metrics, and exclude the provider from persistent evidence storage unless written terms permit it.

### Providers return different URLs for the same event

Score event coverage and canonical sources separately. Do not penalize a provider solely for finding a credible independent report instead of the exact gold URL.

### Reviewers disagree on relevance

Record both labels and the reason, then use the configured domain and product job to adjudicate. Exclude the row from threshold calculations until resolved.

### A cheap model has high average accuracy but invents evidence

It fails the evidence capability gate. It may still be used for low-risk classification if it independently meets that capability's threshold.

### Free credits run out during evaluation

Pause that route and record quota exhaustion. Do not change result limits for only one provider; either purchase a bounded test allowance or repeat a smaller identical sample for every candidate.

## Related

- [Research Evaluation Reference](research_evaluation_reference.md)
- [Initial AI Source Catalogue](initial_ai_source_catalog.md)
- [Content Storage and Retention Policy](content_storage_and_retention_policy.md)
- [Model Routing and Cost Control](../architecture/model_routing_and_cost_control.md)

