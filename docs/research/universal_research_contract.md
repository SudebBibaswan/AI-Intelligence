# Universal Research Contract

Every discovery adapter produces the same normalized candidate before content enters the shared Research Engine. This contract is the handoff between discovery, n8n, backend storage, and downstream intelligence. The machine-readable authority is `schemas/research-source.schema.json`.

Contract version: `1.0.0`.

## Goals

- Isolate channel-specific provider output from downstream logic.
- Make canonicalization, deduplication, relevance, extraction, and verification auditable.
- Preserve enough provenance to reproduce how a source was found.
- Prevent discovery adapters from emitting signals, patterns, or hypotheses.
- Allow the same engine to operate on different domains.

## Normalized record

```json
{
  "schema_version": "1.0.0",
  "source_id": "018f0e6b-3e40-7c62-a2d1-7a6f96c7f111",
  "workspace_id": "018f0e6b-3e40-7c62-a2d1-7a6f96c7f222",
  "workspace_domain_id": "018f0e6b-3e40-7c62-a2d1-7a6f96c7f333",
  "collection_run_id": "018f0e6b-3e40-7c62-a2d1-7a6f96c7f444",
  "source_type": "article",
  "discovery": {
    "channel": "web_search",
    "provider": "example-provider",
    "query": "AI agent security funding India",
    "result_rank": 3,
    "external_result_id": null,
    "discovered_at": "2026-09-26T08:15:00Z"
  },
  "identity": {
    "original_url": "https://example.com/story?utm_source=x",
    "canonical_url": "https://example.com/story",
    "title": "Example title",
    "publisher": "Example Publisher",
    "author": "Example Author",
    "language": "en",
    "published_at": "2026-09-25T12:00:00Z"
  },
  "content": {
    "text": "Cleaned source content when storage and licensing permit.",
    "summary": null,
    "content_hash": "sha256:hex-value",
    "extraction_method": "readability-v2",
    "extracted_at": "2026-09-26T08:15:10Z",
    "status": "success"
  },
  "classification": {
    "domain_key": "artificial-intelligence",
    "topics": ["AI agents", "AI security"],
    "geographies": ["India"],
    "entity_types": ["company", "investor"],
    "relevance_score": 0.91,
    "source_quality_score": 0.76,
    "decision": "accepted",
    "reason_codes": ["TOPIC_MATCH", "RECENT_EVENT", "PRIMARY_DETAILS_PRESENT"]
  },
  "verification": {
    "status": "verified",
    "checked_at": "2026-09-26T08:16:00Z",
    "checks": [
      {"type": "url_resolves", "passed": true, "details": null},
      {"type": "publication_date_present", "passed": true, "details": null}
    ]
  },
  "metadata": {}
}
```

## Field rules

### Version and scope

- `schema_version` is required and uses semantic versioning.
- `workspace_id`, `workspace_domain_id`, and `collection_run_id` are required and created or verified by the trusted backend.
- A discovery adapter must not accept workspace scope solely from an unsigned public webhook.
- `source_id` may be assigned after canonicalization. Before persistence, a workflow may use a temporary candidate identifier internally.

### Source type

Initial controlled values:

`article`, `company_page`, `fund_page`, `portfolio_page`, `paper`, `filing`, `repository`, `transcript`, `video`, `post`, `dataset`, `press_release`, `job_posting`, `regulatory_notice`, `other`.

New values are additive only when their extraction or verification behavior is meaningfully different.

### Discovery

`channel` identifies how the source was found; `provider` identifies the actual service or adapter. The same canonical source can have multiple discovery records in a run. Store all useful discovery provenance in `research_run_sources`, not by duplicating the source.

Initial channel values:

`web_search`, `rss`, `official_site`, `yc`, `vc_site`, `github`, `arxiv`, `hacker_news`, `reddit`, `youtube`, `api`, `manual`, `other`.

### Identity and canonicalization

Canonicalization is deterministic and versioned. At minimum:

1. Resolve safe redirects.
2. Lowercase scheme and host.
3. Remove fragments.
4. Remove known tracking parameters.
5. Normalize default ports, duplicate slashes, and trailing slash policy.
6. Apply known publisher URL rules.
7. Preserve the original URL for debugging.

Do not merge sources solely because their titles match. When canonical URLs differ but content hashes match, record a duplicate relationship and retain the preferred source according to source-quality rules.

### Content

`content.status` is one of `pending`, `success`, `partial`, `failed`, or `blocked`. `text` may be null when extraction fails or licensing prevents storage. A successful record requires content hash, method, and extraction time.

Do not place credentials, full HTTP headers, or unbounded provider payloads in metadata. Large content belongs in private object storage with a database reference.

### Classification

`decision` is `accepted`, `rejected`, `duplicate`, or `needs_review`. Scores are 0 through 1 and must not be mistaken for probabilities unless calibrated.

Reason codes are stable, machine-readable values. Initial examples:

- `TOPIC_MATCH`
- `ENTITY_MATCH`
- `GEOGRAPHY_MATCH`
- `RECENT_EVENT`
- `PRIMARY_SOURCE`
- `PRIMARY_DETAILS_PRESENT`
- `LOW_RELEVANCE`
- `LOW_SOURCE_QUALITY`
- `OUTSIDE_TIME_WINDOW`
- `DUPLICATE_CANONICAL_URL`
- `DUPLICATE_CONTENT`
- `PAYWALL_BLOCKED`
- `EXTRACTION_FAILED`
- `UNSUPPORTED_LANGUAGE`
- `POSSIBLE_SPAM`

Thresholds belong in the run configuration snapshot, not in the contract.

### Verification

Verification describes checks that actually ran. It is not an LLM’s unsupported declaration that a source is true.

Status values:

- `unverified`: checks have not completed.
- `verified`: required checks for this source type passed.
- `partially_verified`: some required checks are unavailable or failed without invalidating the whole source.
- `disputed`: credible sources conflict.
- `rejected`: source failed mandatory integrity checks.

Possible checks include URL resolution, publisher identity, publication time, author presence, content consistency, primary-source proximity, corroboration, and quote-locator integrity.

## Evidence output boundary

An accepted research source is input to evidence extraction. Evidence is stored separately because one source may yield many claims and each claim needs its own locator, confidence, and polarity.

Minimum evidence item:

```json
{
  "source_id": "uuid",
  "research_run_id": "uuid",
  "evidence_type": "fact",
  "claim_text": "Normalized proposition.",
  "excerpt": "Bounded source-grounded excerpt.",
  "locator": {"section": "Funding", "paragraph": 4},
  "confidence": 0.92,
  "verification_status": "verified",
  "extractor_version": "evidence-v1.0.0"
}
```

The extractor may only cite the supplied source. Unsupported model additions are rejected.

## Compatibility rules

- A major version changes required fields, meaning, or controlled values incompatibly.
- A minor version adds optional fields or compatible controlled values.
- A patch clarifies validation without changing valid payloads.
- Workflows must reject unsupported major versions.
- Stored records retain the version used at ingestion.
- A backfill or migration records the original and target versions.

## Validation responsibilities

| Boundary | Validation owner |
|---|---|
| Adapter output before normalization | Adapter |
| Universal contract before persistence | Research Engine |
| Workspace and parent integrity | Backend or database function |
| Model structured output | Model gateway and workflow |
| Database constraints | Supabase |
| Frontend display model | Application API |
