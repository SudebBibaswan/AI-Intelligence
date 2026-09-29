'use client'

import { useEffect, useState } from "react";
import { fetchCapitalFlow } from "@/lib/api/intelligence";
import { CapitalFlowMapping } from "@/types/intelligence";

export default function CapitalFlowPage() {
  const [mappings, setMappings] = useState<CapitalFlowMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMappings() {
      try {
        const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspace_id') || '' : '';
        if (!workspaceId) return;
        const { data } = await fetchCapitalFlow({ workspace_id: workspaceId, limit: 100 });
        setMappings(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load capital flow');
      } finally {
        setLoading(false);
      }
    }
    loadMappings();
  }, []);

  if (loading) return <div className="space-y-9 p-6">Loading capital flow...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;

  return (
    <div className="space-y-9 p-6">
      <header className="border-b border-[#30345f] pb-8">
        <p className="eyebrow mb-3">Artificial Intelligence / Capital Flow</p>
        <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Where <em className="text-[#929aff]">capital moves.</em></h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
          Patterns mapped to VC/YC entities with capital direction, sector tags, and check size estimates.
        </p>
      </header>
      {mappings.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No capital flow mappings yet. Run Capital Flow engine after Thesis extraction.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {mappings.map((mapping) => (
            <div className="surface p-6 hover:border-[#7076f6] transition" key={mapping.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className={`rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-wide ${
                    mapping.capital_direction === 'inflow' ? 'border-[#4b7a5e] bg-[#183828] text-[#8fd19e]' :
                    mapping.capital_direction === 'outflow' ? 'border-[#7a4b4b] bg-[#381818] text-[#e89696]' :
                    'border-[#5a5a7a] bg-[#1a1e2e] text-[#a5abc9]'
                  }`}>
                    {mapping.capital_direction}
                  </span>
                  <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-1 font-mono text-[9px] text-[#a5abc9]">
                    {mapping.match_type}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-2xl leading-tight">{mapping.pattern?.title || 'Pattern'}</h2>
                <p className="mt-2 text-sm text-[#a5abc9]">{mapping.entity?.name || 'Unknown entity'}</p>
                <p className="mt-4 text-xs font-mono text-[#a5abc9]">
                  {mapping.sector_tags?.join(', ') || 'No sectors'} · {mapping.stage_tags?.join(', ') || 'No stages'} · {mapping.geography_tags?.join(', ') || 'No geo'}
                </p>
              </div>
            </div>
            ))}
        </div>
      )}
    </div>
  );
}
