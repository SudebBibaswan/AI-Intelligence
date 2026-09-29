export interface Signal {
  id: string
  workspace_id: string
  workspace_domain_id: string
  signal_type: string
  title: string
  summary: string
  event_at: string | null
  confidence: number
  novelty_score: number
  importance_score: number
  geographies: string[]
  topics: string[]
  metadata: Record<string, unknown>
  engine_version: string
  status: 'draft' | 'accepted' | 'rejected' | 'superseded'
  created_at: string
  updated_at: string
  signal_evidence?: SignalEvidence[]
  signal_entities?: SignalEntity[]
}

export interface SignalEvidence {
  evidence_id: string
  role: 'supporting' | 'contradicting' | 'context'
  weight: number
  evidence: Evidence
}

export interface SignalEntity {
  entity_id: string
  role: string
  entity: Entity
}

export interface Evidence {
  id: string
  source_id: string
  claim_text: string
  excerpt: string
  confidence: number
  source: Source
}

export interface Source {
  id: string
  title: string
  publisher: string
  canonical_url: string
}

export interface Entity {
  id: string
  name: string
  entity_type: string
  attributes: Record<string, unknown>
}

export interface Observation {
  id: string
  workspace_id: string
  workspace_domain_id: string
  title: string
  statement: string
  observation_type: string
  time_window_start: string | null
  time_window_end: string | null
  metadata: Record<string, unknown>
  engine_version: string
  status: 'draft' | 'accepted' | 'rejected' | 'superseded'
  confidence: number
  created_at: string
  updated_at: string
  observation_signals?: ObservationSignal[]
}

export interface ObservationSignal {
  signal_id: string
  role: 'supporting' | 'contradicting' | 'context'
  weight: number
  signal: Signal
}

export interface Pattern {
  id: string
  workspace_id: string
  workspace_domain_id: string
  pattern_type: string
  title: string
  statement: string
  strength_score: number
  persistence_score: number
  evidence_diversity_score: number
  time_window_start: string | null
  time_window_end: string | null
  first_detected_at: string
  last_confirmed_at: string
  metadata: Record<string, unknown>
  engine_version: string
  status: 'emerging' | 'persistent' | 'weakening' | 'contradicted' | 'archived'
  confidence: number
  created_at: string
  updated_at: string
  pattern_observations?: PatternObservation[]
}

export interface PatternObservation {
  observation_id: string
  role: 'supporting' | 'contradicting' | 'context'
  weight: number
  observation: Observation
}

export interface Thesis {
  id: string
  workspace_id: string
  workspace_domain_id: string
  subject_entity_id: string
  thesis_type: 'stated' | 'revealed'
  statement: string
  time_window_start: string | null
  time_window_end: string | null
  methodology: string | null
  metadata: Record<string, unknown>
  engine_version: string
  status: 'draft' | 'accepted' | 'rejected' | 'superseded'
  confidence: number
  created_at: string
  updated_at: string
  thesis_evidence?: ThesisEvidence[]
  entity: Entity
}

export interface ThesisEvidence {
  evidence_id: string
  role: 'supporting' | 'contradicting' | 'context'
  weight: number
  evidence: Evidence
}

export interface Hypothesis {
  id: string
  workspace_id: string
  workspace_domain_id: string
  title: string
  statement: string
  target_user: string
  problem: string
  proposed_value: string | null
  assumptions: string[]
  origin: 'user' | 'engine' | 'mixed'
  status: 'draft' | 'ready_for_validation' | 'validating' | 'supported' | 'mixed' | 'weakened' | 'inconclusive' | 'archived'
  confidence: number
  engine_version: string | null
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  hypothesis_patterns?: HypothesisPattern[]
}

export interface HypothesisPattern {
  pattern_id: string
  role: 'primary' | 'supporting' | 'contradicting' | 'context'
  weight: number
  pattern: Pattern
}

export interface ValidationRun {
  id: string
  workspace_id: string
  hypothesis_id: string
  research_run_id: string | null
  status: 'queued' | 'researching' | 'synthesizing' | 'completed' | 'partial' | 'failed' | 'cancelled'
  dimensions: string[]
  methodology: Record<string, unknown>
  result: 'supported' | 'mixed' | 'weakened' | 'inconclusive' | null
  confidence: number | null
  summary: string | null
  limitations: string[]
  unresolved_questions: string[]
  source_cutoff_at: string | null
  engine_version: string
  idempotency_key: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  validation_evidence?: ValidationEvidence[]
  hypothesis: Hypothesis
}

export interface ValidationEvidence {
  id: string
  validation_run_id: string
  evidence_id: string
  dimension: 'competitor' | 'demand' | 'adoption' | 'funding' | 'technical' | 'regulatory' | 'incumbent' | 'failed_attempt' | 'counter_signal'
  stance: 'supporting' | 'contradicting' | 'neutral'
  weight: number
  reasoning_summary: string
  created_at: string
  evidence: Evidence
}

export interface CapitalFlowMapping {
  id: string
  workspace_id: string
  workspace_domain_id: string
  pattern_id: string
  entity_id: string
  thesis_id: string | null
  match_type: 'revealed_thesis_match' | 'stated_thesis_match' | 'pattern_entity_overlap' | 'thesis_driven'
  match_confidence: number
  capital_direction: 'inflow' | 'outflow' | 'bidirectional'
  sector_tags: string[]
  stage_tags: string[]
  geography_tags: string[]
  check_size_min_usd: number | null
  check_size_max_usd: number | null
  deal_count: number
  metadata: Record<string, unknown>
  engine_version: string
  status: 'draft' | 'accepted' | 'rejected' | 'superseded'
  confidence: number
  created_at: string
  updated_at: string
  pattern: Pattern
  entity: Entity
  thesis: Thesis | null
}

export interface CapitalDirectoryEntry {
  entity_id: string
  workspace_id: string
  entity_type: string
  name: string
  canonical_url: string | null
  resolution_status: string
  wikidata_qid: string | null
  registry_country: string | null
  registry_country_qid: string | null
  registry_source: string | null
  registry_status: string | null
  registry_last_seen_at: string | null
  evidence_count: number
  last_evidence_at: string | null
  capital_relationship_count: number
  last_capital_activity_at: string | null
  activity_status: 'active_evidenced' | 'evidenced' | 'candidate_unverified'
  created_at: string
  updated_at: string
}

export interface QualitySnapshot {
  id: string
  workspace_id: string
  workspace_domain_id: string | null
  snapshot_at: string
  metrics: Record<string, unknown>
  runs_detail: unknown[]
  providers_detail: unknown[]
  backlog_detail: unknown[]
  graph_detail: unknown[]
  created_at: string
}

export interface ResearchQualityRun {
  research_run_id: string
  workspace_id: string
  workspace_domain_id: string
  status: string
  trigger_type: string
  created_at: string
  started_at: string | null
  completed_at: string | null
  duration_seconds: number
  sources_discovered: number
  sources_accepted: number
  sources_rejected: number
  sources_duplicate: number
  sources_failed: number
  sources_needing_review: number
  evidence_count: number
  sources_with_evidence: number
  verified_evidence: number
  unverified_evidence: number
  average_evidence_confidence: number
  source_to_evidence_yield: number
  llm_calls: number
  failed_llm_calls: number
  estimated_cost_usd: number
  discovery_provider_error_count: number
}

export interface EvidenceReviewQueueItem {
  evidence_id: string
  workspace_id: string
  workspace_domain_id: string
  source_id: string
  source_title: string
  canonical_url: string
  publisher: string
  source_type: string
  source_quality_score: number
  extraction_status: string
  evidence_type: string
  claim_text: string
  excerpt: string
  locator: Record<string, unknown>
  polarity: string
  confidence: number
  verification_status: string
  created_at: string
  review_count: number
  last_reviewed_at: string | null
}

export interface EvidenceReviewAction {
  evidence_id: string
  decision: 'verified' | 'disputed' | 'rejected'
  reason: string | null
  request_id: string
}

export interface EvidenceReviewResult {
  review_id: string
  evidence_id: string
  source_id: string
  previous_status: string
  decision: string
  source_evidence_status: string
  replayed: boolean
}