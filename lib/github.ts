export interface Agent {
  path: string;
  name: string;
  department: string;
  url: string;
}

const CACHE_KEY = 'agency_agents_cache';
const CACHE_DURATION = 1000 * 60 * 60; // 1 sat

interface CachedData {
  data: Record<string, Agent[]>;
  timestamp: number;
}

export async function getAgents(): Promise<Record<string, Agent[]>> {
  try {
    // Provjera cache-a na klijentu (ako smo u browseru)
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp }: CachedData = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        }
      }
    }

    const res = await fetch('https://api.github.com/repos/msitarzewski/agency-agents/git/trees/main?recursive=1', {
      next: { revalidate: 3600 } // Cache for 1 hour on server
    });
    
    if (!res.ok) {
      throw new Error('Failed to fetch from GitHub');
    }

    const data = await res.json();
    const tree = data.tree as { path: string; type: string }[];
    
    const agentsByDept: Record<string, Agent[]> = {};
    
    const allowedDepartments = [
      'academic', 'design', 'engineering', 'game-development', 
      'marketing', 'paid-media', 'product', 'project-management', 
      'sales', 'spatial-computing', 'specialized', 'support', 'testing',
      'architecture', 'coding', 'integrations', 'dante.ai coding'
    ];

    for (const item of tree) {
      if (item.type === 'blob' && item.path.endsWith('.md')) {
        const parts = item.path.split('/');
        if (parts.length >= 2) {
          let dept = parts[0];
          
          if (dept === 'integrations') dept = 'coding';
          
          const filename = parts[parts.length - 1].toLowerCase();
          if (filename.includes('architect') || filename.includes('architecture')) {
            dept = 'architecture';
          } else if (filename.includes('code') || filename.includes('developer') || filename.includes('engineer')) {
            if (dept !== 'engineering') dept = 'coding';
          }
          
          if (allowedDepartments.includes(parts[0]) || allowedDepartments.includes(dept)) {
            const filename = parts[parts.length - 1].replace('.md', '');
            const name = filename.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            
            if (!agentsByDept[dept]) {
              agentsByDept[dept] = [];
            }
            
            agentsByDept[dept].push({
              path: item.path,
              name: name,
              department: dept,
              url: `https://raw.githubusercontent.com/msitarzewski/agency-agents/main/${item.path}`
            });
          }
        }
      }
    }

    // Add virtual "Dante.ai Coding" agent if requested
    if (!agentsByDept['dante.ai coding']) {
      agentsByDept['dante.ai coding'] = [{
        path: 'virtual/dante-ai-coding',
        name: 'Dante.ai Coding Expert',
        department: 'dante.ai coding',
        url: 'https://raw.githubusercontent.com/msitarzewski/agency-agents/main/engineering/engineering-senior-developer.md'
      }];
    }

    // Add virtual "Ollama Local Runner" agent
    if (!agentsByDept['coding']) {
      agentsByDept['coding'] = [];
    }
    agentsByDept['coding'].push({
      path: 'virtual/ollama-local-runner',
      name: 'Ollama Local Runner',
      department: 'coding',
      url: 'https://raw.githubusercontent.com/msitarzewski/agency-agents/main/engineering/engineering-senior-developer.md'
    });

    // Sortiranje agenata po imenu (ponovo nakon dodavanja virtualnih)
    Object.keys(agentsByDept).forEach((dept) => {
      agentsByDept[dept].sort((a, b) => a.name.localeCompare(b.name));
    });

    // Čuvanje u cache na klijentu
    if (typeof window !== 'undefined') {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: agentsByDept,
        timestamp: Date.now(),
      }));
    }
    
    return agentsByDept;
  } catch (error) {
    console.error('Error fetching agents:', error);
    return {};
  }
}

export async function getAgentPrompt(path: string): Promise<string> {
  try {
    if (path === 'virtual/dante-ai-coding') {
      return `You are the Dante.ai Coding Expert. Your mission is to provide elite-level coding assistance, architecture advice, and debugging support. You have deep knowledge of all modern frameworks and languages. You always aim for clean, efficient, and secure code.`;
    }
    if (path === 'virtual/ollama-local-runner') {
      return `You are an AI assistant that helps users run and manage models locally using Ollama. Provide instructions on Ollama setup, model pulling, and running inferences.`;
    }
    const res = await fetch(`https://raw.githubusercontent.com/msitarzewski/agency-agents/main/${path}`, {
      next: { revalidate: 3600 }
    });
    if (!res.ok) {
      throw new Error('Failed to fetch agent prompt');
    }
    return await res.text();
  } catch (error) {
    console.error('Error fetching agent prompt:', error);
    return 'You are a helpful AI assistant.';
  }
}
