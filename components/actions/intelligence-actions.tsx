"use client";

import { Bookmark, Check, Heart, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { readPersonalization, updatePersonalization } from "@/lib/personalization";

export function IntelligenceActions({ title, path }: { title: string; path: string }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);
  const type: "Signal" | "Pattern" | "Hypothesis" = path.startsWith("/signals/") ? "Signal" : path.startsWith("/patterns/") ? "Pattern" : "Hypothesis";
  const record = () => ({ path, type, title: document.querySelector("h1")?.textContent?.trim() || title });
  useEffect(() => { const current = readPersonalization().find((item) => item.path === path); if (current) { setLiked(current.liked); setSaved(current.saved); setShared(current.shared); } }, [path]);
  const toggleLike = () => { const next = !liked; setLiked(next); updatePersonalization(record(), { liked: next }); };
  const toggleSave = () => { const next = !saved; setSaved(next); updatePersonalization(record(), { saved: next }); };
  const share = async () => { const url = `${window.location.origin}${path}`; if (navigator.share) await navigator.share({ title: record().title, url }); else await navigator.clipboard.writeText(url); setShared(true); updatePersonalization(record(), { shared: true }); window.setTimeout(() => setShared(false), 1800); };
  return <div className="flex flex-wrap gap-2"><button type="button" onClick={toggleLike} aria-pressed={liked} className={`button min-h-9 px-3 ${liked ? "border-[#b87bea] bg-[#321d48] text-[#e6c8ff]" : ""}`}><Heart size={14} fill={liked ? "currentColor" : "none"} />{liked ? "Liked" : "Like"}</button><button type="button" onClick={toggleSave} aria-pressed={saved} className={`button min-h-9 px-3 ${saved ? "border-[#7782f7] bg-[#20265c] text-white" : ""}`}><Bookmark size={14} fill={saved ? "currentColor" : "none"} />{saved ? "Saved" : "Save"}</button><button type="button" onClick={share} className="button min-h-9 px-3">{shared ? <Check size={14} /> : <Share2 size={14} />}{shared ? "Link copied" : "Share"}</button></div>;
}
