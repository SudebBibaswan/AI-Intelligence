# Parallel Delivery Plan

This plan lets five contributors work concurrently while protecting the shared contracts that connect them. The critical path is tenancy and contracts, then the Research Engine, then intelligence and validation, then the complete user journey.

## Shared rules before parallel work

1. Treat `/schemas`, the database schema, and accepted decision records as shared interfaces.
2. Do not change a field name, status, or object meaning in one workstream only.
3. Use fixtures that validate against the machine-readable schemas.
4. Put long-running work behind job IDs; frontend work can use fixtures before workflows exist.
5. Merge small vertical slices and test integration continuously.
6. Record a decision when a change affects more than one workstream.

## Workstreams

| Workstream | Primary owner | Can start now | Produces | Depends on |
|---|---|---|---|---|
| Product and UX | Product Strategy Lead with Frontend Lead | Yes | User flows, wireframes, acceptance criteria, copy | Vocabulary and MVP scope |
| Data and security | Backend and Data Lead | Yes | Migrations, RLS, seed data, database functions, policy tests | Database and security contracts |
| Research Engine | Intelligence and AI Lead | Yes after contract review | Versioned workflows, adapters, evidence packs, metrics | Research contract and run tables |
| Frontend application | Frontend and Product Experience Lead | Yes | Auth, onboarding, dashboard, intelligence views, states | API fixtures and view-model contracts |
| GTM and beta operations | Growth and GTM Lead | Yes | Interview plan, cohort, feedback instrument, onboarding content | ICP and MVP scope |

## Contract freeze checkpoint

Before building production workflows, the Intelligence Lead, Backend Lead, and Frontend Lead review and sign off:

- Product vocabulary.
- Database tables and statuses required for the first vertical slice.
- Universal Research Contract.
- Signal, hypothesis, and validation JSON Schemas.
- Dashboard and detail view models.
- RLS role matrix.

“Freeze” means breaking changes require a visible proposal and coordinated migration; it does not prevent additive improvements.

## Milestones

### Milestone 0 Foundation

Exit criteria:

- Repository structure, environments, ownership, and secret handling are established.
- Foundation documents are reviewed.
- Development Supabase project and n8n environment exist.
- Contract fixtures validate in continuous integration.
- First architecture decisions are accepted.

Parallel work:

- Backend creates identity, workspace, domain, research-run, source, and evidence migrations plus RLS tests.
- AI builds discovery-adapter fixtures and canonicalization tests against the research schema.
- Frontend builds authenticated shell and onboarding against mock API responses.
- Product produces final MVP flows and usability criteria.
- Growth recruits dogfood users and prepares interview questions.

### Milestone 1 Evidence vertical slice

User outcome: configure AI and see one manually triggered research run produce source and evidence records.

Exit criteria:

- Web search and at least one official or feed adapter work.
- Run status is visible in the UI.
- Sources deduplicate safely.
- Evidence is attributable and viewable.
- Cost is recorded.
- Cross-workspace access tests pass.

Integration gate: one source can be traced from dashboard fixture to database row to run and workflow execution.

### Milestone 2 Signal and investment slice

User outcome: see “What changed” and investment activity with evidence.

Exit criteria:

- Signal Schema validates engine output.
- Entity resolution handles core companies, people, and investors.
- Stated and revealed thesis are not conflated.
- Signal feedback is recorded.
- Partial and stale states are visible.

### Milestone 3 Pattern and hypothesis slice

User outcome: inspect a recurring pattern and create or save a testable hypothesis.

Exit criteria:

- Pattern requires multiple observations and shows counter-signals.
- Hypothesis lineage links to patterns.
- User can edit assumptions without destroying engine provenance.
- Product copy consistently labels inference.

### Milestone 4 Adversarial validation slice

User outcome: request validation and receive a bounded conclusion with supporting and contradicting evidence.

Exit criteria:

- All applicable validation dimensions are searched.
- Result has citations, limitations, unresolved questions, and cost.
- Failed or partial validation is not displayed as complete.
- Retry is idempotent.

### Milestone 5 Dogfood and beta readiness

Exit criteria:

- Quality, usage, reliability, and economics metrics are visible.
- Security and tenant-isolation tests pass in the release environment.
- The team completes daily dogfood for an agreed period.
- High-severity defects are resolved.
- Feedback and support ownership are clear.

## Frontend fixture strategy

The backend owner publishes versioned fixture files for dashboard, signal detail, pattern detail, hypothesis detail, validation progress, and completed validation. Include success, empty, partial, stale, error, and permission-denied variants.

Frontend development may proceed against fixtures, but milestone integration is not complete until the same contract is returned from the real backend.

## Ownership matrix

| Contract or component | Responsible | Required reviewers |
|---|---|---|
| Product vocabulary and MVP acceptance | Product Strategy | Frontend, AI, Backend |
| Database and RLS | Backend and Data | AI, Frontend |
| Research and evidence contracts | Intelligence and AI | Backend |
| API and view models | Backend and Frontend | Product, AI where semantics change |
| n8n workflows | Intelligence and AI | Backend |
| Product UI and states | Frontend | Product |
| Model routing and evaluation | Intelligence and AI | Backend, Product |
| Beta metrics and interviews | Growth | Product |
| Cross-cutting architecture decisions | Decision proposer | Every affected owner |

## Pull request integration checklist

- Contract and decision impact is stated.
- Database migration is forward-only and includes rollback or recovery notes.
- RLS tests cover new tenant data.
- Workflow changes are exported and contain no credentials.
- JSON output validates against the current schema.
- UI covers loading, empty, partial, stale, error, and unauthorized states when relevant.
- New model calls write usage rows and respect budgets.
- Evidence lineage remains intact.
- Documentation and fixtures change in the same pull request when interfaces change.

## Work that must not proceed independently

- Frontend must not invent new status strings.
- n8n must not write tables without workspace and idempotency rules.
- Backend must not rename contract fields without schema and fixture updates.
- Product must not redefine “pattern,” “hypothesis,” or “insight” only in UI copy.
- AI workflows must not promote a claim to insight without required lineage and validation.
- Growth reporting must not promise product capabilities outside the accepted MVP.

## First planning session agenda

1. Review the MVP end-to-end acceptance scenario.
2. Resolve open schema and source-adapter questions.
3. Approve the foundation decision records.
4. Assign owners to Milestone 0 outputs.
5. Set the contract freeze date.
6. Choose the first vertical-slice demo date.
7. Agree on issue labels, pull request review rules, and daily integration rhythm.
