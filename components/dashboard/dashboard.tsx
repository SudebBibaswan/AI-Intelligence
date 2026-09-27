"use client";

import Link from "next/link";
import { ArrowRight, Bookmark, CircleAlert, Layers3, Sparkles } from "lucide-react";
import { useState } from "react";
import { dashboardSnapshot, patterns, signals } from "@/lib/mock-data/dashboard";

const signalLabels = { funding: "Investment", product: "Product", research: "Research", market: "Market" };

export function Dashboard() {
  const [section, setSection] = useState("Overview");
  const [domain, setDomain] = useState("Artificial Intelligence");
  const sections = ["Overview", "Investment activity", "Emerging patterns"];
  const sectors = [
    ["Agent infrastructure", "$284m", "38% of tracked funding"],
    ["AI evaluation", "$146m", "24% of tracked funding"],
    ["AI security", "$92m", "16% of tracked funding"],
    ["Vertical AI", "$74m", "11% of tracked funding"],
  ];
  return <div className="space-y-9">
    <section className="flex flex-col justify-between gap-6 border-b border-line pb-8 md:flex-row md:items-end">
      <div><p className="eyebrow mb-3">Workspace / Daily brief</p><div className="flex flex-wrap items-center gap-3"><h1 className="max-w-3xl font-display text-5xl leading-[0.98] tracking-[-0.025em] sm:text-6xl">{domain}.<br /><em className="text-[#929aff]">Follow the capital.</em></h1><select aria-label="Selected research domain" value={domain} onChange={(event) => setDomain(event.target.value)} className="rounded-md border border-[#30345f] bg-[#111735] px-3 py-2 text-xs font-semibold text-white outline-none focus:border-[#8993ff]"><option>Artificial Intelligence</option><option>Financial Technology</option><option>Climate & Energy</option><option>Healthcare</option></select></div><p className="mt-4 max-w-xl text-sm leading-7 text-[#bfc3dc]">Investment concentration, research activity, and evidence-backed market shifts in your selected domain.</p></div>
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

    {(section === "Overview" || section === "Investment activity") && <section className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]"><div><SectionTitle title="Where investment is concentrating" subtitle="Tracked funding by AI sector · illustrative workspace fixture" href="/investments" /><div className="surface p-5 sm:p-7"><div className="grid gap-3 sm:grid-cols-2">{sectors.map(([name, amount, note], index) => <article className="rounded-md border border-line p-4" key={name}><div className="flex items-center justify-between"><p className="text-xs font-semibold">{name}</p><span className="font-mono text-xs text-[#929aff]">{amount}</span></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-[#1e254c]"><div className="h-full bg-[#7076f6]" style={{ width: `${[88, 64, 46, 32][index]}%` }} /></div><p className="meta mt-2">{note}</p></article>)}</div><div className="mt-6 overflow-x-auto border-t border-line pt-5"><div className="min-w-[520px]"><div className="grid grid-cols-[1.3fr_.8fr_.75fr_.75fr] gap-4 border-b border-line pb-3 font-mono text-[9px] uppercase tracking-wide text-slate-400"><span>Company</span><span>Sector</span><span>Round</span><span>Funding</span></div>{[["Synth Grid", "Agent infrastructure", "Series A", "$54m"], ["Proofwork", "AI evaluation", "Seed", "$18m"], ["Guardrail Systems", "AI security", "Series A", "$36m"]].map((row) => <div className="grid grid-cols-[1.3fr_.8fr_.75fr_.75fr] gap-4 border-b border-line py-4 text-xs" key={row[0]}>{row.map((cell, cellIndex) => <span className={cellIndex === 0 ? "font-semibold" : "text-[#bfc3dc]"} key={cell}>{cell}</span>)}</div>)}</div></div></div></div><aside className="surface p-6"><p className="eyebrow">Investor lens</p><h2 className="mt-3 font-display text-3xl leading-tight">Capital is flowing into the control layer around AI adoption.</h2><p className="mt-3 text-sm leading-6 text-[#bfc3dc]">This is an inference from recorded investments and signals—not a market forecast. Review the evidence before acting on it.</p><Link className="button mt-6" href="/investments">Inspect investment evidence <ArrowRight size={14} /></Link></aside></section>}

    <section className="surface border-l-[3px] border-l-[#7076f6] p-6 sm:p-8"><div className="flex items-center gap-2 text-[#aeb6ff]"><Sparkles size={16} /><p className="eyebrow text-[#aeb6ff]">Next investigation</p></div><h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight">Challenge a thesis, not just a hunch.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#bfc3dc]">Create a hypothesis from a pattern, state its assumptions, and inspect both supporting and contradictory evidence.</p><Link className="button mt-6" href="/hypotheses/new"><Bookmark size={14} />Create hypothesis</Link></section>
  </div>;
}

function Metric({ value, label, note }: { value: number; label: string; note: string }) { return <div className="p-5 sm:p-6"><p className="font-mono text-3xl font-semibold tracking-tight text-[#aeb6ff]">{value}</p><p className="mt-2 text-xs font-semibold text-white">{label}</p><p className="mt-1 font-mono text-[10px] text-[#a5abc9]">{note}</p></div>; }
function SectionTitle({ title, subtitle, href }: { title: string; subtitle: string; href: string }) { return <div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-lg font-semibold tracking-tight">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><Link className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline" href={href}>View all <ArrowRight size={13} /></Link></div>; }
