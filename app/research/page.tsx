'use client'

import { useEffect, useState } from "react";
import { fetchQualitySnapshots } from "@/lib/api/intelligence";

export default function ResearchPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRuns() {
      try {
        const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspace_id') || '' : '';
        if (!workspaceId) throw new Error('No workspace selected');
        const { recentRuns } = await fetchQualitySnapshots({ workspace_id: workspaceId, limit: 50 });
        setRuns(recentRuns);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load research runs');
      } finally {
        setLoading(false);
      }
    }
    loadRuns();
  }, []);

  if (loading) return <div className="space-y-9 p-6">Loading research runs...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;

  return (
    <div className="space-y-9 p-6">
      <header className="border-b border-[#30345f] pb-8">
        <p className="eyebrow mb-3">Artificial Intelligence / Research Engine</p>
        <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Collection <em className="text-[#929aff]">runs.</em></h1>
      </header>
      {runs.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No research runs yet. Trigger Research Engine V2.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run: any) => (
            <div className="surface p-5 flex items-center justify-between gap-4 hover:border-[#7076f6] transition" key={run.research_run_id}>
              <div className="flex items-center gap-4 flex-1">
                <span className={`rounded border px-3 py-1 font-mono text-[10px] ${
                  run.status === 'completed' ? 'border-[#4b7a5e] bg-[#183828] text-[#8fd19e]' :
                  run.status === 'failed' ? 'border-[#7a4b4b] bg-[#381818] text-[#e89696]' :
                  run.status === 'running' ? 'border-[#b9c0ff] bg-[#182048] text-[#b9c0ff]' :
                  'border-[#5a5a7a] bg-[#1a1e2e] text-[#a5abc9]'
                }`}>
                  {run.status}
                </span>
                <span className="font-mono text-sm">{run.trigger_type}</span>
                <span className="text-sm text-[#a5abc9]">{run.workspace_domain_id}</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-[#a5abc9]">
                <span>{run.evidence_count} evidence · {run.verified_evidence} verified</span>
                <span>{run.source_to_evidence_yield ? Math.round(run.source_to_evidence_yield * 10000) / 100 + '%' yield : '0% yield'}</span>
                <span>${run.estimated_cost_usd?.toFixed(4)}</span>
                <span className="font-mono text-xs">{new Date(run.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}