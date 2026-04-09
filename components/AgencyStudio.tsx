'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import {
  Bot,
  BrainCircuit,
  ChevronRight,
  Cpu,
  Globe,
  Layers3,
  LogIn,
  LogOut,
  Menu,
  PanelBottom,
  Plus,
  Save,
  ScanSearch,
  Sparkles,
  Upload,
  Download,
  WandSparkles,
} from 'lucide-react';
import { Agent, getAgentPrompt } from '@/lib/github';
import { OrchestrationResponse, RunMemoryEntry, SkillBrainProfile, StudioSettings } from '@/lib/studio-types';
import { WORKFLOWS } from '@/lib/workflows';
import { getToolkitContext, getToolkitsForWorkflow } from '@/lib/toolkits';
import { auth, db, firebaseEnabled } from '@/lib/firebase';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import {
  addDoc,
  collection,
  onSnapshot,
  query as firestoreQuery,
  serverTimestamp,
  where,
} from 'firebase/firestore';

type StudioTab = 'studio' | 'workflows' | 'agents' | 'memory' | 'brain' | 'stack';

const DEFAULT_SETTINGS: StudioSettings = {
  provider: 'openrouter',
  model: 'google/gemini-2.0-flash-001',
  temperature: 0.4,
  ollamaUrl: 'http://localhost:11434',
};

const MEMORY_KEY = 'agencija_run_memory_v1';
const SETTINGS_KEY = 'agencija_studio_settings';
const SKILLS_KEY = 'agencija_skill_brain_v1';
const CLOUD_RUNS = 'studioRuns';
const CLOUD_SKILLS = 'skillBrains';

const TABS: { id: StudioTab; label: string; icon: React.ReactNode }[] = [
  { id: 'studio', label: 'Studio', icon: <BrainCircuit size={18} /> },
  { id: 'workflows', label: 'Flows', icon: <Layers3 size={18} /> },
  { id: 'agents', label: 'Agents', icon: <Bot size={18} /> },
  { id: 'memory', label: 'Memory', icon: <ScanSearch size={18} /> },
  { id: 'brain', label: 'Brain', icon: <Sparkles size={18} /> },
  { id: 'stack', label: 'Stack', icon: <Cpu size={18} /> },
];

function flattenAgents(agentsByDept: Record<string, Agent[]>) {
  return Object.entries(agentsByDept).flatMap(([department, agents]) =>
    agents.map((agent) => ({
      ...agent,
      department,
    }))
  );
}

function summarizeMemory(entries: RunMemoryEntry[]) {
  return entries
    .slice(0, 5)
    .map(
      (entry, index) =>
        `${index + 1}. ${entry.workflowName} with ${entry.selectedAgentName} on ${new Date(entry.createdAt).toISOString()}\nRequest: ${entry.query}\nOutcome: ${entry.final.slice(0, 700)}`
    )
    .join('\n\n');
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}

export default function AgencyStudio({ agentsByDept }: { agentsByDept: Record<string, Agent[]> }) {
  const agents = useMemo(() => flattenAgents(agentsByDept), [agentsByDept]);
  const [activeTab, setActiveTab] = useState<StudioTab>('studio');
  const [selectedAgentPath, setSelectedAgentPath] = useState<string>('');
  const [selectedAgentPrompt, setSelectedAgentPrompt] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(WORKFLOWS[0].id);
  const [query, setQuery] = useState('');
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [response, setResponse] = useState<OrchestrationResponse | null>(null);
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [search, setSearch] = useState('');
  const [memoryEntries, setMemoryEntries] = useState<RunMemoryEntry[]>([]);
  const [webResearchEnabled, setWebResearchEnabled] = useState(true);
  const [liveResearch, setLiveResearch] = useState<any[]>([]);
  const [skills, setSkills] = useState<SkillBrainProfile[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [skillName, setSkillName] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [skillPromptDraft, setSkillPromptDraft] = useState('');
  const [isGeneratingSkill, setIsGeneratingSkill] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const skillImportRef = useRef<HTMLInputElement>(null);
  const memoryImportRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.path === selectedAgentPath) ?? agents[0] ?? null,
    [agents, selectedAgentPath]
  );

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [skills, selectedSkillId]
  );

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return agents;
    const term = search.toLowerCase();
    return agents.filter((agent) => {
      return agent.name.toLowerCase().includes(term) || agent.department.toLowerCase().includes(term);
    });
  }, [agents, search]);

  useEffect(() => {
    const rawSettings = window.localStorage.getItem(SETTINGS_KEY);
    if (rawSettings) {
      try {
        setSettings(JSON.parse(rawSettings));
      } catch {
        window.localStorage.removeItem(SETTINGS_KEY);
      }
    }

    const rawMemory = window.localStorage.getItem(MEMORY_KEY);
    if (rawMemory) {
      try {
        setMemoryEntries(JSON.parse(rawMemory));
      } catch {
        window.localStorage.removeItem(MEMORY_KEY);
      }
    }

    const rawSkills = window.localStorage.getItem(SKILLS_KEY);
    if (rawSkills) {
      try {
        setSkills(JSON.parse(rawSkills));
      } catch {
        window.localStorage.removeItem(SKILLS_KEY);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(memoryEntries));
  }, [memoryEntries]);

  useEffect(() => {
    window.localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
  }, [skills]);

  useEffect(() => {
    if (!selectedAgentPath && agents[0]) {
      setSelectedAgentPath(agents[0].path);
    }
  }, [agents, selectedAgentPath]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedAgent) return;

    getAgentPrompt(selectedAgent.path)
      .then((prompt) => {
        if (!cancelled) setSelectedAgentPrompt(prompt);
      })
      .catch(() => {
        if (!cancelled) setSelectedAgentPrompt('');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAgent]);

  useEffect(() => {
    if (selectedSkill?.preferredWorkflowId) {
      setSelectedWorkflowId(selectedSkill.preferredWorkflowId);
    }
  }, [selectedSkill]);

  const selectedWorkflow = WORKFLOWS.find((workflow) => workflow.id === selectedWorkflowId) ?? WORKFLOWS[0];
  const activeToolkits = useMemo(() => getToolkitsForWorkflow(selectedWorkflowId), [selectedWorkflowId]);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setCloudSyncEnabled(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCloudSyncEnabled(Boolean(currentUser && firebaseEnabled));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid || !db) return;

    const runsQuery = firestoreQuery(
      collection(db, CLOUD_RUNS),
      where('userId', '==', uid)
    );
    const skillsQuery = firestoreQuery(
      collection(db, CLOUD_SKILLS),
      where('userId', '==', uid)
    );

    const unsubRuns = onSnapshot(runsQuery, (snapshot) => {
      const cloudRuns: RunMemoryEntry[] = snapshot.docs.map((entry) => {
        const data = entry.data();
        return {
          id: entry.id,
          createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
          workflowId: data.workflowId,
          workflowName: data.workflowName,
          query: data.query,
          selectedAgentName: data.selectedAgentName,
          selectedAgentPath: data.selectedAgentPath,
          provider: data.provider,
          model: data.model,
          usedWebResearch: Boolean(data.usedWebResearch),
          skillId: data.skillId,
          final: data.final,
          stages: data.stages || [],
        };
      }).sort((a, b) => b.createdAt - a.createdAt);
      setMemoryEntries(cloudRuns);
    });

    const unsubSkills = onSnapshot(skillsQuery, (snapshot) => {
      const cloudSkills: SkillBrainProfile[] = snapshot.docs.map((entry) => {
        const data = entry.data();
        return {
          id: entry.id,
          name: data.name,
          description: data.description,
          systemPrompt: data.systemPrompt,
          preferredWorkflowId: data.preferredWorkflowId,
          providerOverride: data.providerOverride,
          modelOverride: data.modelOverride,
          createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
        };
      }).sort((a, b) => b.createdAt - a.createdAt);
      setSkills(cloudSkills);
    });

    return () => {
      unsubRuns();
      unsubSkills();
    };
  }, [user]);

  function scrollToTab(tab: StudioTab) {
    const viewport = viewportRef.current;
    const index = TABS.findIndex((entry) => entry.id === tab);
    if (!viewport || index < 0) return;
    viewport.scrollTo({
      left: viewport.clientWidth * index,
      behavior: 'smooth',
    });
    setActiveTab(tab);
  }

  function handleViewportScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const index = Math.round(viewport.scrollLeft / viewport.clientWidth);
    const tab = TABS[index]?.id;
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }

  async function runWorkflow() {
    if (!query.trim() || !selectedAgent) return;

    setIsRunning(true);
    setError('');
    setResponse(null);
    setLiveResearch([]);

    try {
      if (webResearchEnabled) {
        const researchRes = await fetch('/api/web/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        const researchData = await researchRes.json();
        if (researchRes.ok) {
          setLiveResearch(researchData.results || []);
        }
      }

      const effectiveSettings: StudioSettings = {
        ...settings,
        provider: selectedSkill?.providerOverride || settings.provider,
        model: selectedSkill?.modelOverride || settings.model,
      };

      const res = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          workflowId: selectedWorkflow.id,
          settings: effectiveSettings,
          selectedAgentName: selectedAgent.name,
          selectedAgentDepartment: selectedAgent.department,
          selectedAgentPrompt,
          skillName: selectedSkill?.name,
          skillPrompt: selectedSkill?.systemPrompt,
          memorySummary: summarizeMemory(memoryEntries),
          enableWebResearch: webResearchEnabled,
          toolContext: getToolkitContext(selectedWorkflow.id),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to run workflow');
      }

      setResponse(data);

      const memoryEntry: RunMemoryEntry = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        workflowId: data.workflowId,
        workflowName: data.workflowName,
        query,
        selectedAgentName: selectedAgent.name,
        selectedAgentPath: selectedAgent.path,
        provider: effectiveSettings.provider,
        model: effectiveSettings.model,
        usedWebResearch: webResearchEnabled,
        skillId: selectedSkill?.id,
        final: data.final,
        stages: data.stages,
      };

      if (user?.uid && cloudSyncEnabled && db) {
        await addDoc(collection(db, CLOUD_RUNS), stripUndefined({
          ...memoryEntry,
          userId: user.uid,
          createdAt: serverTimestamp(),
        }));
      } else {
        setMemoryEntries((prev) => [memoryEntry, ...prev].slice(0, 30));
      }
      scrollToTab('studio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run workflow');
    } finally {
      setIsRunning(false);
    }
  }

  async function generateSkillBrain() {
    if (!skillName.trim() || !skillDescription.trim()) return;

    setIsGeneratingSkill(true);
    try {
      const provider = settings.provider;
      const model = settings.model;
      const systemPrompt = [
        'You create compact operational system prompts for AI workflow profiles.',
        'Return only the prompt body, no markdown fence, no explanation.',
        'Make it practical, execution-driven, and honest about limitations.',
      ].join('\n');

      const userPrompt = [
        `Skill name: ${skillName}`,
        `Description: ${skillDescription}`,
        `Preferred workflow: ${selectedWorkflow.name}`,
        `Current specialist: ${selectedAgent?.name || 'Generalist'}`,
        'Write a reusable system prompt that helps this skill operate as a strong execution brain inside an agent workflow studio.',
      ].join('\n');

      const res = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userPrompt,
          workflowId: 'product-launch-squad',
          settings: { ...settings, provider, model },
          selectedAgentName: 'Skill Brain Builder',
          selectedAgentDepartment: 'specialized',
          selectedAgentPrompt: systemPrompt,
          enableWebResearch: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate skill brain');
      }

      setSkillPromptDraft(data.final);
      scrollToTab('brain');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate skill');
    } finally {
      setIsGeneratingSkill(false);
    }
  }

  function saveSkillBrain() {
    if (!skillName.trim() || !skillPromptDraft.trim()) return;

    const profile: SkillBrainProfile = {
      id: crypto.randomUUID(),
      name: skillName.trim(),
      description: skillDescription.trim(),
      systemPrompt: skillPromptDraft.trim(),
      preferredWorkflowId: selectedWorkflow.id,
      createdAt: Date.now(),
    };

    const persist = async () => {
      if (user?.uid && cloudSyncEnabled && db) {
        const ref = await addDoc(collection(db, CLOUD_SKILLS), stripUndefined({
          ...profile,
          userId: user.uid,
          createdAt: serverTimestamp(),
        }));
        setSelectedSkillId(ref.id);
      } else {
        setSkills((prev) => [profile, ...prev]);
        setSelectedSkillId(profile.id);
      }

      setSkillName('');
      setSkillDescription('');
      setSkillPromptDraft('');
      scrollToTab('studio');
    };

    void persist();
  }

  async function handleLogin() {
    if (!auth) {
      setError('Firebase nije konfigurisan. Dodaj NEXT_PUBLIC_FIREBASE_* varijable.');
      return;
    }
    await signInWithPopup(auth, new GoogleAuthProvider());
  }

  async function handleLogout() {
    if (!auth) {
      setCloudSyncEnabled(false);
      return;
    }
    await signOut(auth);
    setCloudSyncEnabled(false);
  }

  function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportSkills() {
    downloadJson('agencija-skill-brains.json', skills);
  }

  function exportMemory() {
    downloadJson('agencija-run-memory.json', memoryEntries);
  }

  async function importSkills(file: File) {
    const text = await file.text();
    const parsed = JSON.parse(text) as SkillBrainProfile[];
    if (!Array.isArray(parsed)) throw new Error('Invalid skill import file');

    if (user?.uid && cloudSyncEnabled && db) {
      for (const profile of parsed) {
        await addDoc(collection(db, CLOUD_SKILLS), stripUndefined({
          ...profile,
          userId: user.uid,
          createdAt: serverTimestamp(),
        }));
      }
    } else {
      setSkills((prev) => {
        const merged = [...parsed, ...prev];
        const deduped = merged.filter((item, index) => merged.findIndex((candidate) => candidate.name === item.name && candidate.systemPrompt === item.systemPrompt) === index);
        return deduped;
      });
    }
  }

  async function importMemory(file: File) {
    const text = await file.text();
    const parsed = JSON.parse(text) as RunMemoryEntry[];
    if (!Array.isArray(parsed)) throw new Error('Invalid memory import file');

    if (user?.uid && cloudSyncEnabled && db) {
      for (const entry of parsed) {
        await addDoc(collection(db, CLOUD_RUNS), stripUndefined({
          ...entry,
          userId: user.uid,
          createdAt: serverTimestamp(),
        }));
      }
    } else {
      setMemoryEntries((prev) => {
        const merged = [...parsed, ...prev];
        const deduped = merged.filter((item, index) => merged.findIndex((candidate) => candidate.query === item.query && candidate.final === item.final) === index);
        return deduped.slice(0, 50);
      });
    }
  }

  function loadMemoryEntry(entry: RunMemoryEntry) {
    setQuery(entry.query);
    setSelectedWorkflowId(entry.workflowId);
    setSelectedAgentPath(entry.selectedAgentPath);
    setResponse({
      workflowId: entry.workflowId,
      workflowName: entry.workflowName,
      final: entry.final,
      stages: entry.stages,
    });
    setSelectedSkillId(entry.skillId || '');
    scrollToTab('studio');
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ffc57a_0%,#20140d_30%,#090909_70%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#120d09]/80 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-4 md:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#ffb15c]/30 bg-[#ff7a1a] text-black shadow-[0_10px_30px_rgba(255,122,26,0.35)]">
                <Sparkles size={20} />
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#ffbf80]">Agencija OS</p>
                <h1 className="font-display text-2xl leading-none tracking-tight">Agent Machinery</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => scrollToTab('agents')}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
            >
              <Menu size={16} />
              Browse
            </button>
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="ml-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                <LogOut size={16} />
                Cloud on
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLogin}
                className="ml-2 inline-flex items-center gap-2 rounded-full bg-[#ff7a1a] px-3 py-2 text-sm font-semibold text-black transition hover:bg-[#ff9345]"
              >
                <LogIn size={16} />
                Sign in
              </button>
            )}
          </div>
        </header>

        <section className="grid gap-4 px-4 pb-4 pt-6 md:grid-cols-[1.35fr_0.9fr] md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,132,38,0.18),rgba(255,255,255,0.04))] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#ffbf80]/20 bg-[#ff9d4d]/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.3em] text-[#ffbf80]">
                  <ScanSearch size={14} />
                  Real orchestration only
                </p>
                <h2 className="font-display text-4xl leading-none tracking-tight md:text-6xl">
                  DeerFlow research + Agency roles + skill brain + memory.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/72 md:text-base">
                  Studio sada ima tri nova stvarna sloja: web research, persistent memory run-ova i lokalni skill brain
                  sistem koji menja ponašanje workflow-a bez mock simulacija.
                </p>
              </div>
              <div className="grid min-w-[220px] gap-3 text-sm">
                <MetricCard label="Agency agents" value={String(agents.length)} />
                <MetricCard label="Saved runs" value={String(memoryEntries.length)} />
                <MetricCard label="Skill brains" value={String(skills.length)} />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="rounded-[28px] border border-white/10 bg-[#0f0f10]/85 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.42)]"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#ffbf80]">Current train</p>
            <h3 className="mt-2 font-display text-3xl">{selectedWorkflow.name}</h3>
            <p className="mt-2 text-sm text-white/70">{selectedWorkflow.strapline}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {selectedWorkflow.source.map((source) => (
                <span
                  key={source}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/70"
                >
                  {source}
                </span>
              ))}
            </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${webResearchEnabled ? 'bg-[#ff8f3a] text-black' : 'bg-white/8 text-white/55'}`}>
                    web research {webResearchEnabled ? 'on' : 'off'}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${user ? 'bg-[#61ffad] text-black' : 'bg-white/8 text-white/55'}`}>
                    cloud sync {user ? 'on' : 'local'}
                  </span>
                  {selectedSkill ? (
                    <span className="rounded-full bg-[#d8ff76] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-black">
                      skill {selectedSkill.name}
                    </span>
                  ) : null}
            </div>
            <div className="mt-6 grid gap-3">
              {selectedWorkflow.stages.map((stage) => (
                <div key={stage.id} className="rounded-2xl border border-white/10 bg-white/4 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{stage.title}</p>
                      <p className="text-xs text-white/55">{stage.supportAgentLabel}</p>
                    </div>
                    <ChevronRight size={16} className="text-[#ff9f52]" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <div
          ref={viewportRef}
          onScroll={handleViewportScroll}
          className="flex flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none]"
        >
          <TabPanel>
            <div className="grid gap-4 px-4 pb-32 md:grid-cols-[1.15fr_0.85fr] md:px-8">
              <PanelCard
                eyebrow="Mission Console"
                title="Run a real workflow"
                description="Pick a specialist, optional skill brain, memory context, and a research mode."
              >
                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm">
                    <span className="text-white/72">Selected agent</span>
                    <select
                      value={selectedAgent?.path || ''}
                      onChange={(event) => setSelectedAgentPath(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-[#111214] px-4 py-3 text-sm outline-none transition focus:border-[#ff8b37]"
                    >
                      {agents.map((agent) => (
                        <option key={agent.path} value={agent.path}>
                          {agent.name} · {agent.department}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-white/72">Workflow train</span>
                    <select
                      value={selectedWorkflowId}
                      onChange={(event) => setSelectedWorkflowId(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-[#111214] px-4 py-3 text-sm outline-none transition focus:border-[#ff8b37]"
                    >
                      {WORKFLOWS.map((workflow) => (
                        <option key={workflow.id} value={workflow.id}>
                          {workflow.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-white/72">Skill brain</span>
                    <select
                      value={selectedSkillId}
                      onChange={(event) => setSelectedSkillId(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-[#111214] px-4 py-3 text-sm outline-none transition focus:border-[#ff8b37]"
                    >
                      <option value="">No skill brain</option>
                      {skills.map((skill) => (
                        <option key={skill.id} value={skill.id}>
                          {skill.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-white/72">Mission</span>
                    <textarea
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Describe the product, research target, automation, or build goal."
                      className="min-h-44 rounded-[24px] border border-white/10 bg-[#101113] px-4 py-4 text-sm leading-6 outline-none transition focus:border-[#ff8b37]"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setWebResearchEnabled((prev) => !prev)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                        webResearchEnabled ? 'bg-[#d8ff76] text-black' : 'border border-white/10 bg-white/5 text-white/70'
                      }`}
                    >
                      <Globe size={16} />
                      {webResearchEnabled ? 'Research enabled' : 'Research disabled'}
                    </button>
                    {activeToolkits.map((toolkit) => (
                      <span
                        key={toolkit.id}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                      >
                        <PanelBottom size={14} />
                        {toolkit.title}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => scrollToTab('memory')}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
                    >
                      <ScanSearch size={16} />
                      Open memory
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={runWorkflow}
                      disabled={isRunning || !query.trim() || !selectedAgent}
                      className="inline-flex items-center gap-2 rounded-full bg-[#ff7a1a] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#ff9345] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <WandSparkles size={16} />
                      {isRunning ? 'Running workflow...' : 'Run workflow'}
                    </button>
                    <button
                      type="button"
                      onClick={generateSkillBrain}
                      disabled={isGeneratingSkill || !skillName.trim() || !skillDescription.trim()}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <BrainCircuit size={16} />
                      {isGeneratingSkill ? 'Generating brain...' : 'Generate skill brain'}
                    </button>
                  </div>
                  {error ? <p className="text-sm text-red-300">{error}</p> : null}
                </div>
              </PanelCard>

              <PanelCard
                eyebrow="Output Deck"
                title={response ? response.workflowName : 'Awaiting run'}
                description={
                  response
                    ? 'Stage outputs and final synthesis from the orchestration route.'
                    : 'After you run a workflow, stage-by-stage outputs will render here.'
                }
              >
                {liveResearch.length > 0 ? (
                  <div className="mb-4 rounded-[24px] border border-[#8fe1ff]/20 bg-[#5ed3ff]/8 p-4">
                    <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.28em] text-[#9adfff]">Live web research</p>
                    <div className="space-y-3">
                      {liveResearch.map((hit, index) => (
                        <div key={`${hit.url}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                          <p className="text-sm font-semibold">{hit.title}</p>
                          <a href={hit.url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-[#9adfff] underline">
                            {hit.url}
                          </a>
                          <p className="mt-2 text-xs leading-5 text-white/65">{hit.snippet}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {response ? (
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-[#ff9b52]/20 bg-[#ff8f3a]/8 p-4">
                      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.28em] text-[#ffbf80]">Final synthesis</p>
                      <div className="markdown-body text-sm leading-6 text-white/82">
                        <Markdown>{response.final}</Markdown>
                      </div>
                    </div>
                    {response.stages.map((stage) => (
                      <div key={stage.id} className="rounded-[24px] border border-white/10 bg-white/4 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{stage.title}</p>
                            <p className="text-xs text-white/55">{stage.agentLabel}</p>
                          </div>
                        </div>
                        <div className="markdown-body text-sm leading-6 text-white/75">
                          <Markdown>{stage.output}</Markdown>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm leading-6 text-white/55">
                    Studio sada upisuje run u lokalnu memoriju, može da ubaci web research snapshot, i može da koristi
                    prilagođeni skill brain prompt pri orchestration-u.
                  </div>
                )}
              </PanelCard>
            </div>
          </TabPanel>

          <TabPanel>
            <div className="grid gap-4 px-4 pb-32 md:grid-cols-2 md:px-8">
              {WORKFLOWS.map((workflow) => (
                <button
                  key={workflow.id}
                  type="button"
                  onClick={() => {
                    setSelectedWorkflowId(workflow.id);
                    scrollToTab('studio');
                  }}
                  className={`rounded-[28px] border p-5 text-left transition ${
                    selectedWorkflowId === workflow.id
                      ? 'border-[#ff9d4d]/40 bg-[#ff8f3a]/10'
                      : 'border-white/10 bg-[#101113]/90 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-3xl">{workflow.name}</p>
                      <p className="mt-2 text-sm text-white/68">{workflow.strapline}</p>
                    </div>
                    <Layers3 size={24} className="text-[#ff9f52]" />
                  </div>
                  <p className="mt-5 text-sm leading-6 text-white/72">{workflow.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {workflow.useCases.map((useCase) => (
                      <span key={useCase} className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/55">
                        {useCase}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </TabPanel>

          <TabPanel>
            <div className="grid gap-4 px-4 pb-32 md:grid-cols-[0.7fr_1.3fr] md:px-8">
              <PanelCard
                eyebrow="Agency roster"
                title="Browse specialists"
                description="The live roster is pulled from the agency-agents repository and filtered locally."
              >
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or division"
                  className="mb-4 w-full rounded-2xl border border-white/10 bg-[#101113] px-4 py-3 text-sm outline-none transition focus:border-[#ff8b37]"
                />
                <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {filteredAgents.map((agent) => (
                    <button
                      key={agent.path}
                      type="button"
                      onClick={() => {
                        setSelectedAgentPath(agent.path);
                        scrollToTab('studio');
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selectedAgent?.path === agent.path
                          ? 'border-[#ff9d4d]/40 bg-[#ff8f3a]/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      <p className="text-sm font-semibold">{agent.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/48">{agent.department}</p>
                    </button>
                  ))}
                </div>
              </PanelCard>
              <PanelCard
                eyebrow="Primary prompt"
                title={selectedAgent?.name || 'No agent selected'}
                description="This is the real source prompt pulled from agency-agents for the currently selected specialist."
              >
                <div className="max-h-[70vh] overflow-y-auto rounded-[24px] border border-white/10 bg-[#101113] p-4 custom-scrollbar">
                  <pre className="whitespace-pre-wrap text-xs leading-6 text-white/74">{selectedAgentPrompt || 'Loading prompt...'}</pre>
                </div>
              </PanelCard>
            </div>
          </TabPanel>

          <TabPanel>
            <div className="grid gap-4 px-4 pb-32 md:grid-cols-[0.9fr_1.1fr] md:px-8">
              <PanelCard
                eyebrow="Persistent memory"
                title="Saved runs"
                description="Each completed workflow is stored locally and can be reused as context in later runs."
              >
                <div className="mb-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={exportMemory}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 transition hover:bg-white/10"
                  >
                    <Download size={16} />
                    Export runs
                  </button>
                  <button
                    type="button"
                    onClick={() => memoryImportRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 transition hover:bg-white/10"
                  >
                    <Upload size={16} />
                    Import runs
                  </button>
                  <input
                    ref={memoryImportRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importMemory(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </div>
                <div className="space-y-3">
                  {memoryEntries.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-white/55">
                      No saved runs yet.
                    </div>
                  ) : (
                    memoryEntries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => loadMemoryEntry(entry)}
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{entry.workflowName}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/48">{entry.selectedAgentName}</p>
                          </div>
                          <p className="text-[11px] text-white/45">{new Date(entry.createdAt).toLocaleString()}</p>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-white/70">{entry.query}</p>
                      </button>
                    ))
                  )}
                </div>
              </PanelCard>
              <PanelCard
                eyebrow="Memory summary"
                title="Injected context"
                description="The orchestration route receives a compressed memory summary from recent runs."
              >
                <div className="rounded-[24px] border border-white/10 bg-[#101113] p-4">
                  <pre className="whitespace-pre-wrap text-xs leading-6 text-white/72">{summarizeMemory(memoryEntries) || 'No memory available yet.'}</pre>
                </div>
              </PanelCard>
            </div>
          </TabPanel>

          <TabPanel>
            <div className="grid gap-4 px-4 pb-32 md:grid-cols-[0.95fr_1.05fr] md:px-8">
              <PanelCard
                eyebrow="Skill brain"
                title="Create a reusable execution profile"
                description="Generate or write a custom operational prompt that shapes later workflow runs."
              >
                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm">
                    <span className="text-white/72">Name</span>
                    <input
                      value={skillName}
                      onChange={(event) => setSkillName(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-[#111214] px-4 py-3 outline-none transition focus:border-[#ff8b37]"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-white/72">Description</span>
                    <textarea
                      value={skillDescription}
                      onChange={(event) => setSkillDescription(event.target.value)}
                      className="min-h-28 rounded-2xl border border-white/10 bg-[#111214] px-4 py-3 outline-none transition focus:border-[#ff8b37]"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-white/72">Prompt</span>
                    <textarea
                      value={skillPromptDraft}
                      onChange={(event) => setSkillPromptDraft(event.target.value)}
                      placeholder="Generate it with the button below or write it manually."
                      className="min-h-52 rounded-2xl border border-white/10 bg-[#111214] px-4 py-3 outline-none transition focus:border-[#ff8b37]"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={generateSkillBrain}
                      disabled={isGeneratingSkill || !skillName.trim() || !skillDescription.trim()}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Plus size={16} />
                      {isGeneratingSkill ? 'Generating...' : 'Generate prompt'}
                    </button>
                    <button
                      type="button"
                      onClick={saveSkillBrain}
                      disabled={!skillName.trim() || !skillPromptDraft.trim()}
                      className="inline-flex items-center gap-2 rounded-full bg-[#ff7a1a] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#ff9345] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save size={16} />
                      Save brain
                    </button>
                    <button
                      type="button"
                      onClick={exportSkills}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 transition hover:bg-white/10"
                    >
                      <Download size={16} />
                      Export
                    </button>
                    <button
                      type="button"
                      onClick={() => skillImportRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 transition hover:bg-white/10"
                    >
                      <Upload size={16} />
                      Import
                    </button>
                    <input
                      ref={skillImportRef}
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void importSkills(file);
                        event.currentTarget.value = '';
                      }}
                    />
                  </div>
                </div>
              </PanelCard>
              <PanelCard
                eyebrow="Saved brains"
                title="Reusable profiles"
                description="Any saved brain can be attached to future runs and will be injected into orchestration."
              >
                <div className="space-y-3">
                  {skills.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-white/55">
                      No saved skill brains yet.
                    </div>
                  ) : (
                    skills.map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => {
                          setSelectedSkillId(skill.id);
                          setSkillName(skill.name);
                          setSkillDescription(skill.description);
                          setSkillPromptDraft(skill.systemPrompt);
                        }}
                        className={`w-full rounded-[24px] border p-4 text-left transition ${
                          selectedSkillId === skill.id
                            ? 'border-[#d8ff76]/60 bg-[#d8ff76]/10'
                            : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                        }`}
                      >
                        <p className="text-sm font-semibold">{skill.name}</p>
                        <p className="mt-2 text-sm leading-6 text-white/68">{skill.description}</p>
                        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-white/45">
                          {new Date(skill.createdAt).toLocaleString()}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </PanelCard>
            </div>
          </TabPanel>

          <TabPanel>
            <div className="grid gap-4 px-4 pb-32 md:grid-cols-[0.9fr_1.1fr] md:px-8">
              <PanelCard
                eyebrow="Provider Stack"
                title="Free-first routing"
                description="Use OpenRouter or Hugging Face free tiers, or point to a local Ollama runtime for zero per-call cost."
              >
                <div className="grid gap-4 text-sm">
                  <label className="grid gap-2">
                    <span className="text-white/72">Provider</span>
                    <select
                      value={settings.provider}
                      onChange={(event) => setSettings((prev) => ({ ...prev, provider: event.target.value as StudioSettings['provider'] }))}
                      className="rounded-2xl border border-white/10 bg-[#111214] px-4 py-3 outline-none transition focus:border-[#ff8b37]"
                    >
                      <option value="openrouter">OpenRouter</option>
                      <option value="huggingface">Hugging Face</option>
                      <option value="ollama">Ollama</option>
                      <option value="gemini">Gemini</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-white/72">Model</span>
                    <input
                      value={settings.model}
                      onChange={(event) => setSettings((prev) => ({ ...prev, model: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-[#111214] px-4 py-3 outline-none transition focus:border-[#ff8b37]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-white/72">Temperature</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={settings.temperature}
                      onChange={(event) => setSettings((prev) => ({ ...prev, temperature: Number(event.target.value) }))}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-white/72">OpenRouter key</span>
                    <input
                      type="password"
                      value={settings.openRouterKey || ''}
                      onChange={(event) => setSettings((prev) => ({ ...prev, openRouterKey: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-[#111214] px-4 py-3 outline-none transition focus:border-[#ff8b37]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-white/72">Hugging Face token</span>
                    <input
                      type="password"
                      value={settings.huggingFaceKey || ''}
                      onChange={(event) => setSettings((prev) => ({ ...prev, huggingFaceKey: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-[#111214] px-4 py-3 outline-none transition focus:border-[#ff8b37]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-white/72">Gemini key</span>
                    <input
                      type="password"
                      value={settings.geminiKey || ''}
                      onChange={(event) => setSettings((prev) => ({ ...prev, geminiKey: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-[#111214] px-4 py-3 outline-none transition focus:border-[#ff8b37]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-white/72">Ollama URL</span>
                    <input
                      value={settings.ollamaUrl || ''}
                      onChange={(event) => setSettings((prev) => ({ ...prev, ollamaUrl: event.target.value }))}
                      className="rounded-2xl border border-white/10 bg-[#111214] px-4 py-3 outline-none transition focus:border-[#ff8b37]"
                    />
                  </label>
                </div>
              </PanelCard>

              <PanelCard
                eyebrow="Architecture"
                title="What is already real"
                description="This layer replaces mock theatre with working orchestration and concrete provider routing."
              >
                <ul className="space-y-3 text-sm leading-6 text-white/72">
                  <li>Web research uses real DuckDuckGo HTML search and real page scraping through the backend.</li>
                  <li>When signed in, run memory and skill brains sync to Firestore; otherwise they stay in local storage.</li>
                  <li>You can export and import both memory and skill brain profiles as JSON artifacts.</li>
                  <li>Each workflow now advertises a tool layer and injects that toolkit context into orchestration.</li>
                  <li>Completed runs are stored locally and summarized back into later orchestrations as memory.</li>
                  <li>Skill brains are real saved prompt profiles that are injected into the orchestration route.</li>
                  <li>Each workflow stage loads a real specialist prompt from `agency-agents` over GitHub raw content.</li>
                  <li>The orchestration route performs multiple actual model calls, then a final synthesis pass.</li>
                </ul>
              </PanelCard>
            </div>
          </TabPanel>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#120d09]/88 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-xl">
          <div className="mx-auto grid max-w-5xl grid-cols-6 gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => scrollToTab(tab.id)}
                className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] uppercase tracking-[0.18em] transition ${
                  activeTab === tab.id ? 'bg-[#ff7a1a] text-black' : 'bg-white/5 text-white/58'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

function PanelCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#0f1012]/88 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.38)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#ffbf80]">{eyebrow}</p>
      <h3 className="mt-2 font-display text-3xl">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/68">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/25 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
    </div>
  );
}

function TabPanel({ children }: { children: React.ReactNode }) {
  return <section className="min-w-full flex-none snap-start">{children}</section>;
}
