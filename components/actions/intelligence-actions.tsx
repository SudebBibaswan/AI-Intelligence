"use client";

import { Bookmark, Check, Heart, Share2, Play, Zap, Brain, Activity, GitBranch, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { readPersonalization, updatePersonalization } from "@/lib/personalization";
import { useWorkspace } from "@/lib/hooks/workspace";

const ENGINES = [
  { id: 'research', label: 'Research Engine', icon: Brain, description: 'Discover & extract sources' },
  { id: 'observation', label: 'Observation Engine', icon: Activity, description: 'Generate observations from evidence' },
  { id: 'signal', label: 'Signal Engine', icon: Zap, description: 'Detect market signals' },
  { id: 'hypothesis', label: 'Hypothesis Engine', icon: GitBranch, description: 'Form testable hypotheses' },
  { id: 'pattern', label: 'Pattern Engine', icon: Brain, description: 'Find recurring patterns' },
  { id: 'quality', label: 'Quality Engine', icon: Activity, description: 'Assess research quality' },
  { id: 'thesis', label: 'Thesis Engine', icon: GitBranch, description: 'Generate investment theses' },
  { id: 'validation', label: 'Validation Engine', icon: Check, description: 'Validate hypotheses' },
  { id: 'capital_flow', label: 'Capital Flow Engine', icon: Zap, description: 'Map capital movements' },
  { id: 'evidence_review', label: 'Evidence Review', icon: Activity, description: 'Human review queue' },
] as const;

export function IntelligenceActions({ title, path }: { title: string; path: string }) {
  const { workspace, workspaceDomain } = useWorkspace();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerResults, setTriggerResults] = useState<Record<string, { status: string; message?: string }>>({});
  const [showEngines, setShowEngines] = useState(false);
  
  const type: "Signal" | "Pattern" | "Hypothesis" = path.startsWith("/signals/") ? "Signal" : path.startsWith("/patterns/") ? "Pattern" : "Hypothesis";
  const record = () => ({ path, type, title: document.querySelector("h1")?.textContent?.trim() || title });
  const workspaceId = workspace?.id;
  const workspaceDomainId = workspaceDomain?.id;

  useEffect(() => {
    const current = readPersonalization().find((item) => item.path === path);
    if (current) { setLiked(current.liked); setSaved(current.saved); setShared(current.shared); }
  }, [path]);

  const toggleLike = () => { const next = !liked; setLiked(next); updatePersonalization(record(), { liked: next }); };
  const toggleSave = () => { const next = !saved; setSaved(next); updatePersonalization(record(), { saved: next }); };
  const share = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) await navigator.share({ title: record().title, url });
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      setShared(true);
      updatePersonalization(record(), { shared: true });
      window.setTimeout(() => setShared(false), 1800);
    } catch { setShared(false); }
  };

  const triggerEngine = async (engineId: string) => {
    if (!workspaceId || !workspaceDomainId) return;
    
    setTriggering(engineId);
    setTriggerResults(prev => ({ ...prev, [engineId]: { status: 'triggering', message: 'Starting...' } }));
    
    try {
      const response = await fetch('/api/intelligence/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          workspace_domain_id: workspaceDomainId,
          trigger_type: 'manual',
          engine: engineId,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTriggerResults(prev => ({ 
          ...prev, 
          [engineId]: { status: 'success', message: data.message || 'Triggered successfully' } 
        }));
      } else {
        setTriggerResults(prev => ({ 
          ...prev, 
          [engineId]: { status: 'error', message: data.error || 'Failed to trigger' } 
        }));
      }
    } catch (err) {
      setTriggerResults(prev => ({ 
        ...prev, 
        [engineId]: { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' } 
      }));
    } finally {
      setTriggering(null);
    }
  };

  const triggerAll = async () => {
    if (!workspaceId || !workspaceDomainId) return;
    
    setTriggering('all');
    setTriggerResults({});
    
    try {
      const response = await fetch('/api/intelligence/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          workspace_domain_id: workspaceDomainId,
          trigger_type: 'manual',
          engine: 'all',
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        data.results?.forEach((r: any) => {
          setTriggerResults(prev => ({ 
            ...prev, 
            [r.engine]: { status: r.status === 'triggered' ? 'success' : 'error', message: r.status } 
          }));
        });
      }
    } catch (err) {
      console.error('Trigger all failed:', err);
    } finally {
      setTriggering(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <button 
          type="button" 
          onClick={() => setShowEngines(!showEngines)} 
          className={`button min-h-9 px-3 ${showEngines ? "border-[#7782f7] bg-[#20265c] text-white" : ""}`}
        >
          <Play size={14} className={triggering === 'all' ? "animate-spin" : ""} />
          {showEngines ? "Hide Engines" : "Run Engines"}
        </button>
        
        {showEngines && (
          <div className="fixed bottom-full left-0 right-0 mb-2 p-3 surface border border-[#30345f] rounded-t-lg shadow-lg z-10 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#a5abc9]">INTELLIGENCE ENGINES</p>
              <button onClick={() => setShowEngines(false)} className="text-xs text-[#a5abc9] hover:text-white">Close</button>
            </div>
            <button 
              onClick={triggerAll} 
              disabled={triggering === 'all'}
              className="w-full mb-3 button button-primary text-xs"
            >
              <Zap size={12} className={triggering === 'all' ? "animate-spin" : ""} />
              {triggering === 'all' ? 'Running all engines...' : 'Run All Engines'}
            </button>
            <div className="grid gap-2 max-h-[40vh] overflow-y-auto">
              {ENGINES.map(({ id, label, icon: Icon, description }) => {
                const result = triggerResults[id];
                const IconComponent = Icon;
                return (
                  <button
                    key={id}
                    onClick={() => triggerEngine(id)}
                    disabled={triggering === id}
                    className={`button text-left p-3 gap-3 ${triggering === id ? "bg-[#20265c] border-[#7782f7]" : result?.status === 'success' ? "bg-[#183828] border-[#4b7a5e]" : result?.status === 'error' ? "bg-[#381818] border-[#7a4b4b]" : ""}`}
                  >
                    <IconComponent size={14} className="text-[#aeb6ff] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{label}</p>
                      <p className="text-[10px] text-[#a5abc9] truncate">{description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {triggering === id && <Play size={12} className="animate-spin" />}
                      {result?.status === 'success' && <Check size={12} className="text-[#8fd19e]" />}
                      {result?.status === 'error' && <span className="text-[10px] text-[#e89696]">!</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <button type="button" onClick={toggleLike} aria-pressed={liked} className={`button min-h-9 px-3 ${liked ? "border-[#b87bea] bg-[#321d48] text-[#e6c8ff]" : ""}`}>
        <Heart size={14} fill={liked ? "currentColor" : "none"} />{liked ? "Liked" : "Like"}
      </button>
      <button type="button" onClick={toggleSave} aria-pressed={saved} className={`button min-h-9 px-3 ${saved ? "border-[#7782f7] bg-[#20265c] text-white" : ""}`}>
        <Bookmark size={14} fill={saved ? "currentColor" : "none"} />{saved ? "Saved" : "Save"}
      </button>
      <button type="button" onClick={share} className="button min-h-9 px-3">
        {shared ? <Check size={14} /> : <Share2 size={14} />}{shared ? "Link copied" : "Share"}
      </button>
    </div>
  );
}