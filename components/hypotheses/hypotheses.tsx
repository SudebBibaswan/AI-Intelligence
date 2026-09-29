'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Lightbulb, Plus } from "lucide-react";
import { fetchHypotheses, fetchPatterns } from "@/lib/api/intelligence";
import type { Hypothesis, Pattern } from "@/types/intelligence";
import { useWorkspace } from "@/lib/hooks/workspace";

export function Hypotheses({ mode, id }: { mode?: "new" | "detail"; id?: string }) {
  const { workspace, workspaceDomain, isLoading: workspaceLoading } = useWorkspace();
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const workspaceId = workspace?.id;
  const workspaceDomainId = workspaceDomain?.id;

  useEffect(() => {
    async function loadData() {
      if (!workspaceId || !workspaceDomainId) {
        setError("No workspace or domain configured");
        setLoading(false);
        return;
      }

      try {
        const [{ data: hypothesesData }, { data: patternsData }] = await Promise.all([
          fetchHypotheses({ workspace_id: workspaceId, domain_id: workspaceDomainId, limit: 100 }),
          fetchPatterns({ workspace_id: workspaceId, domain_id: workspaceDomainId, limit: 100 }),
        ]);
        setHypotheses(hypothesesData as Hypothesis[]);
        setPatterns(patternsData as Pattern[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load hypotheses");
      } finally {
        setLoading(false);
      }
    }

    if (!workspaceLoading) {
      loadData();
    }
  }, [workspaceId, workspaceDomainId, workspaceLoading]);

  if (workspaceLoading || loading) return <div className="space-y-9">Loading hypotheses...</div>;
  if (error) return <div className="space-y-9"><p className="text-sm text-[#d0b2ed]">Live hypotheses could not load. Check the workspace connection and try again.</p></div>;
  if (!workspace || !workspaceDomain) return <div className="space-y-9 p-6">Please complete onboarding to set up your workspace.</div>;
  if (mode === "new") return <HypothesisForm patterns={patterns} />;
  if (mode === "detail") return <HypothesisDetail hypothesis={hypotheses.find((item) => item.id === id) ?? hypotheses[0]} />;

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
          <Link href="/hypotheses/new" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-[#6c72f3] px-3.5 text-xs font-semibold text-white">
            <Plus size={14} />New hypothesis
          </Link>
        </div>
      ) : (
        hypotheses.map((hypothesis) => (
          <Link href={`/hypotheses/${hypothesis.id}`} className="surface block p-6 transition hover:border-[#7076f6]" key={hypothesis.id}>
            <div className="flex justify-between gap-4">
              <span className="rounded border border-[#4b559b] bg-[#182048] px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-[#b9c0ff]">
                {hypothesis.status.replaceAll("_", " ")}
              </span>
              <Lightbulb size={17} className="text-[#aeb6ff]" />
            </div>
            <h2 className="mt-5 font-display text-3xl">{hypothesis.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bfc3dc]">{hypothesis.statement}</p>
            <p className="mt-5 border-t border-[#30345f] pt-4 font-mono text-[10px] text-[#a5abc9]">
              {hypothesis.assumptions.length} critical assumptions · {hypothesis.status.replaceAll("_", " ")}
            </p>
          </Link>
        ))
      )}
    </div>
  );
}

function HypothesisForm({ patterns }: { patterns: Pattern[] }) {
  const [assumptions, setAssumptions] = useState(["Agent adoption is reaching production in regulated teams.", "Existing controls do not meet runtime needs."]);
  const [created, setCreated] = useState(false);
  const addAssumption = () => setAssumptions((items) => [...items, ""]);
  const updateAssumption = (index: number, value: string) => setAssumptions((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.localStorage.setItem("ai-intelligence-hypothesis-draft", JSON.stringify({ assumptions, createdAt: new Date().toISOString() }));
    setCreated(true);
  };

  return (
    <div className="max-w-3xl">
      <Link href="/hypotheses" className="inline-flex items-center gap-1 text-xs font-semibold text-[#aeb6ff]">
        <ArrowLeft size={14} />Back to hypotheses
      </Link>
      <header className="mt-8 border-b border-[#30345f] pb-7">
        <p className="eyebrow">New hypothesis</p>
        <h1 className="mt-3 font-display text-5xl">Make the claim testable.</h1>
        <p className="mt-4 text-sm leading-7 text-[#bfc3dc]">State the proposed explanation, who it affects, and the assumptions that validation must challenge.</p>
      </header>
      <form className="mt-8 space-y-6" onSubmit={submit}>
        <Field label="Hypothesis title" placeholder="Independent controls for autonomous agents" required />
        <Field label="Statement" placeholder="What must be true for this to be a meaningful explanation?" multiline required />
        <Field label="Target user or market" placeholder="Security and compliance teams at regulated enterprises" required />
        <Field label="Problem observed" placeholder="What evidence-backed problem does this explain?" multiline required />
        <section className="surface p-5">
          <p className="text-xs font-semibold">Critical assumptions</p>
          <p className="mt-1 text-xs text-[#a5abc9]">Validation will actively search for evidence that weakens these assumptions.</p>
          <div className="mt-4 space-y-2">
            {assumptions.map((assumption, index) => (
              <input
                key={index}
                aria-label={`Assumption ${index + 1}`}
                value={assumption}
                onChange={(event) => updateAssumption(index, event.target.value)}
                placeholder="State an assumption to test"
                className="w-full rounded border border-[#30345f] bg-[#111735] px-3 py-3 text-xs text-white outline-none focus:border-[#8993ff]"
                required
              />
            ))}
          </div>
          <button type="button" className="mt-4 text-xs font-semibold text-[#aeb6ff]" onClick={addAssumption}>
            + Add assumption
          </button>
        </section>
        <section className="surface p-5">
          <p className="eyebrow">Pattern lineage</p>
          <p className="mt-3 text-sm font-semibold">{patterns[0]?.title ?? "No pattern selected"}</p>
          <p className="mt-1 text-xs text-[#a5abc9]">This preserves the evidence chain from observation to hypothesis.</p>
        </section>
        <div className="flex gap-2">
          <button type="submit" className="button button-primary min-h-10 inline-flex items-center gap-2 rounded-md bg-[#6c72f3] px-3.5 text-xs font-semibold text-white">
            <CheckCircle2 size={14} />Create hypothesis
          </button>
        </div>
      </form>
    </div>
  );
}

function HypothesisDetail({ hypothesis }: { hypothesis?: Hypothesis }) {
  if (!hypothesis) return (
    <div className="space-y-8">
      <Link href="/hypotheses" className="text-xs font-semibold text-[#aeb6ff]">Back to hypotheses</Link>
      <p className="text-sm text-[#bfc3dc]">No hypothesis is available yet.</p>
    </div>
  );
  return (
    <div className="space-y-8">
      <Link href="/hypotheses" className="inline-flex items-center gap-1 text-xs font-semibold text-[#aeb6ff]">
        <ArrowLeft size={14} />Back to hypotheses
      </Link>
      <header className="border-b border-[#30345f] pb-8">
        <span className="rounded border border-[#4b559b] bg-[#182048] px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-[#b9c0ff]">
          {hypothesis.status.replaceAll("_", " ")}
        </span>
        <h1 className="mt-5 max-w-4xl font-display text-5xl leading-[.98]">{hypothesis.title}</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-[#bfc3dc]">{hypothesis.statement}</p>
      </header>
      <section className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-6">
          <p className="eyebrow">Critical assumptions</p>
          <ul className="mt-4 space-y-3 text-sm text-[#d9ddf3]">
            {hypothesis.assumptions.map((assumption, index) => (
              <li key={assumption}>0{index + 1} · {assumption}</li>
            ))}
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
        <Link href="/patterns/pat-governance" className="mt-3 inline-block text-sm font-semibold text-[#aeb6ff] hover:underline">Linked pattern</Link>
      </section>
    </div>
  );
}

function Field({ label, placeholder, multiline, required }: { label: string; placeholder: string; multiline?: boolean; required?: boolean }) {
  const className = "mt-2 w-full rounded-md border border-[#30345f] bg-[#111735] px-4 py-3 text-sm text-white outline-none placeholder:text-[#72789f] focus:border-[#8993ff]";
  return (
    <label className="block text-xs font-semibold">
      {label}
      {multiline ? (
        <textarea className={`${className} min-h-24`} placeholder={placeholder} required={required} />
      ) : (
        <input className={className} placeholder={placeholder} required={required} />
      )}
    </label>
  );
}