"use client";

import Link from "next/link";
import { ArrowUpRight, Bookmark, FolderHeart, Heart, Search, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { personalizationEventName, readPersonalization, type PersonalizationRecord } from "@/lib/personalization";

type ActivityFilter = "saved" | "liked" | "shared";

const activityCopy: Record<ActivityFilter, { label: string; tag: string; empty: string; summary: string; dateLabel: string }> = {
  saved: { label: "Saved by you", tag: "Saved by you", empty: "No saved intelligence matches this view yet. Save a signal, pattern, or hypothesis to add it here.", summary: "Open this saved item to return to its original evidence and context.", dateLabel: "Saved" },
  liked: { label: "Liked by you", tag: "Liked by you", empty: "No liked intelligence matches this view yet. Like an item to use it for future personalisation.", summary: "Open this liked item to return to its original evidence and context.", dateLabel: "Liked" },
  shared: { label: "Shared by you", tag: "Shared by you", empty: "No shared intelligence matches this view yet. Share an item to keep it in this collection.", summary: "Open this shared item to return to its original evidence and context.", dateLabel: "Shared" },
};

export function SavedIntelligence() {
  const [typeFilter, setTypeFilter] = useState("All");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("saved");
  const [query, setQuery] = useState("");
  const [personal, setPersonal] = useState<PersonalizationRecord[]>([]);

  useEffect(() => {
    const sync = () => setPersonal(readPersonalization());
    sync();
    window.addEventListener(personalizationEventName, sync);
    return () => window.removeEventListener(personalizationEventName, sync);
  }, []);

  const saved = personal.filter((item) => item.saved);
  const liked = personal.filter((item) => item.liked);
  const shared = personal.filter((item) => item.shared);
  const collection = personal.filter((item) => item[activityFilter]);
  const copy = activityCopy[activityFilter];
  const items = collection.map((item) => ({
    type: item.type,
    title: item.title,
    summary: copy.summary,
    href: item.path,
    tag: copy.tag,
    date: new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  const visible = items.filter((item) =>
    (typeFilter === "All" || item.type === typeFilter) && item.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-9">
      <header className="border-b border-[#30345f] pb-8">
        <p className="eyebrow mb-3">Personal knowledge / Workspace library</p>
        <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Saved intelligence.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">Your saves form a personal research memory. Your likes and shares tell the workspace which kinds of intelligence should become more prominent.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Your intelligence collections">
        <Metric icon={Bookmark} value={saved.length} label="Saved by you" active={activityFilter === "saved"} onClick={() => setActivityFilter("saved")} />
        <Metric icon={Heart} value={liked.length} label="Liked by you" active={activityFilter === "liked"} onClick={() => setActivityFilter("liked")} />
        <Metric icon={Share2} value={shared.length} label="Shared by you" active={activityFilter === "shared"} onClick={() => setActivityFilter("shared")} />
      </section>

      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto" aria-label="Filter intelligence by type">
          {["All", "Signal", "Pattern", "Hypothesis"].map((item) => (
            <button onClick={() => setTypeFilter(item)} className={`whitespace-nowrap rounded px-3 py-2 text-xs font-semibold ${typeFilter === item ? "bg-[#20265c] text-white" : "text-[#a5abc9] hover:bg-[#171c42]"}`} key={item}>
              {item === "All" ? "All" : `${item}s`}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-md border border-[#30345f] bg-[#111735] px-3 py-2">
          <Search size={14} className="text-[#8d93b6]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-48 bg-transparent text-xs text-white outline-none placeholder:text-[#72789f]" placeholder={`Search ${copy.label.toLowerCase()}`} />
        </label>
      </section>

      <section className="surface overflow-hidden px-5 sm:px-7" aria-label={copy.label}>
        {visible.map((item) => (
          <Link href={item.href} className="group flex gap-4 border-b border-[#30345f] py-5 last:border-0" key={item.href}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded bg-[#20275a] text-[#aeb6ff]">
              {activityFilter === "liked" ? <Heart size={15} /> : activityFilter === "shared" ? <Share2 size={15} /> : <Bookmark size={15} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="eyebrow">{item.type}</span><span className="rounded border border-[#3b4378] px-1.5 py-0.5 font-mono text-[9px] text-[#a5abc9]">{item.tag}</span></div>
              <div className="mt-2 flex items-start justify-between gap-4"><h2 className="text-sm font-semibold group-hover:text-[#aeb6ff]">{item.title}</h2><span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#aeb6ff]">Open <ArrowUpRight size={13} /></span></div>
              <p className="mt-1 text-xs leading-5 text-[#bfc3dc]">{item.summary}</p>
              <p className="mt-3 font-mono text-[10px] text-[#8d93b6]">{copy.dateLabel} {item.date}</p>
            </div>
          </Link>
        ))}
        {visible.length === 0 && <p className="py-10 text-center text-sm text-[#a5abc9]">{copy.empty}</p>}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="surface p-6"><FolderHeart size={17} className="text-[#aeb6ff]" /><h2 className="mt-4 text-sm font-semibold">Your research memory · {saved.length} saved</h2><p className="mt-2 text-xs leading-6 text-[#bfc3dc]">Every saved signal, pattern, or hypothesis appears above as a direct link back to its evidence and context.</p></div>
        <div className="surface p-6"><Heart size={17} className="text-[#aeb6ff]" /><h2 className="mt-4 text-sm font-semibold">Your personalisation · {liked.length} liked</h2><p className="mt-2 text-xs leading-6 text-[#bfc3dc]">Liked and shared items are used to rank future signals, patterns, and investment themes closer to your interests.</p></div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, value, label, active, onClick }: { icon: typeof Bookmark; value: number; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`surface flex items-center gap-3 p-4 text-left transition hover:border-[#7076f6] ${active ? "border-[#7076f6] bg-[#171c42]" : ""}`}>
      <Icon size={16} className="text-[#aeb6ff]" />
      <div><p className="font-mono text-lg font-semibold text-[#c3c9ff]">{value}</p><p className="text-[10px] text-[#a5abc9]">{label}</p></div>
    </button>
  );
}
