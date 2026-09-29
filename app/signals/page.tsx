'use client'

import { useEffect, useState } from "react";
import { useSignals } from "@/lib/hooks/intelligence";
import { Signal } from "@/types/intelligence";
import { useWorkspace } from "@/lib/hooks/workspace";

export default function SignalsPage() {
  const { workspace, workspaceDomain, isLoading: workspaceLoading } = useWorkspace();
  const workspaceId = workspace?.id;
  const workspaceDomainId = workspaceDomain?.id;
  
  const { signals, isLoading: loading, error, mutate } = useSignals(workspaceId || "", workspaceDomainId, 'draft', 100);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'accepted' | 'rejected'>('accepted');

  const handleReview = async (signalId: string, decision: 'accepted' | 'rejected') => {
    const requestId = crypto.randomUUID();
    try {
      const response = await fetch('/api/signals/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_id: signalId, decision, request_id: requestId })
      });
      if (!response.ok) throw new Error('Failed to review signal');
      mutate();
    } catch (err) {
      alert('Failed to review signal: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (workspaceLoading) return <div className="space-y-9 p-6">Loading workspace...</div>;
  if (loading) return <div className="space-y-9 p-6">Loading signals...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;
  if (!workspace || !workspaceDomain) return <div className="space-y-9 p-6">Please complete onboarding to set up your workspace.</div>;

  const draftSignals = signals.filter(s => s.status === 'draft');
  const acceptedSignals = signals.filter(s => s.status === 'accepted');
  const rejectedSignals = signals.filter(s => s.status === 'rejected');

  return (
    <div className="space-y-9 p-6">
      <header className="border-b border-[#30345f] pb-8">
        <p className="eyebrow mb-3">Artificial Intelligence / Signals</p>
        <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Signal <em className="text-[#929aff]">review.</em></h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
          Human review is the only mandatory gate. Accept → Observation Engine. Reject → archived.
        </p>
      </header>

      <div className="flex gap-4 mb-6">
        <span className="rounded border border-[#5a5a7a] bg-[#1a1e2e] px-3 py-1 font-mono text-[9px] text-[#a5abc9]">
          {draftSignals.length} pending review
        </span>
        <span className="rounded border border-[#4b7a5e] bg-[#183828] px-3 py-1 font-mono text-[9px] text-[#8fd19e]">
          {acceptedSignals.length} accepted
        </span>
        <span className="rounded border border-[#7a4b4b] bg-[#381818] px-3 py-1 font-mono text-[9px] text-[#e89696]">
          {rejectedSignals.length} rejected
        </span>
      </div>

      {signals.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No signals yet. Run Signal Engine after evidence collection.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((signal: Signal) => (
            <div className="surface p-5 hover:border-[#7076f6] transition flex items-center justify-between gap-4" key={signal.id}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-wide ${
                    signal.status === 'draft' ? 'border-[#5a5a7a] bg-[#1a1e2e] text-[#a5abc9]' :
                    signal.status === 'accepted' ? 'border-[#4b7a5e] bg-[#183828] text-[#8fd19e]' :
                    'border-[#7a4b4b] bg-[#381818] text-[#e89696]'
                  }`}>
                    {signal.status}
                  </span>
                  <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-1 font-mono text-[9px] text-[#a5abc9]">
                    {signal.signal_type}
                  </span>
                  <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-1 font-mono text-[9px] text-[#a5abc9]">
                    {Math.round((signal.confidence || 0) * 100)}%
                  </span>
                </div>
                <h3 className="font-semibold text-sm leading-5 max-w-2xl truncate">{signal.title}</h3>
                <p className="mt-1 text-xs text-[#a5abc9] truncate">{signal.summary}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#a5abc9]">
                  <span>{signal.event_at ? new Date(signal.event_at).toLocaleDateString() : new Date(signal.created_at).toLocaleDateString()}</span>
                  <span className="font-mono text-[#8d93b6]">{signal.signal_evidence?.length || 0} evidence</span>
                  <span className="font-mono text-[#8d93b6]">{signal.signal_entities?.length || 0} entities</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {signal.status === 'draft' ? (
                  <>
                    <button
                      onClick={() => { setReviewDecision('accepted'); setReviewing(signal.id); }}
                      className="button py-2 px-4 bg-[#4b7a5e] hover:bg-[#3d6a4e] text-xs"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => { setReviewDecision('rejected'); setReviewing(signal.id); }}
                      className="button py-2 px-4 bg-[#7a4b4b] hover:bg-[#663d3d] text-xs"
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <span className="font-mono text-[10px] text-[#8d93b6]">
                    {signal.status === 'accepted' ? '→ Observations' : 'Archived'}
                  </span>
                )}
                {reviewing === signal.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReview(signal.id, reviewDecision)}
                      className={`button py-2 px-4 text-xs ${
                        reviewDecision === 'accepted' ? 'bg-[#4b7a5e] hover:bg-[#3d6a4e]' : 'bg-[#7a4b4b] hover:bg-[#663d3d]'
                      }`}
                    >
                      Confirm {reviewDecision}
                    </button>
                    <button onClick={() => setReviewing(null)} className="button py-2 px-4 text-xs">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}