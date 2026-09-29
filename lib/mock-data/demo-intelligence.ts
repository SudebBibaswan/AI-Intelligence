import type { Hypothesis, Pattern, Signal } from "@/types/intelligence";

const now = "2026-09-29T07:30:00.000Z";
const workspaceId = "demo-workspace";
const domainId = "ai-domain";

export const demoSignals: Signal[] = [
  {
    id: "sig-agent-control", workspace_id: workspaceId, workspace_domain_id: domainId, signal_type: "funding",
    title: "Agent-control tooling draws fresh seed attention",
    summary: "Three early-stage teams raised or announced new backing around runtime governance, observability, and intervention for AI agents.",
    event_at: now, confidence: 0.82, novelty_score: 0.76, importance_score: 0.84, geographies: ["Global", "India"], topics: ["Agent infrastructure"],
    metadata: { hasCounterEvidence: false }, engine_version: "demo", status: "accepted", created_at: now, updated_at: now,
    signal_evidence: [
      { evidence_id: "ev-agent-funding", role: "supporting", weight: 0.9, evidence: { id: "ev-agent-funding", source_id: "source-openai", claim_text: "Agent systems need observable runtime controls as they move into higher-stakes workflows.", excerpt: "Illustrative evidence record for the product prototype.", confidence: 0.88, source: { id: "source-openai", title: "OpenAI product updates", publisher: "OpenAI", canonical_url: "https://openai.com/news/" } } },
      { evidence_id: "ev-agent-caution", role: "context", weight: 0.55, evidence: { id: "ev-agent-caution", source_id: "source-nist", claim_text: "Funding attention is not the same as repeatable customer demand.", excerpt: "Illustrative counter-context record for the product prototype.", confidence: 0.7, source: { id: "source-nist", title: "AI Risk Management Framework", publisher: "NIST", canonical_url: "https://www.nist.gov/itl/ai-risk-management-framework" } } },
    ],
    signal_entities: [
      { entity_id: "northzone", role: "investor", entity: { id: "northzone", name: "Northzone", entity_type: "investor", attributes: {} } },
      { entity_id: "convergence", role: "company", entity: { id: "convergence", name: "Convergence", entity_type: "company", attributes: {} } },
    ],
  },
  {
    id: "sig-enterprise-evals", workspace_id: workspaceId, workspace_domain_id: domainId, signal_type: "market",
    title: "Enterprise AI teams are moving evaluation closer to production",
    summary: "Recent releases point to a shift from offline benchmarks toward continuous, workflow-specific evaluation.",
    event_at: "2026-09-28T07:30:00.000Z", confidence: 0.71, novelty_score: 0.62, importance_score: 0.75, geographies: ["Global"], topics: ["AI evaluation"],
    metadata: { hasCounterEvidence: true }, engine_version: "demo", status: "accepted", created_at: now, updated_at: now,
    signal_evidence: [], signal_entities: [],
  },
];

export const demoPatterns: Pattern[] = [
  {
    id: "pat-governance", workspace_id: workspaceId, workspace_domain_id: domainId, pattern_type: "emerging",
    title: "Independent controls for AI agents", statement: "AI-agent adoption is creating demand for independent control layers.",
    strength_score: 0.82, persistence_score: 0.74, evidence_diversity_score: 0.78,
    time_window_start: "2026-08-30T00:00:00.000Z", time_window_end: now, first_detected_at: "2026-09-03T00:00:00.000Z", last_confirmed_at: now,
    metadata: { observation_count: 6, has_contradictions: true }, engine_version: "demo", status: "emerging", confidence: 0.79, created_at: now, updated_at: now,
    pattern_observations: [],
  },
  {
    id: "pat-evaluation", workspace_id: workspaceId, workspace_domain_id: domainId, pattern_type: "emerging",
    title: "Production evaluation workflow", statement: "Evaluation is becoming a production workflow rather than a pre-launch gate.",
    strength_score: 0.74, persistence_score: 0.68, evidence_diversity_score: 0.72,
    time_window_start: "2026-08-15T00:00:00.000Z", time_window_end: now, first_detected_at: "2026-09-01T00:00:00.000Z", last_confirmed_at: now,
    metadata: { observation_count: 5, has_contradictions: true }, engine_version: "demo", status: "emerging", confidence: 0.73, created_at: now, updated_at: now,
    pattern_observations: [],
  },
];

export const demoHypotheses: Hypothesis[] = [
  {
    id: "agent-controls", workspace_id: workspaceId, workspace_domain_id: domainId, title: "Independent controls for autonomous agents",
    statement: "Regulated enterprises will adopt independent runtime controls before scaling autonomous agents into production.",
    target_user: "Security and compliance teams", problem: "Existing controls do not meet runtime intervention needs.", proposed_value: "A policy and observability layer for agent deployments.",
    assumptions: ["Agent adoption is reaching production in regulated teams.", "Existing controls do not meet runtime needs."], origin: "user", status: "ready_for_validation", confidence: 0.64,
    engine_version: "demo", metadata: {}, created_by: null, created_at: now, updated_at: now, deleted_at: null,
  },
];

export type DemoInvestment = {
  id: string;
  company: { name: string; ai_domain: string };
  round_type: string;
  amount_usd: number;
  investors: { investor: { name: string } }[];
  announced_at: string;
};

export const demoInvestments: DemoInvestment[] = [
  { id: "round-synth", company: { name: "Synth Grid", ai_domain: "Agent infrastructure" }, round_type: "Series A", amount_usd: 72000000, investors: [{ investor: { name: "Index Ventures" } }], announced_at: "2026-09-27T00:00:00.000Z" },
  { id: "round-guardrail", company: { name: "Guardrail Systems", ai_domain: "AI security & governance" }, round_type: "Series A", amount_usd: 36000000, investors: [{ investor: { name: "Accel" } }], announced_at: "2026-09-26T00:00:00.000Z" },
  { id: "round-proofwork", company: { name: "Proofwork", ai_domain: "AI evaluation & observability" }, round_type: "Seed", amount_usd: 18000000, investors: [{ investor: { name: "Lightspeed" } }], announced_at: "2026-09-25T00:00:00.000Z" },
  { id: "round-atlas", company: { name: "Atlas Context", ai_domain: "Foundation models" }, round_type: "Seed", amount_usd: 12000000, investors: [{ investor: { name: "Peak XV" } }], announced_at: "2026-09-24T00:00:00.000Z" },
  { id: "round-fieldwise", company: { name: "Fieldwise", ai_domain: "Vertical AI applications" }, round_type: "Seed", amount_usd: 8000000, investors: [{ investor: { name: "General Catalyst" } }], announced_at: "2026-09-22T00:00:00.000Z" },
  { id: "round-operator", company: { name: "Operator Labs", ai_domain: "Model tooling" }, round_type: "Series A", amount_usd: 44000000, investors: [{ investor: { name: "Northzone" } }], announced_at: "2026-09-21T00:00:00.000Z" },
];
