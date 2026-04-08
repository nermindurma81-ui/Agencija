export type StudioProvider = 'gemini' | 'openrouter' | 'huggingface' | 'ollama';

export interface StudioSettings {
  provider: StudioProvider;
  model: string;
  temperature: number;
  geminiKey?: string;
  openRouterKey?: string;
  huggingFaceKey?: string;
  ollamaUrl?: string;
}

export interface OrchestrationStageResult {
  id: string;
  title: string;
  agentLabel: string;
  output: string;
}

export interface OrchestrationResponse {
  workflowId: string;
  workflowName: string;
  final: string;
  stages: OrchestrationStageResult[];
}

export interface WebResearchHit {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

export interface SkillBrainProfile {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  preferredWorkflowId?: string;
  providerOverride?: StudioProvider;
  modelOverride?: string;
  createdAt: number;
}

export interface RunMemoryEntry {
  id: string;
  createdAt: number;
  workflowId: string;
  workflowName: string;
  query: string;
  selectedAgentName: string;
  selectedAgentPath: string;
  provider: StudioProvider;
  model: string;
  usedWebResearch: boolean;
  skillId?: string;
  final: string;
  stages: OrchestrationStageResult[];
}
