# Intelligence Platform Documentation

This directory is the shared implementation reference for the Intelligence Platform. The master plan explains the product vision; the documents below turn that vision into contracts that product, frontend, backend, data, and n8n contributors can use independently without inventing incompatible structures.

## Source of truth order

When two documents disagree, use this order:

1. Accepted architecture decision records in `docs/decisions`
2. Machine-readable contracts in `schemas`
3. Database and API contracts in `docs/architecture`
4. Research workflow specifications in `docs/research`
5. Product scope and vocabulary in `docs/product`
6. `intelligence_platform_master_plan.md` for product intent

Resolve a conflict by updating all affected documents in the same pull request. Do not silently choose one interpretation.

## Foundation documents

| Document | Primary audience | Decision it unlocks |
|---|---|---|
| [Master Product and Build Plan](intelligence_platform_master_plan.md) | Entire team | Product intent and long-term direction |
| [MVP Scope and Acceptance Criteria](product/mvp_scope_and_acceptance.md) | Product, design, engineering | What the first usable release includes |
| [Product Vocabulary](product/product_vocabulary.md) | Entire team | Exact meanings of intelligence terms |
| [System Architecture](architecture/system_architecture.md) | Backend, AI, frontend | Service boundaries and data flow |
| [Database Schema](architecture/database_schema.md) | Backend, frontend, n8n | Canonical tables, keys, states, and lineage |
| [Supabase Setup and Connection](architecture/supabase_setup_and_connection.md) | Backend, frontend, n8n | Apply migrations, verify RLS, and connect each component with the correct key |
| [API and Frontend Data Contracts](architecture/api_and_frontend_contracts.md) | Frontend, backend | Stable read and write interfaces |
| [Security and RLS](architecture/security_and_rls.md) | Backend, n8n | Tenant isolation and credential boundaries |
| [Model Routing and Cost Control](architecture/model_routing_and_cost_control.md) | AI, backend, product | Which work uses which model tier and how cost is recorded |
| [Universal Research Contract](research/universal_research_contract.md) | AI, n8n, backend | Normalized ingestion payload |
| [Research Engine Architecture and Build Plan](research/research_engine_architecture_and_build_plan.md) | AI, n8n, backend, product | Source strategy, provider routing, quality gates, evaluation, and phased build order |
| [Phase 0 Execution Guide](research/phase0_execution_plan.md) | AI, backend, product | How to benchmark and approve sources, providers, models, limits, and retention |
| [Research Evaluation Reference](research/research_evaluation_reference.md) | AI, backend | Gold-set labels, metrics, mandatory gates, and benchmark records |
| [Gold Set Human Review Procedure](research/how_to_review_research_gold_set.md) | AI, research reviewers, product | Dataset repair, blind human review, adjudication, and approval |
| [Initial AI Source Catalogue](research/initial_ai_source_catalog.md) | AI, product | Proposed monitored sources, priorities, channels, and approval checks |
| [Content Storage and Retention Policy](research/content_storage_and_retention_policy.md) | AI, backend, product | What content may be stored, displayed, expired, and sent to providers |
| [Research Generalization and Department Readiness](research/research_engine_generalization_and_department_readiness.md) | AI, product, department leads | What is reusable and what each department must validate independently |
| [Research Engine Workflow](research/research_engine_workflow.md) | AI, n8n, backend | Node boundaries, retries, and handoffs |
| [n8n Provider Credential Setup](operations/how_to_configure_n8n_provider_credentials.md) | AI, n8n, security | Secure Tavily, Exa, Firecrawl, and OpenAI development credentials |
| [First n8n Research Agent Build Guide](operations/how_to_build_first_n8n_research_agent.md) | AI, n8n, backend | Build the manual review-only Research Engine from run claim through evidence persistence |
| [Parallel Delivery Plan](team/parallel_delivery_plan.md) | Entire team | Workstreams, dependencies, and integration gates |
| [Architecture Decisions](decisions/README.md) | Entire team | Accepted cross-team technical decisions |
| [Open Decisions](decisions/open_decisions.md) | Leads and founders | Choices that must be resolved before affected implementation |

## Machine-readable contracts

The JSON Schemas in `/schemas` are normative for workflow output and API validation:

- `research-source.schema.json`
- `signal.schema.json`
- `hypothesis.schema.json`
- `validation-result.schema.json`

Every payload includes `schema_version`. Breaking changes require a new major version and an architecture decision record. Additive optional fields may use a minor version.

Research evaluation begins with `/evaluation/research_gold_set_template.csv`. The seeded Phase 0 review set is `/evaluation/research_gold_set_v1.csv`, with its reviewer-friendly workbook at `/outputs/research-engine-phase0/research_gold_set_v1.xlsx`. The AI seed is not a human review: after repairing the sampling defects, every row requires two independent human reviews and adjudication before provider scoring. These files are evaluation assets, not runtime API contracts.

Provider credentials are tracked without secret values in `/docs/operations/provider_credential_register.csv`. Secret values belong only in the authorized provider dashboard and n8n credential store.

## Change protocol

1. State the problem in an issue or pull request.
2. Identify affected database, API, workflow, UI, and JSON contracts.
3. Update the decision record first if the change alters an accepted boundary.
4. Update machine-readable and human-readable contracts together.
5. Add migration and compatibility notes.
6. Obtain review from the owners of every affected workstream.

The current foundation contract version is `1.0.0`.
