# How to Apply Supabase Migrations

Use this process for every database change after the initial schema. Git migration files are the source of truth. The Supabase SQL editor is for read-only inspection and running `supabase/verify.sql`, not for creating or altering production schema.

## Deployment ownership

The repository's Supabase GitHub integration is the normal deployment owner:

```text
Create migration -> test -> commit -> push -> Supabase Preview -> production main
```

Do not apply the same change manually in the SQL editor. Supabase tracks applied filenames in `supabase_migrations.schema_migrations`; Dashboard changes bypass that history and create the drift that previously caused `score_01 already exists`.

## One-time workstation setup

From the repository root:

```powershell
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest migration list --linked
```

Never commit the access token, database password, `.env` values, or files under `supabase/.temp/`.

## Create a migration

Generate a new timestamped file:

```powershell
npx supabase@latest migration new short_descriptive_name
```

Edit only the new file. Once a migration has been applied to a shared environment, do not rewrite or rename it. Corrections go into another migration.

Every migration should:

- be safe inside a transaction unless Supabase branching explicitly supports the operation;
- use schema-qualified object names;
- preserve existing data or document an approved backfill;
- enable and force RLS on new public tables;
- explicitly revoke browser roles from service-only tables and functions;
- be replay-safe through constraints and idempotent data seeding where appropriate;
- avoid environment-specific UUIDs, secrets, and project references.

## Test before pushing

When Docker Desktop is available:

```powershell
npx supabase@latest start
npx supabase@latest db reset
```

This rebuilds only the local Supabase database from every committed migration. It is the strongest proof that a new environment can start from zero.

Then inspect what production considers pending:

```powershell
npx supabase@latest migration list --linked
npx supabase@latest db push --dry-run
```

The dry run must list only the migration files you intend to deploy. Never use `db reset --linked`; it would target the remote database.

## Deploy through GitHub

Commit the migration with its related code and documentation:

```powershell
git add supabase/migrations/<new_migration>.sql
git add <related-files>
git commit -m "feat(db): describe the database change"
git fetch origin
git rebase origin/main
git push origin main
```

The Supabase integration applies migrations whose versions are absent from the remote history. Check the Supabase status on GitHub and the branch deployment log before treating the release as complete.

After deployment:

```powershell
npx supabase@latest migration list --linked
```

Run the read-only checks in `supabase/verify.sql`. Regenerate frontend types when tables, views, functions, enums, or columns changed:

```powershell
npx supabase@latest gen types typescript --linked > database.types.ts
```

Commit the generated type file in the frontend location agreed with the UI team.

## Emergency manual deployment

If GitHub deployment is unavailable and a database change cannot wait:

1. Create and commit the migration file first.
2. Review `db push --dry-run`.
3. Run `npx supabase@latest db push` once.
4. Push the same commit to GitHub.

Because `db push` records the migration version, the GitHub integration will recognize it as applied. Coordinate one deployer; never have two people run `db push` concurrently.

## If someone used the SQL editor

Stop before pushing more migrations.

```powershell
npx supabase@latest migration list --linked
npx supabase@latest db pull
```

Review the generated migration and reconcile the remote schema with Git. Use `migration repair --status applied` only when the schema object is verified to exist and the matching migration was truly applied. Repair changes history only; it does not execute SQL.

## Verification checklist

```text
[ ] A new migration file contains the complete schema change
[ ] Existing applied migration files were not modified
[ ] Local db reset passes, when Docker is available
[ ] Remote dry run lists only intended pending migrations
[ ] No secret or environment-specific identifier is committed
[ ] GitHub Supabase check passes
[ ] Local and remote migration history align
[ ] supabase/verify.sql passes
[ ] Frontend types are regenerated when the public contract changed
```

## Related

- [Supabase Setup and Connection](../architecture/supabase_setup_and_connection.md)
- [Database Schema](../architecture/database_schema.md)
- [Security and Row Level Security](../architecture/security_and_rls.md)
