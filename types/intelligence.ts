export type SignalType = "funding" | "product" | "research" | "market";
export type Confidence = "High" | "Medium" | "Early";

export interface Signal {
  id: string;
  type: SignalType;
  title: string;
  summary: string;
  entities: string[];
  topic: string;
  publishedAt: string;
  confidence: Confidence;
  evidenceCount: number;
  hasCounterEvidence: boolean;
}

export interface Pattern {
  id: string;
  statement: string;
  strength: number;
  window: string;
  observations: number;
  counterSignals: number;
}

export interface ResearchRun {
  id: string;
  name: string;
  status: "Completed" | "Running" | "Partial";
  progress: number;
  acceptedSources: number;
  completedAt: string;
}
