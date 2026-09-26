# Security and Row Level Security

Workspace membership is the authorization boundary. RLS is mandatory defense in depth on every tenant-owned table, including join tables, operational tables, storage metadata, and views. Application checks improve error handling but do not replace database policies.

## Roles and capabilities

| Capability | Owner | Admin | Member | Viewer | Service workflow |
|---|---:|---:|---:|---:|---:|
| Read workspace intelligence | Yes | Yes | Yes | Yes | Scoped job only |
| Edit domain configuration | Yes | Yes | No | No | No |
| Request research or validation | Yes | Yes | Yes | No | Scheduled or delegated only |
| Create and edit own hypotheses | Yes | Yes | Yes | No | Engine-created records only |
| Manage members and roles | Yes | Limited | No | No | No |
| View detailed cost data | Yes | Yes | Limited | No | Write only |
| Delete workspace | Yes | No | No | No | No |

Precise role changes should be enforced through protected database functions to prevent self-promotion and removal of the final owner.

## Membership helper

Use one stable helper function for policies, implemented as a security-definer function with a fixed search path and minimal body:

```sql
is_workspace_member(target_workspace_id uuid, allowed_roles text[] default null)
```

It returns true only when `auth.uid()` has an active membership in the target workspace and, when provided, its role is in `allowed_roles`. Revoke direct mutation of membership tables from ordinary authenticated users; expose narrow functions for invitations and role changes.

## Policy pattern

For a tenant table such as `signals`:

```sql
alter table public.signals enable row level security;
alter table public.signals force row level security;

create policy signals_select_member
on public.signals for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy signals_insert_editor
on public.signals for insert
to authenticated
with check (public.is_workspace_member(workspace_id, array['owner','admin','member']));
```

User-facing update and delete policies should be narrower than read policies. Engine-managed tables should normally reject direct authenticated writes; application or workflow service paths perform validated writes.

## Policy requirements by table class

### Global catalog

`domains` is readable by authenticated users and writable only through migrations or an administrative service.

### Membership and configuration

Members can read their workspace and membership. Owners and admins can update allowed configuration. Only owners can perform destructive workspace actions or ownership changes.

### Research and intelligence

Workspace members may read according to role. Browser clients cannot directly insert accepted sources, evidence, signals, patterns, validation evidence, insights, LLM usage, job state, or audit rows. These writes go through trusted server or workflow operations with schema validation.

### User-authored objects

Members may create hypotheses and saved items in their workspace. Saved-item mutation additionally requires `user_id = auth.uid()`. Hypothesis edits require an editable status and should preserve an audit trail.

### Join tables

Every join-table policy verifies access through a parent or stores `workspace_id` directly. Do not expose a cross-tenant existence oracle through foreign-key errors or join-table reads.

## Service-role and n8n boundary

The Supabase service-role key bypasses RLS and is therefore equivalent to full database authority.

- Never send it to the browser, logs, prompts, or workflow output.
- Store it only in the server and n8n credential stores for the correct environment.
- Prefer a narrow internal API or security-definer RPC over unrestricted table writes.
- Every workflow input includes a server-created run ID. The workflow loads `workspace_id` from that record rather than trusting an arbitrary webhook value.
- Every service write includes workspace scope and verifies that referenced parents have the same workspace.
- Internal webhooks use a signing secret, timestamp, replay window, and idempotency key.
- Rotate secrets after exposure and maintain separate development and production credentials.

## Storage policies

Use paths beginning with the workspace ID, for example:

```text
workspaces/{workspace_id}/sources/{source_id}/cleaned.txt
```

Storage policies derive the first path segment and verify membership. Raw source content should normally be private and served through signed, short-lived URLs only when the user is entitled and licensing permits display.

## Cross-workspace integrity

RLS cannot by itself guarantee that a workspace A record references a workspace B parent when a privileged service writes it. Add one of:

- Composite foreign keys containing `(id, workspace_id)` for high-risk relationships.
- Before-insert or update constraint triggers that verify workspace equality.
- Narrow database functions that derive workspace ID from trusted parents.

Use composite foreign keys or database enforcement for source-to-evidence, hypothesis-to-validation, and all intelligence lineage relationships.

## Privacy and data minimization

- Collect only account data required for the product.
- Treat saved research, hypotheses, notes, and research history as private workspace data.
- Do not use one customer’s private content to answer another customer’s request.
- Keep prompt and response retention bounded and configurable.
- Redact secrets and unnecessary personal data before model calls.
- Document deletion and export behavior before beta launch.

## Audit events

Record append-only audit events for membership changes, role changes, workspace deletion, credential configuration, manual research and validation requests, publication or supersession of insights, and service-level write failures that could affect integrity.

## Required automated tests

For each tenant table, test:

1. A member can perform allowed actions in their workspace.
2. The same member cannot select, insert, update, or delete in another workspace.
3. A viewer cannot perform member actions.
4. A member cannot promote themselves or remove the final owner.
5. A guessed identifier returns no cross-tenant information.
6. Join tables and views do not bypass parent restrictions.
7. Realtime subscriptions respect the same isolation.
8. Storage reads and writes reject another workspace path.
9. Service operations reject mismatched parent workspace IDs.

No production deployment passes if cross-tenant tests fail.

## Security review checklist

- RLS enabled and forced where applicable.
- No browser bundle contains a service or provider secret.
- Security-definer functions fix `search_path`, validate inputs, and grant execution narrowly.
- Webhooks authenticate origin and reject replays.
- Logs and model prompts are scrubbed of secrets.
- Rate limits exist for costly or abusive actions.
- Dependency and migration changes are reviewed.
- Production access is limited, attributable, and revocable.
