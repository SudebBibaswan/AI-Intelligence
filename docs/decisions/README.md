# Architecture Decisions

These records capture choices that affect multiple workstreams. Status is `accepted` unless explicitly changed by a later record. A decision is changed by adding a new record that supersedes it, not by deleting its history.

## Accepted foundation decisions

### ADR 0001 One shared Research Engine

**Context:** Independent intelligence agents browsing separately would duplicate cost, create inconsistent evidence, and prevent reproducibility.

**Decision:** All external discovery, normalization, deduplication, extraction, and source verification flows through one shared Research Engine. Downstream engines consume accepted evidence packs.

**Consequences:** Intelligence modules cannot browse ad hoc. Validation that needs new research requests a Research Engine run with `trigger_type = validation` and receives a scoped evidence pack.

### ADR 0002 Workspace is the tenant boundary

**Context:** The product must support personal memory now and team use later without leaking research, hypotheses, or history.

**Decision:** Every tenant-owned table carries `workspace_id`; membership drives authorization; RLS is mandatory. Sources are workspace-scoped in the MVP.

**Consequences:** Cross-workspace content deduplication is deferred to a private catalog design. Service writes must validate workspace equality across relationships.

### ADR 0003 Evidence lineage is mandatory

**Context:** The product differentiates itself through evidence-backed intelligence and adversarial validation.

**Decision:** Intelligence objects must trace through explicit joins to evidence and sources. Supporting, contradicting, and contextual roles remain distinct.

**Consequences:** Analytical output without valid evidence identifiers is rejected. UI detail views expose lineage and limitations.

### ADR 0004 Contracts are versioned and machine validated

**Context:** Frontend, backend, and n8n need to work in parallel without interpreting prose differently.

**Decision:** Workflow outputs use JSON Schema and include `schema_version`. API responses and database statuses are documented and tested against fixtures.

**Consequences:** Breaking changes require a major version, migration notes, and coordinated updates. Additive optional changes may use a minor version.

### ADR 0005 n8n orchestrates but does not own product authorization

**Context:** n8n is well suited to scheduled and long-running workflows but should not become the user-facing backend.

**Decision:** The application or backend authenticates users, creates scoped run records, and invokes signed internal workflows. n8n receives trusted identifiers and writes through narrow validated interfaces.

**Consequences:** No public n8n webhook accepts arbitrary workspace identifiers as authorization. Browser logic and service credentials remain separate.

### ADR 0006 Model routing uses capability tiers

**Context:** Sending every operation to a premium model would exhaust budget and reduce repeatability.

**Decision:** Deterministic work uses code or SQL; high-volume tasks use the cheapest model meeting a measured quality floor; complex synthesis can escalate to a senior reasoning tier. Every call is metered.

**Consequences:** Model names are configuration, not embedded business logic. A benchmark and gold dataset govern routing changes.

## New decision template

```markdown
# ADR NNNN Descriptive title

Status: proposed | accepted | superseded
Date: YYYY-MM-DD
Owners: names or roles

## Context

What problem, constraint, or disagreement requires a durable decision?

## Decision

What exactly will the team do?

## Alternatives considered

What credible alternatives were rejected and why?

## Consequences

What becomes easier, harder, required, or deferred?

## Migration and compatibility

What existing data, code, workflow, UI, or contract must change?
```
