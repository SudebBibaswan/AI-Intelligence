'use client'

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Lightbulb, Plus, CheckCircle2, Lightbulb as LightbulbIcon } from "lucide-react";
import { fetchHypotheses, fetchPatterns } from "@/lib/api/intelligence";
import { Hypothesis, Pattern } from "@/types/intelligence";

export function Hypotheses({ mode }: { mode?: "new" | "detail" }) {
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const workspaceId = typeof window !== 'undefined' ? localStorage.getItem('workspace_id') || '' : '';
        if (!workspaceId) throw new Error('No workspace selected');
        const [{ data: hypothesesData }, { data: patternsData }] = await Promise.all([
          fetchHypotheses({ workspace_id: workspaceId, limit: 100 }),
          fetchPatterns({ workspace_id: workspaceId, limit: 100 })
        ]);
        setHypotheses(hypothesesData.data);
        setPatterns(patternsData.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div className="space-y-9">Loading hypotheses...</div>;
  if (error) return <div className="space-y-9">Error: {error}</div>;

  if (mode === "new") return <HypothesisForm patterns={patterns} />;
  if (mode === "detail") return <HypothesisDetail hypotheses={hypotheses} patterns={patterns} />;

  return (
    <div className="space-y-9">
      <header className="flex flex-col justify-between gap-5 border-b border-[#30345f] pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow mb-3">Artificial Intelligence / Hypotheses</p>
          <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Questions worth <em className="text-[#929aff]">testing.</em></h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
            A hypothesis is a testable explanation, not a product recommendation. Validation must look for both supporting and contradictory evidence.
          </p>
        </div>
        <Link href="/hypotheses/new" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#6c72f3] px-3.5 text-xs font-semibold text-white">
          <Plus size={14} />New hypothesis
        </Link>
      </header>
      {hypotheses.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No hypotheses yet. Create your first testable explanation.</p>
          <Link href="/hypotheses/new" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#6c72f3] px-3.5 text-xs font-semibold text-white mt-4">
            <Plus size={14} />New hypothesis
          </Link>
        </div>
      ) : (
        hypotheses.map((hypothesis) => (
          <Link href={`/hypotheses/${hypothesis.id}`} className="surface block p-6 transition hover:border-[#7076f6]" key={hypothesis.id}>
            <div className="flex justify-between gap-4">
              <span className="rounded border border-[#4b559b] bg-[#182048] px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-[#b9c0ff]">
                {hypothesis.status}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#aeb6ff]">
                <path d="M9 18h6" /><path d="M10 4h4" /><path d="M10 20h4" /><path d="M12 14v4" /><path d="M12 2v4" /><path d="M12 6c0 3-2.5 5.5-5 5.5S6 17 6 14" />
              </svg>
            </div>
            <h2 className="mt-5 font-display text-3xl">{hypothesis.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bfc3dc]">{hypothesis.statement}</p>
            <p className="mt-5 border-t border-[#30345f] pt-4 font-mono text-[10px] text-[#a5abc9]">
              Linked pattern · {hypothesis.status === 'ready_for_validation' ? 'Ready for validation' : hypothesis.status}
            </p>
          </Link>
        ))}
    </div>
  );
}

function HypothesisForm({ patterns }: { patterns: any[] }) {
  return (
    <div className="max-w-3xl">
      <Link href="/hypotheses" className="inline-flex items-center gap-1 text-xs font-semibold text-[#aeb6ff]">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>Back to hypotheses
      </Link>
      <header className="mt-8 border-b border-[#30345f] pb-7">
        <p className="eyebrow">New hypothesis</p>
        <h1 className="mt-3 font-display text-5xl">Make the claim testable.</h1>
        <p className="mt-4 text-sm leading-7 text-[#bfc3dc]">
          State the proposed explanation, who it affects, and the assumptions that validation must challenge.
        </p>
      </header>
      <div className="mt-8 space-y-6">
        <Field label="Hypothesis title" placeholder="Independent controls for autonomous agents" />
        <Field label="Statement" placeholder="What must be true for this to be a meaningful explanation?" multiline />
        <Field label="Target user or market" placeholder="Security and compliance teams at regulated enterprises" />
        <Field label="Problem observed" placeholder="What evidence-backed problem does this explain?" multiline />
        <section className="surface p-5">
          <p className="text-xs font-semibold">Critical assumptions</p>
          <p className="mt-1 text-xs text-[#a5abc9]">Validation will actively search for evidence that weakens these assumptions.</p>
          <div className="mt-4 space-y-2">
            <Assumption text="Agent adoption is reaching production in regulated teams." />
            <Assumption text="Existing controls do not meet runtime needs." />
          </div>
          <button className="mt-4 text-xs font-semibold text-[#aeb6ff]">+ Add assumption</button>
        </section>
        <section className="surface p-5">
          <p className="eyebrow">Pattern lineage</p>
          <p className="mt-3 text-sm font-semibold">{/* patterns[0]?.title || 'No patterns available' */}</p>
          <p className="mt-1 text-xs text-[#a5abc9]">This preserves the link between your hypothesis and the observations that prompted it.</p>
        </section>
        <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#6c72f3] px-4 text-xs font-semibold text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 4h4" /><path d="M10 20h4" /><path d="M12 14v4" /><path d="M12 2v4" /><path d="M12 6c0 3-2.5 5.5-5 5.5S6 17 6 14" /></svg>
          Create hypothesis
        </button>
      </div>
    </div>
  );
}

function HypothesisDetail() {
  return (
    <div className="space-y-8">
      <Link href="/hypotheses" className="inline-flex items-center gap-1 text-xs font-semibold text-[#aeb6ff]">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>Back to hypotheses
      </Link>
      <header className="border-b border-[#30345f] pb-8">
        <span className="rounded border border-[#4b559b] bg-[#182048] px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-[#b9c0ff]">
          Draft hypothesis
        </span>
        <h1 className="mt-5 max-w-4xl font-display text-5xl leading-[.98]">Hypothesis title</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-[#bfc3dc]">Hypothesis statement goes here.</p>
      </header>
      <section className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-6">
          <p className="eyebrow">Critical assumptions</p>
          <ul className="mt-4 space-y-3 text-sm text-[#d9ddf3]">
            <li>01 · Agent adoption is reaching production in regulated teams.</li>
            <li>02 · Existing controls do not meet runtime needs.</li>
          </ul>
        </section>
        <section className="surface p-6">
          <p className="eyebrow">Testing layer</p>
          <h2 className="mt-4 font-display text-3xl">Deferred.</h2>
          <p className="mt-3 text-sm leading-6 text-[#bfc3dc]">
            Hypothesis testing needs its own dedicated experience and will be designed separately. This draft remains available for review and refinement.
          </p>
        </section>
      </section>
      <section className="surface p-6">
        <p className="eyebrow">Pattern lineage</p>
        <Link href="/patterns/pat-governance" className="mt-3 inline-block text-sm font-semibold text-[#aeb6ff] hover:underline">
          Linked pattern
        </Link>
        <p className="mt-2 text-xs text-[#a5abc9]">The hypothesis remains separate from the underlying observations and evidence.</p>
      </section>
      <div className="flex gap-2 text-xs text-[#d0b2ed]">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        Drafts are not conclusions; validation must seek disconfirming evidence.
      </div>
    </div>
  );
}

function Field({ label, placeholder, multiline }: { label: string; placeholder: string; multiline?: boolean }) {
  const className = "mt-2 w-full rounded-md border border-[#30345f] bg-[#111735] px-4 py-3 text-sm text-white outline-none placeholder:text-[#72789f] focus:border-[#8993ff]";
  return (
    <label className="block text-xs font-semibold">
      {label}
      {multiline ? (
        <textarea className={`${className} min-h-24`} placeholder={placeholder} />
      ) : (
        <input className={className} placeholder={placeholder} />
      )}
    </label>
  );
}

function Assumption({ text }: { text: string }) {
  return <div className="rounded border border-[#30345f] bg-[#111735] px-3 py-3 text-xs text-[#d9ddf3]">{text}</div>;
}