# Basic Admin Panel — Requirements

## Goal

Build a small, read-mostly operations panel for workspace administrators. It should answer five questions quickly:

1. Is the intelligence pipeline healthy?
2. Which workflow or request failed?
3. How many model calls and tokens were used?
4. What did usage cost?
5. Who changed or approved something?

This is an internal control panel, not a second product dashboard. Keep it simple, fast, and workspace-scoped.

## Access

- Route: `/admin`
- Only authenticated `owner` and `admin` workspace members may access it.
- All reads must enforce workspace isolation through Supabase RLS.
- Do not expose provider credentials, API keys, authorization headers, raw secrets, or unrestricted model prompts/responses.
- Every future write action must use an audited RPC. The first version should be read-only except for safe retry/cancel actions added later.

## Navigation and screens

### 1. Overview

Show compact cards for the selected time range: today, 7 days, or 30 days.

- Workflow runs: total, completed, partial, failed, running, queued
- LLM requests: total, successful, failed
- Tokens: input, output, total
- Estimated model cost in USD
- Sources collected and evidence accepted
- Draft signals awaiting the one human review gate
- Accepted signals, observations, patterns, and hypotheses
- Last successful pipeline run and last failure

Add two small charts only:

- Daily requests and estimated cost
- Daily workflow success/failure count

### 2. Workflow Runs

One searchable table combining operational workflow activity.

Columns:

- Started time
- Workflow/agent
- Run or request ID
- Domain
- Status
- Duration
- Attempt count
- Sources/evidence/output count when available
- LLM calls
- Estimated cost
- Short error summary

Filters:

- Date range
- Workflow: Research Engine, RE07, RE08, RE09, later RE10/RE11
- Status
- Domain
- Provider/model

Opening a row should show stage counts, timestamps, request lineage, errors, and linked output IDs. Do not display large raw provider payloads by default.

### 3. Signal Approval Queue — mandatory human gate

This is the operational approval mechanism between RE07 and RE08. It is the **only mandatory human gate** in the intelligence pipeline.

Use:

- `public.v_signal_review_queue` for draft signals;
- `public.v_signal_review_details` for their evidence and source context; and
- `public.review_intelligence_signal(signal_id, decision, reason, request_id)` for every decision.

The queue must show:

- Signal title, summary, type, event date, confidence, novelty, and importance
- Workspace domain and creation time
- Corroboration status
- Evidence count and independent-source count
- Whether every linked evidence record remains eligible
- Source title, publisher, publication date, canonical URL, claim, and excerpt
- Previous review count

Available actions:

- **Approve** — moves a draft signal to `accepted`, making it eligible for RE08.
- **Reject** — moves a draft signal to `rejected`; a reason is mandatory.
- **Open source** — opens the canonical source for human inspection.

Approval requirements:

- Never update `signals.status` directly from the browser.
- Generate a fresh UUID `request_id` for each deliberate decision and call the audited RPC.
- Disable approval when evidence is missing, stale, unverified, or outside the signal's domain.
- Show a confirmation dialog containing the signal title and selected decision.
- Do not support bulk approval in the first version.
- Treat an RPC replay response as success; repeated clicks must not duplicate reviews.
- Refresh the queue, overview count, and audit log after a successful decision.
- Surface safe database errors when a decision is rejected.
- Every decision must create an append-only `signal_reviews` row and a `signal.reviewed` audit event.

Show the pending-review count as a navigation badge. Approval does not execute RE08 in the browser; it makes the signal eligible for the next scheduled RE08 run or an explicitly configured backend trigger.

### 4. AI Usage

Use `public.llm_usage` and `public.v_workspace_cost_daily`.

Summary:

- Requests/calls
- Successful and failed calls
- Input tokens
- Output tokens
- Total tokens
- Estimated cost
- Average latency
- Failure rate

Breakdowns:

- By day
- By workflow/agent/operation
- By provider and model
- By research run or validation run

Every usage row must retain `request_id`, workflow, agent, operation, provider, model, token counts, cost, latency, success, error code, prompt version, schema version, and timestamp.

Cost figures are estimates until reconciled with provider billing. Show the label **Estimated cost** everywhere.

### 5. Requests and Errors

This is the debugging screen for individual model and workflow requests.

Columns:

- Timestamp
- Request ID
- Workflow and operation
- Provider/model
- Success/failure
- Latency
- Input/output tokens
- Estimated cost
- Error code
- Related research/validation/job run

Allow searching by exact `request_id`. A request detail view should show safe metadata and lineage, but never secrets or full sensitive content. Errors should be grouped by error code so repeated failures are obvious.

### 6. Audit Log

Use `public.audit_log`.

Show:

- Timestamp
- Actor type and actor ID
- Action
- Target type and target ID
- Request ID
- Safe metadata

Filters: date, actor, action, and target type. This screen must include signal acceptance/rejection because signal review is the system’s only mandatory human gate.

### 7. System Counts

Show simple current totals by workspace and domain:

- Research runs
- Sources
- Evidence
- Draft/accepted/rejected signals
- Observations
- Emerging/persistent/weakening/contradicted patterns
- Hypotheses and validation status
- Draft/published insights

This screen is diagnostic only. It must not allow direct row editing or deletion.

## Existing data to reuse

The database already provides most foundations:

- `research_runs` — research execution state and metrics
- `job_runs` — queued/running/completed/failed job state
- `llm_usage` — request, model, tokens, latency, success, and estimated cost
- `audit_log` — human/service/system actions
- `v_research_run_health` — run health and output counts
- `v_workspace_cost_daily` — daily provider/model/operation usage
- `v_source_lineage` — source and evidence lineage
- intelligence tables: `signals`, `observations`, `patterns`, `hypotheses`, `validation_runs`, `insights`

Prefer security-invoker views or workspace-scoped RPCs for admin aggregates. Do not calculate large cross-table aggregates in the browser.

## Small backend additions

Add only what the UI cannot obtain safely and efficiently:

1. `v_admin_overview_daily` — daily run, request, token, cost, and failure totals.
2. `v_admin_pipeline_counts` — counts by domain, object type, and status.
3. `v_admin_request_health` — safe request-level usage joined to related run/job information.
4. Indexes for the main filters: workspace plus created time, status, workflow, request ID, provider, and model.
5. A single workspace-scoped summary RPC if RLS-safe views cannot provide the overview efficiently.

All additions must be additive migrations. Do not weaken existing RLS or expose service-only functions to ordinary authenticated users.

## Data instrumentation requirement

Every OpenAI or other LLM call in Research Engine and RE07–RE11 must insert one `llm_usage` row, including failures. Every workflow execution should have a stable `request_id` propagated through `research_runs`, `job_runs`, `llm_usage`, and `audit_log` wherever applicable.

Minimum recorded fields:

```text
workspace_id
request_id
workflow
agent
operation
provider
model
input_tokens
output_tokens
estimated_cost_usd
latency_ms
success
error_code
prompt_version
schema_version
created_at
```

If a provider does not return token usage, store zero and mark the absence in safe metadata; never invent token counts.

## UI behavior

- Desktop-first responsive layout using the existing app shell and design system.
- Default time range: last 7 days.
- Auto-refresh overview and active runs every 30–60 seconds; historical tables refresh manually.
- Clear loading, empty, partial-data, and error states.
- Use pagination for request, run, and audit tables.
- Display UTC timestamps with the user’s local timezone available in details.
- Redact sensitive metadata keys before rendering JSON.
- CSV export may be added for usage and audit tables, limited to the active workspace and filters.

## Out of scope for the first version

- User billing or invoicing
- Organization-wide super-admin access
- Editing database rows
- Prompt playgrounds
- Viewing complete raw model inputs/outputs
- Credential management
- Complex alerting, forecasting, or anomaly detection
- Destructive reset/delete controls
- Fine-grained custom roles beyond owner/admin/member

## Acceptance criteria

The basic admin panel is complete when:

- Non-admin members cannot access `/admin` or its underlying data.
- All metrics are restricted to the active workspace.
- Overview totals reconcile with database counts for the selected period.
- Owners/admins can inspect evidence and approve or reject RE07 draft signals only through the audited review RPC.
- Approved signals leave the pending queue and become eligible for RE08; rejected signals cannot enter RE08.
- Duplicate review submissions with the same `request_id` are replay-safe and do not create duplicate review records.
- LLM request, token, failure, latency, and estimated-cost data can be filtered by workflow and model.
- A failed request can be traced by `request_id` to its related workflow/run and safe error details.
- Signal review actions appear in the audit log.
- Empty usage or missing optional metrics do not break the page.
- No credentials, secrets, or unrestricted sensitive payloads reach the browser.
- Existing application and pipeline tests continue to pass.

## Recommended build order

1. Add the RLS-safe aggregate views and indexes.
2. Verify all workflows consistently write `llm_usage` and propagate `request_id`.
3. Build `/admin` Overview.
4. Build the Signal Approval Queue and verify the audited RE07→RE08 transition.
5. Add Workflow Runs and AI Usage.
6. Add Requests/Errors and Audit Log.
7. Add System Counts and final access/security tests.
