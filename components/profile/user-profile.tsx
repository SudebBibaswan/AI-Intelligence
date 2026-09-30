"use client";

import { Bookmark, Building2, Check, Heart, Mail, Pencil, Share2, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/hooks/workspace";

const roles = ["Student", "Founder", "Working professional", "Investor / analyst", "Researcher"];
const interests = ["Track AI investments", "Spot emerging patterns", "Research companies", "Develop a market thesis"];

interface WorkspaceSettings {
  user_profile?: {
    name: string;
    email: string;
    organisation: string;
    role: string;
    interest: string;
  };
}

export function UserProfile() {
  const { user, profile: userProfile, isLoading, mutate } = useCurrentUser();
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    organisation: "",
    role: "Student",
    interest: "Track AI investments",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.display_name) {
      setDraft((prev) => ({ ...prev, name: userProfile.display_name }));
    }
    if (user?.email) {
      setDraft((prev) => ({ ...prev, email: user.email }));
    }
  }, [userProfile, user]);

  useEffect(() => {
    async function loadWorkspaceSettings() {
      try {
        const response = await fetch("/api/workspace/current");
        if (response.ok) {
          const data = await response.json();
          if (data.workspace?.settings?.user_profile) {
            setWorkspaceSettings(data.workspace.settings);
            setDraft((prev) => ({ ...prev, ...data.workspace.settings.user_profile }));
          }
        }
      } catch (err) {
        console.error("Failed to load workspace settings:", err);
      }
    }
    loadWorkspaceSettings();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) throw new Error("Failed to save profile");
      
      await mutate();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  if (isLoading) return <div className="space-y-9 p-6">Loading profile...</div>;

  const displayName = userProfile?.display_name || user?.email?.split("@")[0] || "User";
  const displayRole = userProfile?.onboarding_state === "complete" ? "Active" : "Onboarding";

  return (
    <div className="space-y-9">
      <header className="flex flex-col justify-between gap-5 border-b border-[#30345f] pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow mb-3">Personal workspace</p>
          <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Your <em className="text-[#929aff]">profile.</em></h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">
            Your account details, onboarding context, and personal intelligence activity.
          </p>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button className="button" onClick={() => { setDraft({ ...draft }); setEditing(false); }}>
              <X size={14} />Cancel
            </button>
            <button className="button button-primary" onClick={save} disabled={saving}>
              <Check size={14} />{saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        ) : (
          <button className="button w-fit" onClick={() => { setDraft({ ...draft }); setEditing(true); }}>
            <Pencil size={14} />Edit profile
          </button>
        )}
      </header>

      {error && (
        <div className="rounded-md border border-[#7a4b4b] bg-[#381818] p-3 text-sm text-[#e89696]">
          {error}
        </div>
      )}

      <section className="surface p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <span className="grid h-20 w-20 place-items-center rounded-full border border-[#7782f7] bg-[#20265c] font-display text-4xl text-[#c3c9ff]">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold">{displayName}</h2>
            <p className="mt-1 text-sm text-[#bfc3dc]">{displayRole} · Personal workspace</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#a5abc9]">
              <Mail size={13} />{user?.email || "No email"}
            </p>
          </div>
        </div>

        {editing && (
          <div className="mt-7 grid gap-5 border-t border-[#30345f] pt-6 sm:grid-cols-2">
            <Input label="Full name" value={draft.name} onChange={(value) => update("name", value)} />
            <Input label="Gmail address" value={draft.email} onChange={(value) => update("email", value)} type="email" />
            <Input label="Company or university" value={draft.organisation} onChange={(value) => update("organisation", value)} />
            <Select label="What best describes you" value={draft.role} options={roles} onChange={(value) => update("role", value)} />
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-[#d9ddf3]">Primary goal</label>
              <Select label="Primary goal" value={draft.interest} options={interests} onChange={(value) => update("interest", value)} />
            </div>
          </div>
        )}

        {!editing && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Info icon={UserRound} label="Role" value={draft.role || "Not set"} />
            <Info icon={Building2} label="Organization" value={draft.organisation || "Not set"} />
            <Info icon={Heart} label="Interest" value={draft.interest || "Not set"} />
            <Info icon={Mail} label="Email" value={draft.email || user?.email || "Not set"} />
          </div>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold">Account</h2>
        <div className="surface p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#20265c] font-mono text-sm text-[#aeb6ff]">ID</span>
              <div>
                <p className="text-sm font-semibold">Supabase Auth</p>
                <p className="meta mt-0.5 font-mono text-xs">{user?.id?.slice(0, 8)}...</p>
              </div>
            </div>
            <span className="rounded border border-[#4b7a5e] bg-[#183828] px-2 py-1 font-mono text-[9px] text-[#8fd19e]">Connected</span>
          </div>
        </div>

        <h2 className="text-lg font-semibold">Activity</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Activity icon={Bookmark} value={0} label="Saved items" />
          <Activity icon={Heart} value={0} label="Liked items" />
          <Activity icon={Share2} value={0} label="Shared items" />
        </div>
      </section>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="text-xs font-semibold text-[#d9ddf3]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-[#30345f] bg-[#111735] px-3.5 py-3 text-sm text-white outline-none focus:border-[#8993ff]"
      />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-semibold text-[#d9ddf3]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-[#30345f] bg-[#111735] px-3.5 py-3 text-sm text-white outline-none focus:border-[#8993ff]">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Bookmark; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[#aeb6ff]">
        <Icon size={14} />
        <p className="meta">{label}</p>
      </div>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Activity({ icon: Icon, value, label }: { icon: typeof Bookmark; value: number; label: string }) {
  return (
    <section className="surface flex items-center gap-3 p-5">
      <Icon size={17} className="text-[#aeb6ff]" />
      <div>
        <p className="font-mono text-2xl font-semibold text-[#c3c9ff]">{value}</p>
        <p className="mt-1 text-xs text-[#a5abc9]">{label}</p>
      </div>
    </section>
  );
}
