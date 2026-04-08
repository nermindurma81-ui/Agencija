'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { Search, Clock, MessageSquare } from 'lucide-react';

interface ChatSession {
  id: string;
  agentId: string;
  messages: string;
  updatedAt: number;
}

export function ChatHistory({ user, onSelectSession }: { user: FirebaseUser | null; onSelectSession: (sessionId: string) => void }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'chatSessions'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSessions: ChatSession[] = [];
      snapshot.forEach((doc) => {
        fetchedSessions.push({ id: doc.id, ...doc.data() } as ChatSession);
      });
      setSessions(fetchedSessions.sort((a, b) => b.updatedAt - a.updatedAt));
    });

    return () => unsubscribe();
  }, [user]);

  const filteredSessions = sessions.filter(session => {
    try {
      const messages = JSON.parse(session.messages);
      return messages.some((msg: any) => msg.content.toLowerCase().includes(searchQuery.toLowerCase()));
    } catch (e) {
      return false;
    }
  });

  return (
    <div className="p-4 theme-bg-tertiary border-r theme-border h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Search size={18} className="theme-text-secondary" />
        <input
          type="text"
          placeholder="Pretraži istoriju..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 rounded-lg theme-bg-secondary border theme-border text-sm theme-text-primary focus:outline-none focus:border-[#FF6321]"
        />
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredSessions.map(session => {
          const messages = JSON.parse(session.messages);
          const lastMessage = messages[messages.length - 1]?.content || 'Nema poruka';
          return (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className="w-full p-3 mb-2 rounded-lg theme-bg-secondary hover:theme-bg-tertiary transition-colors text-left"
            >
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare size={14} className="theme-text-secondary" />
                <span className="text-xs font-bold theme-text-primary truncate">{session.agentId.split('/').pop()}</span>
              </div>
              <p className="text-xs theme-text-secondary line-clamp-2">{lastMessage}</p>
              <div className="flex items-center gap-1 mt-2 text-[10px] theme-text-secondary">
                <Clock size={10} />
                {new Date(session.updatedAt).toLocaleDateString()}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
