# Research Evaluation Reference

This reference defines the labels, measures, pass gates, and result record used to choose Research Engine providers and models. The working dataset starts from `evaluation/research_gold_set_template.csv`.

Evaluation contract version: `1.0.0`.

## Gold-set columns

| Column | Type | Required | Meaning |
|---|---|---:|---|
| `item_id` | string | Yes | Stable identifier such as `G001` |
| `bucket` | enum | Yes | Sampling bucket assigned before collection |
| `input_type` | enum | Yes | `query_result`, `url`, `document`, or `evidence_case` |
| `query` | string | Conditional | Discovery query when applicable |
| `url` | URI | Conditional | Source presented to extraction or evaluation |
| `title` | string | No | Observed title |
| `publisher` | string | No | Observed publisher |
| `published_at` | datetime | No | Human-verified publication time |
| `expected_relevance` | enum | Yes when labelled | `relevant`, `irrelevant`, `borderline` |
| `expected_canonical_url` | URI | No | Preferred normalized URL |
| `duplicate_family_id` | string | No | Shared ID for exact or syndicated copies |
| `preferred_duplicate` | boolean | No | Whether this is the retained representative |
| `expected_extraction_status` | enum | No | `success`, `partial`, `blocked`, `failed`, `not_applicable` |
| `minimum_content_completeness` | decimal | No | Human estimate from 0 through 1 |
| `source_proximity` | enum | No | `primary`, `authoritative_secondary`, `independent_secondary`, `community`, `unknown` |
| `storage_class` | enum | Yes when labelled | Class from the retention policy |
| `expected_claim` | string | Evidence rows | Normalized proposition |
| `expected_excerpt` | string | Evidence rows | Exact bounded supporting span |
| `expected_locator` | string | Evidence rows | Human-readable section/paragraph/page marker |
| `expected_reason_codes` | pipe-separated strings | No | Stable expected workflow reasons |
| `reviewer_1`, `reviewer_2` | string | Yes when labelled | Stable reviewer IDs |
| `needs_adjudication` | boolean | Yes when labelled | Whether disagreement remains |
| `notes` | string | No | Context not represented elsewhere |

Blank expected fields mean “not yet labelled,” not negative.

## Sampling rules

- Use at least ten publishers.
- No publisher supplies more than 15% of the dataset.
- Cover Global and India-focused AI material.
- Cover model releases, AI agents, infrastructure, research, funding, regulation/safety, open-weight models, and applied products.
- Include recent, stale, and undated pages.
- Include at least five PDFs and five dynamic or script-heavy pages.
- Include primary announcements and independent reports of the same event.
- Include pages that should remain blocked; successful bypass is not the desired answer.

## Metrics

### Discovery

| Metric | Formula or rule |
|---|---|
| Precision@K | Relevant results in first K divided by K labelled results |
| Event coverage | Gold events with at least one credible result divided by eligible gold events |
| Primary-source rate | Relevant results classified primary divided by relevant results |
| Freshness accuracy | Results whose reported date matches the reviewed date within allowed precision |
| Canonical URL accuracy | Correct normalized URLs divided by labelled URLs |
| Cost per accepted source | Discovery currency or normalized credits divided by accepted unique sources |

### Extraction

| Metric | Formula or rule |
|---|---|
| Eligible extraction success | Successful or acceptable partial results divided by eligible pages |
| Content completeness | Retained meaningful gold sections divided by expected meaningful sections |
| Noise ratio | Boilerplate characters divided by returned characters |
| Metadata accuracy | Correct title, publisher, author, and date fields divided by labelled fields |
| Locator stability | Evidence locators that still resolve after deterministic cleaning |
| Cost per usable document | Extraction cost divided by documents passing the content gate |

### Relevance classification

- Precision, recall, and F1 for `relevant`.
- False-acceptance rate for irrelevant/spam rows.
- Borderline routing rate.
- First-pass schema validity.
- Repair-attempt rate.

### Deduplication

- Exact canonical URL recall.
- Exact content-hash recall.
- Duplicate-family precision and recall.
- False-merge rate; this is more damaging than a missed duplicate because distinct evidence can be lost.

### Evidence extraction

- Claim faithfulness: proposition supported by the supplied content.
- Excerpt exactness: excerpt exists verbatim after approved normalization.
- Locator validity.
- Date and number accuracy.
- Unsupported-claim rate.
- Required-field completeness.
- First-pass JSON Schema validity.

## Mandatory pass gates

| Capability | Gate |
|---|---|
| Automatic relevance acceptance | At least 95% precision and no severe spam pattern accepted |
| Exact duplicate handling | At least 98% recall with zero false merges in the reviewed set |
| Near-duplicate handling | At least 95% precision; otherwise keep in review-only mode |
| Evidence extraction | At least 95% claim faithfulness and excerpt exactness |
| Schema output | 100% valid after the configured bounded repair policy |
| Lineage | 100% of accepted evidence contains source, run, excerpt, and locator references |
| Dates and numbers | At least 98% exact accuracy on labelled fields |
| Terms | Storage and intended product use permitted or explicitly restricted by policy |

Average scores cannot compensate for failure of a mandatory gate.

## Weighted selection score

Use this score only after all mandatory gates pass:

| Dimension | Weight |
|---|---:|
| Quality and faithfulness | 40% |
| Useful coverage | 20% |
| Terms and retention fit | 15% |
| Cost per useful outcome | 10% |
| Reliability and quota behavior | 10% |
| Latency | 5% |

Score every dimension from 0 through 100 and retain the underlying measures. A provider with prohibited retention receives zero for terms and is ineligible for persistent evidence routes even if its weighted total would otherwise win.

## Benchmark run record

Each run records:

```json
{
  "evaluation_version": "research-gold-v1",
  "capability": "extract_evidence",
  "provider": "provider-name",
  "model_or_route": "exact-versioned-id",
  "prompt_version": "evidence-v1.0.0",
  "schema_version": "1.0.0",
  "started_at": "2026-09-27T00:00:00Z",
  "dataset_items": 100,
  "configuration": {},
  "metrics": {},
  "failures_by_reason": {},
  "usage": {
    "requests": 0,
    "input_tokens": 0,
    "output_tokens": 0,
    "provider_credits": 0,
    "estimated_cost_usd": 0
  },
  "terms_checked_at": "2026-09-27",
  "review_status": "pending"
}
```

`model_or_route` must contain the exact model ID or extraction route used at evaluation time. Marketing family names are insufficient.

## Approval states

- `pending`: benchmark not reviewed.
- `approved_default`: meets gates and is the configured first route.
- `approved_fallback`: meets gates for specified conditions.
- `review_only`: useful but cannot automatically accept output.
- `rejected_quality`: missed a mandatory quality gate.
- `rejected_terms`: intended storage or processing conflicts with terms.
- `rejected_cost`: meets quality but exceeds budget.
- `expired`: evaluation or terms review is too old to rely on.

Re-evaluate after a model version, major prompt, schema, extraction route, provider terms, or pricing change.

## Related

- [How to Complete Research Engine Phase 0](phase0_execution_plan.md)
- [Research Engine Architecture and Build Plan](research_engine_architecture_and_build_plan.md)
- [Model Routing and Cost Control](../architecture/model_routing_and_cost_control.md)

