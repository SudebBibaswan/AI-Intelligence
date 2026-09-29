"use client";

import { Bell, Check, ChevronRight, Globe2, SlidersHorizontal, Sparkles, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/hooks/workspace";

interface Domain {
  id: string;
  key: string;
  name: string;
  description: string;
}

interface WorkspaceDomain {
  id: string;
  workspace_id: string;
  domain_id: string;
  status: string;
  domain: Domain;
}

const topics = ["Agent infrastructure", "AI evaluation", "AI security", "Enterprise adoption", "Foundation models"];
const regions = ["India", "United States", "Europe"];

function Preference({ label, detail, enabled, onChange }: { label: string; detail: string; enabled: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className="flex w-full items-center justify-between gap-6 border-b border-[#30345f] py-5 text-left last:border-b-0">
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-[#bfc3dc]">{detail}</span>
      </span>
      <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-[#747bf4]" : "bg-[#262c4c]"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${enabled ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

export function WorkspaceSettings() {
  const { workspace, workspaceDomain, isLoading: workspaceLoading, mutate } = useWorkspace();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [currentDomain, setCurrentDomain] = useState<WorkspaceDomain | null>(null);
  const [selectedTopics, setSelectedTopics] = useState(topics.slice(0, 3));
  const [selectedRegions, setSelectedRegions] = useState(regions.slice(0, 2));
  const [preferences, setPreferences] = useState({ daily: true, weekly: false });
  const [changingDomain, setChangingDomain] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainSuccess, setDomainSuccess] = useState<string | null>(null);

  const toggle = (item: string, current: string[], update: (items: string[]) => void) => 
    update(current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);

  useEffect(() => {
    async function loadDomainSettings() {
      if (!workspace?.id) return;
      
      try {
        const response = await fetch("/api/workspace/domain");
        if (response.ok) {
          const data = await response.json();
          setDomains(data.domains || []);
          setCurrentDomain(data.current_domain);
        }
      } catch (err) {
        console.error("Failed to load domain settings:", err);
      }
    }
    loadDomainSettings();
  }, [workspace?.id]);

  const handleChangeDomain = async (domainId: string) => {
    setChangingDomain(true);
    setDomainError(null);
    setDomainSuccess(null);
    
    try {
      const response = await fetch("/api/workspace/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain_id: domainId }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to change domain");
      }
      
      setDomainSuccess("Domain updated successfully");
      await mutate();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : "Failed to change domain");
    } finally {
      setChangingDomain(false);
    }
  };

  const currentDomainName = currentDomain?.domain?.name || "Not configured";
  const currentDomainKey = currentDomain?.domain?.key;

  if (workspaceLoading) return <div className="space-y-9 p-6">Loading workspace...</div>;

  return (
    <div className="space-y-9">
      <header className="border-b border-[#30345f] pb-8">
        <p className="eyebrow mb-3">Personal workspace</p>
        <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Settings & <em className="text-[#929aff]">focus.</em></h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">Set the market context that shapes what you see. These choices stay inside your personal workspace.</p>
      </header>

      <section className="surface overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[#30345f] p-6 sm:p-7">
          <div>
            <p className="eyebrow">Active domain</p>
            <h2 className="mt-2 text-xl font-semibold">{currentDomainName}</h2>
            <p className="mt-2 text-xs leading-5 text-[#bfc3dc]">Your current lens for signals, investment activity, and emerging patterns.</p>
            {domainError && (
              <p className="mt-2 text-xs text-[#e89696] flex items-center gap-1">
                <AlertCircle size={10} />{domainError}
              </p>
            )}
            {domainSuccess && (
              <p className="mt-2 text-xs text-[#8fd19e] flex items-center gap-1">
                <Check size={10} />{domainSuccess}
              </p>
            )}
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-[#535ca5] bg-[#171c42] text-[#aeb6ff]">
            <Sparkles size={18} />
          </span>
        </div>
        
        <div className="grid divide-y divide-[#30345f] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <p className="meta">Workspace</p>
            <p className="mt-2 text-sm font-semibold">{workspace?.name || "Personal workspace"}</p>
          </div>
          <div className="p-5">
            <p className="meta">Domain status</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#b8c0ff]">
              <Check size={14} />{currentDomain ? "Configured" : "Not configured"}
            </p>
          </div>
          {domains.length > 0 && (
            <div className="p-5">
              <p className="meta">Change domain</p>
              <select
                value={currentDomainKey || ""}
                onChange={(e) => handleChangeDomain(e.target.value)}
                disabled={changingDomain}
                className="mt-2 w-full rounded border border-[#30345f] bg-[#111735] px-3 py-2 text-sm text-white outline-none focus:border-[#8993ff]"
              >
                <option value="">Select a domain...</option>
                {domains.map((domain) => (
                  <option key={domain.id} value={domain.id} disabled={domain.id === currentDomainKey}>
                    {domain.name} ({domain.key})
                  </option>
                ))}
              </select>
              {changingDomain && (
                <p className="mt-2 text-xs text-[#a5abc9]">Updating...</p>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <section className="surface p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#171c42] text-[#aeb6ff]">
              <SlidersHorizontal size={17} />
            </span>
            <div>
              <h2 className="text-base font-semibold">Research focus</h2>
              <p className="mt-1 text-xs text-[#bfc3dc]">Tune the themes that should receive more attention.</p>
            </div>
          </div>
          <div className="mt-7">
            <p className="meta">Topics</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {topics.map((topic) => {
                const selected = selectedTopics.includes(topic);
                return (
                  <button 
                    type="button" 
                    key={topic} 
                    onClick={() => toggle(topic, selectedTopics, setSelectedTopics)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${selected ? "border-[#7782f7] bg-[#20265c] text-white" : "border-[#30345f] bg-[#101633] text-[#a5abc9] hover:border-[#626bc2] hover:text-white"}`}
                  >
                    {selected && <Check className="mr-1 inline" size={12} />}{topic}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-7 border-t border-[#30345f] pt-6">
            <p className="meta">Regions</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {regions.map((region) => {
                const selected = selectedRegions.includes(region);
                return (
                  <button 
                    type="button" 
                    key={region} 
                    onClick={() => toggle(region, selectedRegions, setSelectedRegions)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${selected ? "border-[#7782f7] bg-[#20265c] text-white" : "border-[#30345f] bg-[#101633] text-[#a5abc9] hover:border-[#626bc2] hover:text-white"}`}
                  >
                    {selected && <Check className="mr-1 inline" size={12} />}{region}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="surface p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#171c42] text-[#aeb6ff]">
              <Globe2 size={17} />
            </span>
            <div>
              <h2 className="text-base font-semibold">Coverage</h2>
              <p className="mt-1 text-xs text-[#bfc3dc]">The cadence your workspace uses to surface relevant market change.</p>
            </div>
          </div>
          <div className="mt-7 rounded-lg border border-[#30345f] bg-[#101633] p-4">
            <p className="meta">Research cadence</p>
            <p className="mt-2 text-sm font-semibold">Daily market brief</p>
            <p className="mt-1 text-xs text-[#bfc3dc]">A calm summary of meaningful changes, not every headline.</p>
          </div>
        </section>
      </div>

      <section className="surface p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#171c42] text-[#aeb6ff]">
            <Bell size={17} />
          </span>
          <div>
            <h2 className="text-base font-semibold">Notifications</h2>
            <p className="mt-1 text-xs text-[#bfc3dc]">Decide when you want your intelligence workspace to nudge you.</p>
          </div>
        </div>
        <div className="mt-5">
          <Preference 
            label="Daily intelligence brief" 
            detail="Receive a concise daily view of the most meaningful changes." 
            enabled={preferences.daily} 
            onChange={() => setPreferences((value) => ({ ...value, daily: !value.daily }))} 
          />
          <Preference 
            label="Weekly reflection" 
            detail="A weekly summary of saved intelligence and developing ideas." 
            enabled={preferences.weekly} 
            onChange={() => setPreferences((value) => ({ ...value, weekly: !value.weekly }))} 
          />
        </div>
      </section>
    </div>
  );
}