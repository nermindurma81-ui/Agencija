export interface ToolkitDefinition {
  id: string;
  title: string;
  description: string;
  appliesTo: string[];
  tools: string[];
}

export const TOOLKITS: ToolkitDefinition[] = [
  {
    id: 'research-stack',
    title: 'Research Stack',
    description: 'Use for market scans, deep research, due diligence, and source gathering.',
    appliesTo: ['deep-research-swarm', 'product-launch-squad'],
    tools: [
      'DuckDuckGo HTML search',
      'HTML page scraper',
      'Comparative source synthesis',
      'Structured findings digest',
    ],
  },
  {
    id: 'build-stack',
    title: 'Build Stack',
    description: 'Use for software implementation planning, app builds, and technical execution.',
    appliesTo: ['fullstack-build-train'],
    tools: [
      'Architecture decomposition',
      'Frontend delivery plan',
      'Code review hardening pass',
      'Provider routing for implementation prompts',
    ],
  },
  {
    id: 'launch-stack',
    title: 'Launch Stack',
    description: 'Use for packaging ideas into MVPs, offers, positioning, and rollout plans.',
    appliesTo: ['product-launch-squad'],
    tools: [
      'Use case clustering',
      'MVP scoping',
      'Positioning memo',
      'Launch narrative synthesis',
    ],
  },
  {
    id: 'ops-stack',
    title: 'Ops Stack',
    description: 'Use for automations, data pipelines, support flows, and reliability design.',
    appliesTo: ['automation-ops-grid'],
    tools: [
      'Pipeline topology map',
      'Deployment and runtime planning',
      'Observability checklist',
      'Reliability risk assessment',
    ],
  },
];

export function getToolkitsForWorkflow(workflowId: string) {
  return TOOLKITS.filter((toolkit) => toolkit.appliesTo.includes(workflowId));
}

export function getToolkitContext(workflowId: string) {
  const toolkits = getToolkitsForWorkflow(workflowId);
  if (toolkits.length === 0) return '';

  return toolkits
    .map((toolkit) => {
      return `${toolkit.title}: ${toolkit.description}\nTools:\n- ${toolkit.tools.join('\n- ')}`;
    })
    .join('\n\n');
}
