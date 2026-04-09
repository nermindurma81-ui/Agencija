'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Agent, getAgentPrompt } from '@/lib/github';
import Chat from './Chat';
import ModelManager from './ModelManager';
import { ChatHistory } from './ChatHistory';
import { Menu, X, Terminal, Briefcase, Code, PenTool, Megaphone, Target, Gamepad, GraduationCap, Wrench, Shield, HeadphonesIcon, Search, Star, Settings2, Plus, LogIn, LogOut, Wrench as ToolIcon, Puzzle, Sun, Moon, Building2, Cpu, Database, Loader2, History } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, doc, setDoc } from 'firebase/firestore';
import { AVAILABLE_PLUGINS } from '@/lib/pluginStore';
import { syncPublicApis } from '@/lib/publicApis';

const DEPT_ICONS: Record<string, React.ReactNode> = {
  'engineering': <Code size={16} />,
  'design': <PenTool size={16} />,
  'marketing': <Megaphone size={16} />,
  'sales': <Briefcase size={16} />,
  'product': <Target size={16} />,
  'game-development': <Gamepad size={16} />,
  'academic': <GraduationCap size={16} />,
  'specialized': <Wrench size={16} />,
  'testing': <Shield size={16} />,
  'support': <HeadphonesIcon size={16} />,
  'architecture': <Building2 size={16} />,
  'coding': <Code size={16} />,
  'dante.ai coding': <Cpu size={16} />,
  'super-models': <Star size={16} />,
};

export interface AgentSettings {
  model: string;
  provider: 'gemini' | 'openrouter' | 'ollama' | 'huggingface' | 'claude';
  temperature: number;
  customKnowledge: string;
  githubToken?: string;
  netlifyToken?: string;
  vercelToken?: string;
  railwayToken?: string;
  openRouterKey?: string;
  geminiKey?: string;
  huggingFaceKey?: string;
  ollamaUrl?: string;
}

const FREE_PRESETS: { label: string; description: string; settings: Pick<AgentSettings, 'provider' | 'model'> }[] = [
  {
    label: 'OpenRouter · Llama 3.1 8B (free)',
    description: 'Dobar besplatan start preko OpenRouter free modela.',
    settings: { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct:free' },
  },
  {
    label: 'Hugging Face · Mistral 7B',
    description: 'Besplatan token na Hugging Face, stabilan chat model.',
    settings: { provider: 'huggingface', model: 'mistralai/Mistral-7B-Instruct-v0.3' },
  },
  {
    label: 'Claude preko OpenRouter',
    description: 'Claude radi preko OpenRouter-a i traži API ključ.',
    settings: { provider: 'claude', model: 'anthropic/claude-3.5-haiku' },
  },
  {
    label: 'Ollama lokalno · llama3.2',
    description: 'Bez cloud API ključa, ali model mora biti lokalno instaliran.',
    settings: { provider: 'ollama', model: 'llama3.2' },
  },
];

export default function Dashboard({ agentsByDept }: { agentsByDept: Record<string, Agent[]> }) {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [systemInstruction, setSystemInstruction] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settingsTab, setSettingsTab] = useState<'general' | 'models'>('general');
  const [view, setView] = useState<'agents' | 'history'>('agents');
  const [settings, setSettings] = useState<AgentSettings>({
    model: 'gemini-1.5-flash',
    provider: 'gemini',
    temperature: 0.7,
    customKnowledge: '',
    githubToken: '',
    netlifyToken: '',
    vercelToken: '',
    railwayToken: '',
    openRouterKey: '',
    geminiKey: '',
    ollamaUrl: 'http://localhost:11434'
  });

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [customModels, setCustomModels] = useState<Agent[]>([]);
  const [customTools, setCustomTools] = useState<any[]>([]);
  const [isSuperModelModalOpen, setIsSuperModelModalOpen] = useState(false);
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [isPluginStoreOpen, setIsPluginStoreOpen] = useState(false);
  const [isSyncingApis, setIsSyncingApis] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('agency_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  useEffect(() => {
    (window as any).openSettings = () => setIsSettingsOpen(true);
    return () => { delete (window as any).openSettings; };
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('agency_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Super Model Form
  const [smName, setSmName] = useState('');
  const [smDesc, setSmDesc] = useState('');
  const [smInstruction, setSmInstruction] = useState('');

  // Tool Form
  const [toolName, setToolName] = useState('');
  const [toolDesc, setToolDesc] = useState('');
  const [toolSchema, setToolSchema] = useState('{\n  "type": "OBJECT",\n  "properties": {\n    "param1": { "type": "STRING", "description": "..." }\n  },\n  "required": ["param1"]\n}');
  const [toolCode, setToolCode] = useState('return "Hello " + args.param1;');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setIsSidebarOpen(true);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error.message || String(error),
      operation,
      path,
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
  };

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setCustomModels([]);
      setCustomTools([]);
      return;
    }

    const qModels = query(collection(db, 'customModels'), where('userId', '==', uid));
    const unsubModels = onSnapshot(qModels, (snapshot) => {
      const models: Agent[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        models.push({
          name: data.name,
          path: doc.id,
          department: 'super-models',
          url: '',
          systemInstruction: data.systemInstruction
        } as Agent & { systemInstruction: string });
      });
      setCustomModels(models);
    }, (error) => handleFirestoreError(error, 'LIST', 'customModels'));

    const qTools = query(collection(db, 'customTools'), where('userId', '==', uid));
    const unsubTools = onSnapshot(qTools, (snapshot) => {
      const tools: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        try {
          const schema = JSON.parse(data.parametersSchema);
          tools.push({
            id: doc.id,
            declaration: {
              name: data.name,
              description: data.description,
              parameters: schema
            },
            jsCode: data.jsCode
          });
        } catch (e) {
          console.error("Invalid tool schema", e);
        }
      });
      setCustomTools(tools);
    }, (error) => handleFirestoreError(error, 'LIST', 'customTools'));

    return () => {
      unsubModels();
      unsubTools();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleCreateSuperModel = async () => {
    if (!user || !smName || !smInstruction) return;
    try {
      await addDoc(collection(db, 'customModels'), {
        name: smName,
        description: smDesc,
        systemInstruction: smInstruction,
        userId: user.uid,
        createdAt: Date.now()
      });
      setIsSuperModelModalOpen(false);
      setSmName('');
      setSmDesc('');
      setSmInstruction('');
    } catch (error) {
      console.error("Failed to create super model", error);
    }
  };

  const handleCreateTool = async () => {
    if (!user || !toolName || !toolCode) return;
    try {
      await addDoc(collection(db, 'customTools'), {
        name: toolName,
        description: toolDesc,
        parametersSchema: toolSchema,
        jsCode: toolCode,
        userId: user.uid,
        createdAt: Date.now()
      });
      setIsToolModalOpen(false);
      setToolName('');
      setToolDesc('');
      setToolCode('');
    } catch (error) {
      console.error("Failed to create tool", error);
    }
  };

  const handleInstallPlugin = async (plugin: any) => {
    if (!user) return alert("Morate biti prijavljeni da biste instalirali plugin.");
    try {
      // Check if already installed
      const isInstalled = customTools.some(t => t.declaration.name === plugin.declaration.name);
      if (isInstalled) {
        return alert("Ovaj plugin je već instaliran.");
      }

      await addDoc(collection(db, 'customTools'), {
        name: plugin.declaration.name,
        description: plugin.declaration.description,
        parametersSchema: JSON.stringify(plugin.declaration.parameters),
        jsCode: plugin.jsCode,
        userId: user.uid,
        createdAt: Date.now(),
        isPlugin: true,
        pluginId: plugin.id
      });
      alert(`Plugin ${plugin.name} je uspješno instaliran!`);
    } catch (error) {
      console.error("Error installing plugin:", error);
      alert("Greška pri instalaciji plugina.");
    }
  };

  const handleSyncPublicApis = async () => {
    if (!user) return alert("Morate biti prijavljeni.");
    setIsSyncingApis(true);
    try {
      const count = await syncPublicApis();
      alert(`Uspješno sinhronizovano ${count} API-ja u bazu!`);
    } catch (error) {
      console.error("Error syncing APIs:", error);
      alert("Greška pri sinhronizaciji API-ja.");
    } finally {
      setIsSyncingApis(false);
    }
  };

  // Load favorites and settings from localStorage
  useEffect(() => {
    setIsLoadingSettings(true);
    const savedFavorites = localStorage.getItem('agency_favorites');
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    
    const savedSettings = localStorage.getItem('agency_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    setIsLoadingSettings(false);
  }, []);

  const toggleFavorite = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    setFavorites(prev => {
      const newFavs = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path];
      localStorage.setItem('agency_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  const saveSettings = async (newSettings: AgentSettings) => {
    setIsSaving(true);
    // Simulate a small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 600));
    setSettings(newSettings);
    localStorage.setItem('agency_settings', JSON.stringify(newSettings));
    setIsSaving(false);
    setIsSettingsOpen(false);
  };

  // Combine agents
  const allAgentsByDept = { ...agentsByDept };
  if (customModels.length > 0) {
    allAgentsByDept['super-models'] = customModels;
  }

  // Filter logic and separate favorites
  const favoriteAgents: Agent[] = [];
  const filteredAgentsByDept = Object.entries(allAgentsByDept).reduce((acc, [dept, agents]) => {
    const filteredAgents = agents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || dept.toLowerCase().includes(searchQuery.toLowerCase());
      if (matchesSearch && favorites.includes(agent.path)) {
        favoriteAgents.push(agent);
        return false; // Remove from regular dept list
      }
      return matchesSearch;
    });
    if (filteredAgents.length > 0) {
      acc[dept] = filteredAgents;
    }
    return acc;
  }, {} as Record<string, Agent[]>);

  // Select first agent by default
  useEffect(() => {
    if (!selectedAgent && Object.keys(allAgentsByDept).length > 0) {
      const firstDept = Object.keys(allAgentsByDept)[0];
      if (allAgentsByDept[firstDept].length > 0) {
        handleSelectAgent(allAgentsByDept[firstDept][0]);
      }
    }
  }, [agentsByDept]); // Only run on initial load

  const handleSelectAgent = async (agent: Agent) => {
    setSelectedAgent(agent);
    setIsLoadingPrompt(true);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    try {
      if ((agent as any).systemInstruction) {
        setSystemInstruction((agent as any).systemInstruction);
      } else {
        const prompt = await getAgentPrompt(agent.path);
        setSystemInstruction(prompt);
      }
    } catch (error) {
      console.error('Failed to load prompt', error);
      setSystemInstruction('You are a helpful AI assistant.');
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  return (
    <div className="flex h-screen theme-bg-primary theme-text-primary overflow-hidden font-sans relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div 
        ref={sidebarRef}
        initial={false}
        animate={{ 
          x: isSidebarOpen ? 0 : (isMounted && isMobile ? -288 : 0)
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        drag="x"
        dragConstraints={{ left: -288, right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x < -50) setIsSidebarOpen(false);
          if (info.offset.x > 50 && !isSidebarOpen) setIsSidebarOpen(true);
        }}
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-72 theme-bg-secondary border-r theme-border flex flex-col shadow-2xl md:shadow-none
        `}
      >
        <div className="p-6 border-b theme-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#FF6321] rounded-lg flex items-center justify-center">
              <Terminal size={18} className="text-black" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight">The Agency</h1>
              <p className="text-[10px] theme-text-secondary uppercase tracking-widest">AI Specialists</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setView(view === 'agents' ? 'history' : 'agents')}
              className={`p-2 rounded-lg transition-colors ${view === 'history' ? 'bg-[#FF6321] text-black' : 'theme-text-secondary hover:theme-text-primary'}`}
              title={view === 'agents' ? 'Prikaži istoriju' : 'Prikaži agente'}
            >
              {view === 'agents' ? <History size={18} /> : <Briefcase size={18} />}
            </button>
            <button className="md:hidden theme-text-secondary hover:theme-text-primary p-1" onClick={() => setIsSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>
        </div>

        {view === 'agents' ? (
          <>
            <div className="p-4 border-b theme-border">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-secondary" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full theme-bg-tertiary border theme-border text-sm theme-text-primary rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-[#FF6321] focus:ring-1 focus:ring-[#FF6321] transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {favoriteAgents.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 px-2">
                    <span className="text-yellow-500">
                      <Star size={16} fill="currentColor" />
                    </span>
                    <h2 className="text-xs font-bold theme-text-secondary uppercase tracking-wider">
                      Favorites
                    </h2>
                  </div>
                  <div className="space-y-1">
                    {favoriteAgents.map(agent => (
                      <button
                        key={agent.path}
                        onClick={() => handleSelectAgent(agent)}
                        className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedAgent?.path === agent.path
                            ? 'theme-bg-tertiary text-[#FF6321] font-medium border theme-border'
                            : 'theme-text-secondary hover:theme-bg-tertiary hover:theme-text-primary border border-transparent'
                        }`}
                      >
                        <span className="truncate pr-2">{agent.name}</span>
                        <Star 
                          size={14} 
                          className="shrink-0 text-yellow-500 hover:text-yellow-400 transition-colors" 
                          fill="currentColor"
                          onClick={(e) => toggleFavorite(e, agent.path)}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(filteredAgentsByDept).length === 0 && favoriteAgents.length === 0 ? (
                <div className="text-center theme-text-secondary text-sm py-8">
                  No agents found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                Object.entries(filteredAgentsByDept).map(([dept, agents]) => (
                  <div key={dept}>
                    <div className="flex items-center gap-2 mb-3 px-2">
                      <span className="text-[#FF6321]">
                        {DEPT_ICONS[dept] || <Briefcase size={16} />}
                      </span>
                      <h2 className="text-xs font-bold theme-text-secondary uppercase tracking-wider">
                        {dept.replace('-', ' ')}
                      </h2>
                    </div>
                    <div className="space-y-1">
                      {agents.map(agent => (
                        <button
                          key={agent.path}
                          onClick={() => handleSelectAgent(agent)}
                          className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            selectedAgent?.path === agent.path
                              ? 'theme-bg-tertiary text-[#FF6321] font-medium border theme-border'
                              : 'theme-text-secondary hover:theme-bg-tertiary hover:theme-text-primary border border-transparent'
                          }`}
                        >
                          <span className="truncate pr-2">{agent.name}</span>
                          <Star 
                            size={14} 
                            className="shrink-0 text-gray-600 hover:text-yellow-500 transition-colors" 
                            onClick={(e) => toggleFavorite(e, agent.path)}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <ChatHistory user={user} onSelectSession={(sessionId) => {
            // Handle session selection
            console.log('Selected session:', sessionId);
            setView('agents');
            // Need to find agent from sessionId and select it
            // sessionId format: `${user.uid}_${safeAgentPath}`
            // This might need more logic to select the correct agent
          }} />
        )}
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-16 border-b theme-border flex items-center px-4 justify-between theme-bg-secondary/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 -ml-2 theme-text-secondary hover:text-white"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            {selectedAgent && (
              <div>
                <h2 className="font-semibold theme-text-primary">{selectedAgent.name}</h2>
                <p className="text-xs theme-text-secondary capitalize">{selectedAgent.department.replace('-', ' ')} Division</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 theme-text-secondary hover:text-white transition-colors rounded-lg hover:theme-bg-tertiary"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? (
              <>
                <button 
                  onClick={() => setIsSuperModelModalOpen(true)}
                  className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-[#111]"
                  title="Create Super Model"
                >
                  <Plus size={18} />
                </button>
                <button 
                  onClick={() => setIsToolModalOpen(true)}
                  className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-[#111]"
                  title="Manage Tools"
                >
                  <ToolIcon size={18} />
                </button>
                <button 
                  onClick={() => setIsPluginStoreOpen(true)}
                  className="p-2 text-purple-400 hover:text-purple-300 transition-colors rounded-lg hover:bg-[#111]"
                  title="Plugin Store (FutureTools)"
                >
                  <Puzzle size={18} />
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-[#111]"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#FF6321] text-black text-sm font-medium rounded-lg hover:bg-[#ff7a45] transition-colors"
              >
                <LogIn size={16} />
                Login
              </button>
            )}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-[#111]"
              title="Agent Settings"
            >
              <Settings2 size={18} />
            </button>
            <div className="hidden sm:flex px-3 py-1 rounded-full border border-[#333] bg-[#111] text-xs text-gray-400 items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Online
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-hidden relative">
          {isLoadingPrompt ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#050505]">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-[#333] border-t-[#FF6321] rounded-full animate-spin"></div>
                <p className="text-sm text-gray-500 uppercase tracking-widest">Loading Agent Profile...</p>
              </div>
            </div>
          ) : selectedAgent ? (
            <Chat 
              agent={selectedAgent} 
              systemInstruction={systemInstruction} 
              setSystemInstruction={setSystemInstruction}
              settings={settings}
              user={user}
              customTools={customTools}
              onSwipeRight={() => setIsSidebarOpen(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Terminal size={48} className="mx-auto mb-4 opacity-50" />
                <p>Odaberite agenta za početak</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-[#333] rounded-xl w-full max-w-lg p-0 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-[#333]">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold">Agent Settings</h2>
                <div className="flex bg-[#111] rounded-lg p-1">
                  <button 
                    onClick={() => setSettingsTab('general')}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${settingsTab === 'general' ? 'bg-[#FF6321] text-black font-bold' : 'text-gray-500 hover:text-white'}`}
                  >
                    General
                  </button>
                  <button 
                    onClick={() => setSettingsTab('models')}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${settingsTab === 'models' ? 'bg-[#FF6321] text-black font-bold' : 'text-gray-500 hover:text-white'}`}
                  >
                    Model Manager
                  </button>
                </div>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {isLoadingSettings ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="animate-spin text-[#FF6321]" size={32} />
                </div>
              ) : settingsTab === 'general' ? (
                <>
                  <div className="bg-[#FF6321]/10 border border-[#FF6321]/20 rounded-lg p-3 mb-6">
                    <p className="text-[10px] text-[#FF6321] uppercase tracking-wider font-bold mb-1">Published Mode</p>
                    <p className="text-xs text-gray-400">Ovdje možete odabrati AI provajdera i unijeti sopstvene API ključeve direktno u browseru. Postavke se čuvaju lokalno.</p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Quick presets</label>
                      <div className="space-y-2">
                        {FREE_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setSettings({ ...settings, ...preset.settings })}
                            className="w-full rounded-lg border border-[#333] bg-[#111] px-3 py-2 text-left transition hover:border-[#FF6321]/70"
                          >
                            <p className="text-xs font-semibold text-white">{preset.label}</p>
                            <p className="mt-1 text-[11px] text-gray-500">{preset.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Provider & Model</label>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <button 
                          onClick={() => setSettings({...settings, provider: 'gemini'})}
                          className={`text-xs py-2 rounded-lg border ${settings.provider === 'gemini' ? 'bg-[#FF6321] text-black border-[#FF6321]' : 'bg-[#111] text-gray-400 border-[#333]'}`}
                        >
                          Gemini (Free)
                        </button>
                        <button 
                          onClick={() => setSettings({...settings, provider: 'openrouter'})}
                          className={`text-xs py-2 rounded-lg border ${settings.provider === 'openrouter' ? 'bg-[#FF6321] text-black border-[#FF6321]' : 'bg-[#111] text-gray-400 border-[#333]'}`}
                        >
                          OpenRouter (Free)
                        </button>
                        <button 
                          onClick={() => setSettings({...settings, provider: 'huggingface'})}
                          className={`text-xs py-2 rounded-lg border ${settings.provider === 'huggingface' ? 'bg-[#FF6321] text-black border-[#FF6321]' : 'bg-[#111] text-gray-400 border-[#333]'}`}
                        >
                          Hugging Face (Free)
                        </button>
                        <button 
                          onClick={() => setSettings({...settings, provider: 'ollama'})}
                          className={`text-xs py-2 rounded-lg border ${settings.provider === 'ollama' ? 'bg-[#FF6321] text-black border-[#FF6321]' : 'bg-[#111] text-gray-400 border-[#333]'}`}
                        >
                          Ollama (Local)
                        </button>
                        <button 
                          onClick={() => setSettings({...settings, provider: 'claude'})}
                          className={`text-xs py-2 rounded-lg border ${settings.provider === 'claude' ? 'bg-[#FF6321] text-black border-[#FF6321]' : 'bg-[#111] text-gray-400 border-[#333]'}`}
                        >
                          Claude (OpenRouter)
                        </button>
                      </div>

                      {settings.provider === 'gemini' && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-gray-500 italic">Koristi ugrađeni ključ ako ostavite prazno.</p>
                          <input 
                            type="password"
                            value={settings.geminiKey || ''}
                            onChange={(e) => setSettings({...settings, geminiKey: e.target.value})}
                            placeholder="Gemini API Key (Opcionalno)"
                            className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                          />
                          <select 
                            value={settings.model}
                            onChange={(e) => setSettings({...settings, model: e.target.value})}
                            className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                          >
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash (Brz & Besplatan)</option>
                            <option value="gemini-2.0-flash">Gemini 2.0 Flash (Preporučeno)</option>
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Napredno)</option>
                            <option value="gemma-2-27b-it">Gemma 2 27B (Google Open Model)</option>
                            <option value="gemma-2-9b-it">Gemma 2 9B (Lagan & Brz)</option>
                          </select>
                        </div>
                      )}

                      {settings.provider === 'openrouter' && (
                        <div className="space-y-2">
                          <input 
                            type="password"
                            value={settings.openRouterKey || ''}
                            onChange={(e) => setSettings({...settings, openRouterKey: e.target.value})}
                            placeholder="OpenRouter API Key (Za free modele)"
                            className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                          />
                          <select 
                            value={settings.model}
                            onChange={(e) => setSettings({...settings, model: e.target.value})}
                            className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                          >
                            <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (Free)</option>
                            <option value="meta-llama/llama-3.1-8b-instruct:free">Llama 3.1 8B (Free)</option>
                            <option value="mistralai/mistral-7b-instruct:free">Mistral 7B (Free)</option>
                            <option value="qwen/qwen-2-7b-instruct:free">Qwen 2 7B (Free)</option>
                            <option value="microsoft/phi-3-mini-128k-instruct:free">Phi-3 Mini (Free)</option>
                            <option value="huggingfaceh4/zephyr-7b-beta:free">Zephyr 7B (Free)</option>
                          </select>
                        </div>
                      )}

                      {settings.provider === 'huggingface' && (
                        <div className="space-y-2">
                          <input 
                            type="password"
                            value={settings.huggingFaceKey || ''}
                            onChange={(e) => setSettings({...settings, huggingFaceKey: e.target.value})}
                            placeholder="Hugging Face API Token (hf_...)"
                            className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                          />
                          <select 
                            value={settings.model}
                            onChange={(e) => setSettings({...settings, model: e.target.value})}
                            className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                          >
                            <option value="mistralai/Mistral-7B-Instruct-v0.3">Mistral 7B v0.3</option>
                            <option value="meta-llama/Meta-Llama-3-8B-Instruct">Llama 3 8B</option>
                            <option value="google/gemma-2-9b-it">Gemma 2 9B</option>
                            <option value="microsoft/Phi-3-mini-4k-instruct">Phi-3 Mini</option>
                            <option value="HuggingFaceH4/zephyr-7b-beta">Zephyr 7B Beta</option>
                          </select>
                        </div>
                      )}

                      {settings.provider === 'ollama' && (
                        <div className="space-y-2">
                          <input 
                            type="text"
                            value={settings.model}
                            onChange={(e) => setSettings({...settings, model: e.target.value})}
                            placeholder="Model name (npr. llama3, mistral, gemma2)"
                            className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                          />
                        </div>
                      )}

                      {settings.provider === 'claude' && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-amber-400/80">
                            Claude nema javni &quot;no-key&quot; API. Potreban je OpenRouter ključ ili Anthropic ključ.
                          </p>
                          <input 
                            type="password"
                            value={settings.openRouterKey || ''}
                            onChange={(e) => setSettings({...settings, openRouterKey: e.target.value})}
                            placeholder="OpenRouter API Key (Za Claude)"
                            className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                          />
                          <select 
                            value={settings.model}
                            onChange={(e) => setSettings({...settings, model: e.target.value})}
                            className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                          >
                            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (Preporučeno)</option>
                            <option value="anthropic/claude-3.5-haiku">Claude 3.5 Haiku (Brz & Jeftin)</option>
                            <option value="anthropic/claude-3-opus">Claude 3 Opus (Moćan)</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Temperature: {settings.temperature}
                      </label>
                      <input 
                        type="range" 
                        min="0" max="2" step="0.1"
                        value={settings.temperature}
                        onChange={(e) => setSettings({...settings, temperature: parseFloat(e.target.value)})}
                        className="w-full accent-[#FF6321]"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Precise</span>
                        <span>Creative</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Upgrade Skill / Custom Knowledge
                      </label>
                      <textarea 
                        value={settings.customKnowledge}
                        onChange={(e) => setSettings({...settings, customKnowledge: e.target.value})}
                        placeholder="Add custom instructions, behavior rules, or knowledge to upgrade this agent..."
                        className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-sm h-32 focus:outline-none focus:border-[#FF6321] custom-scrollbar resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">GitHub Token</label>
                        <input 
                          type="password"
                          value={settings.githubToken || ''}
                          onChange={(e) => setSettings({...settings, githubToken: e.target.value})}
                          placeholder="ghp_..."
                          className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Netlify Token</label>
                        <input 
                          type="password"
                          value={settings.netlifyToken || ''}
                          onChange={(e) => setSettings({...settings, netlifyToken: e.target.value})}
                          placeholder="nfp_..."
                          className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Vercel Token</label>
                        <input 
                          type="password"
                          value={settings.vercelToken || ''}
                          onChange={(e) => setSettings({...settings, vercelToken: e.target.value})}
                          placeholder="Vercel Access Token..."
                          className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Railway Token</label>
                        <input 
                          type="password"
                          value={settings.railwayToken || ''}
                          onChange={(e) => setSettings({...settings, railwayToken: e.target.value})}
                          placeholder="Railway API Token..."
                          className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Ollama URL</label>
                        <input 
                          type="text"
                          value={settings.ollamaUrl || ''}
                          onChange={(e) => setSettings({...settings, ollamaUrl: e.target.value})}
                          placeholder="http://localhost:11434"
                          className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={() => saveSettings(settings)}
                      disabled={isSaving}
                      className="w-full bg-[#FF6321] text-black font-medium py-2.5 rounded-lg hover:bg-[#ff7a45] transition-colors flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="animate-spin" size={18} />
                          Saving...
                        </>
                      ) : 'Save Settings'}
                    </button>
                  </div>
                </>
              ) : (
                <ModelManager 
                  ollamaUrl={settings.ollamaUrl || 'http://localhost:11434'} 
                  currentModel={settings.model}
                  onActivate={(modelName) => {
                    setSettings({...settings, provider: 'ollama', model: modelName});
                    saveSettings({...settings, provider: 'ollama', model: modelName});
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Super Model Modal */}
      {isSuperModelModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-[#333] rounded-xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold">Create Super Model</h2>
              <button onClick={() => setIsSuperModelModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <input 
                type="text" placeholder="Model Name" value={smName} onChange={e => setSmName(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
              />
              <input 
                type="text" placeholder="Short Description" value={smDesc} onChange={e => setSmDesc(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
              />
              <textarea 
                placeholder="System Instructions (Define behavior, skills, memory...)" value={smInstruction} onChange={e => setSmInstruction(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-sm h-48 focus:outline-none focus:border-[#FF6321] custom-scrollbar resize-none"
              />
              <button 
                onClick={handleCreateSuperModel}
                className="w-full bg-[#FF6321] text-black font-medium py-2.5 rounded-lg hover:bg-[#ff7a45] transition-colors"
              >
                Create Super Model
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tool Modal */}
      {isToolModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-[#333] rounded-xl w-full max-w-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold">Add Custom Tool (JS)</h2>
              <button onClick={() => setIsToolModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <input 
                type="text" placeholder="Tool Name (e.g., fetchWeather)" value={toolName} onChange={e => setToolName(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
              />
              <input 
                type="text" placeholder="Description for the model" value={toolDesc} onChange={e => setToolDesc(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
              />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Parameters Schema (JSON)</label>
                <textarea 
                  value={toolSchema} onChange={e => setToolSchema(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-sm h-32 font-mono focus:outline-none focus:border-[#FF6321] custom-scrollbar resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">JavaScript Code (receives &apos;args&apos; object, must return a value or Promise)</label>
                <textarea 
                  value={toolCode} onChange={e => setToolCode(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-sm h-32 font-mono focus:outline-none focus:border-[#FF6321] custom-scrollbar resize-none"
                />
              </div>
              <button 
                onClick={handleCreateTool}
                className="w-full bg-[#FF6321] text-black font-medium py-2.5 rounded-lg hover:bg-[#ff7a45] transition-colors"
              >
                Save Tool
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plugin Store Modal */}
      {isPluginStoreOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="theme-bg-secondary border theme-border rounded-xl w-full max-w-4xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 theme-text-primary">
                  <Puzzle className="text-purple-500" /> FutureTools Plugin Store
                </h2>
                <p className="text-sm theme-text-secondary mt-1">Besplatni alati i integracije za vaše agente (100% Free)</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleSyncPublicApis}
                  disabled={isSyncingApis}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isSyncingApis 
                      ? 'bg-gray-600 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                  }`}
                >
                  {isSyncingApis ? 'Sinhronizujem...' : 'Sinhronizuj Public APIs'}
                </button>
                <button onClick={() => setIsPluginStoreOpen(false)} className="theme-text-secondary hover:text-white">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {AVAILABLE_PLUGINS.map(plugin => {
                  const isInstalled = customTools.some(t => t.declaration.name === plugin.declaration.name);
                  return (
                    <div key={plugin.id} className="theme-bg-tertiary border theme-border rounded-xl p-5 flex flex-col relative overflow-hidden group hover:border-purple-500/50 transition-colors">
                      <div className="absolute top-0 right-0 px-2 py-1 theme-bg-secondary text-[10px] uppercase tracking-wider theme-text-secondary rounded-bl-lg">
                        {plugin.category}
                      </div>
                      <h3 className="font-bold theme-text-primary mb-2 mt-2">{plugin.name}</h3>
                      <p className="text-sm theme-text-secondary flex-1 mb-4">{plugin.description}</p>
                      
                      <button
                        onClick={() => handleInstallPlugin(plugin)}
                        disabled={isInstalled}
                        className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                          isInstalled 
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20 cursor-not-allowed' 
                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]'
                        }`}
                      >
                        {isInstalled ? 'Instalirano' : 'Instaliraj'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
