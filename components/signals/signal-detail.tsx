'use client'

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, CircleAlert, ExternalLink } from "lucide-react";
import { fetchSignalById } from "@/lib/api/intelligence";
import { IntelligenceActions } from "@/components/actions/intelligence-actions";
import { demoSignals } from "@/lib/mock-data/demo-intelligence";
import { Signal, SignalEvidence, SignalEntity } from "@/types/intelligence";

export function SignalDetail({ id }: { id: string }) {
  const [signal, setSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSignal() {
      try {
        const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspace_id') || '' : '';
        if (!workspaceId) {
          setSignal(demoSignals.find((item) => item.id === id) ?? demoSignals[0]);
          return;
        }
        const data = await fetchSignalById(id, workspaceId);
        if (!data) throw new Error('Signal not found');
        setSignal(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load signal');
      } finally {
        setLoading(false);
      }
    }
    loadSignal();
  }, [id]);

  if (loading) {
    return <div className="space-y-9">Loading signal...</div>;
  }
  if (error || !signal) {
    return <div className="space-y-9"><Link href="/workspace" className="text-sm font-semibold text-[#aeb6ff] hover:underline">Back to workspace</Link><p className="text-sm text-[#d0b2ed]">This signal is unavailable right now. Check the workspace connection and try again.</p></div>;
  }

  return (
    <div className="space-y-9">
      <Link href="/workspace" className="inline-flex items-center gap-1 text-xs font-semibold text-[#aeb6ff] hover:text-white">
        <ArrowLeft size={14} />Back to workspace
      </Link>
      <header className="border-b border-[#30345f] pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{signal.signal_type}</span>
          <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-[#b9c0ff]">
            {signal.topics[0] || 'general'}
          </span>
          {signal.metadata.hasCounterEvidence === true && (
            <span className="inline-flex items-center gap-1 rounded border border-[#705779] bg-[#241a37] px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-[#d0b2ed]">
              <CircleAlert size={11} />Counter-evidence present
            </span>
          )}
        </div>
        <h1 className="mt-5 max-w-4xl font-display text-5xl leading-[.98] sm:text-6xl">{signal.title}</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-[#bfc3dc]">{signal.summary}</p>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] text-[#a5abc9]">
          <span>{signal.event_at ? new Date(signal.event_at).toLocaleDateString() : 'N/A'}</span>
          <span>{signal.signal_evidence?.length || 0} evidence items</span>
          <span>{Math.round((signal.confidence || 0) * 100)}% confidence</span>
        </div>
      </header>
      <section className="grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <div className="space-y-7">
          <article className="surface border-l-[3px] border-l-[#7076f6] p-6 sm:p-8">
            <p className="eyebrow">What changed</p>
            <p className="mt-4 font-display text-3xl leading-tight">{signal.summary}</p>
            <p className="mt-4 text-sm leading-7 text-[#bfc3dc]">
              This is a structured interpretation of the recorded evidence. It is not a market forecast or investment recommendation.
            </p>
          </article>
          <section>
            <h2 className="text-lg font-semibold">Evidence links</h2>
            <p className="mt-1 text-xs text-[#a5abc9]">Open the original publications. Supporting and contradictory sources remain separate.</p>
            <div className="mt-4 space-y-3">
              {signal.signal_evidence?.map((item: SignalEvidence) => (
                <article className="surface p-5" key={item.evidence_id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-wide ${
                      item.role === 'supporting'
                        ? "border-[#4b559b] bg-[#182048] text-[#b9c0ff]"
                        : item.role === 'contradicting'
                        ? "border-[#705779] bg-[#241a37] text-[#d0b2ed]"
                        : "border-[#5a5a7a] bg-[#1a1e2e] text-[#a5abc9]"
                    }`}>
                      {item.role}
                    </span>
                    <span className="font-mono text-[10px] text-[#8d93b6]">Verified</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold leading-6">{item.evidence.claim_text}</h3>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#30345f] pt-4">
                    <div>
                      <p className="text-xs font-semibold text-[#d9ddf3]">{item.evidence.source.title}</p>
                      <p className="mt-1 font-mono text-[10px] text-[#8d93b6]">{item.evidence.source.publisher}</p>
                    </div>
                    <a href={item.evidence.source.canonical_url} target="_blank" rel="noreferrer" className="rounded p-2 text-[#aeb6ff] hover:bg-[#1a1e3a]" aria-label={`Open ${item.evidence.source.title}`}>
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-6">
          <section className="surface p-6">
            <p className="eyebrow">Confidence</p>
            <h2 className="mt-3 font-mono text-4xl text-[#aeb6ff]">{Math.round((signal.confidence || 0) * 100)}%</h2>
            <p className="mt-3 text-sm leading-6 text-[#bfc3dc]">Based on evidence diversity, source quality, recency, and agreement across sources.</p>
            <div className="mt-6 space-y-3">
              {[
                ["Evidence diversity", signal.signal_evidence?.length || 0],
                ["Source quality", Math.round(((signal.signal_evidence ?? []).reduce((sum, evidence) => sum + evidence.evidence.confidence, 0) / (signal.signal_evidence?.length || 1)) * 100) || 0],
                ["Recency", signal.event_at ? Math.max(0, 100 - Math.floor((Date.now() - new Date(signal.event_at).getTime()) / (1000 * 60 * 60 * 24))) : 0]
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
          <section className="surface p-6">
            <p className="eyebrow">Entities involved</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {signal.signal_entities?.map((entity: SignalEntity) => (
                <span className="rounded border border-[#3b4378] bg-[#171c42] px-2.5 py-1.5 text-xs font-semibold text-[#d9ddf3]" key={entity.entity_id}>
                  {entity.entity.name}
                </span>
              ))}
            </div>
            <Link className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[#aeb6ff] hover:underline" href="/investments">
              View related investment activity <ArrowUpRight size={13} />
            </Link>
          </section>
          <section className="surface p-6">
            <p className="eyebrow">Workspace actions</p>
            <div className="mt-4"><IntelligenceActions title={signal.title} path={`/signals/${signal.id}`} /></div>
          </section>
        </aside>
      </section>
    </div>
  );
}
