'use client';

import React, { useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';

interface ModelManagerProps {
  onActivate: (modelName: string, provider?: 'huggingface' | 'openrouter') => void;
  currentModel: string;
  ollamaUrl?: string;
}

const HF_MODELS = [
  {
    category: 'Llama (Meta)',
    models: [
      { name: 'Llama 3.3 70B Instruct', id: 'meta-llama/Llama-3.3-70B-Instruct' },
      { name: 'Llama 3.1 8B Instruct', id: 'meta-llama/Meta-Llama-3.1-8B-Instruct' },
      { name: 'Llama 3.2 3B Instruct', id: 'meta-llama/Llama-3.2-3B-Instruct' },
      { name: 'Llama 3.2 1B Instruct', id: 'meta-llama/Llama-3.2-1B-Instruct' },
    ]
  },
  {
    category: 'Mistral',
    models: [
      { name: 'Mistral 7B v0.3', id: 'mistralai/Mistral-7B-Instruct-v0.3' },
      { name: 'Mixtral 8x7B', id: 'mistralai/Mixtral-8x7B-Instruct-v0.1' },
    ]
  },
  {
    category: 'Google',
    models: [
      { name: 'Gemma 2 9B', id: 'google/gemma-2-9b-it' },
      { name: 'Gemma 2 2B', id: 'google/gemma-2-2b-it' },
    ]
  },
  {
    category: 'Microsoft',
    models: [
      { name: 'Phi-3 Mini 4K', id: 'microsoft/Phi-3-mini-4k-instruct' },
      { name: 'Phi-3.5 Mini', id: 'microsoft/Phi-3.5-mini-instruct' },
    ]
  },
  {
    category: 'Qwen (Alibaba)',
    models: [
      { name: 'Qwen2.5 72B', id: 'Qwen/Qwen2.5-72B-Instruct' },
      { name: 'Qwen2.5 7B', id: 'Qwen/Qwen2.5-7B-Instruct' },
    ]
  },
];

const OR_MODELS = [
  { name: 'Gemini 2.0 Flash (Free)', id: 'google/gemini-2.0-flash-001' },
  { name: 'Llama 3.1 8B (Free)', id: 'meta-llama/llama-3.1-8b-instruct:free' },
  { name: 'Mistral 7B (Free)', id: 'mistralai/mistral-7b-instruct:free' },
  { name: 'Qwen 2 7B (Free)', id: 'qwen/qwen-2-7b-instruct:free' },
  { name: 'DeepSeek R1 (Free)', id: 'deepseek/deepseek-r1:free' },
  { name: 'Phi-3 Mini (Free)', id: 'microsoft/phi-3-mini-128k-instruct:free' },
];

export default function ModelManager({ onActivate, currentModel }: ModelManagerProps) {
  const [tab, setTab] = useState<'hf' | 'or'>('hf');
  const [customId, setCustomId] = useState('');

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex bg-[#111] rounded-lg p-1 gap-1">
        <button
          onClick={() => setTab('hf')}
          className={`flex-1 py-2 text-xs rounded-md font-bold transition-all ${tab === 'hf' ? 'bg-[#FF6321] text-black' : 'text-gray-500 hover:text-white'}`}
        >
          🤗 HuggingFace (Direct)
        </button>
        <button
          onClick={() => setTab('or')}
          className={`flex-1 py-2 text-xs rounded-md font-bold transition-all ${tab === 'or' ? 'bg-[#FF6321] text-black' : 'text-gray-500 hover:text-white'}`}
        >
          🔀 OpenRouter (Free)
        </button>
      </div>

      {tab === 'hf' && (
        <div className="space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-[11px] text-gray-400">
            <span className="font-bold text-blue-400">HuggingFace Inference API</span> — direktan poziv bez Ollame.
            Unesi HF token u Settings → Hugging Face API Token.
            Besplatni tier: ~1000 req/dan.{' '}
            <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-[#FF6321] hover:underline inline-flex items-center gap-1">
              Dobij token <ExternalLink size={10} />
            </a>
          </div>

          {HF_MODELS.map(group => (
            <div key={group.category}>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">{group.category}</p>
              <div className="grid grid-cols-1 gap-1.5">
                {group.models.map(m => (
                  <button
                    key={m.id}
                    onClick={() => onActivate(m.id, 'huggingface')}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left ${
                      currentModel === m.id
                        ? 'border-[#FF6321] bg-[#FF6321]/10'
                        : 'border-[#333] bg-[#111] hover:border-[#FF6321]'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-medium text-gray-200">{m.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">{m.id}</p>
                    </div>
                    {currentModel === m.id && <Check size={14} className="text-[#FF6321] shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Custom HF model */}
          <div className="bg-[#111] border border-[#333] rounded-xl p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Custom HF Model</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customId}
                onChange={e => setCustomId(e.target.value)}
                placeholder="org/model-name"
                className="flex-1 bg-[#0a0a0a] border border-[#333] rounded-lg p-2 text-sm focus:outline-none focus:border-[#FF6321]"
              />
              <button
                onClick={() => { if (customId.trim()) onActivate(customId.trim(), 'huggingface'); }}
                className="px-4 py-2 bg-[#FF6321] text-black text-sm font-bold rounded-lg hover:bg-[#ff7a45] transition-colors"
              >
                Aktiviraj
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'or' && (
        <div className="space-y-4">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-[11px] text-gray-400">
            <span className="font-bold text-purple-400">OpenRouter</span> — pristup 200+ modela.
            Free modeli označeni sa <code>:free</code>. Unesi OR API ključ u Settings.{' '}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-[#FF6321] hover:underline inline-flex items-center gap-1">
              Dobij ključ <ExternalLink size={10} />
            </a>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {OR_MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => onActivate(m.id, 'openrouter')}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left ${
                  currentModel === m.id
                    ? 'border-[#FF6321] bg-[#FF6321]/10'
                    : 'border-[#333] bg-[#111] hover:border-[#FF6321]'
                }`}
              >
                <div>
                  <p className="text-xs font-medium text-gray-200">{m.name}</p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">{m.id}</p>
                </div>
                {currentModel === m.id && <Check size={14} className="text-[#FF6321] shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
