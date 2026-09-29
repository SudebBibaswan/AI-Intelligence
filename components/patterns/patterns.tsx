'use client'

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Layers3 } from "lucide-react";
import { fetchPatterns } from "@/lib/api/intelligence";
import { Pattern } from "@/types/intelligence";
import { useWorkspace } from "@/lib/hooks/workspace";

export function Patterns({ id }: { id?: string }) {
  const { workspace, workspaceDomain, isLoading: workspaceLoading } = useWorkspace();
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const workspaceId = workspace?.id;
  const workspaceDomainId = workspaceDomain?.id;

  useEffect(() => {
    async function loadPatterns() {
      if (!workspaceId || !workspaceDomainId) {
        setError("No workspace or domain configured");
        setLoading(false);
        return;
      }

      try {
        const { data } = await fetchPatterns({ workspace_id: workspaceId, domain_id: workspaceDomainId, limit: 100 });
        setPatterns(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load patterns');
      } finally {
        setLoading(false);
      }
    }

    if (!workspaceLoading) {
      loadPatterns();
    }
  }, [workspaceId, workspaceDomainId, workspaceLoading]);

  if (workspaceLoading || loading) return <div className="space-y-9">Loading patterns...</div>;
  if (error) return <div className="space-y-9"><p className="text-sm text-[#d0b2ed]">Live patterns could not load. Check the workspace connection and try again.</p></div>;
  if (!workspace || !workspaceDomain) return <div className="space-y-9 p-6">Please complete onboarding to set up your workspace.</div>;

  if (id) {
    const pattern = patterns.find((p) => p.id === id) || patterns[0];
    return <PatternDetail pattern={pattern} />;
  }

  return (
    <div className="space-y-9">
      <header className="border-b border-[#30345f] pb-8">
        <p className="eyebrow mb-3">Artificial Intelligence / Patterns</p>
        <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">What is <em className="text-[#929aff]">recurring.</em></h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
          Patterns connect multiple observations across a defined time window. They are interpretations with explicit counter-signals—not confirmed opportunities.
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        {patterns.length === 0 ? (
          <div className="col-span-2 surface p-12 text-center text-[#a5abc9]">
            No patterns yet. Patterns emerge from multiple observations across your domain.
          </div>
        ) : (
          patterns.map((item) => (
            <Link href={`/patterns/${item.id}`} className="surface group p-6 transition hover:-translate-y-0.5 hover:border-[#7076f6]" key={item.id}>
              <div className="flex items-start justify-between">
                <span className="rounded border border-[#4b559b] bg-[#182048] px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-[#b9c0ff]">
                  Strength {Math.round(item.strength_score * 100)}
                </span>
                <Layers3 size={17} className="text-[#aeb6ff]" />
              </div>
              <h2 className="mt-5 font-display text-3xl leading-tight group-hover:text-[#c2c7ff]">{item.statement}</h2>
              <div className="mt-7 grid grid-cols-3 border-t border-[#30345f] pt-4 font-mono text-[10px] text-[#a5abc9]">
                <span>{item.time_window_start ? new Date(item.time_window_start).toLocaleDateString() : 'N/A'} - {item.time_window_end ? new Date(item.time_window_end).toLocaleDateString() : 'N/A'}</span>
                <span>{(item.metadata?.observation_count as number | undefined) ?? 0} observations</span>
                <span>{item.metadata?.has_contradictions === true ? 'Has counter-signals' : '0 counter-signals'}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function PatternDetail({ pattern }: { pattern: Pattern }) {
  return (
    <div className="space-y-9">
      <Link href="/patterns" className="inline-flex items-center gap-1 text-xs font-semibold text-[#aeb6ff] hover:text-white">
        <ArrowLeft size={14} />Back to patterns
      </Link>
      <header className="border-b border-[#30345f] pb-8">
        <span className="rounded border border-[#4b559b] bg-[#182048] px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-[#b9c0ff]">
          Pattern / Strength {Math.round(pattern.strength_score * 100)}
        </span>
        <h1 className="mt-5 max-w-4xl font-display text-5xl leading-[.98] sm:text-6xl">{pattern.statement}</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-[#bfc3dc]">
          A detected relationship across multiple observations. This is a bounded interpretation, not a confirmed market outcome.
        </p>
      </header>
      <section className="grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <div>
          <h2 className="text-lg font-semibold">Supporting observations</h2>
          <p className="mt-1 text-xs text-[#a5abc9]">
            {(pattern.metadata?.observation_count as number | undefined) ?? 0} observations across {pattern.time_window_start ? new Date(pattern.time_window_start).toLocaleDateString() : 'N/A'} - {pattern.time_window_end ? new Date(pattern.time_window_end).toLocaleDateString() : 'N/A'}
          </p>
          <div className="mt-4 space-y-3">
            {pattern.pattern_observations?.map((obs, index) => (
              <article className="surface flex gap-4 p-5" key={`${pattern.id}-${index}`}>
                <span className="font-mono text-xs text-[#aeb6ff]">0{index + 1}</span>
                <div>
                  <p className="text-sm font-semibold leading-6">{obs.observation?.title || 'Observation'}</p>
                  <p className="mt-2 font-mono text-[10px] text-[#a5abc9]">
                    {obs.observation?.statement || 'No statement'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <aside className="space-y-6">
          <section className="surface p-6">
            <p className="eyebrow">Counter-signals</p>
            <p className="mt-4 font-mono text-4xl text-[#d0b2ed]">
              {pattern.metadata?.has_contradictions === true ? 'Present' : 'None'}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#bfc3dc]">
              Incumbents may absorb this capability into broader platforms, reducing standalone category potential.
            </p>
            <div className="mt-5 flex items-start gap-2 border-t border-[#30345f] pt-4 text-xs leading-5 text-[#d0b2ed]">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              Counter-evidence stays visible in every interpretation.
            </div>
          </section>
          <section className="surface p-6">
            <p className="eyebrow">Pattern metrics</p>
            <div className="mt-4 space-y-3">
              {[
                ["Strength", Math.round(pattern.strength_score * 100)],
                ["Persistence", Math.round(pattern.persistence_score * 100)],
                ["Evidence diversity", Math.round(pattern.evidence_diversity_score * 100)],
                ["Confidence", Math.round(pattern.confidence * 100)]
              ].map(([label, score]) => (
                <div key={label}>
                  <div className="flex justify-between font-mono text-[10px] text-[#a5abc9]">
                    <span>{label}</span>
                    <span>{score}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-[#202750]">
                    <div className="h-full bg-[#7076f6]" style={{ width: `${score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}