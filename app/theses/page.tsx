'use client'

import { useEffect, useState } from "react";
import { fetchTheses } from "@/lib/api/intelligence";
import { Thesis } from "@/types/intelligence";

export default function ThesesPage() {
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTheses() {
      try {
        const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspace_id') || '' : '';
        if (!workspaceId) throw new Error('No workspace selected');
        const { data } = await fetchTheses({ workspace_id: workspaceId, limit: 100 });
        setTheses(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load theses');
      } finally {
        setLoading(false);
      }
    }
    loadTheses();
  }, []);

  if (loading) return <div className="space-y-9 p-6">Loading theses...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;

  return (
    <div className="space-y-9 p-6">
      <header className="border-b border-[#30345f] pb-8">
        <p className="eyebrow mb-3">Artificial Intelligence / Theses</p>
        <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Stated & Revealed <em className="text-[#929aff]">theses.</em></h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
          Stated theses from public statements. Revealed theses inferred from actual investment patterns.
        </p>
      </header>
      {theses.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No theses extracted yet. Run the Thesis Extraction engine.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {theses.map((thesis) => (
            <div className="surface p-6 hover:border-[#7076f6] transition" key={thesis.id}>
              <div className="flex items-center justify-between gap-4">
                <span className={`rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-wide ${
                  thesis.thesis_type === 'stated'
                    ? 'border-[#4b559b] bg-[#182048] text-[#b9c0ff]'
                    : 'border-[#5a4b8a] bg-[#201838] text-[#c9b8ff]'
                }`}>
                  {thesis.thesis_type}
                </span>
                <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-1 font-mono text-[9px] text-[#a5abc9]">
                  {thesis.status}
                </span>
              </div>
              <h2 className="mt-4 font-display text-2xl leading-tight">{thesis.statement}</h2>
              <p className="mt-2 text-sm text-[#a5abc9]">Confidence: {Math.round((thesis.confidence || 0) * 100)}%</p>
              <p className="mt-4 text-xs font-mono text-[#a5abc9]">
                Entity: {thesis.entity?.name || 'Unknown'} · {thesis.thesis_evidence?.length || 0} evidence
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}