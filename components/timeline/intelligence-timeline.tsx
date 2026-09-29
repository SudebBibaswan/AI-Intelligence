"use client";

import Link from "next/link";
import { Bookmark, CalendarDays, CircleDot, Layers3, Landmark, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/hooks/workspace";
import { fetchSignals, fetchPatterns, fetchInvestments } from "@/lib/api/intelligence";

interface TimelineEvent {
  id: string;
  date: string;
  day: string;
  time: string;
  type: "Investment" | "Signal" | "Pattern" | "Saved";
  title: string;
  detail: string;
  icon: typeof Landmark;
  href: string;
}

export function IntelligenceTimeline() {
  const { workspace, workspaceDomain, isLoading: workspaceLoading } = useWorkspace();
  const [filter, setFilter] = useState("All activity");
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [days, setDays] = useState<Array<{ id: string; weekday: string; date: string; month: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const workspaceId = workspace?.id;
  const workspaceDomainId = workspaceDomain?.id;

  useEffect(() => {
    // Generate last 7 days
    const dayList = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return {
        id: d.toISOString().split('T')[0],
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: d.getDate().toString(),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
      };
    });
    setDays(dayList);
    setSelectedDay(dayList[0].id);
  }, []);

  useEffect(() => {
    async function loadTimelineData() {
      if (!workspaceId || !workspaceDomainId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [signalsRes, patternsRes, investmentsRes] = await Promise.all([
          fetchSignals({ workspace_id: workspaceId, domain_id: workspaceDomainId, limit: 100, status: 'accepted' }),
          fetchPatterns({ workspace_id: workspaceId, domain_id: workspaceDomainId, limit: 50, status: 'persistent' }),
          fetchInvestments({ workspace_id: workspaceId, domain_id: workspaceDomainId, limit: 50 }),
        ]);

        const timelineEvents: TimelineEvent[] = [];

        // Add signals
        signalsRes.data.forEach((signal: any) => {
          const eventDate = signal.event_at ? signal.event_at.split('T')[0] : signal.created_at.split('T')[0];
          timelineEvents.push({
            id: signal.id,
            date: eventDate,
            day: formatDay(eventDate),
            time: formatTime(signal.event_at || signal.created_at),
            type: "Signal",
            title: signal.title,
            detail: `${signal.signal_evidence?.length || 0} evidence · ${Math.round((signal.confidence || 0) * 100)}% confidence`,
            icon: Sparkles,
            href: `/signals/${signal.id}`,
          });
        });

        // Add patterns
        patternsRes.data.forEach((pattern: any) => {
          const eventDate = pattern.last_confirmed_at ? pattern.last_confirmed_at.split('T')[0] : pattern.created_at.split('T')[0];
          timelineEvents.push({
            id: pattern.id,
            date: eventDate,
            day: formatDay(eventDate),
            time: formatTime(pattern.last_confirmed_at || pattern.created_at),
            type: "Pattern",
            title: pattern.statement,
            detail: `${(pattern.metadata?.observation_count as number) || 0} observations · Strength ${Math.round(pattern.strength_score * 100)}%`,
            icon: Layers3,
            href: `/patterns/${pattern.id}`,
          });
        });

        // Add investments
        investmentsRes.data.forEach((inv: any) => {
          const eventDate = inv.announced_at ? inv.announced_at.split('T')[0] : inv.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];
          timelineEvents.push({
            id: inv.id,
            date: eventDate,
            day: formatDay(eventDate),
            time: formatTime(inv.announced_at || inv.created_at),
            type: "Investment",
            title: `${inv.company?.name || 'Company'} closes ${inv.round_type || 'round'} for ${inv.company?.ai_domain || 'AI'}`,
            detail: `$${((inv.amount_usd || inv.amount || 0) / 1000000).toFixed(1)}m · ${inv.investors?.map((i: any) => i.investor?.name).join(', ') || 'Undisclosed'}`,
            icon: Landmark,
            href: `/companies/${inv.company?.name?.toLowerCase().replace(/\s+/g, '-') || inv.id}`,
          });
        });

        // Sort by date descending, then by time
        timelineEvents.sort((a, b) => {
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          return b.time.localeCompare(a.time);
        });

        setEvents(timelineEvents);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load timeline');
      } finally {
        setLoading(false);
      }
    }

    if (!workspaceLoading) {
      loadTimelineData();
    }
  }, [workspaceId, workspaceDomainId, workspaceLoading]);

  const visible = events.filter((event) => (filter === "All activity" || event.type === filter) && event.date === selectedDay);

  if (workspaceLoading) return <div className="space-y-9 p-6">Loading workspace...</div>;
  if (loading) return <div className="space-y-9 p-6">Loading timeline...</div>;
  if (error) return <div className="space-y-9 p-6">Error: {error}</div>;
  if (!workspace || !workspaceDomain) return <div className="space-y-9 p-6">Please complete onboarding to set up your workspace.</div>;

  return (
    <div className="space-y-9">
      <header className="flex flex-col justify-between gap-5 border-b border-[#30345f] pb-8 md:flex-row md:items-end">
        <div>
          <p className="eyebrow mb-3">Artificial Intelligence / Learning timeline</p>
          <h1 className="font-display text-5xl leading-[.98] sm:text-6xl">Your intelligence <em className="text-[#929aff]">timeline.</em></h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#bfc3dc]">Review the sequence of market changes and the ideas you chose to keep—like a course feed for your selected domain.</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-[#aeb6ff]" />
          <span className="font-mono text-[10px] text-[#a5abc9]">Last 7 days</span>
        </div>
      </header>

      <section aria-label="Choose a date" className="-mx-4 overflow-x-auto px-4 sm:-mx-8 sm:px-8">
        <div className="flex min-w-max gap-3">
          {days.map((day) => {
            const selected = day.id === selectedDay;
            return (
              <button
                type="button"
                aria-pressed={selected}
                key={day.id}
                onClick={() => setSelectedDay(day.id)}
                className={`grid h-28 w-24 place-items-center rounded-[1.8rem] border text-center transition sm:h-32 sm:w-28 ${
                  selected
                    ? "border-[#aeb6ff]/60 bg-[#909fc0] text-white shadow-[0_12px_35px_rgba(111,126,190,.22)]"
                    : "border-[#20243d] bg-[#12131a] text-[#a5abc9] hover:border-[#515a97] hover:bg-[#171a2a] hover:text-white"
                }`}
              >
                <span>
                  <span className="block text-base font-medium tracking-tight">{day.weekday}</span>
                  <strong className="mt-1.5 block text-3xl leading-none">{day.date}</strong>
                  <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-widest">{day.month}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex gap-1 overflow-x-auto border-b border-[#30345f]">
        {["All activity", "Investment", "Signal", "Pattern", "Saved"].map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold ${
              filter === item ? "border-[#7076f6] text-[#c2c7ff]" : "border-transparent text-[#a5abc9] hover:text-white"
            }`}
          >
            {item}
          </button>
        ))}
      </section>

      {visible.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-[#bfc3dc]">No events for this filter and date.</p>
          <p className="mt-2 text-sm text-[#a5abc9]">Run research scans to populate your timeline with real market intelligence.</p>
        </div>
      ) : (
        <section className="space-y-4">
          {visible.map((event) => (
            <article key={event.id} className="surface flex gap-4 p-5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#171c42] text-[#aeb6ff] shrink-0">
                <event.icon size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{event.title}</h3>
                    <span className="rounded border border-[#3b4378] bg-[#171c42] px-2 py-0.5 font-mono text-[9px] text-[#a5abc9]">{event.type}</span>
                  </div>
                  <Link href={event.href} className="text-xs font-semibold text-[#aeb6ff] hover:underline shrink-0">Open</Link>
                </div>
                <p className="mt-1 text-xs text-[#a5abc9] line-clamp-2">{event.detail}</p>
                <p className="mt-2 flex items-center gap-3 text-[10px] text-[#8d93b6]">
                  <span>{event.day}</span>
                  <span>{event.time}</span>
                </p>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (d.toDateString() === today.toDateString()) return `Today · ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}