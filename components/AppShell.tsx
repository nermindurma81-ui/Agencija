'use client';

import { useState } from 'react';
import AgencyStudio from '@/components/AgencyStudio';
import Dashboard from '@/components/Dashboard';
import type { Agent } from '@/lib/github';
import { MessageSquare, Settings2, Sparkles } from 'lucide-react';

type ViewMode = 'studio' | 'chat';

export default function AppShell({ agentsByDept }: { agentsByDept: Record<string, Agent[]> }) {
  const [view, setView] = useState<ViewMode>('studio');

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.24em] text-white/65">Agencija Views</p>
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setView('studio')}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                view === 'studio' ? 'bg-[#ff7a1a] text-black' : 'text-white/75 hover:bg-white/10'
              }`}
            >
              <Sparkles size={14} />
              Studio
            </button>
            <button
              type="button"
              onClick={() => setView('chat')}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                view === 'chat' ? 'bg-[#61ffad] text-black' : 'text-white/75 hover:bg-white/10'
              }`}
            >
              <MessageSquare size={14} />
              Chat + Models
            </button>
          </div>
          {view === 'chat' ? (
            <button
              type="button"
              onClick={() => (window as any).openSettings?.()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
            >
              <Settings2 size={14} />
              Provider settings
            </button>
          ) : null}
        </div>
      </div>

      {view === 'studio' ? <AgencyStudio agentsByDept={agentsByDept} /> : <Dashboard agentsByDept={agentsByDept} />}
    </>
  );
}
