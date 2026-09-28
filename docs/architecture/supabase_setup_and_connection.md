# How to Set Up and Connect Supabase

This guide applies the versioned Intelligence Platform schema to a Supabase development project and connects the frontend, backend, and later n8n workflows using the correct key boundary.

Status: migrations prepared; remote project not yet linked  
Migration directory: `supabase/migrations`  
Required owner input: Supabase development project reference and authenticated CLI session

## What the migrations create

- User profiles, personal workspaces, membership, and domain configuration.
- Research runs, sources, evidence, canonicalization lineage, and entity graph.
- Signals, observations, theses, patterns, hypotheses, validations, and insights.
- Saved items, briefs, job status, model usage, and audit records.
- Workspace-safe composite foreign keys.
- RLS on every public table.
- Six frontend-facing `security_invoker` views.
- A private `research-content` storage bucket.
- An initial Artificial Intelligence domain profile.
- A signup trigger that creates a profile and personal workspace for each new Auth user.
- Service-only, replay-safe n8n functions for claiming runs and recording sources and evidence.

## Security boundary

Use the current Supabase key types:

| Component | Key | Behavior |
|---|---|---|
| Browser/frontend | Publishable key | Safe to ship; RLS controls row access |
| Application backend | Secret key | Bypasses RLS; server only |
| n8n | Separate secret key | Bypasses RLS; n8n credential store only |
| Local CLI | Personal CLI login plus database password when prompted | Schema management only |

Never expose a secret key in frontend variables, workflow exports, Git, screenshots, or logs. Use a different secret key for the application backend and n8n so either can be rotated independently.

## Prerequisites

1. Create a dedicated Supabase **development** project.
2. Install the Supabase CLI.
3. Install and start Docker Desktop or another Docker-compatible runtime if you want local replay testing.
4. Obtain the project reference from the dashboard URL.
5. Confirm whether the remote project is empty.

This workstation did not have the Supabase CLI, `psql`, or a container runtime available when these migrations were prepared. The SQL has therefore received static checks but has not yet been executed against PostgreSQL.

## If the Supabase project already contains tables

Stop before pushing these migrations. First inventory the existing schema and map every existing table to `keep`, `alter`, `migrate`, `merge`, or `retire`.

Then run:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db pull
```

Review the generated remote baseline alongside these migrations. Do not push a second definition of the same tables. Reconcile the histories first.

## If the Supabase project is new and empty

From the repository root:

```powershell
supabase init
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
```

Inspect the dry-run output. It should show seven pending migrations in timestamp order. If the project is correct, apply them:

```powershell
supabase db push
```

Do not use `supabase db reset --linked`. That command destroys the linked remote database and is unnecessary for initial setup.

## Verify the deployed schema

Open the Supabase SQL editor, paste the contents of `supabase/verify.sql`, and run it. It fails if expected tables, RLS, product views, the domain seed, or the private storage bucket are missing.

Then verify a real signup in the development environment:

1. Create one test user through Supabase Auth.
2. Confirm one matching row exists in `profiles`.
3. Confirm one personal workspace exists with that user as owner.
4. Sign in using the frontend publishable key.
5. Confirm the user can read their workspace and cannot read another test user's workspace.
6. Confirm the user cannot insert directly into `sources`, `evidence`, `signals`, `llm_usage`, or `audit_log`.
7. Confirm the user can create their own hypothesis and saved item only inside their workspace.

Do not continue to agent development if the cross-workspace checks fail.

## Configure frontend connection values

Copy `supabase/.env.example` into the frontend application's local environment file and replace only the browser-safe values:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Retrieve both from the Supabase **Connect** dialog. The publishable key is designed for public clients, but it is safe only because RLS and grants restrict access.

Generate frontend types after the remote schema is live:

```powershell
supabase gen types --lang typescript --linked > database.types.ts
```

Give the generated file to the frontend repository. Regenerate it after every database migration.

## Configure backend and n8n connections

The application backend uses:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=stored-in-the-backend-secret-manager
```

n8n receives a different secret key through its credential store. Do not store the n8n key in an n8n Set node or workflow variable.

Both secret-key consumers bypass RLS. Every privileged write must therefore include `workspace_id` and rely on the migration's composite foreign keys to reject cross-workspace lineage. Prefer narrow database functions or an internal API before production instead of allowing arbitrary table writes from workflows.

## Frontend-facing surfaces

The frontend should begin with these views and tables:

| UI need | Surface |
|---|---|
| Workspace selector | `workspaces`, `workspace_members` |
| Domain setup | `domains`, `workspace_domains` |
| Research progress | `v_research_run_health` |
| Signal cards | `v_dashboard_signal_cards` |
| Pattern list | `v_pattern_summaries` |
| Hypothesis validation | `v_hypothesis_validation_status` |
| Cost dashboard | `v_workspace_cost_daily` for owners/admins |
| Source citations | `v_source_lineage` |

The frontend must not reconstruct intelligence lineage by joining unrestricted raw tables. Use the stable views or backend APIs.

## Migration workflow after setup

The Supabase GitHub integration is the normal migration deployer. Create and test a new migration, commit it, and push it; do not apply schema SQL manually through the Dashboard. See [How to Apply Supabase Migrations](../operations/how_to_apply_supabase_migrations.md) for the complete create, local replay, dry-run, deployment, verification, and recovery procedure.

## Connection completion checklist

```text
[ ] Development Supabase project created
[ ] Existing remote schema disposition confirmed
[ ] CLI authenticated and linked to the correct project reference
[ ] Dry-run reviewed
[ ] Seven migrations applied in order
[ ] supabase/verify.sql passes
[ ] Signup creates profile, workspace, and owner membership
[ ] Two-user RLS isolation tests pass
[ ] Frontend uses URL + publishable key only
[ ] Backend and n8n have separate secret keys
[ ] TypeScript database types generated and handed to frontend
[ ] Remote project reference recorded without storing secrets
```

## Related

- [Database Schema](database_schema.md)
- [Security and Row Level Security](security_and_rls.md)
- [API and Frontend Data Contracts](api_and_frontend_contracts.md)
- [System Architecture](system_architecture.md)
