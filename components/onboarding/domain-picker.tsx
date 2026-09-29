"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Globe2, Sparkles } from "lucide-react";
import { useState } from "react";

interface Domain {
  key: string;
  name: string;
  description: string;
  initials: string;
}

const domains: Domain[] = [
  { key: "artificial-intelligence", name: "Artificial Intelligence", description: "Models, agents, infrastructure, evaluation", initials: "AI" },
  { key: "financial-technology", name: "Financial Technology", description: "Payments, credit, wealth, financial infrastructure", initials: "FT" },
  { key: "climate-energy", name: "Climate & Energy", description: "Grid, carbon, industrial transition", initials: "CE" },
  { key: "healthcare", name: "Healthcare", description: "Care delivery, biotech, health infrastructure", initials: "HC" },
  { key: "enterprise-software", name: "Enterprise Software", description: "Workflows, security, data, automation", initials: "ES" },
  { key: "consumer-internet", name: "Consumer Internet", description: "Commerce, media, creator and community products", initials: "CI" },
];

export function DomainPicker() {
  const router = useRouter();
  const [selected, setSelected] = useState<typeof domains[0]>(domains[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/onboarding/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_key: selected.key }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save domain");
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
          {domains.map((domain) => (
            <button
              className={`relative min-h-44 rounded-lg border p-6 text-left transition hover:-translate-y-0.5 ${
                selected.key === domain.key
                  ? "border-[#7d83ff] bg-[#171c42] ring-1 ring-[#7d83ff]"
                  : "border-[#30345f] bg-[#10142d] hover:border-[#7076f6]"
              }`}
              onClick={() => setSelected(domain)}
              key={domain.key}
            >
              <span className="grid h-9 w-9 place-items-center rounded bg-[#20275a] font-mono text-xs font-semibold text-[#aeb6ff]">
                {domain.initials}
              </span>
              {selected.key === domain.key && (
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
            onClick={handleContinue}
            disabled={loading}
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