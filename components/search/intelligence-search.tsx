"use client";

import Link from "next/link";
import { Building2, Layers3, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { investmentDomains, investmentRounds, patterns } from "@/lib/mock-data/dashboard";

type SearchItem = {
  category: "Investment" | "Pattern";
  title: string;
  detail: string;
  href: string;
};

const companySlug = (company: string) => company.toLowerCase().replace(/\s+/g, "-");

const searchableItems: SearchItem[] = [
  ...investmentDomains.map((domain) => ({
    category: "Investment" as const,
    title: domain.name,
    detail: `$${domain.amount}m · ${domain.detail} · ${domain.change} in the comparison period`,
    href: "/investments",
  })),
  ...investmentRounds.map(([company, domain, round, amount, investor, date]) => ({
    category: "Investment" as const,
    title: company,
    detail: `${domain} · ${round} · ${amount} · ${investor} · ${date}`,
    href: `/companies/${companySlug(company)}`,
  })),
  ...patterns.map((pattern) => ({
    category: "Pattern" as const,
    title: pattern.statement,
    detail: `${pattern.window} · Strength ${pattern.strength} · ${pattern.observations} observations · ${pattern.counterSignals} counter-signals`,
    href: `/patterns/${pattern.id}`,
  })),
];

export function IntelligenceSearch({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return searchableItems;
    return searchableItems.filter((item) => `${item.title} ${item.detail} ${item.category}`.toLowerCase().includes(term));
  }, [query]);

  return <>
    <button className={`button w-full justify-start ${compact ? "" : "text-slate-600"}`} type="button" onClick={() => setOpen(true)}>
      <Search size={15} />Search intelligence {!compact && <kbd className="ml-auto font-mono text-[10px] text-slate-400">⌘ K</kbd>}
    </button>
    {open && <div className="fixed inset-0 z-[70] grid place-items-start bg-[#030613]/75 px-4 pt-[10vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Search intelligence" onMouseDown={() => setOpen(false)}>
      <section className="w-full max-w-2xl overflow-hidden rounded-xl border border-[#4b559b] bg-[#0d1230] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[#30345f] px-5 py-4"><Search size={18} className="shrink-0 text-[#aeb6ff]" /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#72789f]" placeholder="Search companies, funding rounds, AI domains, or patterns" /><button aria-label="Close search" className="rounded p-1 text-[#a5abc9] hover:bg-[#202750] hover:text-white" onClick={() => setOpen(false)}><X size={18} /></button></div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          <div className="flex items-center justify-between px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-[#8d93b6]"><span>{query ? `${results.length} matching results` : "Search across investments & patterns"}</span><span>Esc to close</span></div>
          {results.map((item) => <Link href={item.href} onClick={() => setOpen(false)} className="flex gap-3 rounded-lg px-3 py-3 transition hover:bg-[#191f49]" key={`${item.category}-${item.title}`}><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded border border-[#3b4378] bg-[#151a39] text-[#aeb6ff]">{item.category === "Investment" ? <Building2 size={15} /> : <Layers3 size={15} />}</span><span className="min-w-0"><span className="mb-1 block font-mono text-[9px] uppercase tracking-wide text-[#aeb6ff]">{item.category}</span><span className="block text-sm font-semibold leading-5 text-white">{item.title}</span><span className="mt-1 block text-xs leading-5 text-[#bfc3dc]">{item.detail}</span></span></Link>)}
          {results.length === 0 && <p className="px-3 py-10 text-center text-sm text-[#a5abc9]">No investment companies, domains, or patterns match “{query}”.</p>}
        </div>
      </section>
    </div>}
  </>;
}
