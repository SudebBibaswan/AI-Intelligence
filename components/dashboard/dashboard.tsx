"use client";

import Link from "next/link";
import { ArrowRight, CircleAlert, Layers3 } from "lucide-react";
import { useState } from "react";
import { dashboardSnapshot, patterns, signals } from "@/lib/mock-data/dashboard";

const signalLabels = { funding: "Investment", product: "Product", research: "Research", market: "Market" };

export function Dashboard() {
  const [section, setSection] = useState("Overview");
  const domain = "Artificial Intelligence";
  const sections = ["Overview", "Emerging patterns"];
  return <div className="space-y-9">
    <section className="flex flex-col justify-between gap-6 border-b border-line pb-8 md:flex-row md:items-end">
      <div><p className="eyebrow mb-3">Workspace / Daily brief</p><h1 className="max-w-3xl font-display text-5xl leading-[0.98] tracking-[-0.025em] sm:text-6xl">{domain}.<br /><em className="text-[#929aff]">Follow the capital.</em></h1><p className="mt-4 max-w-xl text-sm leading-7 text-[#bfc3dc]">Investment concentration, research activity, and evidence-backed market shifts in your selected domain.</p></div>
      <div className="surface flex items-center gap-3 px-4 py-3"><span className="h-2 w-2 rounded-full bg-emerald-600" /><div><p className="text-xs font-semibold">Research health: {dashboardSnapshot.health}</p><p className="meta mt-1">Source cutoff: {dashboardSnapshot.sourceCutoffAt}</p></div></div>
    </section>

    <div className="flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Domain intelligence views">{sections.map((item) => <button key={item} role="tab" aria-selected={section === item} onClick={() => setSection(item)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold ${section === item ? "border-teal text-teal" : "border-transparent text-slate-500 hover:text-ink"}`}>{item}</button>)}</div>

    <section className="surface grid grid-cols-2 divide-x divide-y divide-line md:grid-cols-4 md:divide-y-0">
      <Metric value={dashboardSnapshot.counts.newSignals} label="New signals" note="Since yesterday" /><Metric value={dashboardSnapshot.counts.patterns} label="Emerging patterns" note="Across 11 observations" /><Metric value={dashboardSnapshot.counts.hypotheses} label="Active hypotheses" note="One needs a decision" /><Metric value={dashboardSnapshot.counts.validations} label="Validation review" note="Ready to inspect" />
    </section>

    {section !== "Research activity" && <section className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
      <div><SectionTitle title="What changed" subtitle="Evidence-backed developments ranked for your workspace" href="/signals" />
        <div className="surface overflow-hidden px-5 sm:px-7">{signals.map((signal) => <article className="group border-b border-line py-5 last:border-0" key={signal.id}><div className="flex items-start justify-between gap-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="eyebrow">{signalLabels[signal.type]}</span><span className="meta">{signal.topic}</span>{signal.hasCounterEvidence && <span className="inline-flex items-center gap-1 rounded border border-[#705779] bg-[#241a37] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[#c7a8ea]"><CircleAlert size={10} />Counter-evidence</span>}</div><h2 className="mt-2 text-[15px] font-semibold leading-snug transition group-hover:text-[#929aff]">{signal.title}</h2><p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#bfc3dc]">{signal.summary}</p><div className="meta mt-3 flex flex-wrap gap-x-4 gap-y-1"><span>{signal.publishedAt}</span><span>{signal.evidenceCount} evidence items</span><span>{signal.confidence} confidence</span></div></div><Link href={`/signals/${signal.id}`} aria-label={`Inspect ${signal.title}`} className="mt-5 shrink-0 text-[#929aff] opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100"><ArrowRight size={17} /></Link></div></article>)}</div>
      </div>
      <aside className="space-y-8"><div><SectionTitle title="Emerging patterns" subtitle="Interpretations, not conclusions" href="/patterns" />
        <div className="space-y-3">{patterns.map((pattern) => <Link className="surface block p-5 transition hover:-translate-y-0.5 hover:border-teal/50" href={`/patterns/${pattern.id}`} key={pattern.id}><div className="flex items-start justify-between gap-4"><span className="eyebrow">Strength {pattern.strength}</span><Layers3 size={15} className="text-teal" /></div><h2 className="mt-3 font-display text-2xl leading-[1.05]">{pattern.statement}</h2><p className="meta mt-4">{pattern.window} · {pattern.observations} observations · {pattern.counterSignals} counter-signals</p></Link>)}</div></div>
      </aside>
    </section>}

  </div>;
}

function Metric({ value, label, note }: { value: number; label: string; note: string }) { return <div className="p-5 sm:p-6"><p className="font-mono text-3xl font-semibold tracking-tight text-[#aeb6ff]">{value}</p><p className="mt-2 text-xs font-semibold text-white">{label}</p><p className="mt-1 font-mono text-[10px] text-[#a5abc9]">{note}</p></div>; }
function SectionTitle({ title, subtitle, href }: { title: string; subtitle: string; href: string }) { return <div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-lg font-semibold tracking-tight">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><Link className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline" href={href}>View all <ArrowRight size={13} /></Link></div>; }
