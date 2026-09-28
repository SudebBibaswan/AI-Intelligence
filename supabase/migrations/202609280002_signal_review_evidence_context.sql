begin;

-- Reviewers need the underlying source context beside each draft signal.
-- This remains a read-only view; decisions still go through the audited RPC.

create or replace view public.v_signal_review_details
with (security_invoker = true)
as
select
  signal.id as signal_id,
  signal.workspace_id,
  signal.workspace_domain_id,
  domain.key as domain_key,
  coalesce(workspace_domain.name, domain.name) as domain_name,
  signal.signal_type,
  signal.title as signal_title,
  signal.summary as signal_summary,
  signal.event_at,
  signal.confidence as signal_confidence,
  signal.novelty_score,
  signal.importance_score,
  signal.status as signal_status,
  signal.metadata ->> 'corroboration_status' as corroboration_status,
  evidence.id as evidence_id,
  link.role as evidence_role,
  link.weight as evidence_weight,
  evidence.evidence_type,
  evidence.claim_text,
  evidence.excerpt,
  evidence.locator,
  evidence.polarity,
  evidence.confidence as evidence_confidence,
  evidence.verification_status,
  source.id as source_id,
  source.title as source_title,
  source.canonical_url,
  source.publisher,
  source.published_at,
  source.source_type,
  source.source_quality_score,
  source.evidence_status as source_evidence_status,
  case
    when evidence.verification_status = 'verified'
      and source.evidence_status = 'accepted'
      and source.deleted_at is null
      and run.workspace_domain_id = signal.workspace_domain_id
    then true
    else false
  end as evidence_currently_eligible,
  signal.created_at as signal_created_at,
  signal.updated_at as signal_updated_at
from public.signals signal
join public.workspace_domains workspace_domain
  on workspace_domain.id = signal.workspace_domain_id
 and workspace_domain.workspace_id = signal.workspace_id
join public.domains domain on domain.id = workspace_domain.domain_id
join public.signal_evidence link
  on link.signal_id = signal.id
 and link.workspace_id = signal.workspace_id
join public.evidence evidence
  on evidence.id = link.evidence_id
 and evidence.workspace_id = link.workspace_id
join public.sources source
  on source.id = evidence.source_id
 and source.workspace_id = evidence.workspace_id
join public.research_runs run
  on run.id = evidence.research_run_id
 and run.workspace_id = evidence.workspace_id
where signal.status = 'draft';

grant select on public.v_signal_review_details to authenticated;

commit;
