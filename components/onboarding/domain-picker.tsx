"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Globe2 } from "lucide-react";
import { useEffect, useState } from "react";

interface Domain {
  key: string;
  name: string;
  description: string;
}

async function readJsonResponse<T>(response: Response): Promise<Partial<T>> {
  const body = await response.text();
  if (!body) return {};

  try {
    return JSON.parse(body) as T;
  } catch {
    return {};
  }
}

function redirectedToLogin(response: Response) {
  return response.redirected && new URL(response.url).pathname === "/login";
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function DomainPicker() {
  const router = useRouter();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selected, setSelected] = useState<Domain | null>(null);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDomains() {
      try {
        const response = await fetch("/api/onboarding/domain");
        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (redirectedToLogin(response)) {
          router.replace("/login");
          return;
        }

        const result = await readJsonResponse<{ domains: Domain[]; error: string }>(response);
        if (!response.ok) throw new Error(result.error || "Failed to load domains");

        const availableDomains = Array.isArray(result.domains) ? result.domains : [];
        if (!active) return;
        setDomains(availableDomains);
        setSelected(availableDomains[0] ?? null);
        if (availableDomains.length === 0) setError("No active domains are configured yet.");
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load domains");
      } finally {
        if (active) setDomainsLoading(false);
      }
    }

    loadDomains();
    return () => { active = false; };
  }, [router]);

  const handleContinue = async () => {
    if (!selected || loading) return;
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/onboarding/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_key: selected.key }),
      });

      if (response.status === 401 || redirectedToLogin(response)) {
        router.replace("/login");
        return;
      }

      const result = await readJsonResponse<{ error: string }>(response);
      
      if (!response.ok) {
        throw new Error(result.error || `Failed to save domain (${response.status})`);
      }
      
      router.push("/onboarding/profile");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save domain");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090b18] px-5 py-8 sm:px-8 lg:px-12">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-sm border border-[#8993ff] font-display text-2xl text-[#aeb6ff]">i</span>
          <span className="text-[13px] font-bold">intelligence<span className="text-[#8993ff]">.</span></span>
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#8d93b6]">Step 1 of 2</span>
      </header>
      <section className="mx-auto max-w-6xl pt-20">
        <p className="eyebrow">Set your research lens</p>
        <h1 className="mt-3 max-w-2xl font-display text-5xl leading-[.98] sm:text-6xl">
          Which domain should we help you understand?
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
          Your domain determines the sources, topics, investment activity, and emerging patterns your workspace tracks. You can refine this later.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {domainsLoading && (
            <div className="col-span-full rounded-lg border border-[#30345f] bg-[#10142d] p-8 text-sm text-[#a5abc9]">
              Loading available domains...
            </div>
          )}
          {!domainsLoading && domains.map((domain) => (
            <button
              type="button"
              className={`relative min-h-44 rounded-lg border p-6 text-left transition hover:-translate-y-0.5 ${
                selected?.key === domain.key
                  ? "border-[#7d83ff] bg-[#171c42] ring-1 ring-[#7d83ff]"
                  : "border-[#30345f] bg-[#10142d] hover:border-[#7076f6]"
              }`}
              onClick={() => setSelected(domain)}
              key={domain.key}
            >
              <span className="grid h-9 w-9 place-items-center rounded bg-[#20275a] font-mono text-xs font-semibold text-[#aeb6ff]">
                {getInitials(domain.name)}
              </span>
              {selected?.key === domain.key && (
                <span className="absolute right-5 top-5 grid h-5 w-5 place-items-center rounded-full bg-[#7076f6] text-white">
                  <Check size={13} />
                </span>
              )}
              <h2 className="mt-5 text-sm font-semibold">{domain.name}</h2>
              <p className="mt-1.5 text-xs leading-5 text-[#a5abc9]">{domain.description}</p>
            </button>
          ))}
        </div>
        
        {error && (
          <div className="mt-6 rounded-md border border-[#7a4b4b] bg-[#381818] p-3 text-sm text-[#e89696]">
            {error}
          </div>
        )}
        
        <div className="mt-9 flex flex-col gap-4 border-t border-[#30345f] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-[#a5abc9]">
            <Globe2 size={13} className="text-[#8d93b6]" />
            <span>Your workspace will track this domain across global sources</span>
          </div>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selected || loading || domainsLoading}
            className={`inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-md px-4 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              loading ? "bg-[#6c72f3] opacity-70" : "bg-[#6c72f3] hover:bg-[#8187ff]"
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                Saving...
              </>
            ) : (
              <>
                Continue
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </section>
    </main>
  );
}
