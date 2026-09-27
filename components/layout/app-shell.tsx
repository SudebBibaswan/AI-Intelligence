"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown, Compass, FlaskConical, Library, Menu, Search, Settings, Sparkles, X } from "lucide-react";
import { useState } from "react";

const navigation = [
  { href: "/", label: "Overview", icon: Compass },
  { href: "/signals", label: "What changed", icon: Sparkles },
  { href: "/research", label: "Research runs", icon: FlaskConical },
  { href: "/patterns", label: "Patterns", icon: BookOpen },
  { href: "/hypotheses", label: "Hypotheses", icon: Library },
];

function Navigation({ close }: { close?: () => void }) {
  const pathname = usePathname();
  return <nav className="space-y-1" aria-label="Primary navigation">
    {navigation.map(({ href, label, icon: Icon }) => {
      const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
      return <Link className={`nav-link ${active ? "nav-link-active" : ""}`} href={href} onClick={close} key={href}>
        <Icon size={16} strokeWidth={1.8} />{label}
      </Link>;
    })}
  </nav>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="min-h-screen lg:flex">
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-[#efeee8] p-5 lg:flex">
      <Brand />
      <button className="button mt-10 w-full justify-start text-slate-600" type="button"><Search size={15} />Search <kbd className="ml-auto font-mono text-[10px] text-slate-400">⌘ K</kbd></button>
      <p className="eyebrow mb-3 mt-8 px-3">Workspace</p>
      <Navigation />
      <div className="mt-auto border-t border-line pt-5">
        <Link href="/settings" className="nav-link"><Settings size={16} />Settings</Link>
        <div className="mt-5 flex items-center gap-3 px-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-teal font-mono text-xs font-semibold text-white">AJ</span><div><p className="text-xs font-semibold">Aman Jain</p><p className="meta mt-0.5">Personal workspace</p></div></div>
      </div>
    </aside>

    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-line bg-paper/95 px-5 backdrop-blur lg:px-12">
        <div className="flex items-center gap-3 lg:hidden"><button aria-label="Open navigation" className="rounded p-1.5" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><Brand compact /></div>
        <div className="hidden items-center gap-2 lg:flex"><span className="meta">Workspace</span><ChevronDown size={14} className="text-slate-500" /><span className="mx-2 text-slate-300">/</span><span className="text-xs font-semibold">AI Intelligence</span></div>
        <div className="flex items-center gap-3"><span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-600" />Research healthy</span><Link className="button button-primary" href="/research/new"><FlaskConical size={14} />New research</Link></div>
      </header>
      <main className="mx-auto max-w-[1360px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">{children}</main>
    </div>

    {mobileOpen && <div className="fixed inset-0 z-50 bg-ink/45 lg:hidden" onMouseDown={() => setMobileOpen(false)}>
      <aside className="h-full w-[min(320px,85vw)] bg-[#efeee8] p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between"><Brand /><button className="rounded p-2" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
        <button className="button mt-9 w-full justify-start"><Search size={15} />Search intelligence</button>
        <p className="eyebrow mb-3 mt-8 px-3">Workspace</p><Navigation close={() => setMobileOpen(false)} />
      </aside>
    </div>}
  </div>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-sm border border-teal font-display text-2xl leading-none text-teal">i</span>{!compact && <span className="text-[13px] font-bold tracking-tight">intelligence<span className="text-teal">.</span></span>}</Link>;
}
