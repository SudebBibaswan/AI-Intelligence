"use client";

import Link from "next/link";
import { ArrowRight, Check, Globe2, Sparkles } from "lucide-react";
import { useState } from "react";

const domains = [
  ["Artificial Intelligence", "Models, agents, infrastructure, evaluation", "AI"],
  ["Financial Technology", "Payments, credit, wealth, financial infrastructure", "FT"],
  ["Climate & Energy", "Grid, carbon, industrial transition", "CE"],
  ["Healthcare", "Care delivery, biotech, health infrastructure", "HC"],
  ["Enterprise Software", "Workflows, security, data, automation", "ES"],
  ["Consumer Internet", "Commerce, media, creator and community products", "CI"],
] as const;

export function DomainPicker() {
  const [selected, setSelected] = useState("Artificial Intelligence");
  return <main className="min-h-screen bg-paper px-5 py-8 sm:px-8 lg:px-12"><header className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/" className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-sm border border-teal font-display text-2xl text-teal">i</span><span className="text-[13px] font-bold">intelligence<span className="text-teal">.</span></span></Link><span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Step 1 of 2</span></header><section className="mx-auto max-w-6xl pt-20"><p className="eyebrow">Set your research lens</p><h1 className="mt-3 max-w-2xl font-display text-5xl leading-[.98] sm:text-6xl">Which domain should we help you understand?</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600">Your domain determines the sources, topics, investment activity, and emerging patterns your workspace tracks. You can refine this later.</p><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{domains.map(([name, description, initials]) => <button className={`surface relative min-h-44 p-6 text-left transition hover:-translate-y-0.5 ${selected === name ? "border-teal bg-[#f2f9f8] ring-1 ring-teal" : "hover:border-teal/40"}`} onClick={() => setSelected(name)} key={name}><span className="grid h-9 w-9 place-items-center rounded bg-stone-100 font-mono text-xs font-semibold text-teal">{initials}</span>{selected === name && <span className="absolute right-5 top-5 grid h-5 w-5 place-items-center rounded-full bg-teal text-white"><Check size={13} /></span>}<h2 className="mt-5 text-sm font-semibold">{name}</h2><p className="mt-1.5 text-xs leading-5 text-slate-600">{description}</p></button>)}</div><div className="mt-9 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-xs text-slate-600"><Globe2 size={15} className="text-teal" />Global and India are selected by default</div><Link className="button button-primary" href="/workspace">Continue with {selected} <ArrowRight size={15} /></Link></div></section></main>;
}
