'use client'

import { useEffect, useState } from "react";
import { fetchEvidenceReviewQueue, submitEvidenceReview } from "@/lib/api/intelligence";
import { AppShell } from "@/components/layout/app-shell";

export default function EvidenceReviewPage() {
  return <AppShell><EvidenceReviewContent /></AppShell>;
}

function EvidenceReviewContent() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadQueue() {
      try {
        const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspace_id') || '' : '';
        if (!workspaceId) return;
        const { data } = await fetchEvidenceReviewQueue({ workspace_id: workspaceId, limit: 100 });
        setQueue(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load review queue');
      } finally {
        setLoading(false);
      }
    }
    loadQueue();
  }, []);

  const handleReview = async (evidenceId: string, decision: 'verified' | 'disputed' | 'rejected') => {
    const requestId = crypto.randomUUID();
    try {
      await submitEvidenceReview({ evidence_id: evidenceId, decision, reason: null, request_id: requestId });
      setQueue(queue.filter(q => q.evidence_id !== evidenceId));
    } catch (err) {
      alert('Failed to submit review: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) return <div className="space-y-9 p-6">Loading review queue...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;

  return (
    <div className="space-y-9 p-6">
      <header className="border-b border-[#30345f] pb-8">
        <p className="eyebrow mb-3">Artificial Intelligence / Evidence Review</p>
        <h1 className="font-display text-5xl leading-[.98] sm:text-6xl"><em className="text-[#929aff]">Review</em> queue.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
          Human review for unverified/disputed evidence. Verified evidence feeds signal engine.
        </p>
      </header>
      <div className="flex gap-4 mb-6">
        <span className="rounded border border-[#4b7a5e] bg-[#183828] px-3 py-1 font-mono text-[9px] text-[#8fd19e]">
          {queue.filter(q => q.verification_status === 'unverified').length} unverified
        </span>
        <span className="rounded border border-[#705779] bg-[#241a37] px-3 py-1 font-mono text-[9px] text-[#d0b2ed]">
          {queue.filter(q => q.verification_status === 'disputed').length} disputed
        </span>
        <span className="rounded border border-[#b9c0ff] bg-[#182048] px-3 py-1 font-mono text-[9px] text-[#b9c0ff]">
          {queue.length} total
        </span>
      </div>
      {queue.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No evidence pending review. Great job!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((item) => (
            <div className="surface p-5 hover:border-[#7076f6] transition" key={item.evidence_id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`rounded border px-2 py-1 font-mono text-[9px] ${
                      item.verification_status === 'unverified' ? 'border-[#5a5a7a] bg-[#1a1e2e] text-[#a5abc9]' :
                      'border-[#705779] bg-[#241a37] text-[#d0b2ed]'
                    }`}>
                      {item.verification_status}
                    </span>
                    <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-1 font-mono text-[9px] text-[#a5abc9]">
                      {item.source_type}
                    </span>
                    <span className="font-mono text-[10px] text-[#8d93b6]">{item.confidence ? Math.round(item.confidence * 100) + '%' : 'N/A'}</span>
                  </div>
                  <h3 className="font-semibold text-sm leading-6">{item.claim_text}</h3>
                  <p className="mt-2 text-xs text-[#a5abc9] max-h-20 overflow-hidden">
                    {item.excerpt}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] text-[#a5abc9]">
                    <span>{item.source_title}</span>
                    <span>{item.publisher}</span>
                    <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleReview(item.evidence_id, 'verified')} className="button py-2 px-4 bg-[#4b7a5e] hover:bg-[#3d6a4e]">
                    Verified
                  </button>
                  <button onClick={() => handleReview(item.evidence_id, 'disputed')} className="button py-2 px-4 bg-[#705779] hover:bg-[#5a4565]">
                    Disputed
                  </button>
                  <button onClick={() => handleReview(item.evidence_id, 'rejected')} className="button py-2 px-4 bg-[#7a4b4b] hover:bg-[#663d3d]">
                    Rejected
                  </button>
                  <a href={item.canonical_url} target="_blank" rel="noreferrer" className="button py-2 px-4 bg-[#3b4378] hover:bg-[#4a508a]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
