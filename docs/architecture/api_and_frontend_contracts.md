# API and Frontend Data Contracts

The frontend consumes stable, authorization-aware view models rather than raw workflow payloads or a large set of loosely joined database rows. The backend validates all commands, creates background jobs for long-running work, and returns consistent errors and pagination.

This document specifies logical endpoints. They may be implemented as server routes, Supabase RPC functions, or a combination, but their request and response behavior must remain stable.

## General protocol

Base prefix: `/api/v1`.

All requests use the authenticated user session. Workspace endpoints require `workspace_id` in the path or server-derived active context; the server verifies membership rather than trusting a client claim.

Successful responses use:

```json
{
  "data": {},
  "meta": {
    "request_id": "uuid",
    "schema_version": "1.0.0"
  }
}
```

List responses add:

```json
{
  "meta": {
    "next_cursor": "opaque-or-null",
    "has_more": false
  }
}
```

Error responses use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A user-safe explanation.",
    "field_errors": {},
    "retryable": false
  },
  "meta": {
    "request_id": "uuid"
  }
}
```

Use cursor pagination for feeds and timelines. Timestamps are ISO 8601 UTC. Scores are numbers from 0 through 1.

## Authentication and onboarding

| Method and path | Purpose |
|---|---|
| `GET /me` | Current profile, workspace memberships, and onboarding state. |
| `PATCH /me` | Update display name, timezone, and allowed preferences. |
| `POST /workspaces` | Create a personal or team workspace. |
| `GET /workspaces/{workspace_id}` | Workspace details and current membership. |
| `POST /workspaces/{workspace_id}/domains` | Configure a domain. |
| `PATCH /workspaces/{workspace_id}/domains/{workspace_domain_id}` | Update topics, geographies, sources, or schedule. |

Domain configuration command:

```json
{
  "domain_key": "artificial-intelligence",
  "name": "My AI Radar",
  "topics": ["AI agents", "AI infrastructure"],
  "geographies": ["Global", "India"],
  "entity_types": ["company", "investor", "product", "technology"],
  "collection_frequency": "daily",
  "source_config": {
    "web_search": true,
    "rss": true,
    "structured_ecosystem": true
  }
}
```

## Dashboard

### `GET /workspaces/{workspace_id}/dashboard`

Filters: `workspace_domain_id`, `from`, `to`, `geography`, `topic`.

Returns a purpose-built summary:

```json
{
  "data": {
    "generated_at": "2026-09-26T08:00:00Z",
    "source_cutoff_at": "2026-09-26T07:30:00Z",
    "research_health": {
      "status": "healthy",
      "last_completed_at": "2026-09-26T07:35:00Z",
      "accepted_sources": 42,
      "partial": false
    },
    "counts": {
      "new_signals": 18,
      "emerging_patterns": 3,
      "active_hypotheses": 2,
      "validations_needing_review": 1
    },
    "important_signals": [],
    "investment_movements": [],
    "emerging_patterns": [],
    "active_hypotheses": []
  }
}
```

The UI must display `source_cutoff_at` and partial or stale status so users know how current the intelligence is.

## Signals

| Method and path | Purpose |
|---|---|
| `GET /workspaces/{workspace_id}/signals` | Cursor-paginated feed with domain, type, topic, entity, geography, time, confidence, and saved filters. |
| `GET /workspaces/{workspace_id}/signals/{signal_id}` | Signal detail and lineage. |
| `POST /workspaces/{workspace_id}/signals/{signal_id}/feedback` | User usefulness, duplicate, incorrect, or irrelevant feedback. |

Signal card contract:

```json
{
  "id": "uuid",
  "signal_type": "funding",
  "title": "Example company raised a seed round",
  "summary": "Concise evidence-grounded summary.",
  "event_at": "2026-09-25T00:00:00Z",
  "confidence": 0.91,
  "novelty_score": 0.82,
  "importance_score": 0.74,
  "entities": [{"id": "uuid", "type": "company", "name": "Example"}],
  "evidence_count": 3,
  "source_count": 2,
  "has_counter_evidence": false,
  "saved": false
}
```

Signal detail adds evidence groups, sources, confidence components, related signals, engine version, and correction or supersession state.

## Entities and investment intelligence

| Method and path | Purpose |
|---|---|
| `GET /workspaces/{workspace_id}/entities` | Search and filter entities. |
| `GET /workspaces/{workspace_id}/entities/{entity_id}` | Entity profile, relationships, events, and evidence. |
| `GET /workspaces/{workspace_id}/investors/{entity_id}/theses` | Separate stated and revealed thesis timelines. |
| `GET /workspaces/{workspace_id}/investment-activity` | Investment signals and category or geography aggregation. |

Revealed thesis responses must include `inference: true`, methodology, time window, evidence count, and confidence.

## Patterns

| Method and path | Purpose |
|---|---|
| `GET /workspaces/{workspace_id}/patterns` | Pattern list filtered by status, strength, topic, entity, and time. |
| `GET /workspaces/{workspace_id}/patterns/{pattern_id}` | Pattern detail with supporting and contradicting observations. |

Pattern detail contract includes:

- `statement`, `status`, and scores for strength, persistence, and evidence diversity.
- Exact analysis time window and first or last detection times.
- Supporting, contradicting, and contextual observations as separate arrays.
- Entities, geographies, and topics.
- Related hypotheses.
- Engine version and source cutoff.

## Hypotheses and validation

| Method and path | Purpose |
|---|---|
| `POST /workspaces/{workspace_id}/hypotheses` | Create a user-authored hypothesis, optionally linked to patterns. |
| `GET /workspaces/{workspace_id}/hypotheses` | Filtered hypothesis list. |
| `GET /workspaces/{workspace_id}/hypotheses/{hypothesis_id}` | Detail, lineage, assumptions, evidence, and validation history. |
| `PATCH /workspaces/{workspace_id}/hypotheses/{hypothesis_id}` | Edit allowed draft fields with optimistic concurrency. |
| `POST /workspaces/{workspace_id}/hypotheses/{hypothesis_id}/validations` | Request validation. |
| `GET /workspaces/{workspace_id}/validations/{validation_run_id}` | Validation status or completed result. |
| `POST /workspaces/{workspace_id}/validations/{validation_run_id}/cancel` | Request cancellation if the job is cancellable. |

Hypothesis create command:

```json
{
  "title": "Independent controls for autonomous agents",
  "statement": "Regulated software teams need an independent runtime control layer for autonomous agents.",
  "target_user": "Security and compliance teams at regulated enterprises",
  "problem": "Teams cannot reliably enforce policy during autonomous agent execution.",
  "proposed_value": "Policy enforcement, auditability, and intervention outside the agent runtime.",
  "assumptions": [
    {"id": "a1", "text": "Agent adoption is reaching production in regulated teams", "critical": true},
    {"id": "a2", "text": "Existing controls do not meet runtime needs", "critical": true}
  ],
  "pattern_ids": ["uuid"],
  "idempotency_key": "client-generated-unique-value"
}
```

Validation request:

```json
{
  "dimensions": [
    "competitor",
    "demand",
    "adoption",
    "funding",
    "technical",
    "regulatory",
    "failed_attempt",
    "counter_signal"
  ],
  "depth": "standard",
  "max_cost_usd": 2.5,
  "idempotency_key": "client-generated-unique-value"
}
```

The completed result separates evidence by stance and dimension and returns `supported`, `mixed`, `weakened`, or `inconclusive`. It also returns limitations and unresolved questions.

## Research operations

| Method and path | Purpose |
|---|---|
| `POST /workspaces/{workspace_id}/research-runs` | Request a manual research run. |
| `GET /workspaces/{workspace_id}/research-runs` | Run history. |
| `GET /workspaces/{workspace_id}/research-runs/{run_id}` | Stage status, metrics, sanitized failures, and cost. |
| `POST /internal/research-runs/{run_id}/events` | Signed service callback for stage changes; not browser-accessible. |

Manual request returns `202 Accepted` with `research_run_id`, `job_id`, `status`, and estimated queue information. Repeating a request with the same idempotency key returns the original identifiers.

## Saved knowledge and feedback

| Method and path | Purpose |
|---|---|
| `PUT /workspaces/{workspace_id}/saved-items/{item_type}/{item_id}` | Save or update annotation and tags. |
| `DELETE /workspaces/{workspace_id}/saved-items/{item_type}/{item_id}` | Remove the current user’s save only. |
| `GET /workspaces/{workspace_id}/saved-items` | Filter by item type or tag. |
| `POST /workspaces/{workspace_id}/feedback` | Record quality feedback with object and reason. |

## Cost and usage

| Method and path | Purpose |
|---|---|
| `GET /workspaces/{workspace_id}/usage/summary` | Daily and total cost, model and workflow breakdown, and budget. |
| `GET /workspaces/{workspace_id}/usage/events` | Paginated usage ledger for authorized roles. |

Token-level provider details may be restricted to owners and admins. The UI should never display secrets, raw prompts containing restricted content, or provider credentials.

## Frontend state requirements

Every primary screen implements:

- Initial loading and incremental pagination.
- True empty state, distinct from filters returning zero results.
- Partial-data state when a run completed with gaps.
- Stale-data state using the source cutoff.
- Recoverable and non-recoverable error states with request ID.
- Permission-denied and missing-object states without leaking object existence.
- Background progress for research and validation.
- Superseded or corrected intelligence state.

## Optimistic concurrency

Mutable user-authored objects return `updated_at` or an opaque version. Update commands include that value. A stale update returns `409 CONFLICT` with the current version; the client must not silently overwrite a newer edit.

## Contract ownership

- Backend owns endpoint behavior, authorization, error codes, and view models.
- Frontend owns presentation-specific state but does not redefine domain statuses.
- AI and n8n own schema-compliant engine output but do not change API responses directly.
- Any breaking change increments the API or schema major version and includes migration notes.
