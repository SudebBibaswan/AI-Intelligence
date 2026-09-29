'use client'

import { useEffect, useState } from "react";
import { fetchQualitySnapshots } from "@/lib/api/intelligence";

export default function QualityPage() {
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuality() {
      try {
        const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspace_id') || '' : '';
        if (!workspaceId) return;
        const { snapshots, recentRuns } = await fetchQualitySnapshots({ workspace_id: workspaceId, limit: 50 });
        setSnapshots(snapshots);
        setRecentRuns(recentRuns);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quality');
      } finally {
        setLoading(false);
      }
    }
    loadQuality();
  }, []);

  if (loading) return <div className="space-y-9 p-6">Loading quality metrics...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;

  const latest = snapshots[0]?.metrics || {};

  return (
    <div className="space-y-9 p-6">
      <header className="border-b border-[#30345f] pb-8">
        <p className="eyebrow mb-3">Artificial Intelligence / Research Quality</p>
        <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Pipeline <em className="text-[#929aff]">health.</em></h1>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="surface p-4 border-l-4 border-[#8fd19e]">
          <p className="text-xs font-semibold text-[#8fd19e]">Runs Completed</p>
          <p className="mt-2 font-display text-3xl">{latest.runs_completed || 0}</p>
        </div>
        <div className="surface p-4 border-l-4 border-[#e89696]">
          <p className="text-xs font-semibold text-[#e89696]">Runs Failed</p>
          <p className="mt-2 font-display text-3xl">{latest.runs_failed || 0}</p>
        </div>
        <div className="surface p-4 border-l-4 border-[#b9c0ff]">
          <p className="text-xs font-semibold text-[#b9c0ff]">Verification Rate</p>
          <p className="mt-2 font-display text-3xl">{latest.verification_rate ? Math.round(latest.verification_rate * 100) + '%' : 'N/A'}</p>
        </div>
        <div className="surface p-4 border-l-4 border-[#d0b2ed]">
          <p className="text-xs font-semibold text-[#d0b2ed]">Cost (USD)</p>
          <p className="mt-2 font-display text-3xl">${(latest.total_cost_usd || 0).toFixed(4)}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="surface p-4 border-l-4 border-[#8fd19e]">
          <p className="text-xs font-semibold text-[#8fd19e]">Source Yield</p>
          <p className="mt-2 font-display text-3xl">{latest.source_to_evidence_yield ? Math.round(latest.source_to_evidence_yield * 10000) / 100 + '%' : 'N/A'}</p>
        </div>
        <div className="surface p-4 border-l-4 border-[#b9c0ff]">
          <p className="text-xs font-semibold text-[#b9c0ff]">Providers</p>
          <p className="mt-2 font-display text-3xl">{latest.providers_monitored || 0}</p>
        </div>
        <div className="surface p-4 border-l-4 border-[#8fd19e]">
          <p className="text-xs font-semibold text-[#8fd19e]">Backlog</p>
          <p className="mt-2 font-display text-3xl">{latest.review_backlog_count || 0}</p>
        </div>
        <div className="surface p-4 border-l-4 border-[#d0b2ed]">
          <p className="text-xs font-semibold text-[#d0b2ed]">Capital Entities</p>
          <p className="mt-2 font-display text-3xl">{latest.capital_entities || 0}</p>
        </div>
      </div>
      <section className="space-y-4">
        <h2 className="font-display text-2xl">Recent Research Runs</h2>
        <div className="space-y-2">
          {recentRuns.slice(0, 10).map((run: any) => (
            <div className="surface p-4 flex items-center justify-between gap-4" key={run.research_run_id}>
              <div className="flex items-center gap-3">
                <span className={`rounded border px-2 py-1 font-mono text-[9px] ${
                  run.status === 'completed' ? 'border-[#4b7a5e] bg-[#183828] text-[#8fd19e]' :
                  run.status === 'failed' ? 'border-[#7a4b4b] bg-[#381818] text-[#e89696]' :
                  'border-[#5a5a7a] bg-[#1a1e2e] text-[#a5abc9]'
                }`}>
                  {run.status}
                </span>
                <span className="font-mono text-sm">{run.trigger_type}</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-[#a5abc9]">
                <span>{run.evidence_count} evidence · {run.verified_evidence} verified</span>
                <span>{run.source_to_evidence_yield ? `${Math.round(run.source_to_evidence_yield * 10000) / 100}% yield` : '0% yield'}</span>
                <span>${run.estimated_cost_usd?.toFixed(4)}</span>
                <span className="font-mono text-xs">{new Date(run.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-2xl">Provider Quality</h2>
        {/* Provider quality would come from quality snapshots */}
        <p className="text-[#a5abc9]">Provider quality metrics available in quality snapshots.</p>
      </section>
    </div>
  );
}
