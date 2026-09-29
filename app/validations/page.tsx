'use client'

import { useEffect, useState } from "react";
import { fetchValidations } from "@/lib/api/intelligence";
import { ValidationRun } from "@/types/intelligence";

export default function ValidationsPage() {
  const [validations, setValidations] = useState<ValidationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadValidations() {
      try {
        const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspace_id') || '' : '';
        if (!workspaceId) return;
        const { data } = await fetchValidations({ workspace_id: workspaceId, limit: 100 });
        setValidations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load validations');
      } finally {
        setLoading(false);
      }
    }
    loadValidations();
  }, []);

  if (loading) return <div className="space-y-9 p-6">Loading validations...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;

  return (
    <div className="space-y-9 p-6">
      <header className="border-b border-[#30345f] pb-8">
        <p className="eyebrow mb-3">Artificial Intelligence / Validations</p>
        <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Adversarial <em className="text-[#929aff]">validation.</em></h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
          9-dimension adversarial research. Supported, Mixed, Weakened, or Inconclusive.
        </p>
      </header>
      {validations.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No validations run yet. Hypotheses must be ready_for_validation first.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {validations.map((validation) => (
            <div className="surface p-6 hover:border-[#7076f6] transition" key={validation.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl leading-tight">{validation.hypothesis?.title || 'Unknown hypothesis'}</h2>
                  <p className="mt-1 text-sm text-[#a5abc9]">{validation.hypothesis?.statement || ''}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`rounded border px-3 py-1 font-mono text-[10px] uppercase ${
                    validation.result === 'supported' ? 'border-[#4b7a5e] bg-[#183828] text-[#8fd19e]' :
                    validation.result === 'mixed' ? 'border-[#705779] bg-[#241a37] text-[#d0b2ed]' :
                    validation.result === 'weakened' ? 'border-[#7a4b4b] bg-[#381818] text-[#e89696]' :
                    'border-[#5a5a7a] bg-[#1a1e2e] text-[#a5abc9]'
                  }`}>
                    {validation.result || 'pending'}
                  </span>
                  {validation.confidence && (
                    <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-1 font-mono text-[9px] text-[#a5abc9]">
                      {Math.round((validation.confidence || 0) * 100)}% confidence
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-[#8d93b6]">Supporting evidence</p>
                  <p className="font-mono text-lg">{validation.validation_evidence?.filter(e => e.stance === 'supporting').length || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8d93b6]">Contradicting evidence</p>
                  <p className="font-mono text-lg">{validation.validation_evidence?.filter(e => e.stance === 'contradicting').length || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8d93b6]">Neutral evidence</p>
                  <p className="font-mono text-lg">{validation.validation_evidence?.filter(e => e.stance === 'neutral').length || 0}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {validation.dimensions?.map((dim) => (
                  <span key={dim} className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-1 font-mono text-[9px] text-[#a5abc9]">
                    {dim}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
