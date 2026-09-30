'use client'

import { useEffect, useState } from "react";
import { Play, RefreshCw, CheckCircle2, AlertCircle, Clock, Zap, Brain, Activity, GitBranch, ExternalLink } from "lucide-react";
import { useWorkspace } from "@/lib/hooks/workspace";
import { useResearchRuns } from "@/lib/hooks/intelligence";
import { ResearchQualityRun } from "@/types/intelligence";
import { AppShell } from "@/components/layout/app-shell";

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle2, color: 'text-[#8fd19e]', bg: 'bg-[#183828] border-[#4b7a5e]', label: 'Completed' },
  failed: { icon: AlertCircle, color: 'text-[#e89696]', bg: 'bg-[#381818] border-[#7a4b4b]', label: 'Failed' },
  partial: { icon: AlertCircle, color: 'text-[#c7a8ea]', bg: 'bg-[#241a37] border-[#705779]', label: 'Partial' },
  researching: { icon: Zap, color: 'text-[#aeb6ff]', bg: 'bg-[#171c42] border-[#3b4378]', label: 'Researching' },
  discovering: { icon: Brain, color: 'text-[#aeb6ff]', bg: 'bg-[#171c42] border-[#3b4378]', label: 'Discovering' },
  extracting: { icon: Activity, color: 'text-[#aeb6ff]', bg: 'bg-[#171c42] border-[#3b4378]', label: 'Extracting' },
  verifying: { icon: GitBranch, color: 'text-[#aeb6ff]', bg: 'bg-[#171c42] border-[#3b4378]', label: 'Verifying' },
  analyzing: { icon: Brain, color: 'text-[#aeb6ff]', bg: 'bg-[#171c42] border-[#3b4378]', label: 'Analyzing' },
  queued: { icon: Clock, color: 'text-[#a5abc9]', bg: 'bg-[#1a1e2e] border-[#5a5a7a]', label: 'Queued' },
  cancelled: { icon: AlertCircle, color: 'text-[#8d93b6]', bg: 'bg-[#1a1e2e] border-[#5a5a7a]', label: 'Cancelled' },
};

const triggerTypeLabels: Record<string, string> = {
  manual: 'Manual',
  schedule: 'Scheduled',
  validation: 'Validation',
  backfill: 'Backfill',
};

export default function ResearchRunsPage() {
  return <AppShell><ResearchRunsContent /></AppShell>;
}

function ResearchRunsContent() {
  const { workspace, workspaceDomain, isLoading: workspaceLoading } = useWorkspace();
  const workspaceId = workspace?.id;
  const workspaceDomainId = workspaceDomain?.id;
  
  const { runs, isLoading: loading, error, mutate } = useResearchRuns(workspaceId || "", 50);
  const [refreshing, setRefreshing] = useState(false);

  if (workspaceLoading) return <div className="space-y-9 p-6">Loading workspace...</div>;
  if (loading) return <div className="space-y-9 p-6">Loading research runs...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;
  if (!workspace || !workspaceDomain) return <div className="space-y-9 p-6">Please complete onboarding to set up your workspace.</div>;

  const handleRefresh = () => {
    setRefreshing(true);
    mutate();
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className="space-y-9 p-6">
      <header className="flex flex-col justify-between gap-6 border-b border-[#30345f] pb-8 md:flex-row md:items-end">
        <div>
          <p className="eyebrow mb-3">Artificial Intelligence / Research Runs</p>
          <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Research <em className="text-[#929aff]">history.</em></h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
            Track all research executions, their status, and metrics. Trigger manual runs from any page.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} disabled={refreshing} className="button">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh
          </button>
        </div>
      </header>

      {runs.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No research runs yet.</p>
          <p className="mt-2 text-sm text-[#a5abc9]">Trigger your first run from the engine panel on any page, or schedule automatic runs.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map((run: ResearchQualityRun) => (
            <ResearchRunCard key={run.research_run_id} run={run} onRefresh={mutate} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResearchRunCard({ run, onRefresh }: { run: ResearchQualityRun; onRefresh: () => void }) {
  const status = run.status as keyof typeof statusConfig;
  const config = statusConfig[status] || statusConfig.queued;
  const Icon = config.icon;
  const duration = run.started_at && run.completed_at 
    ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
    : null;

  return (
    <article className="surface p-5 hover:border-[#7076f6] transition">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`rounded border px-2 py-1 font-mono text-[9px] uppercase ${config.bg} ${config.color}`}>
            {config.label}
          </span>
          <div>
            <p className="font-semibold text-sm">{triggerTypeLabels[run.trigger_type] || run.trigger_type} run</p>
            <p className="text-xs text-[#a5abc9]">{new Date(run.created_at).toLocaleString()}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
          {duration !== null && (
            <span className="font-mono text-xs text-[#8d93b6]">{duration}s</span>
          )}
          <span className="font-mono text-xs text-[#8d93b6]">{run.sources_accepted || 0}/{run.sources_discovered || 0} sources</span>
          <span className="font-mono text-xs text-[#8d93b6]">{run.evidence_count || 0} evidence</span>
          <span className="font-mono text-xs text-[#c7a8ea]">${run.estimated_cost_usd?.toFixed(4) || '0.0000'}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-4 text-sm border-t border-[#30345f] pt-4">
        <div><p className="text-xs text-[#8d93b6]">Discovered</p><p className="font-mono">{run.sources_discovered || 0}</p></div>
        <div><p className="text-xs text-[#8d93b6]">Accepted</p><p className="font-mono text-[#8fd19e]">{run.sources_accepted || 0}</p></div>
        <div><p className="text-xs text-[#8d93b6]">Rejected</p><p className="font-mono text-[#e89696]">{run.sources_rejected || 0}</p></div>
        <div><p className="text-xs text-[#8d93b6]">Duplicates</p><p className="font-mono">{run.sources_duplicate || 0}</p></div>
        <div><p className="text-xs text-[#8d93b6]">Failed</p><p className="font-mono text-[#e89696]">{run.sources_failed || 0}</p></div>
        <div><p className="text-xs text-[#8d93b6]">Needs review</p><p className="font-mono text-[#c7a8ea]">{run.sources_needing_review || 0}</p></div>
      </div>

      {(run.metrics as any)?.trigger_results && (
        <div className="mt-4 p-3 bg-[#111735] rounded border border-[#30345f]">
          <p className="text-xs font-semibold text-[#a5abc9] mb-2">Engine trigger results:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries((run.metrics as any).trigger_results).map(([engine, result]: [string, any]) => (
              <span key={engine} className={`rounded px-2 py-1 font-mono text-[9px] ${result.status === 'triggered' ? 'bg-[#183828] text-[#8fd19e]' : 'bg-[#381818] text-[#e89696]'}`}>
                {engine}: {result.status}
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
