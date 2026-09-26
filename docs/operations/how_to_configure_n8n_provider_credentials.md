# How to Configure Research Provider Credentials in n8n Cloud

This guide prepares development credentials for Tavily, Exa, Firecrawl, and OpenAI without exposing secrets in workflows, Git, screenshots, execution logs, or frontend code. It prepares credential access only; it does not approve a provider or authorize production use.

Status: setup guide ready; account keys and n8n access are required from the authorized owner  
Environment: n8n Cloud development project  
Last provider-documentation check: 2026-09-27

## Security model

- Use provider keys created for this product and environment, not a founder's general personal key.
- Keep development and production credentials separate.
- Put secrets only in the n8n credential store or an approved secret manager.
- Give each provider a separate credential so it can be rotated, disabled, and measured independently.
- Treat workflow access as credential use access. n8n documents that workflow editors can use credentials attached to a shared workflow even when the credential itself was not explicitly shared.
- Never put a key in a Code node, Set node, workflow variable, webhook payload, prompt, URL query string, test fixture, exported workflow, or repository file.
- Never return an authorization header or credential field in node output.

## Prerequisites

- n8n Cloud owner or project-admin access.
- Provider account-owner access for Tavily, Exa, Firecrawl, and OpenAI.
- Multi-factor authentication enabled on n8n and provider accounts where available.
- A development budget and usage alert for every paid provider.
- An authorized credential owner and backup owner.
- The non-secret register at `docs/operations/provider_credential_register.csv`.

Do not paste API keys into tickets, chat, email, or this repository. The authorized owner should create and enter each key directly in the provider dashboard and n8n.

## Credential naming standard

Use:

```text
research-{environment}-{provider}-{capability}-v{generation}
```

Initial names:

```text
research-dev-tavily-search-v1
research-dev-exa-search-v1
research-dev-firecrawl-extract-v1
research-dev-openai-models-v1
```

The generation changes only when a credential is replaced. Do not include the secret, account email, or full provider account ID in the name.

## Step 1: Create the restricted n8n project

1. Create or select an n8n project named `Research Engine - Development`.
2. Add only the Intelligence Lead, workflow implementer, and one credential backup owner.
3. Keep benchmark and credential-smoke-test workflows in this project.
4. Do not share provider-backed workflows with the wider UI or research team merely so they can view results. Publish sanitized results outside n8n instead.
5. Record project owner and member review date in the credential register.

If the current n8n plan does not support projects or the needed sharing controls, keep the workflows private to the credential owner until an approved access boundary exists.

## Step 2: Prepare provider-side controls

For each provider:

1. Create a development-only team, project, or key when the provider supports it.
2. Use the lowest permissions that can call the required endpoint.
3. Set a low development spending limit and alerts before testing.
4. Name the key consistently with the n8n credential name.
5. Set an expiry date when supported.
6. Record creation date, owner, quota, expiry, allowed data classes, and terms-review date in the non-secret register.

For OpenAI, use a project-based key and separate development project. OpenAI recommends project separation, spend controls, secure storage, expiration, and rotation. Use a service-account key for nonhuman production workloads when the account's governance supports it; do not share a personal key.

## Step 3: Add Tavily to n8n

Tavily's current Search API uses `POST https://api.tavily.com/search` with bearer authentication.

1. In n8n, create a new **HTTP Bearer Auth** credential.
2. Name it `research-dev-tavily-search-v1`.
3. Paste only the Tavily API key into the Bearer Token field.
4. Save the credential in `Research Engine - Development`.
5. Do not add `Bearer` manually when the n8n credential form expects only the token.

Use the credential only with the `api.tavily.com` host. The first benchmark should use bounded `max_results`, disable generated answers and raw content unless the test explicitly needs them, and record returned usage.

Official reference: [Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search).

## Step 4: Add Exa to n8n

The baseline adapter should use an HTTP Request credential so the provider remains replaceable. Exa accepts either bearer authentication or the `x-api-key` header; use one method consistently.

Recommended baseline:

1. Create a new **HTTP Header Auth** credential.
2. Name it `research-dev-exa-search-v1`.
3. Set header name to `x-api-key`.
4. Paste the Exa API key as the header value.
5. Save it in the restricted project.
6. Restrict its use to `https://api.exa.ai` requests.

Exa also publishes an official n8n community node. Treat it as optional convenience after the instance owner reviews its package, permissions, compatibility, and update policy. Do not make the first adapter depend on it.

Official references: [Exa API authentication](https://exa.ai/docs/llms.txt), [Exa Search](https://exa.ai/docs/reference/search), and [Exa's n8n integration](https://exa.ai/docs/integrations/n8n).

## Step 5: Add Firecrawl to n8n

Firecrawl's current API base URL is `https://api.firecrawl.dev`, and its API requires bearer authentication.

1. Create a new **HTTP Bearer Auth** credential.
2. Name it `research-dev-firecrawl-extract-v1`.
3. Paste only the Firecrawl API key into the Bearer Token field.
4. Save it in the restricted project.
5. Use Firecrawl for difficult extraction after cheaper direct routes fail; do not use enhanced modes by default.

Do not enable TLS-verification bypasses to make a smoke test pass. A source with invalid TLS must be handled as a source/access problem and reviewed explicitly.

Official reference: [Firecrawl API introduction and authentication](https://docs.firecrawl.dev/api-reference/introduction).

## Step 6: Add OpenAI to n8n

Use n8n's built-in OpenAI credential.

1. In the OpenAI dashboard, create or select the development project for this platform.
2. Set the project budget, alerts, allowed users, and key expiration.
3. Create a project key with only the permissions needed for the selected API route when permission controls are available.
4. In n8n, create an **OpenAI API** credential named `research-dev-openai-models-v1`.
5. Paste the API key into the API Key field.
6. Add an Organization ID only when the account belongs to multiple organizations and requests must be assigned explicitly.
7. Save it in the restricted project.

n8n Cloud gateway credits may be available, but they are not the default for this evaluation because provider usage, model identity, and cost must remain attributable to our benchmark configuration.

Official references: [n8n OpenAI credentials](https://docs.n8n.io/integrations/builtin/credentials/openai/) and [OpenAI API-key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key).

## Step 7: Verify credentials without building the Research Engine

Create one private, manual-only workflow named `OPS 01 Provider Credential Smoke Test`. It is an operations check, not the first Research Engine workflow.

For each provider, run one minimum-cost request against a public, non-sensitive input:

| Provider | Verification | Pass condition |
|---|---|---|
| Tavily | One result, basic search, no answer, no raw content | HTTP 200, one result, request/usage metadata captured |
| Exa | One-result search without page contents | HTTP 200 and one normalized result |
| Firecrawl | One basic scrape of `https://example.com` | HTTP 200 and a non-empty bounded result |
| OpenAI | n8n credential test, then one minimal structured call only after model approval | Authentication succeeds; exact model ID and usage are recorded |

Before execution, turn off or minimize stored successful execution payloads when n8n permits it. After each test:

- Record status, timestamp, latency, provider request ID, and credits/tokens in the register.
- Record only the final four characters of a provider key fingerprint if the provider exposes a safe key identifier. Never derive or store key substrings yourself.
- Delete any execution data containing unexpected headers or provider payloads.
- Stop after one successful call. Repeated calls are not credential validation.

## Step 8: Approve credential readiness

A credential is `ready_for_phase0` only when:

```text
[ ] Secret exists only in an approved credential store
[ ] Named owner and backup owner
[ ] Development environment only
[ ] Budget/usage alerts configured
[ ] Expiry or review-by date recorded
[ ] Allowed data/storage classes recorded
[ ] Provider terms and retention review date recorded
[ ] Minimum-cost smoke test passed
[ ] No secret or authorization header in execution output
[ ] Rotation and revocation route confirmed
```

Credential readiness does not mean provider approval. Provider approval still requires the reviewed gold-set benchmark.

## Rotation procedure

1. Create a replacement provider key before the old key expires.
2. Create a new n8n credential with the next generation number.
3. Test the new credential once in the private smoke-test workflow.
4. Update eligible development workflows to the new credential.
5. Verify one bounded execution.
6. Revoke the old provider key.
7. Delete or archive the old n8n credential according to n8n capabilities.
8. Update the non-secret register and audit event.

Never overwrite the old credential value first and hope the new key works. A separate generation gives a safe rollback window.

## Suspected-exposure response

1. Disable or revoke the provider key immediately.
2. Pause every n8n workflow using the credential.
3. Review provider usage, n8n executions, workflow exports, repository history, and shared messages for exposure scope.
4. Create a replacement key with the next generation number.
5. Test and reconnect only approved workflows.
6. Record time, affected provider, observed usage, actions, owner, and follow-up review.
7. Escalate unexpected charges or data access to the provider and the project owner.

Do not wait for proof of abuse when the secret itself is exposed.

## Troubleshooting

### HTTP 401 or rejected credential

Confirm that the correct development key is active, the authentication type matches the provider, and the workflow selected the intended credential generation. Do not print the header to debug it.

### HTTP 429 or quota error

Stop testing, record the provider response and current quota, and adjust the approved budget or rate policy. Do not rotate a key to evade a provider limit.

### A team member needs to edit the workflow

Add access only after reviewing that person's project role. Because editors may use attached credentials, workflow access is a security decision even if the secret value remains hidden.

### A provider key was pasted into a node

Treat it as exposed: revoke it, remove it from the workflow and execution history, scan repository/workflow exports, and issue a new generation through the credential store.

## Related

- [Security and Row Level Security](../architecture/security_and_rls.md)
- [Model Routing and Cost Control](../architecture/model_routing_and_cost_control.md)
- [How to Complete Research Engine Phase 0](../research/phase0_execution_plan.md)
- [Content Storage and Retention Policy](../research/content_storage_and_retention_policy.md)

