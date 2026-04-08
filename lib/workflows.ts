export interface WorkflowStageDefinition {
  id: string;
  title: string;
  goal: string;
  supportAgentPath: string;
  supportAgentLabel: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  strapline: string;
  source: string[];
  description: string;
  outcome: string;
  useCases: string[];
  stages: WorkflowStageDefinition[];
}

export const USE_CASE_CLUSTERS = [
  'healthcare',
  'finance',
  'education',
  'customer-support',
  'retail',
  'real-estate',
  'agriculture',
  'cybersecurity',
  'developer-tools',
  'marketing',
  'media',
  'operations',
];

export const WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'deep-research-swarm',
    name: 'Deep Research Swarm',
    strapline: 'DeerFlow-style multi-pass research with actual synthesis.',
    source: ['DeerFlow', 'Agency Agents'],
    description:
      'Runs a planning, investigation, and editorial synthesis chain to produce a grounded report, execution memo, or decision brief.',
    outcome: 'A structured report with assumptions, findings, risks, and recommended next actions.',
    useCases: ['market scan', 'competitive research', 'technical due diligence', 'feature discovery'],
    stages: [
      {
        id: 'scope',
        title: 'Scope and Plan',
        goal: 'Clarify the objective, define unknowns, and produce a research plan.',
        supportAgentPath: 'project-management/project-management-studio-producer.md',
        supportAgentLabel: 'Studio Producer',
      },
      {
        id: 'investigate',
        title: 'Investigate Signals',
        goal: 'Collect the strongest lines of inquiry, compare options, and extract patterns.',
        supportAgentPath: 'product/product-trend-researcher.md',
        supportAgentLabel: 'Trend Researcher',
      },
      {
        id: 'synthesize',
        title: 'Synthesize Delivery',
        goal: 'Turn findings into a concise, decision-ready output with tradeoffs.',
        supportAgentPath: 'engineering/engineering-technical-writer.md',
        supportAgentLabel: 'Technical Writer',
      },
    ],
  },
  {
    id: 'fullstack-build-train',
    name: 'Fullstack Build Train',
    strapline: 'Spec to architecture to UI to review, with one real model pipeline.',
    source: ['Agency Agents', '500 AI Agents Projects'],
    description:
      'Builds software deliverables through architecture, implementation guidance, and review passes using specialized agent prompts.',
    outcome: 'A production-minded build plan or implementation draft with technical risks called out.',
    useCases: ['web app', 'mobile app', 'internal tool', 'MVP', 'AI product'],
    stages: [
      {
        id: 'architecture',
        title: 'Architecture',
        goal: 'Shape the system architecture, data flow, and critical interfaces.',
        supportAgentPath: 'engineering/engineering-backend-architect.md',
        supportAgentLabel: 'Backend Architect',
      },
      {
        id: 'experience',
        title: 'Experience Layer',
        goal: 'Translate the product into a polished user experience and delivery slices.',
        supportAgentPath: 'engineering/engineering-frontend-developer.md',
        supportAgentLabel: 'Frontend Developer',
      },
      {
        id: 'review',
        title: 'Hardening Review',
        goal: 'Interrogate the plan for regressions, blind spots, and validation gaps.',
        supportAgentPath: 'engineering/engineering-code-reviewer.md',
        supportAgentLabel: 'Code Reviewer',
      },
    ],
  },
  {
    id: 'product-launch-squad',
    name: 'Product Launch Squad',
    strapline: 'Maps ideas to real AI use cases, routes, and launch priorities.',
    source: ['500 AI Agents Projects', 'Agency Agents'],
    description:
      'Classifies a concept against proven AI use case clusters, then turns it into a deliverable roadmap, stack, and go-to-market skeleton.',
    outcome: 'A launch blueprint with use case mapping, scope cuts, and execution order.',
    useCases: ['startup idea', 'agency offer', 'B2B feature', 'AI workflow business'],
    stages: [
      {
        id: 'classification',
        title: 'Use Case Mapping',
        goal: 'Map the idea to real industry use cases and adjacent opportunities.',
        supportAgentPath: 'product/product-trend-researcher.md',
        supportAgentLabel: 'Trend Researcher',
      },
      {
        id: 'product',
        title: 'Product Shape',
        goal: 'Define the MVP, user journey, success metrics, and roadmap cuts.',
        supportAgentPath: 'product/product-manager.md',
        supportAgentLabel: 'Product Manager',
      },
      {
        id: 'launch',
        title: 'Launch Narrative',
        goal: 'Package the concept into a sharp execution memo with positioning.',
        supportAgentPath: 'project-management/project-management-studio-producer.md',
        supportAgentLabel: 'Studio Producer',
      },
    ],
  },
  {
    id: 'automation-ops-grid',
    name: 'Automation Ops Grid',
    strapline: 'Designs production-grade automations, not fake agent theatre.',
    source: ['Agency Agents', '500 AI Agents Projects'],
    description:
      'Defines the tool chain, data path, failure modes, and deployment posture for AI automations and service backplanes.',
    outcome: 'An operational plan with tool topology, data movement, and observability checklist.',
    useCases: ['ops automation', 'data workflows', 'support triage', 'AI ops'],
    stages: [
      {
        id: 'pipeline',
        title: 'Pipeline Topology',
        goal: 'Design the event flow, ingestion, triggers, and data boundaries.',
        supportAgentPath: 'engineering/engineering-data-engineer.md',
        supportAgentLabel: 'Data Engineer',
      },
      {
        id: 'delivery',
        title: 'Delivery Layer',
        goal: 'Specify deployment, environments, and change management.',
        supportAgentPath: 'engineering/engineering-devops-automator.md',
        supportAgentLabel: 'DevOps Automator',
      },
      {
        id: 'reliability',
        title: 'Reliability Pass',
        goal: 'Pressure-test scaling, incident handling, and monitoring.',
        supportAgentPath: 'engineering/engineering-sre.md',
        supportAgentLabel: 'SRE',
      },
    ],
  },
];

export function getWorkflowById(id: string) {
  return WORKFLOWS.find((workflow) => workflow.id === id) ?? WORKFLOWS[0];
}
