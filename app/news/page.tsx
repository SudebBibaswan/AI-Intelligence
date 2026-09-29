'use client'

import { useEffect, useState } from "react";
import { Filter, RefreshCw, ExternalLink, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useWorkspace } from "@/lib/hooks/workspace";
import { Source, Evidence } from "@/types/intelligence";

interface FeedItem {
  id: string;
  type: 'source';
  title: string;
  publisher: string;
  url: string;
  sourceType: string;
  publishedAt: string;
  discoveredAt: string;
  qualityScore: number | null;
  extractionStatus: string;
  evidenceCount: number;
  verifiedEvidenceCount: number;
  topClaims: string[];
  entities: { id: string; name: string; entity_type: string }[];
  triggerType: string;
}

export default function NewsFeedPage() {
  const { workspace, workspaceDomain, isLoading: workspaceLoading } = useWorkspace();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ sourceType?: string; verificationStatus?: string }>({});
  const [refreshing, setRefreshing] = useState(false);

  const workspaceId = workspace?.id;
  const workspaceDomainId = workspaceDomain?.id;

  const loadFeed = async () => {
    if (!workspaceId || !workspaceDomainId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        domain_id: workspaceDomainId,
        limit: '50',
      });
      
      if (filter.sourceType) params.append('source_type', filter.sourceType);
      if (filter.verificationStatus) params.append('verification_status', filter.verificationStatus);
      
      const response = await fetch(`/api/news?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load feed');
      
      const data = await response.json();
      setFeed(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!workspaceLoading) {
      loadFeed();
    }
  }, [workspaceId, workspaceDomainId, workspaceLoading, filter]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  const sourceTypes = ['article', 'company_page', 'fund_page', 'portfolio_page', 'paper', 'filing', 'repository', 'transcript', 'video', 'post', 'dataset', 'press_release', 'job_posting', 'regulatory_notice'];

  if (workspaceLoading) return <div className="space-y-9 p-6">Loading workspace...</div>;
  if (loading) return <div className="space-y-9 p-6">Loading news feed...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;
  if (!workspace || !workspaceDomain) return <div className="space-y-9 p-6">Please complete onboarding to set up your workspace.</div>;

  return (
    <div className="space-y-9 p-6">
      <header className="flex flex-col justify-between gap-6 border-b border-[#30345f] pb-8 md:flex-row md:items-end">
        <div>
          <p className="eyebrow mb-3">Artificial Intelligence / News Feed</p>
          <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Latest <em className="text-[#929aff]">intelligence.</em></h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
            Real-time evidence feed from your domain sources. Filter by source type and verification status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} disabled={refreshing} className="button">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />Refresh
          </button>
          <span className="inline-flex w-fit items-center gap-2 rounded border border-[#4b559b] bg-[#182048] px-3 py-2 font-mono text-[10px] text-[#b9c0ff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8993ff]" />
            {feed.length} sources
          </span>
        </div>
      </header>

      <div className="surface p-4 border-b border-[#30345f]">
        <div className="flex flex-wrap gap-3">
          <select
            value={filter.sourceType || ""}
            onChange={(e) => setFilter({ ...filter, sourceType: e.target.value || undefined })}
            className="rounded border border-[#30345f] bg-[#111735] px-3 py-2 text-sm text-white outline-none focus:border-[#8993ff]"
          >
            <option value="">All source types</option>
            {sourceTypes.map((type) => (
              <option key={type} value={type}>{type.replace('_', ' ')}</option>
            ))}
          </select>
          
          <select
            value={filter.verificationStatus || ""}
            onChange={(e) => setFilter({ ...filter, verificationStatus: e.target.value || undefined })}
            className="rounded border border-[#30345f] bg-[#111735] px-3 py-2 text-sm text-white outline-none focus:border-[#8993ff]"
          >
            <option value="">All verification statuses</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="disputed">Disputed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {feed.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No sources yet.</p>
          <p className="mt-2 text-sm text-[#a5abc9]">Run a research scan to discover and extract intelligence from your domain.</p>
          <button onClick={handleRefresh} className="mt-4 button">
            <RefreshCw size={14} />Run Research Scan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {feed.map((item) => (
            <article key={item.id} className="surface p-5 hover:border-[#7076f6] transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-[#a5abc9]">
                      {item.sourceType.replace('_', ' ')}
                    </span>
                    <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-1 font-mono text-[9px] text-[#a5abc9]">
                      {item.extractionStatus}
                    </span>
                    {item.verifiedEvidenceCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded border border-[#4b7a5e] bg-[#183828] px-2 py-1 font-mono text-[9px] text-[#8fd19e]">
                        <CheckCircle2 size={10} />{item.verifiedEvidenceCount} verified
                      </span>
                    )}
                    {item.evidenceCount > item.verifiedEvidenceCount && (
                      <span className="inline-flex items-center gap-1 rounded border border-[#7a4b4b] bg-[#381818] px-2 py-1 font-mono text-[9px] text-[#e89696]">
                        <AlertCircle size={10} />{item.evidenceCount - item.verifiedEvidenceCount} unverified
                      </span>
                    )}
                    <span className="meta ml-auto">{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : new Date(item.discoveredAt).toLocaleDateString()}</span>
                  </div>
                  
                  <h3 className="font-semibold text-lg leading-snug">{item.title}</h3>
                  <p className="mt-1 text-sm text-[#a5abc9]">{item.publisher} · {item.triggerType || 'manual'} discovery</p>
                  
                  {item.topClaims.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {item.topClaims.map((claim, idx) => (
                        <p key={idx} className="text-xs text-[#bfc3dc] line-clamp-1">→ {claim}</p>
                      ))}
                    </div>
                  )}
                  
                  {item.entities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.entities.slice(0, 5).map((entity) => (
                        <span key={entity.id} className="rounded border border-[#30345f] bg-[#111735] px-2 py-1 text-xs text-[#a5abc9]">
                          {entity.name} ({entity.entity_type})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button py-2 px-3 text-xs"
                  >
                    <ExternalLink size={12} />Open source
                  </a>
                  {item.qualityScore && (
                    <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-1 font-mono text-[9px] text-[#a5abc9]">
                      Quality: {Math.round(item.qualityScore * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}