"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IntelligenceActions } from "@/components/actions/intelligence-actions";
import { IntelligenceSearch } from "@/components/search/intelligence-search";
import { BookOpen, ChevronDown, Compass, History, Landmark, Library, LogOut, Menu, Newspaper, Settings, UserRound, X, Database } from "lucide-react";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/hooks/workspace";
import { createClient } from "@/lib/supabase/client";

const navigation = [
  { href: "/workspace", label: "Overview", icon: Compass },
  { href: "/news", label: "News Feed", icon: Newspaper },
  { href: "/investments", label: "Investments", icon: Landmark },
  { href: "/capital-directory", label: "Capital Directory", icon: Database },
  { href: "/research-runs", label: "Research Runs", icon: Database },
  { href: "/patterns", label: "Patterns", icon: BookOpen },
  { href: "/hypotheses", label: "Hypotheses", icon: Library },
  { href: "/library", label: "Saved intelligence", icon: Library },
  { href: "/timeline", label: "Timeline", icon: History },
  { href: "/profile", label: "Profile", icon: UserRound },
];

function Navigation({ close }: { close?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1" aria-label="Primary navigation">
      {navigation.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link className={`nav-link ${active ? "nav-link-active" : ""}`} href={href} onClick={close} key={href}>
            <Icon size={16} strokeWidth={1.8} />{label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, isLoading } = useCurrentUser();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const detailType = pathname.startsWith("/signals/") ? "signal" : pathname.startsWith("/patterns/") ? "pattern" : pathname.startsWith("/hypotheses/") && !pathname.endsWith("/new") ? "hypothesis" : null;
  
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "User";
  const displayRole = profile?.onboarding_state === 'complete' ? "Active" : "Onboarding";

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-[#090e27] p-5 lg:flex">
        <Brand />
        <div className="mt-10"><IntelligenceSearch /></div>
        <p className="eyebrow mb-3 mt-8 px-3">Workspace</p>
        <Navigation />
        <div className="mt-auto border-t border-line pt-5">
          <Link href="/settings" className={`nav-link ${pathname.startsWith("/settings") ? "nav-link-active" : ""}`}>
            <Settings size={16} />Settings
          </Link>
          <Link href="/profile" className="mt-5 flex items-center gap-3 rounded-md px-3 py-1 transition hover:bg-[#18214a]">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-teal font-mono text-xs font-semibold text-white">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="text-xs font-semibold">{displayName}</p>
              <p className="meta mt-0.5">{displayRole} · Profile</p>
            </div>
          </Link>
          <button className="nav-link mt-3 w-full text-[#d9a9c8] hover:bg-[#30162b]" type="button" onClick={logout}>
            <LogOut size={16} />Log out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-line bg-paper/95 px-5 backdrop-blur lg:px-12">
          <div className="flex items-center gap-3 lg:hidden">
            <button aria-label="Open navigation" className="rounded p-1.5" onClick={() => setMobileOpen(true)}>
              <Menu size={21} />
            </button>
            <Brand compact />
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <span className="meta">Workspace</span>
            <ChevronDown size={14} className="text-slate-500" />
            <span className="mx-2 text-slate-300">/</span>
            <span className="text-xs font-semibold">AI Intelligence</span>
          </div>
          <div className="hidden sm:block">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#a5abc9]">Daily brief</span>
          </div>
        </header>
        <main className="mx-auto max-w-[1360px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
          {detailType && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#30345f] pb-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#a5abc9]">{detailType} actions</p>
              <IntelligenceActions title={`AI Intelligence ${detailType}`} path={pathname} />
            </div>
          )}
          {children}
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 lg:hidden" onMouseDown={() => setMobileOpen(false)}>
          <aside className="h-full w-[min(320px,85vw)] bg-[#090e27] p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <Brand />
              <button className="rounded p-2" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="mt-9"><IntelligenceSearch compact /></div>
            <p className="eyebrow mb-3 mt-8 px-3">Workspace</p>
            <Navigation close={() => setMobileOpen(false)} />
            <button className="nav-link mt-4 w-full text-[#d9a9c8] hover:bg-[#30162b]" type="button" onClick={logout}>
              <LogOut size={16} />Log out
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/workspace" className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-sm border border-teal font-display text-2xl leading-none text-teal">i</span>
      {!compact && <span className="text-[13px] font-bold tracking-tight">intelligence<span className="text-teal">.</span></span>}
    </Link>
  );
}