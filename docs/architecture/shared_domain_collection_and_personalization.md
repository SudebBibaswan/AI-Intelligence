# Shared Domain Collection and Personalization

Status: **accepted and locked for v1**  
Decision date: 2026-09-27  
Owners: Product, Intelligence, Backend, and n8n  

This document defines how the platform collects research once for each domain and turns that shared corpus into a different feed for each workspace. It is the reference and rationale for ADR 0007.

## Locked outcomes

1. The Research Engine collects public-domain research at the **domain level**, not separately for every user.
2. Each active domain is scheduled **twice per day**, in two configurable slots approximately 12 hours apart.
3. A scheduled slot runs only when at least one non-archived workspace has that domain active.
4. With seven domains, the normal ceiling is **14 shared scheduled runs per day**, regardless of user count.
5. Sources, evidence, entity tags, and shared intelligence are produced once and reused by every eligible workspace.
6. Personalization happens after shared research and never starts another crawl merely to rank a user's feed.
7. User-private uploads, notes, connected accounts, and confidential data remain workspace-owned and are never added to the shared corpus.
8. The browser continues to use `UI -> Backend -> Supabase -> Backend -> UI`. It does not query service-owned research tables directly.

## Initial domain catalogue

The v1 catalogue contains exactly these seven research domains:

| Domain key | Display name |
|---|---|
| `cybersecurity` | Cybersecurity |
| `banking-financial-services` | Banking and financial services |
| `ai-manufacturing-operations` | AI in manufacturing and operations |
| `healthcare` | Healthcare |
| `core-ai-it-infrastructure` | Core AI technology, IT, and infrastructure |
| `agriculture` | Agriculture |
| `retail-ecommerce` | Retail and e-commerce |

Capital flow is a cross-domain intelligence lens. Funding rounds, acquisitions, investors, accelerators, portfolios, stated theses, and revealed investment patterns are attached to one or more domains instead of becoming an eighth user-selected domain.

## End-to-end flow

```text
Active workspace subscriptions
            |
            v
 Domain schedule eligibility ---- no subscribers ----> skip with metric
            |
            v
 Two shared collection slots per day
            |
            v
 Discover -> normalize -> deduplicate -> extract -> verify
            |
            v
 Shared sources, evidence, entities, capital events, and signals
            |
            v
 Eligibility filters -> multi-factor ranking -> diversity policy
            |
            v
 Workspace feed references
            |
            v
 Backend view model -> UI
```

## Collection scheduling

The scheduler evaluates each domain at the start of each configured slot.

### Eligibility

A domain run is eligible when all of the following are true:

- `domains.is_active = true`.
- At least one `workspace_domains` row for that domain has `status = 'active'`.
- No completed or active run exists for the same domain, schedule slot, and research profile version.
- The domain's provider budget and policy allow execution.

The idempotency key is derived from:

```text
domain_id + schedule_slot_start + domain_profile_version + engine_version
```

Late retries use the same key. They resume or return the existing run rather than creating duplicate research.

The exact UTC times are configuration, not architecture. Both slots should use an overlap window so late-indexed material is found; URL and content deduplication prevent that overlap from duplicating canonical records.

### Ownership within the current schema

The current database requires `research_runs`, `sources`, and `evidence` to belong to a workspace. For v1, one private **service research workspace** owns the shared public corpus and has one internal `workspace_domains` row per domain.

This is a compatibility bridge, not a user workspace:

- It is never returned as a user membership.
- Its identifiers never authorize a browser request.
- Only the backend and service-role workflows can write it.
- Workspace feed queries expose approved view models, not service workspace rows.

This approach preserves the current foreign keys, n8n RPCs, RLS assumptions, and frontend contracts. A future global-catalog migration is optional and must not be required for v1.

## Shared corpus boundaries

The service-owned corpus stores one canonical copy of public research metadata and permitted evidence. It includes:

- canonical source metadata and discovery provenance;
- bounded evidence and locators;
- content hashes and extraction status;
- normalized entities, investors, funds, accelerators, companies, and relationships;
- funding, acquisition, partnership, product, regulatory, and market events;
- domain, topic, geography, stage, and intelligence-type tags;
- quality, confidence, novelty, and recency features;
- storage pointers for temporary content governed by the retention policy.

Raw or cleaned page bodies remain in private object storage according to the storage-class policy. Feed rows do not copy page bodies, evidence, or generated intelligence.

## Personalization contract

Personalization is a deterministic, explainable ranking stage over eligible shared records. Models may tag or structure an item once during shared processing; the request path must not call a model separately for each user.

### Profile inputs

The backend builds a versioned workspace personalization profile from:

- selected domain;
- explicit topics and subtopics;
- role and primary objective, such as founder, investor, operator, researcher, or advisor;
- entities and competitors on watchlists;
- desired intelligence types, such as funding, product, regulation, hiring, partnership, market movement, or risk;
- geography and market preferences;
- company maturity and investment-stage preferences;
- capital-event and investor-type preferences;
- preferred time horizon and freshness;
- preferred or blocked sources;
- explicit feedback: save, useful, not useful, incorrect, duplicate, hide topic, or hide entity;
- bounded behavioral signals such as opens and dwell, used only after sufficient history;
- diversity settings that prevent a feed from becoming one-topic or one-publisher repetition.

Explicit onboarding choices remain authoritative. Inferred behavior can tune a profile but cannot silently remove or reverse an explicit preference.

### Hard eligibility gates

An item is scored only when it:

- belongs to the workspace's selected domain;
- has the minimum accepted evidence and source-quality status for its content type;
- is within the allowed retention and display policy;
- is not a duplicate, superseded item, blocked source, blocked entity, or explicit user exclusion;
- is accessible to that workspace and contains no other workspace's private data.

Hard gates protect quality and authorization. Ranking cannot promote an ineligible item.

### Default v1 scoring model

Each eligible item receives a score from 0 to 100. The following weights are locked defaults; the scoring version and any approved per-workspace overrides must be stored.

| Factor | Weight | What it measures |
|---|---:|---|
| Explicit topic and subtopic match | 15 | Match to selected interests within the chosen domain |
| Entity and watchlist affinity | 12 | Companies, investors, technologies, competitors, or regulators followed by the workspace |
| Role and objective fit | 10 | Whether the item is useful for the user's stated job and outcome |
| Intelligence-type preference | 10 | Funding, product, regulation, hiring, partnership, risk, or other selected event types |
| Capital-flow relevance | 10 | Importance to the “where capital is flowing” lens |
| Geography and market fit | 8 | Match to selected countries, regions, or markets |
| Company maturity or investment-stage fit | 7 | Pre-seed through public-market stage, or the configured operating maturity |
| Freshness and time-horizon fit | 8 | Recency relative to the user's preferred horizon |
| Source quality and evidence confidence | 8 | Provenance, corroboration, extraction integrity, and evidence strength |
| Novelty and unseen value | 5 | New information rather than a repeated story or previously consumed item |
| Explicit and bounded behavioral feedback | 5 | Saves, usefulness, hides, and later low-weight engagement learning |
| Diversity and serendipity | 2 | Controlled inclusion of credible adjacent material and underrepresented sources |
| **Total** | **100** | |

Each factor is normalized from 0 to 1. The default score is:

```text
personalization_score = sum(factor_value * factor_weight)
```

The response also retains the factor breakdown and scoring version. The backend may return a short explanation such as “High match: watched investor, cybersecurity funding, India, recent and strongly sourced.”

### Negative feedback and repetition

- Explicitly blocked sources, entities, or topics are excluded.
- A confirmed duplicate or superseded record is excluded.
- A hidden item is excluded for that workspace.
- Previously read items receive a configurable demotion unless they materially changed.
- Repeated coverage of the same event is grouped; the feed prefers the canonical event with the strongest and most diverse evidence.
- Engagement-derived features are capped at 5% so clicks cannot overpower stated interests or evidence quality.

### Diversity safeguards

After scoring, a deterministic re-ranker enforces configurable feed constraints:

- no single publisher dominates a page;
- near-duplicate events are grouped;
- capital-flow and non-capital developments can each receive reserved positions when relevant;
- selected geographies and intelligence types receive minimum coverage where qualifying items exist;
- a small serendipity allocation may surface credible adjacent items, but never outside the selected domain without an explicit cross-domain setting.

This makes the feed personalized without creating a narrow feedback loop.

### Cold start

Before behavioral history exists, ranking uses onboarding choices, domain defaults, freshness, source quality, evidence confidence, and diversity. A user should receive a useful feed immediately after selecting a domain and completing the preference questions.

## Minimal additive persistence

No existing frontend table or response must be removed or renamed. Implementation should add backend-owned structures only when the corresponding stage is built.

| Logical structure | Purpose | Duplication rule |
|---|---|---|
| `domain_collection_schedule` | Two slots, profile version, next run, and last run per domain | One row per domain |
| `workspace_personalization_profiles` | Versioned explicit and learned preferences plus scoring version | One active profile per workspace-domain |
| `workspace_feed_items` | Item reference, score, factor breakdown, rank, eligibility reason, generated/expiry time | References shared item; never copies source content |
| `workspace_item_feedback` | Explicit user actions used by ranking and quality review | One event stream with idempotent action IDs |

Names are logical until an additive migration is approved. During the first implementation, the profile may be read from existing `workspace_domains` configuration, but feed materialization must still store only references.

## API and UI compatibility

Existing dashboard and signal endpoints remain the frontend contract. The backend changes which eligible items are selected and ordered.

Additive response fields may include:

```json
{
  "personalization": {
    "score": 86.4,
    "reason": "Matches watched investors and cybersecurity funding in India",
    "scoring_version": "personalization-v1.0.0"
  }
}
```

The UI may ignore this object until designs are ready. Internal factor values are available for debugging, but the product should display understandable reasons rather than a false-precision breakdown by default.

## Privacy and tenant isolation

- Shared-corpus records contain only approved public or licensed research.
- Workspace-private inputs never improve another workspace's feed or model without a separate, explicit future policy.
- Personalization profiles, feedback, saves, hides, and generated feed references carry `workspace_id` and remain RLS-protected.
- Aggregate popularity may be introduced only after privacy thresholds and product approval; it is not part of v1 scoring.
- The backend verifies workspace membership before returning any personalized result.

## Operational metrics

Track at least:

- eligible domains and skipped domains per slot;
- shared runs started, completed, partial, and failed;
- cost and accepted evidence per domain run;
- corpus reuse: eligible workspaces per shared run;
- time from source publication to accepted evidence;
- feed coverage and freshness per workspace;
- duplicate-event rate and publisher concentration;
- saves, hides, not-useful feedback, and reason-code distribution;
- score distribution by factor and scoring version;
- percentage of feed items with a human-readable ranking reason.

## Acceptance criteria

The architecture is implemented correctly when:

1. Adding a second or hundredth workspace to a domain does not create another scheduled crawl for that domain slot.
2. A domain with no active subscribers creates no paid discovery or extraction work.
3. Replaying a schedule slot does not duplicate canonical sources, evidence, or feed items.
4. Two workspaces in the same domain can receive different ordering and filtering from the same shared records.
5. Every feed item traces to its shared signal/evidence/source and to a personalization score version.
6. A user preference change can recompute ranking without crawling the web.
7. No shared-corpus identifier or service workspace membership is trusted as browser authorization.
8. Existing frontend responses remain valid while personalization fields are added incrementally.

## Trade-offs and alternatives

### Rejected: crawl separately for each user

This gives maximum bespoke discovery but multiplies cost, duplicate storage, workflow executions, and inconsistency. It is incompatible with the expected user count and is rejected.

### Rejected: one universal feed for everyone in a domain

This is inexpensive but ignores role, entity, geography, stage, objective, and feedback differences. It weakens the core product value and is rejected.

### Deferred: immediate global-catalog schema rewrite

A fully global source catalogue may eventually be cleaner than a service-owned workspace. It would change current foreign keys, RLS, RPCs, storage paths, and UI assumptions. The service-workspace bridge provides the same collection reuse now with additive changes, so the rewrite is deferred until measured scale justifies it.

## Related

- [Architecture Decisions](../decisions/README.md)
- [System Architecture](system_architecture.md)
- [Database Schema](database_schema.md)
- [API and Frontend Data Contracts](api_and_frontend_contracts.md)
- [Research Engine Architecture and Build Plan](../research/research_engine_architecture_and_build_plan.md)
- [Content Storage and Retention Policy](../research/content_storage_and_retention_policy.md)
