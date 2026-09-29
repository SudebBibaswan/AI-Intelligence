'use client'

import { useEffect, useState } from "react";
import { fetchSignals } from "@/lib/api/intelligence";

export default function TimelinePage() {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSignals() {
      try {
        const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspace_id') || '' : '';
        if (!workspaceId) throw new Error('No workspace selected');
        const { data } = await fetchSignals({ workspace_id: workspaceId, limit: 200, status: 'accepted' });
        setSignals(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load timeline');
      } finally {
        setLoading(false);
      }
    }
    loadSignals();
  }, []);

  if (loading) return <div className="space-y-9 p-6">Loading timeline...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;

  const sorted = [...signals].sort((a, b) => new Date(b.event_at || b.created_at).getTime() - new Date(a.event_at || a.created_at).getTime());

  return (
    <div className="space-y-9 p-6">
      <header className="border-b border-[#30345f] pb-8">
        <p className="eyebrow mb-3">Artificial Intelligence / Timeline</p>
        <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Signal <em className="text-[#929aff]">timeline.</em></h1>
      </header>
      {sorted.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No signals yet. Run the Signal engine.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((signal) => (
            <Link href={`/signals/${signal.id}`} className="surface p-5 hover:border-[#7076f6] transition flex items-center gap-4" key={signal.id}>
              <div className="w-12 h-12 rounded-lg bg-[#171c42] border border-[#30345f] flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#aeb6ff]"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-5">{signal.title}</p>
                <p className="text-xs text-[#a5abc9] truncate">{signal.summary}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#a5abc9]">
                <span>{signal.event_at ? new Date(signal.event_at).toLocaleDateString() : new Date(signal.created_at).toLocaleDateString()}</span>
                <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-0.5 font-mono text-[9px] text-[#a5abc9]">{signal.signal_type}</span>
                <span className="font-mono text-[#8d93b6]">{Math.round((signal.confidence || 0) * 100)}%</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";