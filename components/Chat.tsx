'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Type } from '@google/genai';
import Markdown from 'react-markdown';
import { Send, Loader2, AlertCircle, User, Bot, Paperclip, X, File as FileIcon, Zap, Copy, Check, Wrench } from 'lucide-react';
import { Agent } from '@/lib/github';
import { AgentSettings } from './Dashboard';
import { PromptEditor } from './PromptEditor';
import { searchPublicApis } from '@/lib/publicApis';
import JSZip from 'jszip';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';

interface Message {
  role: 'user' | 'model';
  content: string;
  attachments?: { name: string; mimeType: string; data: string }[];
}

const createZipTool = {
  name: "createAndUploadZip",
  description: "Creates a ZIP file containing the provided files and uploads it to a free cloud storage (file.io). Returns the download link.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      files: {
        type: Type.ARRAY,
        description: "List of files to include in the ZIP archive.",
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "File name including extension (e.g., script.js)" },
            content: { type: Type.STRING, description: "Text content of the file" }
          },
          required: ["name", "content"]
        }
      }
    },
    required: ["files"]
  }
};

const githubPushTool = {
  name: "pushToGitHub",
  description: "Creates a new GitHub repository and pushes the provided files to it. Requires a GitHub token in settings.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      repoName: { type: Type.STRING, description: "Name of the new repository" },
      description: { type: Type.STRING, description: "Description of the repository" },
      isPrivate: { type: Type.BOOLEAN, description: "Whether the repo should be private" },
      files: {
        type: Type.ARRAY,
        description: "Files to push",
        items: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: "File path (e.g., src/index.js)" },
            content: { type: Type.STRING, description: "File content" }
          },
          required: ["path", "content"]
        }
      }
    },
    required: ["repoName", "files"]
  }
};

const netlifyDeployTool = {
  name: "deployToNetlify",
  description: "Deploys a static site to Netlify by zipping the provided files. Requires a Netlify token in settings. YOU MUST ensure that the files array includes a 'netlify.toml' configuration file if needed, and a 'package.json' with build scripts if deploying a framework.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      siteName: { type: Type.STRING, description: "Optional name for the site" },
      files: {
        type: Type.ARRAY,
        description: "Files to deploy (must include an index.html or build config)",
        items: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: "File path" },
            content: { type: Type.STRING, description: "File content" }
          },
          required: ["path", "content"]
        }
      }
    },
    required: ["files"]
  }
};

const vercelDeployTool = {
  name: "deployToVercel",
  description: "Deploys files directly to Vercel. Requires a Vercel token in settings. YOU MUST ensure that the files array includes a 'vercel.json' configuration file if needed, and a 'package.json' with build scripts if deploying a framework.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      projectName: { type: Type.STRING, description: "Name of the Vercel project" },
      files: {
        type: Type.ARRAY,
        description: "Files to deploy",
        items: {
          type: Type.OBJECT,
          properties: {
            path: { type: Type.STRING, description: "File path" },
            content: { type: Type.STRING, description: "File content" }
          },
          required: ["path", "content"]
        }
      }
    },
    required: ["projectName", "files"]
  }
};

const railwayDeployTool = {
  name: "deployToRailway",
  description: "Deploys a GitHub repository to Railway. Requires a Railway token in settings. YOU MUST first use pushToGitHub to create the repo, ensure it contains a 'railway.json' or 'nixpacks.toml' file, and then pass the GitHub repo full name (owner/repo) to this tool.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      repoFullName: { type: Type.STRING, description: "Full GitHub repository name (e.g., 'username/repo-name')" }
    },
    required: ["repoFullName"]
  }
};

const searchPublicApisTool = {
  name: "searchPublicApis",
  description: "Search for public APIs from a curated database. Use this when you need an external API for a specific task (e.g., weather, news, finance).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, description: "The category of API to search for (e.g., Animals, Books, Business, Cryptocurrency, Development, Games, Health, Music, News, Security, Social, Sports, Weather)" }
    },
    required: ["category"]
  }
};

async function handleCreateAndUploadZip(files: { name: string, content: string }[]) {
  const zip = new JSZip();
  files.forEach(f => zip.file(f.name, f.content));
  const blob = await zip.generateAsync({ type: 'blob' });
  
  const formData = new FormData();
  formData.append('file', blob, 'archive.zip');
  
  const res = await fetch('https://file.io', {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  return data.link;
}

async function handleGitHubPush(token: string, repoName: string, description: string, isPrivate: boolean, files: { path: string, content: string }[]) {
  if (!token) throw new Error("GitHub token is missing in settings.");
  
  // Create repo
  const createRes = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      name: repoName,
      description: description || '',
      private: isPrivate || false,
      auto_init: true
    })
  });
  
  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Failed to create repo: ${err.message}`);
  }
  
  const repoData = await createRes.json();
  const owner = repoData.owner.login;
  
  // Push files sequentially (simple approach)
  for (const file of files) {
    await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${file.path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: `Add ${file.path}`,
        content: btoa(unescape(encodeURIComponent(file.content)))
      })
    });
  }
  
  return repoData.html_url;
}

async function handleNetlifyDeploy(token: string, files: { path: string, content: string }[], siteName?: string) {
  if (!token) throw new Error("Netlify token is missing in settings.");
  
  const zip = new JSZip();
  files.forEach(f => zip.file(f.path, f.content));
  const blob = await zip.generateAsync({ type: 'blob' });
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/zip'
  };
  
  let url = 'https://api.netlify.com/api/v1/sites';
  
  // Create site first if we want a specific name or just let Netlify generate one
  const createRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: siteName || `agency-${Date.now()}` })
  });
  
  let siteId = '';
  if (createRes.ok) {
    const siteData = await createRes.json();
    siteId = siteData.id;
    url = `https://api.netlify.com/api/v1/sites/${siteId}/deploys`;
  } else {
    throw new Error("Failed to create Netlify site");
  }
  
  const deployRes = await fetch(url, {
    method: 'POST',
    headers,
    body: blob
  });
  
  if (!deployRes.ok) {
    throw new Error("Failed to deploy to Netlify");
  }
  
  const deployData = await deployRes.json();
  return deployData.deploy_ssl_url || deployData.url;
}

async function handleVercelDeploy(token: string, files: { path: string, content: string }[], projectName: string) {
  if (!token) throw new Error("Vercel token is missing in settings.");
  
  const response = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: projectName || 'agency-deploy',
      files: files.map(f => ({
        file: f.path,
        data: f.content
      })),
      projectSettings: {
        framework: null // Let Vercel auto-detect
      }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Failed to deploy to Vercel: ${err.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.url ? `https://${data.url}` : 'Deployment started successfully';
}

async function handleRailwayDeploy(token: string, repoFullName: string) {
  if (!token) throw new Error("Railway token is missing in settings.");
  
  const query = `
    mutation {
      projectCreate(input: {
        repo: "${repoFullName}"
      }) {
        id
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    throw new Error("Failed to connect to Railway API");
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Railway Error: ${data.errors[0].message}`);
  }

  return `Project created on Railway from ${repoFullName}. Check your Railway dashboard to view the deployment.`;
}

export default function Chat({ agent, systemInstruction, setSystemInstruction, settings, user, customTools = [], onSwipeRight }: { agent: Agent; systemInstruction: string; setSystemInstruction: (instruction: string) => void; settings: AgentSettings; user: FirebaseUser | null; customTools?: any[]; onSwipeRight?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [godMode, setGodMode] = useState(false);
  const [activeToolNames, setActiveToolNames] = useState<string[]>(['createAndUploadZip', 'pushToGitHub', 'deployToNetlify', 'deployToVercel', 'deployToRailway', 'searchPublicApis']);
  const [isToolSelectorOpen, setIsToolSelectorOpen] = useState(false);
  const [workflowPlan, setWorkflowPlan] = useState<any[] | null>(null);
  const [attachments, setAttachments] = useState<{ name: string; mimeType: string; data: string }[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load session from Firebase
  useEffect(() => {
    if (!user || !db) {
      setMessages([{
        role: 'model',
        content: `Zdravo! Ja sam **${agent.name}**. Kako vam mogu pomoći danas?`
      }]);
      return;
    }

    const safeAgentPath = agent.path.split('/').pop()?.replace(/\.[^/.]+$/, "") || 'agent';
    const sessionId = `${user.uid}_${safeAgentPath}`;
    const docRef = doc(db, 'chatSessions', sessionId);
    
    const handleFirestoreError = (error: any, operation: string, path: string) => {
      const errInfo = {
        error: error.message || String(error),
        operation,
        path,
        userId: user?.uid,
        email: user?.email
      };
      console.error('Firestore Error:', JSON.stringify(errInfo));
    };

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.messages) {
          try {
            setMessages(JSON.parse(data.messages));
          } catch (e) {
            console.error("Failed to parse messages", e);
          }
        }
      } else {
        setMessages([{
          role: 'model',
          content: `Zdravo! Ja sam **${agent.name}**. Kako vam mogu pomoći danas?`
        }]);
      }
    }, (error) => handleFirestoreError(error, 'GET', `chatSessions/${sessionId}`));

    return () => unsubscribe();
  }, [agent, user]);

  const saveSession = async (newMessages: Message[]) => {
    if (!user || !db) return;
    const safeAgentPath = agent.path.split('/').pop()?.replace(/\.[^/.]+$/, "") || 'agent';
    const sessionId = `${user.uid}_${safeAgentPath}`;
    try {
      await setDoc(doc(db, 'chatSessions', sessionId), {
        agentId: agent.path,
        userId: user.uid,
        messages: JSON.stringify(newMessages),
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error("Failed to save session", error);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        setAttachments(prev => [...prev, {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: base64
        }]);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const processAIResponse = async (
    responseText: string, 
    currentMessages: Message[]
  ): Promise<void> => {
    let finalMessages = [...currentMessages];

    // Check for workflow JSON block (Deer-Flow visualization)
    const workflowMatch = responseText.match(/```json\s*\n\s*\{\s*"workflow"\s*:\s*(\[[\s\S]*?\])\s*\}\s*\n\s*```/);
    if (workflowMatch) {
      try {
        const plan = JSON.parse(workflowMatch[1]);
        setWorkflowPlan(plan);
      } catch (e) {
        console.error("Failed to parse workflow plan", e);
      }
    }

    const cleanText = responseText.replace('[CONTINUE]', '').trim();

    if (cleanText) {
      finalMessages = [...finalMessages, { role: 'model', content: cleanText }];
      setMessages(finalMessages);
      saveSession(finalMessages);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userMessage = input.trim();
    const currentAttachments = [...attachments];
    
    setInput('');
    setAttachments([]);
    setWorkflowPlan(null);
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage, attachments: currentAttachments }, { role: 'model', content: '' }];
    setMessages(newMessages);
    saveSession(newMessages);
    setIsLoading(true);

    try {
      const requiresOpenRouterKey =
        settings.provider === 'openrouter' || settings.provider === 'claude' || settings.provider === 'gemini';
      if (requiresOpenRouterKey && !settings.openRouterKey?.trim()) {
        throw new Error('OpenRouter API ključ je obavezan za izabrani provider/model.');
      }
      if (settings.provider === 'huggingface' && !settings.huggingFaceKey?.trim()) {
        throw new Error('Hugging Face token je obavezan za izabrani provider/model.');
      }
      let responseContent = '';

      let godModePrompt = godMode ? `\n\nNALAZIŠ SE U GOD MODE-u (KONSOLIDOVANA AI ARMIJA - CLAUDE MAX & GEMMA 4 CAPABILITIES).
Ovo je "Web unutar Weba", ultimativna mašinerija za izvršavanje zadataka.
Tvoj zadatak je da djeluješ kao roj ekspertnih agenata koji paralelno rješavaju problem.
NEMA SIMULACIJA. NEMA MOCK PODATAKA. NEMA LAŽNIH LOGIKA.
Kada deployaš aplikacije, OBAVEZNO prvo generiši potrebne konfiguracione fajlove (netlify.toml, vercel.json, railway.json, nixpacks.toml, package.json sa build skriptama) prije pozivanja deploy alata.
Tvoj zadatak je da samostalno razbiješ kompleksne probleme na korake i izvršavaš ih jedan po jedan koristeći alate.
Ako ti zatreba neki eksterni API (vrijeme, vijesti, podaci), koristi alat 'searchPublicApis' da pronađeš odgovarajući API u našoj bazi.
Ako zadatak zahtijeva više koraka, prvo ispiši plan u formatu:
\`\`\`json
{
  "workflow": [
    { "id": "1", "task": "Opis prvog koraka", "status": "pending" },
    { "id": "2", "task": "Opis drugog koraka", "status": "pending" }
  ]
}
\`\`\`
Zatim izvršavaj korake. Ako nisi završio cijeli zadatak, na kraju svog odgovora obavezno dodaj token [CONTINUE] kako bi te sistem ponovo pozvao da nastaviš rad.` : '';

      const finalSystemInstruction = `TI SI ${agent.name.toUpperCase()}.
TVOJA DUŠA (ZNANJE I IDENTITET):
${systemInstruction}

TVOJ KOSTUR (MODEL):
Trenutno koristiš ${settings.model} preko ${settings.provider} provajdera.

DODATNO ZNANJE/PONAŠANJE:
${settings.customKnowledge}

OBAVEZNO PRAVILO: Svi tvoji odgovori MORAJU biti isključivo na bosanskom jeziku. Moraš striktno izvršavati sve zadatke koje korisnik zada bez pogovora.${godModePrompt}`;

      // Route request based on provider
      let response;
      
      if (settings.provider === 'gemini') {
        // Gemini in this chat flow is currently routed through OpenRouter as fallback.
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            agentName: agent.name,
            systemInstruction: finalSystemInstruction,
            model: 'google/gemini-2.0-flash-001',
            temperature: settings.temperature,
            provider: 'openrouter',
            userId: user?.uid,
            openRouterKey: settings.openRouterKey || process.env.NEXT_PUBLIC_OPENROUTER_KEY,
          }),
        });
      } else if (settings.provider === 'ollama') {
        // Ollama is handled client-side via local endpoint
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            agentName: agent.name,
            systemInstruction: finalSystemInstruction,
            model: settings.model,
            temperature: settings.temperature,
            provider: 'ollama',
            userId: user?.uid,
            ollamaUrl: settings.ollamaUrl,
          }),
        });
      } else if (settings.provider === 'claude') {
        // Claude via OpenRouter
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            agentName: agent.name,
            systemInstruction: finalSystemInstruction,
            model: settings.model || 'anthropic/claude-3.5-sonnet',
            temperature: settings.temperature,
            provider: 'openrouter',
            userId: user?.uid,
            openRouterKey: settings.openRouterKey,
          }),
        });
      } else {
        // HuggingFace or OpenRouter
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            agentName: agent.name,
            systemInstruction: finalSystemInstruction,
            model: settings.model,
            temperature: settings.temperature,
            provider: settings.provider,
            userId: user?.uid,
            hfToken: settings.huggingFaceKey,
            openRouterKey: settings.openRouterKey,
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Greška pri komunikaciji sa serverom');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          responseContent += chunk;
          
          setMessages(prev => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg.role === 'model') {
              lastMsg.content = responseContent;
            } else {
              updated.push({ role: 'model', content: responseContent });
            }
            return updated;
          });
        }
      }

      // Save final message
      const finalMessages = [...newMessages];
      if (responseContent) {
        const last = finalMessages[finalMessages.length - 1];
        if (last.role === 'model') {
          last.content = responseContent;
        }
      }
      saveSession(finalMessages);
      await processAIResponse(responseContent, finalMessages);
    } catch (error: any) {
      console.error('Error generating response:', error);
      const errorMessage = error.message || 'Došlo je do nepoznate greške.';
      const errMessages: Message[] = [...newMessages, { role: 'model', content: `Greška: ${errorMessage}` }];
      setMessages(errMessages);
      saveSession(errMessages);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100 && onSwipeRight) {
          onSwipeRight();
        }
      }}
      className={`flex flex-col h-full transition-all duration-700 ${godMode ? 'bg-[#000] border-2 border-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.3),inset_0_0_100px_rgba(168,85,247,0.1)] relative overflow-hidden' : 'theme-bg-secondary'} theme-text-primary`}
    >
      {godMode && (
        <>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none mix-blend-screen"></div>
          <motion.div 
            animate={{ 
              opacity: [0.1, 0.3, 0.1],
              scale: [1, 1.02, 1]
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20 pointer-events-none"
          />
        </>
      )}
      
      <div className="px-4 py-2 border-b theme-border flex items-center justify-between bg-black/20 backdrop-blur-sm z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${settings.provider === 'openrouter' ? 'bg-purple-500' : 'bg-yellow-500'} animate-pulse`}></div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest font-bold opacity-50 leading-none mb-1">
                Skeleton (Model)
              </span>
              <span className="text-[11px] font-bold theme-text-primary leading-none">
                {settings.provider}: {settings.model}
              </span>
            </div>
          </div>
          
          <div className="w-px h-6 bg-theme-border opacity-20"></div>

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#FF6321] shadow-[0_0_8px_rgba(255,99,33,0.5)]"></div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest font-bold opacity-50 leading-none mb-1">
                Soul (Knowledge)
              </span>
              <span className="text-[11px] font-bold text-[#FF6321] leading-none">
                {agent.name}
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => (window as any).openSettings?.()}
          className="text-[10px] uppercase tracking-widest font-bold text-[#FF6321] hover:underline"
        >
          Settings
        </button>
      </div>

      <PromptEditor systemInstruction={systemInstruction} onSave={setSystemInstruction} />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 relative z-10">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-[#FF6321] flex items-center justify-center shrink-0">
                <Bot size={18} className="text-black" />
              </div>
            )}
            <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-4 relative group ${
              msg.role === 'user' 
                ? 'bg-[#2a2a2a] text-white rounded-tr-sm' 
                : 'theme-bg-tertiary border theme-border theme-text-primary rounded-tl-sm'
            }`}>
              <button 
                onClick={() => handleCopy(msg.content, idx)}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#111]/50 theme-text-secondary opacity-0 group-hover:opacity-100 transition-all hover:theme-text-primary"
                title="Copy message"
              >
                {copiedIdx === idx ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {msg.attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#111] border border-[#444] rounded-lg px-3 py-1.5 text-xs">
                      {att.mimeType.startsWith('image/') ? (
                        <img src={`data:${att.mimeType};base64,${att.data}`} alt={att.name} className="w-8 h-8 object-cover rounded" />
                      ) : (
                        <FileIcon size={14} className="text-[#FF6321]" />
                      )}
                      <span className="truncate max-w-[150px]">{att.name}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="prose prose-invert prose-sm sm:prose-base max-w-none markdown-body">
                <Markdown>{msg.content}</Markdown>
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full theme-bg-tertiary flex items-center justify-center shrink-0">
                <User size={18} className="theme-text-primary" />
              </div>
            )}
          </div>
        ))}
        <AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex gap-4 justify-start"
            >
              <div className="w-8 h-8 rounded-full bg-[#FF6321] flex items-center justify-center shrink-0 shadow-lg shadow-[#FF6321]/20">
                <Bot size={18} className="text-black" />
              </div>
              <div className="theme-bg-tertiary border theme-border rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-3 shadow-sm">
                <div className="relative flex items-center justify-center">
                  <Loader2 size={18} className="animate-spin text-[#FF6321]" />
                  <div className="absolute inset-0 animate-ping rounded-full bg-[#FF6321]/20"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium theme-text-primary animate-pulse">
                    {godMode ? 'Autonomno razmišljam...' : 'Agent is thinking...'}
                  </span>
                  <span className="text-[10px] theme-text-secondary uppercase tracking-wider font-bold">
                    Processing request
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 theme-bg-secondary border-t theme-border">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 max-w-4xl mx-auto">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 theme-bg-tertiary border theme-border rounded-lg pl-3 pr-1 py-1.5 text-sm">
                {att.mimeType.startsWith('image/') ? (
                  <img src={`data:${att.mimeType};base64,${att.data}`} alt={att.name} className="w-6 h-6 object-cover rounded" />
                ) : (
                  <FileIcon size={14} className="theme-text-secondary" />
                )}
                <span className="truncate max-w-[150px] theme-text-primary">{att.name}</span>
                <button 
                  onClick={() => removeAttachment(i)}
                  className="p-1 hover:theme-bg-secondary rounded-md theme-text-secondary hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {workflowPlan && (
          <div className="max-w-4xl mx-auto mb-4 theme-bg-secondary border theme-border rounded-xl p-5 shadow-2xl overflow-x-auto">
            <h3 className="text-sm font-medium text-purple-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
              <Zap size={16} className="animate-pulse" /> Deer-Flow Execution Engine
            </h3>
            <div className="flex items-center gap-4 min-w-max pb-2">
              {workflowPlan.map((step: any, idx: number) => (
                <div key={step.id || idx} className="flex items-center">
                  <div className={`relative flex flex-col items-center w-48 theme-bg-tertiary border rounded-xl p-4 transition-all ${
                    step.status === 'completed' ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' :
                    step.status === 'running' ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' :
                    'theme-border'
                  }`}>
                    <div className={`absolute -top-3 w-6 h-6 rounded-full flex items-center justify-center border-2 theme-bg-tertiary ${
                      step.status === 'completed' ? 'border-green-500 text-green-500' :
                      step.status === 'running' ? 'border-purple-500 text-purple-500 animate-pulse' :
                      'border-[#444] theme-text-secondary'
                    }`}>
                      <span className="text-[10px] font-bold">{idx + 1}</span>
                    </div>
                    <p className="text-xs theme-text-primary text-center mt-2 line-clamp-3">{step.task}</p>
                    <div className={`mt-3 text-[9px] uppercase tracking-wider px-2 py-1 rounded-full ${
                      step.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                      step.status === 'running' ? 'bg-purple-500/10 text-purple-400' :
                      'theme-bg-secondary theme-text-secondary'
                    }`}>
                      {step.status || 'pending'}
                    </div>
                  </div>
                  {idx < workflowPlan.length - 1 && (
                    <div className="w-8 h-0.5 bg-gradient-to-r from-[#333] to-[#333] relative">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-[#333] rotate-45"></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative flex items-center gap-2 z-20">
          <div className="relative flex-1 flex items-center">
            <input
              type="file"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute left-2 w-10 h-10 rounded-full theme-text-secondary hover:text-white flex items-center justify-center transition-colors z-10"
            >
              <Paperclip size={20} />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Poruka za ${agent.name}...`}
              className={`w-full theme-bg-tertiary border theme-border theme-text-primary rounded-full pl-12 pr-14 py-4 focus:outline-none focus:border-[#FF6321] focus:ring-1 focus:ring-[#FF6321] transition-all ${godMode ? 'border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : ''}`}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={(!input.trim() && attachments.length === 0) || isLoading}
              className={`absolute right-2 w-10 h-10 rounded-full ${godMode ? 'bg-purple-600 hover:bg-purple-500' : 'bg-[#FF6321] hover:bg-[#ff7a45]'} text-black flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            >
              <Send size={18} className="ml-0.5" />
            </button>
          </div>
          
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsToolSelectorOpen(!isToolSelectorOpen)}
              className={`flex items-center justify-center w-12 h-12 shrink-0 rounded-full transition-colors border ${
                isToolSelectorOpen 
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                  : 'theme-bg-tertiary theme-border theme-text-secondary hover:text-gray-300'
              }`}
              title="Tool Selection"
            >
              <Wrench size={20} />
            </button>
            
            <AnimatePresence>
              {isToolSelectorOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  className="absolute bottom-full right-0 mb-4 w-64 theme-bg-tertiary border theme-border rounded-xl p-4 shadow-2xl z-50"
                >
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-3 theme-text-secondary">Aktivni Alati</h4>
                  <div className="space-y-2">
                    {[
                      { id: 'createAndUploadZip', name: 'ZIP & Upload' },
                      { id: 'pushToGitHub', name: 'GitHub Push' },
                      { id: 'deployToNetlify', name: 'Netlify Deploy' },
                      { id: 'deployToVercel', name: 'Vercel Deploy' },
                      { id: 'deployToRailway', name: 'Railway Deploy' },
                      { id: 'searchPublicApis', name: 'Public API Search' },
                      ...customTools.map(t => ({ id: t.declaration.name, name: t.declaration.name }))
                    ].map(tool => (
                      <label key={tool.id} className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={activeToolNames.includes(tool.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setActiveToolNames(prev => [...prev, tool.id]);
                            } else {
                              setActiveToolNames(prev => prev.filter(id => id !== tool.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-black"
                        />
                        <span className="text-sm theme-text-primary group-hover:text-white transition-colors">{tool.name}</span>
                      </label>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => setGodMode(!godMode)}
            className={`flex items-center justify-center w-12 h-12 shrink-0 rounded-full transition-colors border ${
              godMode 
                ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]' 
                : 'theme-bg-tertiary theme-border theme-text-secondary hover:text-gray-300'
            }`}
            title="GOD Mode (Autonomous Task Execution)"
          >
            <Zap size={20} className={godMode ? 'animate-pulse' : ''} />
          </button>
        </form>
        <div className="text-center mt-2">
          <span className="text-[10px] theme-text-secondary uppercase tracking-widest">Powered by {settings.model}</span>
        </div>
      </div>
    </motion.div>
  );
}
