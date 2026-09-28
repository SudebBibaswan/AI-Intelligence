# Research Engine V2 Multi-Source Import Guide

Use `Research Engine_multisource_v2.json` for the next controlled n8n test. It is generated from `Research Engine_current_export.json`, so the working native Tavily and Firecrawl nodes, Supabase/OpenAI requests, credential references, and manual fixes remain the baseline.

Do not delete or overwrite the existing working workflow during evaluation.

## What V2 adds

- Manual and scheduled entry paths that converge before claiming a run.
- Native Tavily discovery for general web, official/capital, and ecosystem searches.
- Targeted YC, VC, Reddit, and X discovery through Tavily queries.
- Hacker News discovery through its public Algolia search endpoint.
- arXiv structured discovery with valid fielded queries and abstract content that can bypass Firecrawl.
- GDELT global-news discovery through its public DOC API, with no additional credential.
- Optional monitored RSS/Atom feeds through n8n's RSS node.
- Provider-neutral normalization before canonical URL deduplication.
- One shared relevance, quality, extraction, persistence, and evidence pipeline.
- A default limit of three Tavily searches and two Firecrawl pages per run.
- Per-provider and per-channel metrics in the final run metrics.
- Automatic evidence verification with exact-excerpt grounding and recorded verification provenance.

Reddit and X URLs are deliberately tagged `DISCOVERY_ONLY_SOCIAL_SOURCE`. They can reveal a weak signal, but they do not enter evidence extraction automatically. Direct platform API ingestion requires separately approved credentials and terms.

## Preserved credentials

The import references the credentials already present in the working export:

| Use | Credential name | Node behavior |
|---|---|---|
| Supabase | `Supabase account` | HTTP Request nodes use the Supabase credential type |
| OpenAI | `OpenAI account` | Existing credentialed OpenAI HTTP calls remain unchanged |
| Tavily | `Tavily account` | Native Tavily community node remains in place |
| Firecrawl | `Firecrawl account` | Native Firecrawl `/scrape` node remains in place |

No credential secret is embedded in the JSON.

## Safe import sequence

1. Keep the current `Research Engine` workflow unchanged and inactive while testing.
2. Import `Research Engine_multisource_v2.json` as a new workflow.
3. Confirm the imported name is `Research Engine V2 - Multi Source`.
4. Open the four credentialed node groups and confirm they show the existing credentials above. Re-select only if n8n marks one red.
5. Keep `Scheduled Run Trigger` unused for the first test.
6. Execute the manual path once.
7. Inspect `Build Discovery Jobs`. A normal core-AI run should produce:
   - three Tavily jobs;
   - up to four compact Hacker News topic jobs;
   - one arXiv job;
   - one GDELT news job returning up to 20 articles, kept to one call to respect the public endpoint's rate guidance;
   - zero or more RSS jobs.
8. Inspect `Normalize and Dedupe Candidates`. All providers must converge into one candidate list. If every provider is empty, the sentinel must report `NO_DISCOVERY_RESULTS` and preserve provider-specific errors instead of reporting an invalid URL.
   - This node must include `function parseHttpUrl(rawUrl)` and must not contain `require('url')`. The parser is self-contained because restricted n8n task runners may expose neither the browser-style `URL` global nor the Node `url` module. Importing either older generated V2 variant can reject every Tavily and Hacker News URL.
9. Confirm Reddit/X candidates are discovery-only and that at most two non-embedded candidates reach Firecrawl.
10. Confirm the final Supabase run is `completed` or `partial` and provider/channel metrics are present.

Only after the manual test passes should `RE 01 Shared Domain Scheduler` select this V2 workflow in its `Execute Research Engine` node.

## Monitored feeds

The RSS adapter reads `config.monitored_feeds`. Each feed has this shape:

```json
{
  "url": "https://publisher.example/feed.xml",
  "name": "Publisher newsroom",
  "source_tier": "primary",
  "intent": "current_news",
  "limit": 10
}
```

The manual configuration currently starts with an empty list. Scheduled domain feeds should eventually be added to each domain's `default_config` through a new Supabase migration after every feed URL and retention rule is verified. Do not hardcode hundreds of feeds inside the workflow.

## Company and investor coverage

This workflow discovers current company, funding, portfolio, accelerator, and investor activity. It does not attempt to rebuild the complete company/VC master directory twice per day. A country-level list such as “100 currently active VCs” is structured reference data and should be collected by a separate entity-registry workflow, then refreshed periodically and joined to research evidence by stable entity IDs.

Free/public inputs suitable for that registry include Wikidata, regulator/company-register data where the selected country provides an open endpoint, official VC portfolio pages, accelerator directories, and verified RSS feeds. Country, source licensing, activity criteria, and entity matching must be configured before those records are written to Supabase. This separation prevents every research run from storing the same 100 firms again.

`capital_directory_refresh.json` implements the first conservative registry source. It runs separately every four weeks, uses the free Wikidata SPARQL endpoint, and initially requests India-based venture-capital firms and startup accelerators. Edit `Directory Configuration.countries` to add another country by name and Wikidata QID; do not duplicate the workflow per country.

Wikidata entries are stored as `candidate_unverified`. The workflow deliberately creates zero activity claims. `public.v_capital_directory` promotes an entry to `active_evidenced` only when the research graph contains a non-rejected, evidence-backed investment, partnership, or acquisition within the previous 365 days. This keeps directory coverage separate from claims about current investment activity.

Before activating the schedule:

1. Apply migration `202609270011_capital_directory_observability.sql`.
2. Import `capital_directory_refresh.json` as a separate n8n workflow.
3. Confirm `Upsert Directory Entity` uses the central `Supabase account` credential.
4. Run the manual path once and inspect `Capital Directory Summary`.
5. Query `public.v_capital_directory`; newly discovered rows should normally remain `candidate_unverified` until the research/evidence workflows support an activity classification.

### India regulated venture-fund coverage

`sebi_capital_registry.json` adds a second, free registry layer from SEBI's official complete Venture Capital Funds export. It runs every four weeks and imports the regulator-issued identity and registration metadata for the full registry. It does not use Tavily, Firecrawl, or OpenAI.

SEBI registration resolves the fund identity, but it does not prove that the fund is currently deploying capital. Consequently, this workflow sets `regulatory_status=registered` and `activity_verification_status=unverified`, creates no activity claim, and leaves `public.v_capital_directory.activity_status` governed by grounded evidence.

## RE 06: bounded official-profile verification

`capital_profile_verification.json` enriches a deliberately small queue of capital entities with grounded official-profile metadata. Its weekly default is three entities. For each entity it performs at most one basic Tavily search, one Firecrawl page extraction, and one structured OpenAI extraction.

The workflow reuses the central `Supabase account`, `Tavily account`, `Firecrawl account`, and `OpenAI account` credentials. It records a verified official website, stated thesis, sectors, stages, geographies, explicit check-size text, explicit portfolio names, exact supporting excerpts, and a confidence score. It does not create investment relationships or change evidence-backed activity status.

Before importing the workflow, apply `202609270013_capital_profile_verification.sql`. Then import `capital_profile_verification.json`, verify the four credentials, run it manually, and inspect the final `Capital Profile Summary` plus `public.v_capital_profile_verification_queue`. A normal first run processes no more than three candidates. `needs_review` is a safe result when an official page cannot be located or the page does not satisfy the identity and quotation gates.

## Single human review gate

Migration `202609280005_single_human_gate.sql` makes signal review the only mandatory human intervention. Research Engine V2 runs in `automatic` mode and verifies evidence only after exact-excerpt grounding, structural validation, and confidence checks. Verification method, score, time, and verifier version are stored on every verified evidence record. Earlier evidence-review functions remain available for audit and exceptional correction, but they do not block the normal agent path.

Migration `202609280001_signal_human_review.sql` remains the single trust boundary. Draft signals appear in `public.v_signal_review_queue`; authenticated workspace members accept or reject them through `public.review_intelligence_signal`. Acceptance rechecks every linked evidence item and source at decision time. Only accepted signals whose evidence remains verified appear in `public.v_observation_eligible_signals`, so observation synthesis cannot consume stale or unreviewed model output. Single-source signals may be accepted by a reviewer, but retain their provenance warning and confidence cap.

Migration `202609280002_signal_review_evidence_context.sql` adds `public.v_signal_review_details`, a read-only reviewer view containing each draft signal beside its linked claim, excerpt, source title, canonical URL, source quality, and current eligibility. Review decisions must still use the audited signal-review RPC.

Migration `202609280003_verified_observation_engine.sql` and workflow `verified_observation_engine.json` implement RE 08. The workflow reads only accepted signals whose evidence remains verified, groups them within one domain, and requires at least two accepted signals backed by at least two independent sources. Migration `202609280005_single_human_gate.sql` adds a second database policy check and automatically accepts only observations whose complete lineage still satisfies those requirements. Prompt, workflow, and database guards prevent observations from being promoted into trends, patterns, causal claims, predictions, hypotheses, recommendations, or final insights.

Migration `202609280004_observation_human_review.sql` remains available for audit and exceptional correction. It is no longer a normal workflow gate. Automatically accepted observations record `acceptance_method=automated`, `accepted_at`, and a system audit event before becoming eligible for later pattern analysis.

## RE 07: verified-evidence Signal Engine

`verified_signal_engine.json` is the first intelligence consumer. It reads only verified, accepted evidence through a service-only RPC. Each run processes at most three domains, twelve evidence items per domain, two items per source, and five generated signals per domain. Repeated claims from one article therefore remain one source rather than becoming false corroboration.

The workflow uses only the central `Supabase account` and `OpenAI account` credentials. Model citations are checked against the supplied evidence IDs before persistence. The database independently revalidates that every cited item is verified, accepted, and belongs to the same workspace domain. Single-source signal confidence is capped at `0.75`; source-diverse signals are labelled `multi_source`. Outputs are always `draft`, replay-safe, and fully linked through `signal_evidence` and `signal_entities`. This workflow creates no observations, patterns, hypotheses, or final insights.

Apply `202609270015_verified_signal_engine.sql`, import `verified_signal_engine.json`, confirm both credentials, and run the manual trigger first. Inspect `Signal Engine Summary`, `public.v_dashboard_signal_cards`, and `public.v_signal_engine_health` before enabling the daily trigger.

Apply `202609270012_regulated_capital_registry.sql`, import the workflow, verify the central `Supabase account` credential on `Upsert Regulated Fund`, and run the manual path once before enabling its four-week schedule. Inspect results through `public.v_regulated_capital_funds`.

## Local regeneration and validation

```powershell
node n8n/build_research_engine_multisource_v2.js
node n8n/validate_research_engine_multisource_v2.js
node n8n/test_research_engine_multisource_v2.js
```

The builder always reads `Research Engine_current_export.json` and writes a separate V2 file. This makes future n8n exports mergeable without losing manual fixes.
