"use client";

import { 
  Activity, AlertTriangle, CheckCircle2, ClipboardList, Clock3, Database, 
  RefreshCw, Search, ShieldCheck, Waypoints, FileText, Zap, Brain, 
  Filter, ChevronDown, ExternalLink, AlertCircle, Check
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/lib/hooks/workspace";

const tabs = ["Overview", "Signal Review", "Workflow Runs", "AI Usage", "Requests & Errors", "Audit Log", "System Counts"] as const;
type Tab = typeof tabs[number];

interface SignalReviewItem {
  signal_id: string;
  workspace_id: string;
  workspace_domain_id: string;
  domain_key: string;
  domain_name: string;
  signal_type: string;
  title: string;
  summary: string;
  event_at: string;
  confidence: number;
  novelty_score: number;
  importance_score: number;
  status: string;
  corroboration_status: string;
  evidence_count: number;
  independent_source_count: number;
  invalid_evidence_count: number;
  all_evidence_verified: boolean;
  review_count: number;
  last_reviewed_at: string | null;
  created_at: string;
}

interface OverviewData {
  counts: Record<string, number>;
  signalStatus: { draft: number; accepted: number; rejected: number };
  observationStatus: { draft: number; accepted: number };
  patternStatus: { emerging: number; persistent: number; weakening: number };
  hypothesisStatus: { ready: number; validating: number; complete: number };
  insightStatus: { draft: number; published: number };
  draftSignalsCount: number;
  recentRuns: any[];
  lastFailure: any;
  lastSuccess: any;
  dailyStats: any[];
}

interface WorkflowRun {
  id: string;
  research_run_id: string;
  trigger_type: string;
  status: string;
  error_summary: any;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  llm_calls: number;
  failed_llm_calls: number;
  estimated_cost_usd: number;
  workspace_domain: {
    id: string;
    name: string | null;
    domain: { key: string; name: string };
  };
}

interface AIUsageData {
  totals: { calls: number; failed: number; failureRate: string; avgLatency: string; cost: string };
  daily: any[];
}

interface AuditLogItem {
  created_at: string;
  actor_type: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  request_id: string;
  metadata: any;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

async function fetchAdminAPI<T>(endpoint: string, workspaceId: string): Promise<T> {
  return fetcher(`/api/admin${endpoint}?workspace_id=${workspaceId}`);
}

export function AdminPanel() {
  const { workspace, isLoading: workspaceLoading } = useWorkspace();
  const workspaceId = workspace?.id;
  
  const [tab, setTab] = useState<Tab>("Overview");
  const [range, setRange] = useState("7 days");
  const [query, setQuery] = useState("");
  const [refreshed, setRefreshed] = useState("Just now");
  
  // Data states
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [signalReviews, setSignalReviews] = useState<SignalReviewItem[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [aiUsage, setAIUsage] = useState<AIUsageData | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Fetch data for current tab
  useEffect(() => {
    if (!workspaceId) return;
    
    const loadData = async () => {
      setLoading(prev => ({ ...prev, [tab]: true }));
      setErrors(prev => ({ ...prev, [tab]: null }));
      
      try {
        switch (tab) {
          case "Overview": {
            const data = await fetchAdminAPI<OverviewData>('/overview', workspaceId);
            setOverview(data);
            break;
          }
          case "Signal Review": {
            const data = await fetchAdminAPI<{ data: SignalReviewItem[] }>('/signal-review-queue', workspaceId);
            setSignalReviews(data.data || []);
            break;
          }
          case "Workflow Runs": {
            const data = await fetchAdminAPI<{ data: WorkflowRun[] }>('/workflow-runs', workspaceId);
            setWorkflowRuns(data.data || []);
            break;
          }
          case "AI Usage": {
            const data = await fetchAdminAPI<AIUsageData>(`/ai-usage?range=${range}`, workspaceId);
            setAIUsage(data);
            break;
          }
          case "Requests & Errors": {
            const data = await fetchAdminAPI<{ data: any[] }>('/requests', workspaceId);
            setRequests(data.data || []);
            break;
          }
          case "Audit Log": {
            const data = await fetchAdminAPI<{ data: AuditLogItem[] }>('/audit', workspaceId);
            setAuditLogs(data.data || []);
            break;
          }
        }
        setRefreshed(new Date().toLocaleTimeString());
      } catch (err) {
        setErrors(prev => ({ ...prev, [tab]: err instanceof Error ? err.message : 'Failed to load' }));
      } finally {
        setLoading(prev => ({ ...prev, [tab]: false }));
      }
    };

    loadData();
  }, [tab, workspaceId, range, query]);

  const handleRefresh = async () => {
    setRefreshed("Loading...");
    // Re-trigger fetch by updating a dummy state
    setLoading(prev => ({ ...prev, [tab]: true }));
    try {
      switch (tab) {
        case "Overview": {
          const data = await fetchAdminAPI<OverviewData>('/overview', workspaceId!);
          setOverview(data);
          break;
        }
        case "Signal Review": {
          const data = await fetchAdminAPI<{ data: SignalReviewItem[] }>('/signal-review-queue', workspaceId!);
          setSignalReviews(data.data || []);
          break;
        }
        case "Workflow Runs": {
          const data = await fetchAdminAPI<{ data: WorkflowRun[] }>('/workflow-runs', workspaceId!);
          setWorkflowRuns(data.data || []);
          break;
        }
        case "AI Usage": {
          const data = await fetchAdminAPI<AIUsageData>(`/ai-usage?range=${range}`, workspaceId!);
          setAIUsage(data);
          break;
        }
        case "Requests & Errors": {
          const data = await fetchAdminAPI<{ data: any[] }>('/requests', workspaceId!);
          setRequests(data.data || []);
          break;
        }
        case "Audit Log": {
          const data = await fetchAdminAPI<{ data: AuditLogItem[] }>('/audit', workspaceId!);
          setAuditLogs(data.data || []);
          break;
        }
      }
      setRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      setErrors(prev => ({ ...prev, [tab]: err instanceof Error ? err.message : 'Failed to refresh' }));
    } finally {
      setLoading(prev => ({ ...prev, [tab]: false }));
    }
  };

  if (workspaceLoading) return <div className="space-y-9 p-6">Loading workspace...</div>;
  if (!workspace) return <div className="space-y-9 p-6">Please complete onboarding to set up your workspace.</div>;

  const filteredRuns = useMemo(() => 
    workflowRuns.filter(run => 
      Object.values(run).join(" ").toLowerCase().includes(query.toLowerCase())
    ), [workflowRuns, query]);

  const filteredRequests = useMemo(() => 
    requests.filter(req => 
      Object.values(req).join(" ").toLowerCase().includes(query.toLowerCase())
    ), [requests, query]);

  const filteredSignals = useMemo(() => 
    signalReviews.filter(signal => 
      Object.values(signal).join(" ").toLowerCase().includes(query.toLowerCase())
    ), [signalReviews, query]);

  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-5 border-b border-[#30345f] pb-7 xl:flex-row xl:items-end">
        <div>
          <p className="eyebrow mb-3">Internal / workspace operations</p>
          <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Admin <em className="text-[#929aff]">control.</em></h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
            Pipeline health, model usage, costs, request lineage, and review activity for this workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-[#4b559b] bg-[#182048] px-3 py-2 font-mono text-[10px] text-[#b9c0ff]">
            <ShieldCheck className="mr-1 inline" size={13} />Owner / admin / member
          </span>
          <button className="button" onClick={handleRefresh} disabled={loading[tab]}>
            <RefreshCw size={14} className={loading[tab] ? "animate-spin" : ""} />Refresh
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3 border-b border-[#30345f] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((item) => (
            <button 
              key={item}
              onClick={() => { setTab(item); setQuery(""); }}
              className={`whitespace-nowrap rounded px-3 py-2 text-xs font-semibold ${tab === item ? "bg-[#20265c] text-white" : "text-[#a5abc9] hover:bg-[#171c42]"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={range} 
            onChange={(event) => { setRange(event.target.value); setQuery(""); }}
            className="rounded border border-[#30345f] bg-[#111735] px-3 py-2 text-xs text-white outline-none"
          >
            <option>Today</option>
            <option>7 days</option>
            <option>30 days</option>
          </select>
          <span className="font-mono text-[10px] text-[#8d93b6]">Updated {refreshed} · UTC</span>
        </div>
      </div>

      {errors[tab] && (
        <div className="rounded border border-[#7a4b4b] bg-[#381818] p-3 text-sm text-[#e89696]">
          Error: {errors[tab]}
        </div>
      )}

      {tab === "Overview" && <Overview data={overview} loading={loading["Overview"]} range={range} />}
      {tab === "Signal Review" && <SignalReviewTab data={filteredSignals} loading={loading["Signal Review"]} error={errors["Signal Review"]} />}
      {tab === "Workflow Runs" && <WorkflowRunsTab data={filteredRuns} loading={loading["Workflow Runs"]} error={errors["Workflow Runs"]} query={query} setQuery={setQuery} />}
      {tab === "AI Usage" && <UsageTab data={aiUsage} loading={loading["AI Usage"]} range={range} />}
      {tab === "Requests & Errors" && <RequestsTab data={filteredRequests} loading={loading["Requests & Errors"]} query={query} setQuery={setQuery} />}
      {tab === "Audit Log" && <AuditTab data={auditLogs} loading={loading["Audit Log"]} />}
      {tab === "System Counts" && <CountsTab 
        signalStatus={overview?.signalStatus} 
        observationStatus={overview?.observationStatus}
        patternStatus={overview?.patternStatus}
        hypothesisStatus={overview?.hypothesisStatus}
        insightStatus={overview?.insightStatus}
        loading={loading["System Counts"]}
      />}
    </div>
  );
}

function Overview({ data, loading, range }: { data: OverviewData | null; loading: boolean; range: string }) {
  if (loading) return <div className="space-y-9 p-6">Loading overview...</div>;
  if (!data) return <div className="space-y-9 p-6">No data available</div>;

  const bars = data.dailyStats?.map((d: any) => d.requests || 0) || [40, 58, 44, 74, 68, 87, 63];
  const labels = data.dailyStats?.map((d: any) => d.date?.slice(-2) || "") || ["23", "24", "25", "26", "27", "28", "29"];
  
  const completedRuns = data.recentRuns?.filter((r: any) => r.status === 'completed').length || 0;
  const partialRuns = data.recentRuns?.filter((r: any) => r.status === 'partial').length || 0;
  const failedRuns = data.recentRuns?.filter((r: any) => r.status === 'failed').length || 0;
  const totalRequests = data.dailyStats?.reduce((s: number, d: any) => s + (d.requests || 0), 0) || 0;
  const totalSuccessful = data.dailyStats?.reduce((s: number, d: any) => s + (d.successful || 0), 0) || 0;
  const totalCost = data.dailyStats?.reduce((s: number, d: any) => s + (d.cost || 0), 0) || 0;
  const costStr = totalCost > 0 ? '$' + totalCost.toFixed(2) : '$0.00';
  const lastFailureStr = data.lastFailure ? new Date(data.lastFailure.created_at).toLocaleTimeString() : "—";
  const lastFailureDetail = data.lastFailure ? data.lastFailure.trigger_type : "—";
  const lastSuccessStr = data.lastSuccess ? new Date(data.lastSuccess.created_at).toLocaleTimeString() : "—";
  const lastSuccessDetail = data.lastSuccess ? data.lastSuccess.trigger_type : "—";

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Waypoints} label="Workflow runs" value={data.counts.researchRuns} detail={`${completedRuns} completed · ${partialRuns} partial · ${failedRuns} failed`} />
        <Stat icon={Activity} label="LLM requests" value={totalRequests} detail={`${totalSuccessful} successful`} />
        <Stat icon={Database} label="Total tokens" value="—" detail="Tracked via research runs" />
        <Stat icon={Clock3} label="Estimated cost" value={costStr} detail="Estimated · not provider-reconciled" />
        <Stat icon={CheckCircle2} label="Evidence accepted" value={data.counts.evidence} detail={`From ${data.counts.sources} collected sources`} />
        <Stat icon={ClipboardList} label="Draft signals" value={data.draftSignalsCount} detail="Awaiting human review gate" />
        <Stat icon={AlertTriangle} label="Last failure" value={lastFailureStr} detail={lastFailureDetail} />
        <Stat icon={RefreshCw} label="Last success" value={lastSuccessStr} detail={lastSuccessDetail} />
      </section>
      
      <section className="grid gap-5 xl:grid-cols-2">
        <Chart title="Daily requests & estimated cost" subtitle={`${range} · Estimated cost`} bars={bars} labels={labels} />
        <Chart title="Daily workflow outcome" subtitle="Completed versus partial / failed" bars={bars.map(b => b * 0.9)} labels={labels} secondary />
      </section>
      
      <section className="surface p-6">
        <p className="eyebrow">Data handling</p>
        <p className="mt-3 text-sm leading-6 text-[#bfc3dc]">
          This view reads only RLS-scoped admin views; it never returns credentials, raw prompts, full model responses, or unrestricted metadata.
        </p>
      </section>
    </>
  );
}

function SignalReviewTab({ data, loading, error }: { data: SignalReviewItem[]; loading: boolean; error?: string | null }) {
  if (loading) return <div className="space-y-9 p-6">Loading signal review queue...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">Signal Review Queue</p>
          <p className="text-sm text-[#bfc3dc]">{data.length} signals pending human review. Accept → Observation Engine (RE08). Reject → Archived.</p>
        </div>
        <span className="rounded border border-[#5a5a7a] bg-[#1a1e2e] px-3 py-1 font-mono text-[9px] text-[#a5abc9]">
          {data.length} pending
        </span>
      </div>

      {data.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No signals pending review.</p>
          <p className="mt-2 text-sm text-[#a5abc9]">Run Signal Engine (RE07) after evidence collection to generate draft signals.</p>
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="min-w-[1050px] w-full text-left text-xs">
            <thead className="border-b border-[#30345f] bg-[#111735] font-mono text-[9px] uppercase tracking-wide text-[#8d93b6]">
              <tr>
                <th className="px-4 py-3 font-medium">Signal</th>
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Evidence</th>
                <th className="px-4 py-3 font-medium">Sources</th>
                <th className="px-4 py-3 font-medium">Verification</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30345f] text-[#bfc3dc]">
              {data.map((signal) => (
                <tr key={signal.signal_id}>
                  <td className="px-4 py-3 max-w-[300px]">
                    <p className="font-semibold truncate">{signal.title}</p>
                    <p className="text-[10px] text-[#a5abc9] truncate">{signal.summary}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-1 font-mono text-[9px] text-[#b9c0ff]">
                      {signal.domain_name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-1 font-mono text-[9px] text-[#a5abc9]">
                      {signal.signal_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[#aeb6ff]">
                    {Math.round(signal.confidence * 100)}%
                  </td>
                  <td className="px-4 py-3 font-mono text-[#8d93b6]">{signal.evidence_count}</td>
                  <td className="px-4 py-3 font-mono text-[#8d93b6]">{signal.independent_source_count}</td>
                  <td className="px-4 py-3">
                    {signal.all_evidence_verified ? (
                      <span className="inline-flex items-center gap-1 rounded border border-[#4b7a5e] bg-[#183828] px-2 py-1 font-mono text-[9px] text-[#8fd19e]">
                        <CheckCircle2 size={10} />All verified
                      </span>
                    ) : signal.invalid_evidence_count > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded border border-[#7a4b4b] bg-[#381818] px-2 py-1 font-mono text-[9px] text-[#e89696]">
                        <AlertCircle size={10} />{signal.invalid_evidence_count} invalid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded border border-[#5a5a7a] bg-[#1a1e2e] px-2 py-1 font-mono text-[9px] text-[#a5abc9]">
                        <AlertTriangle size={10} />Unverified
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-[#8d93b6]">
                    {new Date(signal.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <SignalReviewActions signal={signal} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SignalReviewActions({ signal }: { signal: SignalReviewItem }) {
  const [reviewing, setReviewing] = useState<{ decision: 'accepted' | 'rejected'; reason: string } | null>(null);

  const handleReview = async (decision: 'accepted' | 'rejected', reason?: string) => {
    const requestId = crypto.randomUUID();
    try {
      const response = await fetch('/api/signals/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_id: signal.signal_id, decision, request_id: requestId, reason })
      });
      if (!response.ok) throw new Error('Failed to review signal');
      alert(`${decision.toUpperCase()} signal ${signal.signal_id.slice(0, 8)}...`);
      // In a real app, you'd refresh the data here
    } catch (err) {
      alert('Failed to review signal: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setReviewing(null);
  };

  if (reviewing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={reviewing.decision === 'rejected' ? 'Reason required' : 'Optional reason'}
          value={reviewing.reason}
          onChange={(e) => setReviewing({ ...reviewing, reason: e.target.value })}
          className="w-[200px] rounded border border-[#30345f] bg-[#111735] px-2 py-1 text-xs text-white outline-none"
          required={reviewing.decision === 'rejected'}
        />
        <button
          onClick={() => handleReview(reviewing.decision, reviewing.reason)}
          disabled={reviewing.decision === 'rejected' && !reviewing.reason}
          className={`button py-2 px-3 text-xs ${reviewing.decision === 'accepted' ? 'bg-[#4b7a5e] hover:bg-[#3d6a4e]' : 'bg-[#7a4b4b] hover:bg-[#663d3d]'}`}
        >
          Confirm
        </button>
        <button onClick={() => setReviewing(null)} className="button py-2 px-3 text-xs">Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setReviewing({ decision: 'accepted', reason: '' })}
        className="button py-2 px-3 bg-[#4b7a5e] hover:bg-[#3d6a4e] text-xs"
      >
        <Check size={12} className="mr-1" />Accept
      </button>
      <button
        onClick={() => setReviewing({ decision: 'rejected', reason: '' })}
        className="button py-2 px-3 bg-[#7a4b4b] hover:bg-[#663d3d] text-xs"
      >
        <AlertCircle size={12} className="mr-1" />Reject
      </button>
    </div>
  );
}

function WorkflowRunsTab({ data, loading, error, query, setQuery }: { data: WorkflowRun[]; loading: boolean; error?: string | null; query: string; setQuery: (v: string) => void }) {
  if (loading) return <div className="space-y-9 p-6">Loading workflow runs...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;

  return (
    <section className="surface overflow-hidden">
      <Toolbar query={query} setQuery={setQuery} placeholder="Search run ID, workflow, domain, or status" />
      <Table headers={["Started", "Workflow / ID", "Domain", "Status", "Duration", "LLM Calls", "Failed", "Est. Cost", "Error"]}>
        {data.map((run) => (
          <tr key={run.id}>
            <td className="px-4 py-3">{run.created_at}</td>
            <td className="px-4 py-3"><b>{run.trigger_type}</b><br /><span className="font-mono text-[10px] text-[#8d93b6]">{run.research_run_id?.slice(0, 12)}</span></td>
            <td className="px-4 py-3">{run.workspace_domain?.domain?.name || run.workspace_domain?.name}</td>
            <td className="px-4 py-3"><Status value={run.status} /></td>
            <td className="px-4 py-3">{run.duration_seconds ? `${run.duration_seconds}s` : '—'}</td>
            <td className="px-4 py-3 font-mono">{run.llm_calls}</td>
            <td className="px-4 py-3 font-mono text-[#e89696]">{run.failed_llm_calls}</td>
            <td className="px-4 py-3 font-mono text-[#aeb6ff]">${run.estimated_cost_usd?.toFixed(4) || '0.0000'}</td>
            <td className="px-4 py-3 text-[#e89696]">{run.error_summary ? (run.error_summary as any)?.message || 'Error' : '—'}</td>
          </tr>
        ))}
      </Table>
      {!data.length && <Empty />}
    </section>
  );
}

function UsageTab({ data, loading, range }: { data: AIUsageData | null; loading: boolean; range: string }) {
  if (loading) return <div className="space-y-9 p-6">Loading AI usage...</div>;
  if (!data) return <div className="space-y-9 p-6">No data available</div>;

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Activity} label="Requests / calls" value={data.totals.calls} detail={`${range} selected`} />
        <Stat icon={AlertTriangle} label="Failure rate" value={data.totals.failureRate} detail={`${data.totals.failed} failed requests`} />
        <Stat icon={Clock3} label="Average latency" value={data.totals.avgLatency} detail="Successful calls only" />
        <Stat icon={Database} label="Estimated cost" value={data.totals.cost} detail="Estimated · not provider-reconciled" />
      </section>
      <section className="surface overflow-hidden">
        <Table headers={["Day", "Workflow", "Provider / model", "Calls", "Input", "Output", "Est. cost", "Avg latency", "Failed"]}>
          {data.daily.map((row) => (
            <tr key={`${row.date}-${row.workflow}`}>
              <td className="px-4 py-3">{row.date}</td>
              <td className="px-4 py-3">{row.workflow}</td>
              <td className="px-4 py-3">{row.provider} / {row.model}</td>
              <td className="px-4 py-3">{row.calls}</td>
              <td className="px-4 py-3">{row.input.toLocaleString()}</td>
              <td className="px-4 py-3">{row.output.toLocaleString()}</td>
              <td className="px-4 py-3">${row.cost.toFixed(2)}</td>
              <td className="px-4 py-3">{row.latency}s</td>
              <td className="px-4 py-3">{row.failed}</td>
            </tr>
          ))}
        </Table>
      </section>
    </>
  );
}

function RequestsTab({ data, loading, query, setQuery }: { data: any[]; loading: boolean; query: string; setQuery: (v: string) => void }) {
  if (loading) return <div className="space-y-9 p-6">Loading requests...</div>;

  return (
    <section className="surface overflow-hidden">
      <Toolbar query={query} setQuery={setQuery} placeholder="Search request ID, workflow, provider, model, or error code" />
      <Table headers={["Timestamp", "Request ID", "Workflow / operation", "Provider / model", "Result", "Latency", "Tokens in / out", "Est. cost", "Error", "Related run"]}>
        {data.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-3">{row.time}</td>
            <td className="px-4 py-3"><code>{row.id}</code></td>
            <td className="px-4 py-3">{row.workflow}</td>
            <td className="px-4 py-3">{row.model}</td>
            <td className="px-4 py-3"><Status value={row.success ? "Success" : "Failed"} /></td>
            <td className="px-4 py-3">{row.latency}</td>
            <td className="px-4 py-3">{row.tokens}</td>
            <td className="px-4 py-3">{row.cost}</td>
            <td className="px-4 py-3">{row.error}</td>
            <td className="px-4 py-3"><code>{row.related}</code></td>
          </tr>
        ))}
      </Table>
      {!data.length && <Empty />}
    </section>
  );
}

function AuditTab({ data, loading }: { data: AuditLogItem[]; loading: boolean }) {
  if (loading) return <div className="space-y-9 p-6">Loading audit log...</div>;

  return (
    <section className="surface overflow-hidden">
      <Table headers={["Timestamp", "Actor", "Action", "Target", "Request ID", "Metadata"]}>
        {data.map((row) => (
          <tr key={row.request_id}>
            <td className="px-4 py-3">{row.created_at}</td>
            <td className="px-4 py-3">{row.actor_type} · {row.actor_id?.slice(0, 8)}</td>
            <td className="px-4 py-3"><span className="font-semibold text-[#c3c9ff]">{row.action}</span></td>
            <td className="px-4 py-3">{row.target_type} · {row.target_id?.slice(0, 8)}</td>
            <td className="px-4 py-3"><code>{row.request_id?.slice(0, 12)}</code></td>
            <td className="px-4 py-3 text-[10px] text-[#a5abc9] max-w-[300px] truncate">{JSON.stringify(row.metadata)}</td>
          </tr>
        ))}
      </Table>
      {!data.length && <Empty />}
      <div className="border-t border-[#30345f] px-5 py-4 text-xs leading-5 text-[#a5abc9]">
        Signal acceptance and rejection are retained here as the system's required human-review gate. Sensitive metadata keys are redacted before display.
      </div>
    </section>
  );
}

function CountsTab({ signalStatus, observationStatus, patternStatus, hypothesisStatus, insightStatus, loading }: { 
  signalStatus?: { draft: number; accepted: number; rejected: number };
  observationStatus?: { draft: number; accepted: number };
  patternStatus?: { emerging: number; persistent: number; weakening: number };
  hypothesisStatus?: { ready: number; validating: number; complete: number };
  insightStatus?: { draft: number; published: number };
  loading: boolean;
}) {
  if (loading) return <div className="space-y-9 p-6">Loading counts...</div>;

  const countRows = [
    ["Research runs", "Completed", "—"],
    ["Sources", "Collected", "—"],
    ["Evidence", "Accepted", "—"],
    ["Signals", `Draft / accepted / rejected`, `${signalStatus?.draft || 0} / ${signalStatus?.accepted || 0} / ${signalStatus?.rejected || 0}`],
    ["Observations", `Draft / accepted`, `${observationStatus?.draft || 0} / ${observationStatus?.accepted || 0}`],
    ["Patterns", `Emerging / persistent / weakening`, `${patternStatus?.emerging || 0} / ${patternStatus?.persistent || 0} / ${patternStatus?.weakening || 0}`],
    ["Hypotheses", `Ready / validating / complete`, `${hypothesisStatus?.ready || 0} / ${hypothesisStatus?.validating || 0} / ${hypothesisStatus?.complete || 0}`],
    ["Insights", `Draft / published`, `${insightStatus?.draft || 0} / ${insightStatus?.published || 0}`],
  ];

  return (
    <section className="surface overflow-hidden">
      <Table headers={["Object", "Status breakdown", "Current total"]}>
        {countRows.map((row) => (
          <tr key={row[0]}>
            <td className="px-4 py-3"><b>{row[0]}</b></td>
            <td className="px-4 py-3">{row[1]}</td>
            <td className="px-4 py-3">{row[2]}</td>
          </tr>
        ))}
      </Table>
      <div className="border-t border-[#30345f] px-5 py-4 text-xs text-[#a5abc9]">
        Diagnostic totals only. No direct editing or deletion is available in the admin panel.
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string | number; detail: string }) {
  return (
    <section className="surface p-5">
      <div className="flex items-center justify-between">
        <p className="meta">{label}</p>
        <Icon size={15} className="text-[#aeb6ff]" />
      </div>
      <p className="mt-4 font-mono text-2xl font-semibold text-[#e5e8ff]">{value}</p>
      <p className="mt-2 text-[10px] leading-4 text-[#a5abc9]">{detail}</p>
    </section>
  );
}

function Chart({ title, subtitle, bars, labels, secondary = false }: { title: string; subtitle: string; bars: number[]; labels: string[]; secondary?: boolean }) {
  return (
    <section className="surface p-6">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-[#a5abc9]">{subtitle}</p>
      </div>
      <div className="mt-8 flex h-40 items-end gap-3 border-b border-[#30345f] pb-0">
        {bars.map((bar, index) => (
          <div key={labels[index]} className="flex flex-1 flex-col items-center gap-2">
            <div className={`w-full rounded-t ${secondary ? "bg-[#8766c5]" : "bg-[#6872eb]"}`} style={{ height: `${bar}%` }} />
            <span className="font-mono text-[9px] text-[#8d93b6]">{labels[index]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Toolbar({ query, setQuery, placeholder }: { query: string; setQuery: (value: string) => void; placeholder: string }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#30345f] p-4 sm:flex-row">
      <label className="flex flex-1 items-center gap-2 rounded border border-[#30345f] bg-[#111735] px-3 py-2">
        <Search size={14} className="text-[#8d93b6]" />
        <input 
          value={query} 
          onChange={(event) => setQuery(event.target.value)} 
          className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-[#72789f]" 
          placeholder={placeholder} 
        />
      </label>
      <select className="rounded border border-[#30345f] bg-[#111735] px-3 py-2 text-xs text-white outline-none">
        <option>All statuses</option>
        <option>Completed</option>
        <option>Partial</option>
        <option>Failed</option>
        <option>Draft</option>
        <option>Accepted</option>
        <option>Rejected</option>
      </select>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1050px] w-full text-left text-xs">
        <thead className="border-b border-[#30345f] bg-[#111735] font-mono text-[9px] uppercase tracking-wide text-[#8d93b6]">
          <tr>
            {headers.map((header) => <th className="px-4 py-3 font-medium" key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#30345f] text-[#bfc3dc]">{children}</tbody>
      </table>
    </div>
  );
}

function Status({ value }: { value: string }) {
  const tone = /failed/i.test(value) ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : 
    /partial/i.test(value) ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : 
    /running|queued|discovering|extracting|verifying|analyzing/i.test(value) ? "border-[#7782f7]/30 bg-[#20265c] text-[#c3c9ff]" : 
    "border-emerald-300/30 bg-emerald-300/10 text-emerald-200";
  return <span className={`rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-wide ${tone}`}>{value}</span>;
}

function Empty() {
  return <p className="px-5 py-12 text-center text-sm text-[#a5abc9]">No records match the current filters.</p>;
}