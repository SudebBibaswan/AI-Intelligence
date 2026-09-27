# How to Configure the Shared Domain Scheduler

This guide activates the database scheduler introduced by migration `202609270008_shared_domain_scheduler.sql`. It creates one hidden service workspace, configures all seven collectors, and lets n8n queue shared runs at 00:00 and 12:00 UTC only when a real workspace subscribes to the domain.

## Prerequisites

- Migration `202609270008_shared_domain_scheduler.sql` is deployed.
- `supabase/verify.sql` passes.
- At least one real Auth user and matching `profiles` row exists.
- n8n has the existing Supabase service credential.
- The existing Research Engine can process a supplied `research_run_id` and `request_id`. Until that input handoff is added, keep the scheduler workflow inactive.

## Bootstrap the service workspace once

Use the UUID of an existing operator profile for audit ownership. The operator does not receive membership in the hidden service workspace.

In n8n, create a temporary HTTP Request node:

- Method: `POST`
- URL: `{{$json.supabase_url}}/rest/v1/rpc/n8n_bootstrap_shared_research_workspace`
- Authentication: existing Supabase service credential
- Body content type: JSON
- Body:

```json
{
  "p_operator_user_id": "YOUR_EXISTING_AUTH_USER_UUID"
}
```

Expected response:

```json
{
  "workspace_id": "uuid",
  "configured_domains": 7,
  "slot_hours_utc": [0, 12],
  "status": "ready"
}
```

The function is idempotent. Repeating it repairs missing collector mappings instead of creating another service workspace.

## Build the n8n scheduler workflow

Create a workflow named `RE 01 Shared Domain Scheduler`.

1. Add a Schedule Trigger that runs hourly at minute 5.
2. Add an HTTP Request node named `Queue Eligible Domain Runs`.
3. Configure:
   - Method: `POST`
   - URL: `YOUR_SUPABASE_URL/rest/v1/rpc/n8n_schedule_domain_collection_runs`
   - Authentication: existing Supabase service credential
   - JSON body:

     ```json
     {
       "p_slot_start": "={{ $now.startOf('hour').toISO() }}"
     }
     ```

4. Split the returned array into items.
5. Ignore rows where `created` is `false`; that slot was already queued.
6. For each new row, execute the Research Engine with:
   - `research_run_id`
   - `request_id`
   - `collector_workspace_id` as `workspace_id`
   - `collector_workspace_domain_id` as `workspace_domain_id`
   - `domain_key`

The RPC returns no rows outside configured UTC slot hours. Hourly triggering provides recovery from a short n8n outage without creating additional runs.

## Activate a domain subscription

A domain becomes eligible when at least one non-service `workspace_domains` row has:

```text
status = active
```

The service collector row remains `draft` and is explicitly excluded from subscriber counts. Pausing or archiving the last real subscription causes the next scheduled slot to be skipped without paid provider work.

## Verify scheduling safely

Call the RPC with the current UTC hour. It will return rows only if that hour is one of the configured slots.

To test without waiting, temporarily change one domain's `slot_hours_utc` through a controlled service-side migration or backend operation, test once, and restore it through another tracked migration. Do not edit production schedule rows through the SQL editor.

After a real slot, verify:

```sql
select
  d.key,
  rr.id,
  rr.status,
  rr.idempotency_key,
  rr.created_at,
  rr.metrics
from public.research_runs rr
join public.workspace_domains wd on wd.id = rr.workspace_domain_id
join public.domains d on d.id = wd.domain_id
where rr.trigger_type = 'schedule'
order by rr.created_at desc
limit 20;
```

The same domain and slot must have only one run even after retries.

## Operational behavior

- Default slots: `00:00` and `12:00` UTC.
- Maximum normal scheduled volume: fourteen runs per day.
- No active subscriber: no run and no provider usage.
- Retry in the same domain slot: returns the existing run with `created = false`.
- Adding users to an active domain changes `subscriber_count`, not crawl count.
- Personalization runs after shared research and does not call this scheduler.

## Related

- [Shared Domain Collection and Personalization](../architecture/shared_domain_collection_and_personalization.md)
- [How to Apply Supabase Migrations](how_to_apply_supabase_migrations.md)
- [First n8n Research Agent Build Guide](how_to_build_first_n8n_research_agent.md)
