import type { Pattern, ResearchRun, Signal } from "@/types/intelligence";

export const dashboardSnapshot = {
  sourceCutoffAt: "27 Sep 2026, 07:30 UTC",
  health: "Healthy" as const,
  counts: {
    newSignals: 18,
    patterns: 3,
    hypotheses: 2,
    validations: 1,
  },
};

export const signals: Signal[] = [
  {
    id: "sig-agent-control",
    type: "funding",
    title: "Agent-control tooling draws fresh seed attention",
    summary: "Three early-stage teams raised or announced new backing around runtime governance, observability, and intervention for AI agents.",
    entities: ["Convergence", "Twelve Labs", "Northzone"],
    topic: "Agent infrastructure",
    publishedAt: "Today",
    confidence: "High",
    evidenceCount: 4,
    hasCounterEvidence: false,
  },
  {
    id: "sig-enterprise-evals",
    type: "market",
    title: "Enterprise AI teams are moving evaluation closer to production",
    summary: "Recent product releases and engineering posts point to a shift from offline benchmarks toward continuous, workflow-specific evaluation.",
    entities: ["Langfuse", "Arize", "Weights & Biases"],
    topic: "Evaluation",
    publishedAt: "Yesterday",
    confidence: "Medium",
    evidenceCount: 3,
    hasCounterEvidence: true,
  },
  {
    id: "sig-small-models",
    type: "research",
    title: "Small models gain ground in constrained agent workflows",
    summary: "New research and platform guidance shows targeted models handling routing, extraction, and tool selection at materially lower cost.",
    entities: ["Mistral", "Hugging Face", "Microsoft Research"],
    topic: "Models",
    publishedAt: "2 days ago",
    confidence: "High",
    evidenceCount: 5,
    hasCounterEvidence: false,
  },
];

export const patterns: Pattern[] = [
  {
    id: "pat-governance",
    statement: "AI-agent adoption is creating demand for independent control layers.",
    strength: 82,
    window: "Last 30 days",
    observations: 6,
    counterSignals: 2,
  },
  {
    id: "pat-evaluation",
    statement: "Evaluation is becoming a production workflow rather than a pre-launch gate.",
    strength: 74,
    window: "Last 45 days",
    observations: 5,
    counterSignals: 1,
  },
];

export const researchRuns: ResearchRun[] = [
  { id: "run-daily", name: "Daily AI ecosystem scan", status: "Completed", progress: 100, acceptedSources: 42, completedAt: "Today, 07:35 UTC" },
  { id: "run-agents", name: "Agent governance follow-up", status: "Running", progress: 64, acceptedSources: 17, completedAt: "Started 18 min ago" },
];
