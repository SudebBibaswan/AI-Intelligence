# MVP Scope and Acceptance Criteria

The MVP proves that one user can configure an Artificial Intelligence research domain, receive traceable ecosystem and investment intelligence, inspect emerging patterns, and run adversarial validation on a hypothesis. It is a persistent intelligence product, not an assignment generator or an open-ended chatbot.

## Target user and job

The initial user is a Masters’ Union student, aspiring founder, or early-career builder who wants to understand a domain deeply enough to decide what deserves further investigation.

Primary job:

> Keep me current on meaningful changes in AI, show me where activity and capital are concentrating, and help me test whether an apparent opportunity is real.

## Included in MVP

### Account and workspace

- Email-based authentication and account recovery.
- One personal workspace created during onboarding.
- Workspace-scoped access enforced through Supabase RLS.
- One active domain per workspace in the first release, with the schema ready for more.

### Domain onboarding

- Select the Artificial Intelligence domain.
- Select geographies, topics, entity types, and collection frequency.
- Review and edit the configuration later.

### Shared Research Engine

- Scheduled and manually requested research runs.
- At least three source channels: web search, RSS or official sites, and one structured ecosystem source.
- URL canonicalization, content hashing, and workspace-level deduplication.
- Relevance filtering, content extraction, evidence creation, and run-level metrics.
- Every downstream object traces back to source and evidence identifiers.

### Ecosystem and investment intelligence

- A combined “What changed” feed with filters for ecosystem and investment activity.
- Signal detail with source citations, evidence excerpts, confidence, novelty, entities, and timestamps.
- Investor, company, funding, product, research, and market-development signal types.
- Stated thesis and revealed thesis stored separately.

### Patterns and hypotheses

- Pattern list and detail views showing supporting observations, time window, affected entities, and counter-signals.
- A user can create a hypothesis from a pattern or save an engine-suggested hypothesis.
- A hypothesis shows its assumptions, lineage, status, supporting evidence, and counter-evidence.

### Validation

- A validation run checks competitors, demand evidence, adoption, funding, technical feasibility, regulatory constraints, failed attempts, and counter-evidence when applicable.
- The result is `supported`, `mixed`, `weakened`, or `inconclusive`, with confidence and unresolved questions.
- Users can inspect all supporting and contradicting evidence.

### Personal knowledge and costs

- Save and annotate sources, signals, patterns, and hypotheses.
- View recent research runs and their status.
- Record LLM usage and estimated cost by run, workflow, provider, and model.

## Explicitly outside MVP

- Multiple collaborative organizations with billing and complex permissions beyond basic workspace roles.
- A generic conversational assistant over the entire internet.
- Automated investment advice, company scoring, or claims of market certainty.
- Native mobile applications.
- Real-time social firehose ingestion.
- Fully automated publishing of reports or assignment submissions.
- Enterprise integrations, SSO, advanced team administration, and external customer APIs.
- A broad marketplace of domains. The architecture is domain-agnostic, but the MVP domain is AI.

## End-to-end acceptance scenario

1. A new user creates an account and an isolated workspace.
2. The user chooses AI, India and Global geographies, and several topics.
3. A research run collects and normalizes sources using the versioned research contract.
4. Duplicate sources are suppressed, rejected items are auditable, and extraction failures are visible.
5. The dashboard displays relevant signals with verified source lineage.
6. Investment activity is distinguishable from general ecosystem activity.
7. A pattern detail page explains why multiple observations constitute a pattern.
8. The user saves or creates a hypothesis from that pattern.
9. Validation deliberately searches for evidence against the hypothesis.
10. The user receives a bounded conclusion with citations, confidence, limitations, and unresolved questions.
11. A second user cannot access any first-user workspace record, including by guessing an identifier.
12. The team can identify the cost and model usage of the entire flow.

## Release gates

| Gate | Pass condition |
|---|---|
| Contract integrity | All workflow payloads validate against the current JSON Schemas. |
| Lineage | A sample of every visible intelligence object traces to evidence and source records. |
| Tenant isolation | Automated tests prove cross-workspace reads and writes are rejected. |
| Research quality | Duplicate rate, extraction success, and rejected-source reasons are measurable. |
| Safety of claims | Hypotheses and revealed theses are visibly labelled as inferences. |
| Validation quality | Every completed validation contains both support and counter-evidence searches. |
| Cost control | Usage rows reconcile with provider usage within an agreed tolerance. |
| Reliability | Failed nodes retry safely without duplicating accepted records. |
| UX completeness | Loading, empty, partial, failed, and stale states exist for every primary view. |

## Initial success measures

- At least 60 percent of reviewed top dashboard signals are rated useful by dogfood users.
- Fewer than 10 percent of accepted sources are duplicate representations of the same content after canonicalization.
- At least 90 percent of visible signals have complete source and evidence lineage.
- Every validation result contains at least one counter-evidence item or an explicit, auditable “none found” record with the searches performed.
- Research and reasoning cost remains inside the budget configured per workspace and per run.
- Beta users return to review new intelligence at least weekly during the test period.
