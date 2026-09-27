# Open Decisions

The foundation pack makes enough assumptions for parallel work to begin, but the items below need explicit answers before the affected implementation is locked. Record each answer as an architecture decision or an update to an existing decision.

## Must resolve before production migrations

### Existing Supabase schema disposition

Needed input: current migrations, table definitions, indexes, RLS policies, sample row shapes, and any workflow dependencies.

Decision: map each existing table to `keep`, `alter`, `migrate`, `merge`, or `retire`. Do not discard prototype data until lineage and workspace migration are documented.

Owner: Backend and Data Lead with Intelligence Lead.

### Workspace model at beta

Current assumption: one personal workspace is created for each user; team roles exist in the schema but advanced collaboration is outside MVP.

Decision: whether beta users can invite others or whether membership management remains disabled.

Owner: Product Strategy and Backend Leads.

### Investment representation

Current assumption: investment activity initially uses typed entity relationships with structured attributes.

Decision: create a dedicated `investments` and `investment_participants` model immediately if the first dashboard requires strict round, currency, stage, lead, and participant queries.

Owner: Backend and Intelligence Leads.

## Must resolve before Research Engine build

### Initial source adapters

Proposed baseline: selected official/RSS feeds, arXiv/GitHub structured sources, and one benchmarked web-search provider. Evaluate Tavily and Exa for search; prefer direct extraction, then Jina Reader, with Firecrawl for dynamic or difficult pages. See `docs/research/research_engine_architecture_and_build_plan.md`.

Decision: approve the exact monitored-source list and select the default search/extraction providers after the gold-set benchmark. Record their terms, quotas, expected coverage, and fallback behavior.

Owner: Intelligence Lead.

### Content storage and retention

Decision: what full text may be stored, for how long, in which private bucket, and what the product may display. Define behavior for paywalls, robots restrictions, deleted pages, transcripts, and copyrighted material.

Owner: Intelligence Lead with Backend and Product Leads.

### Research provider and model evaluation

Proposed baseline: evaluate provider and model choices on a reviewed gold set before allowing automatic acceptance. Free credits are experimental capacity rather than an architectural dependency.

Decision: approve the evaluation set, minimum quality gates, fallback providers, and the first hosted open-weight and commercial models for relevance and evidence extraction.

Owner: Intelligence Lead with Backend Lead.

### Relevance and source-quality thresholds

Decision: thresholds for accept, reject, and review; required checks per source type; minimum coverage for a completed run.

Owner: Intelligence Lead.

### Entity-resolution policy

Decision: deterministic identifiers, merge thresholds, review queue, and whether organizations, funds, and products need typed profile tables in MVP.

Owner: Intelligence and Backend Leads.

## Must resolve before frontend integration

### Application stack and deployment

Decision: web framework, server/API deployment, background status transport, error monitoring, and preview environment strategy.

Owner: Frontend and Backend Leads.

### User-visible confidence

Decision: whether cards display a numeric score, labelled bands, or only explanations; define calibration and avoid false precision.

Owner: Product and Intelligence Leads.

## Must resolve before validation beta

### Validation depth and cost

Decision: standard dimension set, when a dimension is not applicable, per-run cost ceiling, cancellation behavior, and what qualifies as an “none found” counter-evidence search.

Owner: Intelligence and Product Leads.

### Human correction workflow

Decision: who can mark a source, signal, pattern, or conclusion incorrect; how corrections supersede old objects; and how evaluation datasets receive reviewed examples.

Owner: Product, Intelligence, and Backend Leads.

## Deferred until measured need

- Vector search technology and embedding model.
- Cross-workspace private content catalog.
- Realtime social ingestion.
- Enterprise identity and SSO.
- External customer API.
- Automated team billing.
- Multi-region data placement.

Deferral is intentional. Reopen an item when a validated product requirement or measured performance limit makes it necessary.
