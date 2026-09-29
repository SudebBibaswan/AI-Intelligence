"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Building2, CircleAlert, Landmark, MapPin, Users, ExternalLink } from "lucide-react";
import { Entity, CapitalFlowMapping, Evidence, Source } from "@/types/intelligence";

interface CompanyData {
  entity: Entity;
  capitalFlows: CapitalFlowMapping[];
  evidence: { evidence: Evidence & { verification_status?: string } }[];
}

export function CompanyDetail({ id }: { id: string }) {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCompany() {
      try {
        const response = await fetch(`/api/companies/${id}`);
        if (!response.ok) {
          if (response.status === 404) throw new Error("Company not found");
          throw new Error("Failed to load company");
        }
        const data = await response.json();
        setCompany(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load company");
      } finally {
        setLoading(false);
      }
    }
    loadCompany();
  }, [id]);

  if (loading) return <div className="space-y-9 p-6">Loading company...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;
  if (!company) return <div className="space-y-9 p-6">Company not found</div>;

  const { entity, capitalFlows, evidence } = company;
  const attrs = entity.attributes as Record<string, unknown> | undefined;
  const latestRound = capitalFlows[0];
  const totalFunding = capitalFlows.reduce((sum, cf) => sum + (cf.check_size_max_usd || 0), 0);
  const leadInvestor = latestRound?.thesis?.entity?.name || (attrs?.lead_investor as string) || "Unknown";
  const geography = (attrs?.headquarters as string) || (attrs?.geography as string) || "Global";
  const website = attrs?.website ? String(attrs.website) : null;

  return (
    <div className="space-y-9">
      <Link href="/investments" className="inline-flex items-center gap-1 text-xs font-semibold text-[#aeb6ff] hover:text-white">
        <ArrowLeft size={14} />Back to investments
      </Link>
      <header className="border-b border-[#30345f] pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">Company profile</span>
          <span className="rounded border border-[#4b559b] bg-[#182048] px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-[#b9c0ff]">
            {(attrs?.ai_domain as string) || entity.entity_type}
          </span>
        </div>
        <h1 className="mt-5 font-display text-5xl leading-[.98] sm:text-6xl">{entity.name}</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-[#bfc3dc]">
          {(attrs?.description as string) || (attrs?.summary as string) || "No description available."}
        </p>
        {entity.canonical_url && (
          <a href={entity.canonical_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#aeb6ff] hover:text-white">
            <ExternalLink size={12} />Website
          </a>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Landmark} label="Latest round" value={latestRound?.stage_tags?.[0] || "Unknown"} />
        <Stat icon={Building2} label="Total tracked funding" value={`$${(totalFunding / 1000000).toFixed(1)}m`} />
        <Stat icon={Users} label="Lead investor" value={leadInvestor} />
        <Stat icon={MapPin} label="Geography" value={geography} />
      </section>

      <section className="grid gap-7 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <div className="space-y-7">
          <section className="surface p-6 sm:p-7">
            <p className="eyebrow">Funding history</p>
            <div className="mt-5 overflow-x-auto">
              <div className="min-w-[500px]">
                <div className="grid grid-cols-4 gap-4 border-b border-[#30345f] pb-3 font-mono text-[9px] uppercase tracking-wide text-[#8d93b6]">
                  <span>Round</span><span>Amount</span><span>Announced</span><span>Lead investor</span>
                </div>
                {capitalFlows.length === 0 ? (
                  <div className="py-8 text-center text-[#a5abc9]">No funding rounds tracked yet.</div>
                ) : (
                  capitalFlows.map((cf) => (
                    <div className="grid grid-cols-4 gap-4 border-b border-[#30345f] py-4 text-xs last:border-0" key={cf.id}>
                      <span className="font-semibold text-white">{cf.stage_tags?.[0] || "Unknown"}</span>
                      <span className="font-mono font-semibold text-[#aeb6ff]">${((cf.check_size_max_usd || 0) / 1000000).toFixed(1)}m</span>
                      <span className="text-[#bfc3dc]">{cf.created_at ? new Date(cf.created_at).toLocaleDateString() : "N/A"}</span>
                      <span className="text-[#bfc3dc]">{cf.thesis?.entity?.name || "Unknown"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="surface p-6 sm:p-7">
            <p className="eyebrow">Investment context</p>
            <p className="mt-4 font-mono text-3xl text-[#d0b2ed]">
              {capitalFlows.length > 0 ? `${capitalFlows.length} capital flow matches` : "No matches"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#bfc3dc]">
              {(attrs?.thesis as string) || "This company appears in capital flow mappings derived from evidence-backed patterns and theses in your workspace."}
            </p>
          </section>

          {evidence.length > 0 && (
            <section className="surface p-6 sm:p-7">
              <p className="eyebrow">Supporting evidence</p>
              <div className="mt-4 space-y-3">
                {evidence.slice(0, 5).map((item, index) => (
                  <article className="surface flex gap-4 p-4" key={`${entity.id}-ev-${index}`}>
                    <span className="font-mono text-xs text-[#aeb6ff]">E{index + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold leading-5">{item.evidence.source?.title || "Source"}</p>
                      <p className="mt-1 text-xs text-[#a5abc9] line-clamp-2">{item.evidence.claim_text}</p>
                      <p className="mt-2 font-mono text-[10px] text-[#8d93b6]">
                        {item.evidence.source?.publisher} · {item.evidence.verification_status || 'unverified'} · {Math.round(item.evidence.confidence * 100)}% confidence
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {capitalFlows.length > 0 && (
            <section className="surface p-6 sm:p-7">
              <p className="eyebrow">Capital flow matches</p>
              <div className="mt-4 space-y-3">
                {capitalFlows.slice(0, 5).map((cf) => (
                  <Link key={cf.id} href={`/patterns/${cf.pattern_id}`} className="surface flex gap-4 p-4 transition hover:border-teal/50">
                    <Layers3 size={16} className="mt-0.5 shrink-0 text-[#aeb6ff]" />
                    <div>
                      <p className="text-sm font-semibold">{cf.pattern?.title || "Pattern match"}</p>
                      <p className="mt-1 text-xs text-[#a5abc9]">Match: {cf.match_type} · {Math.round(cf.match_confidence * 100)}% confidence</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="surface p-6">
            <p className="eyebrow">Entity details</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-[#a5abc9]">Type</span><span className="font-semibold">{entity.entity_type}</span></div>
              <div className="flex justify-between"><span className="text-[#a5abc9]">Resolution</span><span className="font-semibold capitalize">{entity.resolution_status || 'provisional'}</span></div>
              {entity.wikidata_qid && (
                <div className="flex justify-between"><span className="text-[#a5abc9]">Wikidata</span><span className="font-mono text-[#aeb6ff]">{entity.wikidata_qid}</span></div>
              )}
              {website && (
                <div className="flex justify-between"><span className="text-[#a5abc9]">Website</span><span className="font-mono text-[#aeb6ff] truncate max-w-[150px]">{website}</span></div>
              )}
            </div>
          </section>

          <section className="surface p-6">
            <p className="eyebrow">Relationships</p>
            <p className="mt-3 text-sm leading-6 text-[#bfc3dc]">
              {(entity as any).relationships?.length || 0} relationships tracked.{" "}
              <Link href={`/entities/${entity.id}`} className="text-[#aeb6ff] hover:underline">View graph</Link>
            </p>
          </section>
        </aside>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Landmark; label: string; value: string }) {
  return (
    <section className="surface p-5">
      <Icon size={16} className="text-[#aeb6ff]" />
      <p className="mt-5 font-mono text-2xl font-semibold text-[#c3c9ff]">{value}</p>
      <p className="mt-2 text-xs font-semibold text-white">{label}</p>
    </section>
  );
}

function Layers3({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4.05V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5.05A2.85 2.83 0 0 1 5.08 3h14a2 2 0 0 0 0-4Z" />
      <path d="M8 11V3m0 0 4 4m0-4-4 4" />
    </svg>
  );
}