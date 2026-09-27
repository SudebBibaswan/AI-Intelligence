"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, CircleAlert, Filter, Search } from "lucide-react";
import { useState } from "react";

const sectors = [
  ["Agent infrastructure", "$284m", 38, "Policy, runtime control, and orchestration"],
  ["AI evaluation", "$146m", 24, "Testing, monitoring, and observability"],
  ["AI security", "$92m", 16, "Governance, security, and compliance"],
  ["Vertical AI", "$74m", 11, "Industry-specific AI workflows"],
];

const rounds = [
  ["Synth Grid", "Agent infrastructure", "Series A", "$54m", "Northzone · Global", "Today"],
  ["Guardrail Systems", "AI security", "Series A", "$36m", "Accel · India", "Yesterday"],
  ["Proofwork", "AI evaluation", "Seed", "$18m", "Lightspeed · Global", "Sep 25"],
  ["Atlas Context", "Agent infrastructure", "Seed", "$12m", "Peak XV · India", "Sep 24"],
  ["Fieldwise", "Vertical AI", "Seed", "$8m", "General Catalyst · Global", "Sep 22"],
];

export function InvestmentActivity() {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("Last 30 days");
  const visibleRounds = rounds.filter((round) => round.join(" ").toLowerCase().includes(query.toLowerCase()));

  return <div className="space-y-9"><header className="flex flex-col justify-between gap-6 border-b border-[#30345f] pb-8 md:flex-row md:items-end"><div><p className="eyebrow mb-3">Artificial Intelligence / Investment intelligence</p><h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Where capital is <em className="text-[#929aff]">concentrating.</em></h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">Funding activity is a signal, not proof of demand. Inspect the underlying sources before treating a concentration as a market conclusion.</p></div><span className="inline-flex w-fit items-center gap-2 rounded border border-[#4b559b] bg-[#182048] px-3 py-2 font-mono text-[10px] text-[#b9c0ff]"><span className="h-1.5 w-1.5 rounded-full bg-[#8993ff]" />Source cutoff: Today, 07:30 UTC</span></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{sectors.map(([name, amount, share, detail]) => <article className="surface p-5" key={name}><p className="text-xs font-semibold text-white">{name}</p><div className="mt-5 flex items-end justify-between gap-3"><p className="font-mono text-2xl font-semibold text-[#aeb6ff]">{amount}</p><p className="font-mono text-[10px] text-[#a5abc9]">{share}% share</p></div><div className="mt-3 h-1.5 overflow-hidden rounded bg-[#202750]"><div className="h-full bg-[#7076f6]" style={{ width: `${share}%` }} /></div><p className="mt-3 text-xs leading-5 text-[#a5abc9]">{detail}</p></article>)}</section>
    <section className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]"><div><div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-lg font-semibold">Recent funding activity</h2><p className="mt-1 text-xs text-[#a5abc9]">Workspace-scoped investment signals with available source lineage</p></div><div className="flex gap-2"><button className="button" onClick={() => setPeriod(period === "Last 30 days" ? "Last 90 days" : "Last 30 days")}><Filter size={14} />{period}<ChevronDown size={13} /></button></div></div><div className="surface overflow-hidden"><div className="flex items-center gap-2 border-b border-[#30345f] px-5 py-4"><Search size={15} className="text-[#8d93b6]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company, sector, or investor" className="w-full bg-transparent text-xs text-white outline-none placeholder:text-[#72789f]" /></div><div className="overflow-x-auto"><div className="min-w-[680px] px-5"><div className="grid grid-cols-[1.3fr_1fr_.7fr_.65fr_1.15fr_.6fr] gap-4 border-b border-[#30345f] py-3 font-mono text-[9px] uppercase tracking-wide text-[#8d93b6]"><span>Company</span><span>Sector</span><span>Round</span><span>Funding</span><span>Investor / Geography</span><span>Date</span></div>{visibleRounds.map((round) => <Link href="/signals/sig-agent-control" className="grid grid-cols-[1.3fr_1fr_.7fr_.65fr_1.15fr_.6fr] gap-4 border-b border-[#30345f] py-4 text-xs transition last:border-0 hover:bg-[#151a39]" key={round[0]}>{round.map((cell, index) => <span className={index === 0 ? "font-semibold text-white" : index === 3 ? "font-mono text-[#aeb6ff]" : "text-[#bfc3dc]"} key={cell}>{cell}</span>)}</Link>)}</div></div></div></div><aside className="space-y-6"><section className="surface p-6"><p className="eyebrow">Investor lens</p><h2 className="mt-3 font-display text-3xl leading-tight">Control and evaluation layers are receiving disproportionate attention.</h2><p className="mt-3 text-sm leading-6 text-[#bfc3dc]">The observed funding concentration aligns with increased activity in agent deployment. It remains an inference, and counter-signals are being tracked.</p><div className="mt-5 flex items-start gap-2 border-t border-[#30345f] pt-4 text-xs leading-5 text-[#c7a8ea]"><CircleAlert size={14} className="mt-0.5 shrink-0" />Incumbent expansion may reduce whitespace for standalone products.</div><Link href="/signals/sig-agent-control" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[#aeb6ff] hover:underline">Review related evidence <ArrowRight size={13} /></Link></section><section className="surface p-6"><p className="eyebrow">Research question</p><p className="mt-3 text-sm font-semibold leading-6">Is funding momentum translating into sustained enterprise demand?</p><button className="button mt-5 w-full">Start a validation</button></section></aside></section>
  </div>;
}
