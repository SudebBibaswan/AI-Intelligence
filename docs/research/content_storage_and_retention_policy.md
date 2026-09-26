# Content Storage and Retention Policy

Status: proposed for approval before provider benchmarking leaves the local evaluation environment.  
Scope: research discovery, extracted source content, evidence, provider payloads, model inputs/outputs, and logs.  

This is an engineering and product policy, not legal advice. Publisher terms, provider contracts, privacy law, and an authorized legal decision override these defaults.

## Principles

1. A crawler being technically able to retrieve content does not grant a right to store or display it.
2. Store the minimum content needed for attribution, verification, deduplication, and the user feature.
3. Metadata, full content, evidence excerpts, and derived intelligence have different retention rules.
4. Provider restrictions follow the data through caches, model calls, exports, and backups.
5. Deletion and expiry must be operational behavior, not a note in documentation.
6. Public availability does not mean unrestricted reuse.

## Storage classes

| Class | Name | Default storage | Default retention | Product display |
|---|---|---|---|---|
| `S0` | Locator only | URL, publisher, dates, hashes, discovery and access status | While workspace/run audit is retained | Link and metadata only |
| `S1` | Evidence excerpt | `S0` plus bounded excerpt and locator | While referenced by an active intelligence object; review annually | Bounded excerpt with citation |
| `S2` | Temporary cleaned content | Cleaned meaningful text in private storage | 30 days | Do not display full text; use for processing and verification |
| `S3` | Permitted reusable content | Cleaned or raw content where explicit terms/license permit | 365 days, then revalidate or delete | According to license and attribution requirements |
| `S4` | User-provided private content | User upload or authorized connected source | Until user deletion or workspace policy expiry | Only authorized workspace members |
| `S5` | Prohibited persistence | Transient in-memory processing only, if processing itself is allowed | Delete immediately after operation | No stored excerpt or content; locator only if allowed |

If a source has no assigned class, use `S0` until reviewed.

## Data-type defaults

| Data | Default class/retention | Notes |
|---|---|---|
| Canonical URL and source metadata | `S0` | Keep enough to prevent repeated fetching and preserve lineage |
| Search result snippet | Provider-specific, usually `S0` or short evaluation-only retention | Never assume snippets can be republished |
| Raw HTTP body | Transient; maximum 24 hours for debugging when permitted | Prefer not to persist in production |
| Cleaned webpage text | `S2`, 30 days | Private, encrypted storage only |
| Evidence excerpt and locator | `S1` | Keep bounded and attributable |
| Open-licensed paper/content | `S3` only after license capture | Store license name and source version |
| Paywalled or login-only content | `S0` or `S5` | Do not bypass controls |
| Robots-disallowed automated retrieval | `S0` | Record blocked status; do not retry through stealth routes |
| Provider-native API response | 7 days for evaluation, 24 hours production debugging when terms permit | Normalize promptly and remove unnecessary fields |
| Model input/output | 30 days for quality review unless provider/data policy requires less | Redact secrets and unnecessary personal data |
| Hashes and dedupe fingerprints | `S0` | A hash is not a substitute for access control |
| Research run metrics and costs | 24 months | Contains no full source content |
| Security/audit logs | 24 months, subject to security policy | Sanitize content and credentials |

## Source-specific rules

### Official announcements and company pages

Default to `S1` plus temporary `S2`. Retain claims and excerpts needed for citation. Do not mirror entire pages unless a license or written permission supports `S3`.

### RSS and Atom feeds

Store feed metadata and item fields provided for syndication. Full item bodies still follow the publisher's terms. A feed does not automatically grant the right to republish the linked page.

### Research papers

Store bibliographic metadata, abstract where permitted, version, authors, dates, and links. Store full text only when the license permits it and the license is captured. Otherwise use `S1` or temporary `S2`.

### GitHub and open-source repositories

Store release metadata and bounded release-note evidence. Repository code and documentation follow the repository license. Do not treat the existence of a public repository as a license grant.

### News and paywalled publishers

Default to `S0` or `S1`. Do not store or display full articles. Do not bypass paywalls, login walls, CAPTCHAs, or publisher access controls.

### Community and social sources

Default to `S0` or `S1` with stricter personal-data minimization. Store author handles only when needed for provenance. Avoid collecting profiles, private groups, deleted posts, or unrelated personal information.

### User-provided material

Use `S4`. Keep it isolated by workspace, exclude it from cross-customer training or retrieval, and delete it when the user removes it or the workspace retention period expires.

## Provider processing rules

Before sending content to a search, extraction, or model provider, record:

- Provider and exact service.
- Allowed storage classes.
- Provider retention/training configuration.
- Processing region when relevant.
- Whether user-provided/private content is allowed.
- Contract or terms review date.
- Approved fallback providers.

Do not silently send data to a fallback provider with different retention or training behavior. Open-weight models hosted by third parties still involve third-party processing.

## Storage implementation

- Store content in a private bucket under `workspaces/{workspace_id}/sources/{source_id}/`.
- Store storage class, policy version, acquired time, expiry time, source terms reference, content hash, and deletion state alongside the object record.
- Use short-lived signed URLs only for authorized internal review.
- Encrypt traffic and provider credentials; never place credentials in content metadata.
- Enforce workspace isolation in storage policies and service functions.
- A scheduled expiry job deletes objects and marks the database record expired.
- Backups must inherit deletion schedules; document the maximum backup disappearance time.

## Derived data and deletion

When source content expires or is deleted:

1. Delete raw and cleaned objects plus caches.
2. Preserve permitted source metadata and hashes.
3. Keep a bounded evidence excerpt only if its class permits it.
4. Mark evidence unavailable if its retained locator can no longer be verified.
5. Recompute or withdraw derived objects that depended on prohibited or invalid evidence when necessary.
6. Preserve a minimal audit event without copied content.

Deleting a source from the product must not leave the same content in evaluation fixtures, model-debug tables, workflow execution logs, or exported n8n data.

## Logs and n8n executions

- Do not log raw page bodies or model prompts by default.
- Store identifiers, counts, hashes, sanitized errors, latency, and cost.
- Disable or minimize successful execution payload retention in production when operationally acceptable.
- Restrict failed-execution access because failures may contain provider payloads.
- Redact authorization headers, cookies, API keys, signed URLs, email addresses, and unnecessary personal data.

## Policy exceptions

An exception record must include:

- Source/provider and affected data.
- Requested storage class and retention.
- Product reason.
- Legal/terms basis.
- Approver and approval date.
- Expiry/review date.
- Required deletion or attribution behavior.

No permanent exception is implied by a successful experiment.

## Approval checklist

```text
[ ] Every initial source category has a default storage class
[ ] Every provider has a current terms/retention review
[ ] Private/user data routes are explicitly approved
[ ] Storage objects carry expiry and policy version
[ ] n8n execution logging is minimized
[ ] Expiry and deletion jobs are testable
[ ] Backups and exports have deletion behavior
[ ] Product excerpts and citations match class rules
[ ] Exception owner and process are assigned
```

## Related

- [Security and Row Level Security](../architecture/security_and_rls.md)
- [Initial AI Source Catalogue](initial_ai_source_catalog.md)
- [Research Engine Architecture and Build Plan](research_engine_architecture_and_build_plan.md)

