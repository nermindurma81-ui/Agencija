'use client';

import { useState } from 'react';

export function PromptEditor({ 
  systemInstruction, 
  onSave 
}: { 
  systemInstruction: string;
  onSave: (prompt: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [prompt, setPrompt] = useState(systemInstruction);
  
  return (
    <div className="p-4 border-b theme-border">
      {isEditing ? (
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full p-3 rounded-lg theme-bg-tertiary border theme-border text-sm theme-text-primary focus:outline-none focus:border-[#FF6321] custom-scrollbar"
          rows={4}
        />
      ) : (
        <p className="text-sm theme-text-secondary line-clamp-2">{prompt}</p>
      )}
      <button
        onClick={() => {
          if (isEditing) onSave(prompt);
          setIsEditing(!isEditing);
        }}
        className="mt-2 text-xs bg-[#FF6321] text-black px-3 py-1.5 rounded-lg font-medium hover:bg-[#ff7a45] transition-colors"
      >
        {isEditing ? 'Spremi' : 'Uredi System Prompt'}
      </button>
    </div>
  );
}
