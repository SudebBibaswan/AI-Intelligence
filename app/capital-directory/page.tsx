'use client'

import { useEffect, useState } from "react";
import { Building2, Filter, RefreshCw, Search, TrendingUp, Users } from "lucide-react";
import { useCapitalDirectory } from "@/lib/hooks/intelligence";
import { useWorkspace } from "@/lib/hooks/workspace";
import { CapitalDirectoryEntry } from "@/types/intelligence";

export default function CapitalDirectoryPage() {
  const { workspace, workspaceDomain, isLoading: workspaceLoading } = useWorkspace();
  const workspaceId = workspace?.id;
  const workspaceDomainId = workspaceDomain?.id;
  
  const { entities, isLoading: loading, error, mutate } = useCapitalDirectory(workspaceId || "", undefined, undefined, 200);
  const [filter, setFilter] = useState<{ entityType?: string; activityStatus?: string; search?: string }>({});

  if (workspaceLoading) return <div className="space-y-9 p-6">Loading workspace...</div>;
  if (loading) return <div className="space-y-9 p-6">Loading capital directory...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;
  if (!workspace || !workspaceDomain) return <div className="space-y-9 p-6">Please complete onboarding to set up your workspace.</div>;

  const filteredEntities = entities.filter((entity) => {
    if (filter.entityType && entity.entity_type !== filter.entityType) return false;
    if (filter.activityStatus && entity.activity_status !== filter.activityStatus) return false;
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      if (!entity.name.toLowerCase().includes(searchLower)) return false;
    }
    return true;
  });

  const active = filteredEntities.filter(e => e.activity_status === 'active_evidenced');
  const evidenced = filteredEntities.filter(e => e.activity_status === 'evidenced');
  const candidates = filteredEntities.filter(e => e.activity_status === 'candidate_unverified');
  
  const entityTypes = [...new Set(entities.map(e => e.entity_type))].sort();
  const ycEntities = filteredEntities.filter(e => 
    e.name.toLowerCase().includes('y combinator') || 
    e.name.toLowerCase().includes('ycombinator') ||
    e.entity_type === 'accelerator'
  );
  const vcEntities = filteredEntities.filter(e => 
    e.entity_type === 'vc_firm' || 
    e.entity_type === 'fund' ||
    e.entity_type === 'investor'
  );

  const handleRefresh = async () => {
    try {
      await mutate();
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  };

  return (
    <div className="space-y-9 p-6">
      <header className="flex flex-col justify-between gap-6 border-b border-[#30345f] pb-8 md:flex-row md:items-end">
        <div>
          <p className="eyebrow mb-3">Artificial Intelligence / Capital Directory</p>
          <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">VC & YC <em className="text-[#929aff]">entities.</em></h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
            Investors, funds, accelerators tracked with evidenced capital activity. YC companies and VC portfolios mapped to your domain.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} className="button">
            <RefreshCw size={14} />Refresh Directory
          </button>
        </div>
      </header>

      <div className="surface p-4 border-b border-[#30345f]">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d93b6]" />
            <input
              type="text"
              placeholder="Search entities..."
              value={filter.search || ""}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="w-full rounded border border-[#30345f] bg-[#111735] pl-10 pr-3 py-2 text-sm text-white outline-none focus:border-[#8993ff] placeholder:text-[#72789f]"
            />
          </div>
          
          <select
            value={filter.entityType || ""}
            onChange={(e) => setFilter({ ...filter, entityType: e.target.value || undefined })}
            className="rounded border border-[#30345f] bg-[#111735] px-3 py-2 text-sm text-white outline-none focus:border-[#8993ff]"
          >
            <option value="">All types</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>{type.replace('_', ' ')}</option>
            ))}
          </select>
          
          <select
            value={filter.activityStatus || ""}
            onChange={(e) => setFilter({ ...filter, activityStatus: e.target.value || undefined })}
            className="rounded border border-[#30345f] bg-[#111735] px-3 py-2 text-sm text-white outline-none focus:border-[#8993ff]"
          >
            <option value="">All statuses</option>
            <option value="active_evidenced">Active Evidenced</option>
            <option value="evidenced">Evidenced</option>
            <option value="candidate_unverified">Candidates</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface p-4 border-l-4 border-[#8fd19e]">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-[#8fd19e]" />
            <p className="text-xs font-semibold text-[#8fd19e]">Active Evidenced</p>
          </div>
          <p className="mt-2 font-display text-4xl">{active.length}</p>
          <p className="mt-1 text-xs text-[#a5abc9]">Recent capital activity with verified evidence</p>
        </div>
        <div className="surface p-4 border-l-4 border-[#b9c0ff]">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-[#b9c0ff]" />
            <p className="text-xs font-semibold text-[#b9c0ff]">Evidenced</p>
          </div>
          <p className="mt-2 font-display text-4xl">{evidenced.length}</p>
          <p className="mt-1 text-xs text-[#a5abc9]">Historical capital activity with evidence</p>
        </div>
        <div className="surface p-4 border-l-4 border-[#a5abc9]">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#a5abc9]" />
            <p className="text-xs font-semibold text-[#a5abc9]">YC & VC Candidates</p>
          </div>
          <p className="mt-2 font-display text-4xl">{ycEntities.length + vcEntities.length}</p>
          <p className="mt-1 text-xs text-[#a5abc9]">{ycEntities.length} YC · {vcEntities.length} VC firms</p>
        </div>
      </div>

      {filteredEntities.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No capital entities yet.</p>
          <p className="mt-2 text-sm text-[#a5abc9]">Run Capital Directory refresh to discover and track investors, funds, and accelerators in your domain.</p>
          <button onClick={handleRefresh} className="mt-4 button">
            <RefreshCw size={14} />Run Capital Directory Refresh
          </button>
        </div>
      ) : (
        <>
          {(ycEntities.length > 0 || vcEntities.length > 0) && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp size={18} className="text-[#aeb6ff]" />
                YC Accelerators & VC Firms
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...ycEntities, ...vcEntities].map((entity) => (
                  <CapitalEntityCard key={entity.entity_id} entity={entity} />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">All Capital Entities</h2>
            <div className="space-y-4">
              {filteredEntities.map((entity) => (
                <CapitalEntityRow key={entity.entity_id} entity={entity} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function CapitalEntityCard({ entity }: { entity: CapitalDirectoryEntry }) {
  const isYC = entity.name.toLowerCase().includes('y combinator') || entity.name.toLowerCase().includes('ycombinator');
  const isVC = entity.entity_type === 'vc_firm' || entity.entity_type === 'fund' || entity.entity_type === 'investor';
  
  return (
    <div className="surface p-5 hover:border-[#7076f6] transition">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#20275a] font-mono text-xs font-semibold text-[#aeb6ff]">
            {isYC ? 'YC' : isVC ? 'VC' : entity.entity_type.slice(0,2).toUpperCase()}
          </span>
          <div>
            <h3 className="font-semibold">{entity.name}</h3>
            <p className="text-xs text-[#a5abc9]">{entity.entity_type.replace('_', ' ')} · {entity.registry_country || 'Global'}</p>
          </div>
        </div>
        <span className={`rounded border px-2 py-1 font-mono text-[9px] uppercase shrink-0 ${
          entity.activity_status === 'active_evidenced' ? 'border-[#4b7a5e] bg-[#183828] text-[#8fd19e]' :
          entity.activity_status === 'evidenced' ? 'border-[#b9c0ff] bg-[#182048] text-[#b9c0ff]' :
          'border-[#5a5a7a] bg-[#1a1e2e] text-[#a5abc9]'
        }`}>
          {entity.activity_status.replace('_', ' ')}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm border-t border-[#30345f] pt-4">
        <div><p className="text-xs text-[#8d93b6]">Evidence</p><p className="font-mono text-lg">{entity.evidence_count}</p></div>
        <div><p className="text-xs text-[#8d93b6]">Relationships</p><p className="font-mono text-lg">{entity.capital_relationship_count}</p></div>
        <div><p className="text-xs text-[#8d93b6]">Last activity</p><p className="font-mono text-lg">{entity.last_capital_activity_at ? new Date(entity.last_capital_activity_at).toLocaleDateString() : 'Never'}</p></div>
      </div>
    </div>
  );
}

function CapitalEntityRow({ entity }: { entity: CapitalDirectoryEntry }) {
  return (
    <div className="surface p-4 hover:border-[#7076f6] transition">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid h-8 w-8 place-items-center rounded bg-[#20275a] font-mono text-xs font-semibold text-[#aeb6ff] shrink-0">
            {entity.entity_type.slice(0,2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{entity.name}</h3>
            <p className="text-xs text-[#a5abc9]">{entity.entity_type.replace('_', ' ')} · {entity.registry_country || 'Global'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`rounded border px-2 py-1 font-mono text-[9px] uppercase ${
            entity.activity_status === 'active_evidenced' ? 'border-[#4b7a5e] bg-[#183828] text-[#8fd19e]' :
            entity.activity_status === 'evidenced' ? 'border-[#b9c0ff] bg-[#182048] text-[#b9c0ff]' :
            'border-[#5a5a7a] bg-[#1a1e2e] text-[#a5abc9]'
          }`}>
            {entity.activity_status.replace('_', ' ')}
          </span>
          <div className="hidden sm:flex items-center gap-4 text-sm font-mono text-[#8d93b6]">
            <span>{entity.evidence_count} evidence</span>
            <span>{entity.capital_relationship_count} rels</span>
            <span>{entity.last_capital_activity_at ? new Date(entity.last_capital_activity_at).toLocaleDateString() : 'Never'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}