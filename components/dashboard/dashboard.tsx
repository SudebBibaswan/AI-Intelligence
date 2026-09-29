"use client";

import Link from "next/link";
import { ArrowRight, CircleAlert, Layers3 } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchSignals, fetchPatterns, fetchHypotheses, fetchValidations } from "@/lib/api/intelligence";
import { Signal, Pattern, Hypothesis, ValidationRun } from "@/types/intelligence";
import { useWorkspace } from "@/lib/hooks/workspace";

const signalLabels = {
  funding: "Investment",
  product: "Product",
  research: "Research",
  market: "Market",
} as const;

type SignalType = keyof typeof signalLabels;

export function Dashboard() {
  const { workspace, workspaceDomain, domain, isLoading: workspaceLoading } = useWorkspace();
  const [section, setSection] = useState("Overview");
  const sections = ["Overview", "Emerging patterns"];
  const [signals, setSignals] = useState<Signal[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [validations, setValidations] = useState<ValidationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState({
    newSignals: 0,
    patterns: 0,
    hypotheses: 0,
    validations: 0,
    health: "Healthy" as const,
    sourceCutoffAt: new Date().toISOString(),
  });

  const workspaceId = workspace?.id;
  const workspaceDomainId = workspaceDomain?.id;

  useEffect(() => {
    async function loadDashboardData() {
      if (!workspaceId || !workspaceDomainId) {
        setError("No workspace or domain configured");
        setLoading(false);
        return;
      }

      try {
        const [signalsResult, patternsResult, hypothesesResult, validationsResult] = await Promise.all([
          fetchSignals({ workspace_id: workspaceId, domain_id: workspaceDomainId, limit: 50, status: "accepted" }),
          fetchPatterns({ workspace_id: workspaceId, domain_id: workspaceDomainId, limit: 20, status: "persistent" }),
          fetchHypotheses({ workspace_id: workspaceId, domain_id: workspaceDomainId, limit: 20, status: "ready_for_validation" }),
          fetchValidations({ workspace_id: workspaceId, domain_id: workspaceDomainId, limit: 20 }),
        ]);

        setSignals(signalsResult.data);
        setPatterns(patternsResult.data);
        setHypotheses(hypothesesResult.data);
        setValidations(validationsResult.data);

        const newSignals = signalsResult.data.filter((s) => {
          const createdAt = new Date(s.created_at);
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return createdAt > yesterday;
        }).length;

        const readyValidations = validationsResult.data.filter(v => v.status === 'completed' && v.result !== null).length;

        setDashboardStats({
          newSignals,
          patterns: patternsResult.data.length,
          hypotheses: hypothesesResult.data.length,
          validations: readyValidations,
          health: "Healthy",
          sourceCutoffAt: new Date().toISOString(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    if (!workspaceLoading) {
      loadDashboardData();
    }
  }, [workspaceId, workspaceDomainId, workspaceLoading]);

  if (workspaceLoading || loading) return <div className="space-y-9">Loading dashboard...</div>;
  if (error) return <div className="space-y-9">Error: {error}</div>;
  if (!workspace || !workspaceDomain) return <div className="space-y-9 p-6">Please complete onboarding to set up your workspace.</div>;

  const domainName = domain?.name || "Artificial Intelligence";

  return (
    <div className="space-y-9">
      <section className="flex flex-col justify-between gap-6 border-b border-line pb-8 md:flex-row md:items-end">
        <div>
          <p className="eyebrow mb-3">Workspace / Daily brief</p>
          <h1 className="max-w-3xl font-display text-5xl leading-[0.98] tracking-[-0.025em] sm:text-6xl">
            {domainName}.<br />
            <em className="text-[#929aff]">Follow the capital.</em>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#bfc3dc]">
            Investment concentration, research activity, and evidence-backed market shifts in your selected domain.
          </p>
        </div>
        <div className="surface flex items-center gap-3 px-4 py-3">
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          <div>
            <p className="text-xs font-semibold">Research health: {dashboardStats.health}</p>
            <p className="meta mt-1">Source cutoff: {new Date(dashboardStats.sourceCutoffAt).toLocaleString()}</p>
          </div>
        </div>
      </section>

      <div className="flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Domain intelligence views">
        {sections.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={section === item}
            onClick={() => setSection(item)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold ${section === item ? "border-teal text-teal" : "border-transparent text-slate-500 hover:text-ink"}`}
          >
            {item}
          </button>
        ))}
      </div>

      <section className="surface grid grid-cols-2 divide-x divide-y divide-line md:grid-cols-4 md:divide-y-0">
        <Metric value={dashboardStats.newSignals} label="New signals" note="Since yesterday" />
        <Metric value={dashboardStats.patterns} label="Emerging patterns" note="Across observations" />
        <Metric value={dashboardStats.hypotheses} label="Active hypotheses" note="Ready for validation" />
        <Metric value={dashboardStats.validations} label="Validation review" note="Ready to inspect" />
      </section>

      {section !== "Research activity" && (
        <section className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
          <div>
            <SectionTitle title="What changed" subtitle="Evidence-backed developments ranked for your workspace" href="/signals" />
            <div className="surface overflow-hidden px-5 sm:px-7">
              {signals.length === 0 ? (
                <div className="py-12 text-center text-[#a5abc9]">No signals yet. Run a research scan to generate signals.</div>
              ) : (
                signals.map((signal) => (
                  <article key={signal.id} className="group border-b border-line py-5 last:border-0">
                    <div className="flex items-start justify-between gap-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="eyebrow">{signalLabels[signal.signal_type as SignalType]}</span>
                          <span className="meta">{signal.topics[0] || "general"}</span>
                          {(signal.metadata as Record<string, unknown>)?.hasCounterEvidence === true && (
                            <span className="inline-flex items-center gap-1 rounded border border-[#705779] bg-[#241a37] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[#c7a8ea]">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              Counter-evidence
                            </span>
                          )}
                        </div>
                        <h2 className="mt-2 text-[15px] font-semibold leading-snug transition group-hover:text-[#929aff]">{signal.title}</h2>
                        <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#bfc3dc]">{signal.summary}</p>
                        <div className="meta mt-3 flex flex-wrap gap-x-4 gap-y-1">
                          <span>{signal.event_at ? new Date(signal.event_at).toLocaleDateString() : new Date(signal.created_at).toLocaleDateString()}</span>
                          <span>{signal.signal_evidence?.length || 0} evidence items</span>
                          <span>{Math.round((signal.confidence || 0) * 100)}% confidence</span>
                        </div>
                      </div>
                      <Link href={`/signals/${signal.id}`} aria-label={`Inspect ${signal.title}`} className="mt-5 shrink-0 text-[#929aff] opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="M12 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
          <aside className="space-y-8">
            <div>
              <SectionTitle title="Emerging patterns" subtitle="Interpretations, not conclusions" href="/patterns" />
              <div className="space-y-3">
                {patterns.length === 0 ? (
                  <div className="py-8 text-center text-[#a5abc9]">No patterns yet. Patterns emerge from multiple observations.</div>
                ) : (
                  patterns.map((pattern) => (
                    <Link key={pattern.id} href={`/patterns/${pattern.id}`} className="surface block p-5 transition hover:-translate-y-0.5 hover:border-teal/50">
                      <div className="flex items-start justify-between gap-4">
                        <span className="eyebrow">Strength {Math.round(pattern.strength_score * 100)}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4.05V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5.05A2.85 2.83 0 0 1 5.08 3h14a2 2 0 0 0 0-4Z" />
                          <path d="M8 11V3m0 0 4 4m0-4-4 4" />
                        </svg>
                      </div>
                      <h2 className="mt-3 font-display text-xl leading-tight">{pattern.statement}</h2>
                      <div className="mt-3 font-mono text-[10px] text-[#a5abc9]">
                        {pattern.time_window_start ? new Date(pattern.time_window_start).toLocaleDateString() : 'N/A'} - {pattern.time_window_end ? new Date(pattern.time_window_end).toLocaleDateString() : 'N/A'}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}

function Metric({ value, label, note }: { value: number; label: string; note: string }) {
  return (
    <div className="p-5 sm:p-6">
      <p className="font-mono text-3xl font-semibold tracking-tight text-[#aeb6ff]">{value}</p>
      <p className="mt-2 text-xs font-semibold text-white">{label}</p>
      <p className="mt-1 font-mono text-[10px] text-[#a5abc9]">{note}</p>
    </div>
  );
}

function SectionTitle({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
      <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline">
        View all
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}