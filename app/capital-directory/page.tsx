'use client'

import { useEffect, useState } from "react";
import { fetchCapitalDirectory } from "@/lib/api/intelligence";
import { CapitalDirectoryEntry } from "@/types/intelligence";

export default function CapitalDirectoryPage() {
  const [entities, setEntities] = useState<CapitalDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEntities() {
      try {
        const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspace_id') || '' : '';
        if (!workspaceId) throw new Error('No workspace selected');
        const { data } = await fetchCapitalDirectory({ workspace_id: workspaceId, limit: 100 });
        setEntities(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load capital directory');
      } finally {
        setLoading(false);
      }
    }
    loadEntities();
  }, []);

  if (loading) return <div className="space-y-9 p-6">Loading capital directory...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;

  const active = entities.filter(e => e.activity_status === 'active_evidenced');
  const evidenced = entities.filter(e => e.activity_status === 'evidenced');
  const candidates = entities.filter(e => e.activity_status === 'candidate_unverified');

  return (
    <div className="space-y-9 p-6">
      <header className="border-b border-[#30345f] pb-8">
        <p className="eyebrow mb-3">Artificial Intelligence / Capital Directory</p>
        <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">VC & YC <em className="text-[#929aff]">entities.</em></h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
          Investors, funds, accelerators tracked with evidenced capital activity.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface p-4 border-l-4 border-[#8fd19e]">
          <p className="text-xs font-semibold text-[#8fd19e]">Active Evidenced</p>
          <p className="mt-2 font-display text-4xl">{active.length}</p>
        </div>
        <div className="surface p-4 border-l-4 border-[#b9c0ff]">
          <p className="text-xs font-semibold text-[#b9c0ff]">Evidenced</p>
          <p className="mt-2 font-display text-4xl">{evidenced.length}</p>
        </div>
        <div className="surface p-4 border-l-4 border-[#a5abc9]">
          <p className="text-xs font-semibold text-[#a5abc9]">Candidates</p>
          <p className="mt-2 font-display text-4xl">{candidates.length}</p>
        </div>
      </div>
      {entities.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No capital entities yet. Run Capital Directory refresh.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entities.map((entity) => (
            <div className="surface p-6 hover:border-[#7076f6] transition" key={entity.entity_id}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl leading-tight">{entity.name}</h2>
                  <p className="mt-1 text-sm text-[#a5abc9]">{entity.entity_type} · {entity.registry_country || 'Unknown country'}</p>
                </div>
                <span className={`rounded border px-2 py-1 font-mono text-[9px] uppercase ${
                  entity.activity_status === 'active_evidenced' ? 'border-[#4b7a5e] bg-[#183828] text-[#8fd19e]' :
                  entity.activity_status === 'evidenced' ? 'border-[#b9c0ff] bg-[#182048] text-[#b9c0ff]' :
                  'border-[#5a5a7a] bg-[#1a1e2e] text-[#a5abc9]'
                }`}>
                  {entity.activity_status}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                <div><p className="text-xs text-[#8d93b6]">Evidence</p><p className="font-mono text-lg">{entity.evidence_count}</p></div>
                <div><p className="text-xs text-[#8d93b6]">Capital relationships</p><p className="font-mono text-lg">{entity.capital_relationship_count}</p></div>
                <div><p className="text-xs text-[#8d93b6]">Last activity</p><p className="font-mono text-lg">{entity.last_capital_activity_at ? new Date(entity.last_capital_activity_at).toLocaleDateString() : 'Never'}</p></div>
                <div><p className="text-xs text-[#8d93b6]">Status</p><p className="font-mono text-lg">{entity.activity_status}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}