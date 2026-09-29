'use client'

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, ChevronDown, CircleAlert, Database, Filter, Search } from "lucide-react";
import { useInvestments } from "@/lib/hooks/intelligence";
import { demoInvestments, type DemoInvestment } from "@/lib/mock-data/demo-intelligence";

export function InvestmentActivity() {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("Last 30 days");
  const [workspaceId, setWorkspaceId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setWorkspaceId(localStorage.getItem("workspace_id") || "");
    setHydrated(true);
  }, []);
  const { investments, isLoading: loading, error } = useInvestments(workspaceId, undefined, 100);

  const isDemo = hydrated && investments.length === 0;
  const rounds = (isDemo ? demoInvestments : investments) as DemoInvestment[];
  const visibleRounds = rounds.filter((round) => {
    const searchText = [round.company?.name, round.company?.ai_domain, round.round_type, round.amount_usd, round.investors?.map((i: any) => i.investor?.name).join(' '), round.announced_at].join(' ').toLowerCase();
    return searchText.includes(query.toLowerCase());
  });

  if (loading) return <div className="space-y-9"><header className="flex flex-col justify-between gap-6 border-b border-[#30345f] pb-8 md:flex-row md:items-end"><div><p className="eyebrow mb-3">Artificial Intelligence / Investment intelligence</p><h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Where capital is <em className="text-[#929aff]">concentrating.</em></h1></div></header></div>;
  if (error) return <div className="space-y-9"><p className="text-sm text-[#d0b2ed]">Live investment data could not load. Check the workspace connection and try again.</p></div>;

  const domainsMap = new Map<string, { amount: number; count: number }>();
  rounds.forEach((inv) => {
    const domain = inv.company?.ai_domain || 'Other';
    const existing = domainsMap.get(domain) || { amount: 0, count: 0 };
    domainsMap.set(domain, { amount: existing.amount + (inv.amount_usd || 0) / 1000000, count: existing.count + 1 });
  });

  const domainsArray = Array.from(domainsMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.amount - a.amount);

  const visibleRoundsList = rounds.filter((round) => {
    const searchText = [round.company?.name, round.company?.ai_domain, round.round_type, round.amount_usd, round.investors?.map((i: any) => i.investor?.name).join(' '), round.announced_at].join(' ').toLowerCase();
    return searchText.includes(query.toLowerCase());
  });

  return <div className="space-y-9"><header className="flex flex-col justify-between gap-6 border-b border-[#30345f] pb-8 md:flex-row md:items-end"><div><p className="eyebrow mb-3">Artificial Intelligence / Investment intelligence</p><h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Where capital is <em className="text-[#929aff]">concentrating.</em></h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">Compare company funding across the major AI domains, then drill into the rounds and sources behind each total.</p></div><span className="inline-flex w-fit items-center gap-2 rounded border border-[#4b559b] bg-[#182048] px-3 py-2 font-mono text-[10px] text-[#b9c0ff]"><span className="h-1.5 w-1.5 rounded-full bg-[#8993ff]" />Core AI data cutoff: Today, 07:30 UTC</span></header>

    <section className="rounded-lg border border-[#705779] bg-[#16182f] p-5 sm:flex sm:items-start sm:justify-between sm:gap-6"><div className="flex gap-3"><Database size={18} className="mt-0.5 shrink-0 text-[#c7a8ea]" /><div><p className="text-sm font-semibold">{isDemo ? "Illustrative market data" : "Live data from Supabase"}. {rounds.length} rounds loaded.</p><p className="mt-1 text-xs leading-6 text-[#bfc3dc]">{isDemo ? "Connect Supabase to replace these demo records with evidence-backed results." : "Data from verified evidence pipeline."}</p></div></div><span className="mt-3 inline-block shrink-0 rounded border border-[#4b559b] px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-[#b9c0ff] sm:mt-0">{isDemo ? "Demo data" : "Live data"}</span></section>

    <section className="surface p-6 sm:p-7"><div className="flex flex-col justify-between gap-4 border-b border-[#30345f] pb-5 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2"><BarChart3 size={17} className="text-[#aeb6ff]" /><h2 className="text-lg font-semibold">Investment by AI domain</h2></div><p className="mt-2 text-xs text-[#a5abc9]">Disclosed funding across AI domains · USD millions</p></div><button className="button w-fit" onClick={() => setPeriod(period === "Last 30 days" ? "Last 90 days" : "Last 30 days")}><Filter size={14} />{period}<ChevronDown size={13} /></button></div><div className="mt-8 overflow-x-auto pb-2"><div className="grid min-w-[620px] grid-cols-6 items-end gap-4 border-b border-[#30345f] pb-0">{Array.from(domainsMap.entries()).map(([name, data]) => <div key={name} className="group flex h-72 flex-col justify-end"><div className="mb-3 text-center"><p className="font-mono text-sm font-semibold text-[#c3c9ff]">${data.amount.toFixed(1)}m</p></div><div className="relative rounded-t-lg bg-gradient-to-t from-[#5961d4] to-[#a5adff] transition group-hover:from-[#717afa] group-hover:to-[#c2c7ff]" style={{ height: `${Math.round((data.amount / (domainsArray[0]?.amount || 1)) * 100)}%` }}><span className="absolute inset-x-0 bottom-0 h-px bg-white/40" /></div><div className="min-h-16 pt-3 text-center"><p className="text-[11px] font-semibold leading-4 text-[#e5e8ff]">{name}</p><p className="mt-1 text-[9px] text-[#8d93b6]">{((data.amount / Array.from(domainsMap.values()).reduce((sum, d) => sum + d.amount, 0)) * 100).toFixed(1)}% of set</p></div></div>)}</div></div><div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] text-[#a5abc9]"><span>Total: <strong className="text-[#d9ddf3]">${Array.from(domainsMap.values()).reduce((sum, d) => sum + d.amount, 0).toFixed(1)}m</strong></span><span>Period: {period}</span><span>{domainsMap.size} domains</span></div></section>

    <section className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]"><div><div className="mb-4"><h2 className="text-lg font-semibold">Company funding tracker</h2><p className="mt-1 text-xs text-[#a5abc9]">Rounds with available source lineage. Select a company to open its profile.</p></div><div className="surface overflow-hidden"><div className="flex items-center gap-2 border-b border-[#30345f] px-5 py-4"><Search size={15} className="text-[#8d93b6]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company, AI domain, or investor" className="w-full bg-transparent text-xs text-white outline-none placeholder:text-[#72789f]" /></div><div className="overflow-x-auto"><div className="min-w-[700px] px-5"><div className="grid grid-cols-[1.3fr_1.25fr_.7fr_.65fr_1.15fr_.6fr] gap-4 border-b border-[#30345f] py-3 font-mono text-[9px] uppercase tracking-wide text-[#8d93b6]"><span>Company</span><span>AI domain</span><span>Round</span><span>Funding</span><span>Investor / Geography</span><span>Date</span></div>{visibleRoundsList.map((round) => <Link href={`/companies/${round.company.name.toLowerCase().replace(/\s+/g, "-") || round.id}`} className="grid grid-cols-[1.3fr_1.25fr_.7fr_.65fr_1.15fr_.6fr] gap-4 border-b border-[#30345f] py-4 text-xs transition last:border-0 hover:bg-[#151a39]" key={round.id}>{[round.company.name, round.company.ai_domain, round.round_type, `$${(round.amount_usd / 1000000).toFixed(1)}m`, round.investors.map((investor) => investor.investor.name).join(', ') || 'N/A', new Date(round.announced_at).toLocaleDateString()].map((cell, index) => <span className={index === 0 ? "font-semibold text-white" : index === 3 ? "font-mono text-[#aeb6ff]" : "text-[#bfc3dc]"} key={cell}>{cell}</span>)}</Link>)}</div></div></div></div><aside className="space-y-6"><section className="surface p-6"><p className="eyebrow">How to read this</p><h2 className="mt-3 font-display text-3xl leading-tight">Compare capital, then inspect the evidence.</h2><p className="mt-3 text-sm leading-6 text-[#bfc3dc]">Funding indicates attention, not demand or category quality. The company tracker remains the place to inspect individual records.</p><Link href="/signals/sig-agent-control" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[#aeb6ff] hover:underline"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 4h4" /><path d="M10 20h4" /><path d="M10 20h4" /><path d="M12 14v4" /><path d="M12 2v4" /><path d="M12 6c0 3-2.5 5.5-5 5.5S6 17 6 14" /></svg>Open related signal <ArrowRight size={13} /></Link></section></aside></section></div>; }
