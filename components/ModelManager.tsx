'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Download, Check, Terminal, Shield, Info } from 'lucide-react';

interface ModelManagerProps {
  ollamaUrl: string;
  onActivate: (modelName: string) => void;
  currentModel: string;
}

export default function ModelManager({ ollamaUrl, onActivate, currentModel }: ModelManagerProps) {
  const [hfUrl, setHfUrl] = useState('hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF:Q4_K_M');
  const [isPulling, setIsPulling] = useState(false);
  const [pullLogs, setPullLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'pulling' | 'success' | 'error'>('idle');
  const [ollamaStatus, setOllamaStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkOllamaStatus();
  }, [ollamaUrl]);

  const checkOllamaStatus = async () => {
    setOllamaStatus('checking');
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`);
      if (res.ok) setOllamaStatus('online');
      else setOllamaStatus('offline');
    } catch (e) {
      setOllamaStatus('offline');
    }
  };

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pullLogs]);

  const QUICK_MODELS = [
    { name: 'Gemma 2 9B', url: 'hf.co/bartowski/gemma-2-9b-it-GGUF:Q4_K_M' },
    { name: 'Gemma 2 2B', url: 'hf.co/bartowski/gemma-2-2b-it-GGUF:Q4_K_M' },
    { name: 'Llama 3.2 1B', url: 'hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF:Q4_K_M' },
    { name: 'Llama 3.2 3B', url: 'hf.co/bartowski/Llama-3.2-3B-Instruct-GGUF:Q4_K_M' },
  ];

  const PUTER_MODELS = [
    { name: 'Claude 3.5 Sonnet', id: 'claude-3-5-sonnet' },
    { name: 'Claude 3.5 Opus', id: 'claude-3-5-opus' },
    { name: 'Claude 3.5 Haiku', id: 'claude-3-5-haiku' },
    { name: 'Llama 3.1 405B', id: 'llama-3-1-405b' },
    { name: 'Llama 3.1 70B', id: 'llama-3-1-70b' },
    { name: 'Mistral Large 2', id: 'mistral-large-2' },
    { name: 'Qwen 2.5 72B', id: 'qwen-2-5-72b' },
  ];

  const pullModel = async (targetUrl?: string) => {
    const urlToPull = targetUrl || hfUrl;
    if (!urlToPull.trim()) return;
    
    setIsPulling(true);
    setPullLogs([]);
    setProgress(0);
    setStatus('pulling');
    setPullLogs(prev => [...prev, `↓ Pulling ${urlToPull}...`]);

    try {
      const response = await fetch(`${ollamaUrl}/api/pull`, {
        method: 'POST',
        body: JSON.stringify({ name: urlToPull, stream: true }),
      });

      if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.status) {
              let logLine = data.status;
              if (data.completed && data.total) {
                const percent = Math.round((data.completed / data.total) * 100);
                setProgress(percent);
                logLine += ` ${percent}% (${Math.round(data.completed / 1024 / 1024)}MB / ${Math.round(data.total / 1024 / 1024)}MB)`;
              }
              setPullLogs(prev => [...prev, logLine]);
            }
            if (data.error) throw new Error(data.error);
          } catch (e) {
            console.error('Error parsing Ollama stream:', e);
          }
        }
      }

      setStatus('success');
      setPullLogs(prev => [...prev, '✅ Model successfully pulled!']);
      if (targetUrl) setHfUrl(targetUrl);
    } catch (err: any) {
      setStatus('error');
      setPullLogs(prev => [...prev, `❌ Error: ${err.message}`]);
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤗</span>
          <h2 className="text-lg font-bold">HuggingFace GGUF Modeli</h2>
        </div>
        <div className="flex items-center gap-2 bg-[#111] px-3 py-1 rounded-full border border-[#333]">
          <div className={`w-2 h-2 rounded-full ${ollamaStatus === 'online' ? 'bg-green-500' : ollamaStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
          <span className="text-[10px] uppercase font-bold text-gray-400">Ollama: {ollamaStatus}</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-6">Povuci model direktno sa HF Hub-a kroz Ollama</p>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-6 flex gap-3">
        <Info size={18} className="text-blue-500 shrink-0" />
        <p className="text-[11px] text-gray-400">
          <span className="font-bold text-blue-400">Napomena:</span> Za rad sa browserom, Ollama mora imati dozvoljen CORS. Pokreni Ollama sa: 
          <code className="bg-black px-1 rounded text-[#FF6321] ml-1">OLLAMA_ORIGINS=&quot;*&quot; ollama serve</code>
        </p>
      </div>

      {/* Quick Pull Section */}
      <div className="space-y-3">
        <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500">Brzi Pull (Google & Llama)</label>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_MODELS.map((m) => (
            <button
              key={m.name}
              onClick={() => {
                setHfUrl(m.url);
                pullModel(m.url);
              }}
              disabled={isPulling}
              className="flex items-center justify-between px-3 py-2 bg-[#111] border border-[#333] rounded-lg hover:border-[#FF6321] transition-all group"
            >
              <span className="text-xs font-medium text-gray-300 group-hover:text-white">{m.name}</span>
              <Download size={14} className="text-gray-500 group-hover:text-[#FF6321]" />
            </button>
          ))}
        </div>
      </div>

      {/* Puter Models */}
      <div className="bg-[#111] border border-[#333] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Terminal size={18} className="text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Puter Models (Cloud)</h3>
            <p className="text-[10px] text-gray-500">Besplatan pristup (bez API ključa)</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PUTER_MODELS.map(m => (
            <button 
              key={m.id}
              onClick={() => onActivate(m.id)}
              className={`flex items-center justify-between px-3 py-2 bg-[#111] border rounded-lg transition-all group ${
                currentModel === m.id ? 'border-[#FF6321]' : 'border-[#333] hover:border-[#FF6321]'
              }`}
            >
              <span className="text-xs font-medium text-gray-300 group-hover:text-white">{m.name}</span>
              {currentModel === m.id && <Check size={14} className="text-[#FF6321]" />}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Model Card */}
      <div className="bg-[#111] border border-[#333] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
            <Download size={18} className="text-yellow-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Custom Model</h3>
            <p className="text-[10px] text-gray-500">Unesi bilo koji HF GGUF model</p>
          </div>
        </div>

        <div className="flex gap-2">
          <input 
            type="text"
            value={hfUrl}
            onChange={(e) => setHfUrl(e.target.value)}
            placeholder="hf.co/user/repo:quant"
            className="flex-1 bg-[#0a0a0a] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
          />
        </div>
        
        <p className="text-[10px] text-gray-500 italic">
          Format: hf.co/user/repo:quant — npr. hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF:Q4_K_M
        </p>

        <div className="flex gap-3">
          <button 
            onClick={() => pullModel()}
            disabled={isPulling}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${
              isPulling ? 'bg-purple-500/50 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500'
            } text-white text-sm`}
          >
            <Download size={16} />
            {isPulling ? `Pulling ${progress}%` : 'Pull model'}
          </button>
          <button 
            onClick={() => onActivate(hfUrl)}
            disabled={status !== 'success' && currentModel !== hfUrl}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${
              status === 'success' ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-[#222] text-gray-500 border border-[#333]'
            } text-sm`}
          >
            <Check size={16} />
            Postavi aktivnim
          </button>
        </div>

        {/* Logs Window */}
        {(pullLogs.length > 0 || isPulling) && (
          <div className="bg-black rounded-lg border border-[#333] p-3 h-40 overflow-y-auto font-mono text-[10px] custom-scrollbar">
            {pullLogs.map((log, i) => (
              <div key={i} className="text-gray-400 mb-1">
                {log}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* SSH Key Card */}
      <div className="bg-[#111] border border-[#333] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Shield size={18} className="text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold">SSH Ključ (Private modeli)</h3>
            <p className="text-[10px] text-gray-500">Za privatne HF GGUF modele. Dodaj Ollama SSH key na HF account.</p>
          </div>
        </div>

        <div className="text-[11px] text-gray-400 space-y-2 leading-relaxed">
          <p>1. Pokreni: <code className="bg-black px-1 rounded text-[#FF6321]">cat ~/.ollama/id_ed25519.pub</code></p>
          <p>2. Idi na <a href="https://huggingface.co/settings/keys" target="_blank" className="text-[#FF6321] hover:underline">huggingface.co/settings/keys</a></p>
          <p>3. Dodaj SSH key</p>
          <p>4. Sada možeš: <code className="bg-black px-1 rounded text-[#FF6321]">ollama run hf.co/tvoj-user/privatni-repo</code></p>
        </div>

        <div className="pt-2">
          <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">HF_SSH_KEY ENV VARIJABLA (OPCIONALNO)</label>
          <input 
            type="text"
            placeholder="Putanja do SSH key fajla"
            className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#FF6321]"
          />
        </div>
      </div>
    </div>
  );
}
