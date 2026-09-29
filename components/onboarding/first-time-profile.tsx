"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Check, ChevronLeft, MessageSquareText, UserRound } from "lucide-react";
import { useState } from "react";

const roles = ["Student", "Founder", "Working professional", "Investor / analyst", "Researcher"];
const goals = ["Track AI investments", "Spot emerging patterns", "Research companies", "Develop a market thesis"];

export function FirstTimeProfile() {
  const router = useRouter();
  const [role, setRole] = useState("Student");
  const [goal, setGoal] = useState("Track AI investments");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canContinue = name.trim().length > 1 && email.includes("@");

  const saveProfile = async () => {
    if (!canContinue || loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: name.trim(), 
          email: email.trim(), 
          organisation: company.trim(), 
          role, 
          interest: goal 
        }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save profile");
      }
      
      router.push("/workspace");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090b18] px-5 py-8 sm:px-8 lg:px-12">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Link href="/login" className="inline-flex items-center gap-1 text-xs font-semibold text-[#a5abc9] hover:text-white">
          <ChevronLeft size={15} />Back to sign in
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#a5abc9]">Step 2 of 2</span>
      </header>
      <section className="mx-auto max-w-3xl py-12 sm:py-20">
        <p className="eyebrow">First-time setup</p>
        <h1 className="mt-3 max-w-2xl font-display text-5xl leading-[.98] sm:text-6xl">
          Tell us a little about <em className="text-[#929aff]">yourself.</em>
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-[#bfc3dc]">
          This helps us make your workspace feel useful from the first brief. You can edit these details later.
        </p>
        
        {error && (
          <div className="mt-6 rounded-md border border-[#7a4b4b] bg-[#381818] p-3 text-sm text-[#e89696]">
            {error}
          </div>
        )}
        
        <div className="mt-10 space-y-7">
          <section className="surface p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <UserRound size={17} className="text-[#aeb6ff]" />
              <div>
                <h2 className="text-sm font-semibold">Your details</h2>
                <p className="mt-1 text-xs text-[#a5abc9]">Used only for your personal workspace.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Full name" value={name} onChange={setName} placeholder="Your name" />
              <Field label="Gmail address" value={email} onChange={setEmail} placeholder="you@gmail.com" type="email" />
            </div>
            <div className="mt-5">
              <Field label="Company or university" value={company} onChange={setCompany} placeholder="Optional" />
            </div>
          </section>
          
          <section className="surface p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <Building2 size={17} className="text-[#aeb6ff]" />
              <div>
                <h2 className="text-sm font-semibold">What best describes you?</h2>
                <p className="mt-1 text-xs text-[#a5abc9]">Choose the closest fit for now.</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {roles.map((item) => (
                <Choice key={item} selected={role === item} onClick={() => setRole(item)}>
                  {item}
                </Choice>
              ))}
            </div>
          </section>
          
          <section className="surface p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <MessageSquareText size={17} className="text-[#aeb6ff]" />
              <div>
                <h2 className="text-sm font-semibold">What's your primary goal?</h2>
                <p className="mt-1 text-xs text-[#a5abc9]">This shapes your initial brief and suggestions.</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {goals.map((item) => (
                <Choice key={item} selected={goal === item} onClick={() => setGoal(item)}>
                  {item}
                </Choice>
              ))}
            </div>
          </section>
        </div>
        
        <div className="mt-9 flex flex-col gap-4 border-t border-[#30345f] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-[#a5abc9]">
            <span>All data stays in your private workspace. Read our </span>
            <Link href="/privacy" className="font-semibold text-[#aeb6ff] hover:underline">privacy policy</Link>
            <span>.</span>
          </div>
          <button
            onClick={saveProfile}
            disabled={!canContinue || loading}
            className={`inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-md px-4 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              loading ? "bg-[#6c72f3] opacity-70" : canContinue ? "bg-[#6c72f3] hover:bg-[#8187ff]" : "bg-[#3a3f6b]"
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                Completing setup...
              </>
            ) : (
              <>
                Complete setup
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) { 
  return (
    <label className="block text-xs font-semibold text-[#d9ddf3]">
      {label}
      <input 
        type={type} 
        value={value} 
        onChange={(event) => onChange(event.target.value)} 
        placeholder={placeholder} 
        className="mt-2 w-full rounded-md border border-[#30345f] bg-[#111735] px-3.5 py-3 text-sm text-white outline-none placeholder:text-[#72789f] focus:border-[#8993ff] focus:ring-2 focus:ring-[#6c72f3]/20" 
      />
    </label>
  ); 
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) { 
  return (
    <button 
      type="button" 
      onClick={onClick} 
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${
        selected ? "border-[#7782f7] bg-[#20265c] text-white" : "border-[#30345f] bg-[#101633] text-[#a5abc9] hover:border-[#626bc2] hover:text-white"
      }`}
    >
      {selected && <Check size={12} />}
      {children}
    </button>
  ); 
}