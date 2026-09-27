# Importing the Research Engine into n8n

Import `research_engine_complete.json` into the **AI Intelligence** project/folder and keep it inactive during the first test.

## Required one-time mapping

Open `Research Request and Limits` and replace:

- `https://REPLACE_PROJECT_REF.supabase.co`
- `REPLACE_WITH_WORKSPACE_UUID`
- `REPLACE_WITH_WORKSPACE_DOMAIN_UUID`

The JSON references these credential names:

| Purpose | n8n credential type | Referenced name |
|---|---|---|
| Supabase | Supabase API | `supabase` |
| OpenAI | OpenAI API | `openai` |
| Tavily | Bearer Auth | `bearer auth for tavily` |
| Firecrawl | Header Auth | `firecrawl` |

Credential secrets are never included in an exported workflow. Because credential IDs are specific to an n8n account, re-select each existing credential once if its node shows red after import.

The Firecrawl Header Auth credential must send:

```text
Authorization: Bearer YOUR_FIRECRAWL_API_KEY
```

The Tavily Bearer Auth credential must contain only the Tavily token; n8n adds `Bearer` automatically.

## Required Supabase runtime objects

The workflow expects:

- `research_runs`, `sources`, `research_run_sources`, `evidence`, and `llm_usage` tables.
- Private Storage bucket `research-content`.
- RPC functions `n8n_claim_research_run`, `n8n_set_research_run_status`, `n8n_record_research_source`, and `n8n_record_research_evidence`.
- A secret Supabase key in the n8n credential, not a browser publishable key.

## First execution

The imported workflow defaults to:

- Manual trigger only.
- `review_only` mode.
- Three search queries.
- Five Tavily results per query.
- Ten deduplicated candidates maximum.
- One-at-a-time crawling.
- Five grounded evidence items per source.
- GPT-6 Luna for structured query planning and evidence extraction.

Run it once and inspect the final node. A successful result contains `research_run_id`, `status`, and metrics. Then confirm:

1. The matching `research_runs` row is `completed` or `partial`.
2. New source content exists in `research-content/<workspace>/<run>/<source>.md`.
3. Source rows have canonical URLs and content hashes.
4. Evidence excerpts match their source content after deterministic whitespace normalization.
5. Evidence remains `unverified` in review-only mode even when the workflow's deterministic grounding check passes.

Do not add a schedule or public webhook until reviewed runs meet the evaluation gates.

## Local artifact validation

The workflow can be regenerated and checked with:

```powershell
node n8n/build_research_engine_workflow.js
node n8n/validate_research_engine_workflow.js
```
