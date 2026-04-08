import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/llm';
import { OrchestrationResponse, StudioSettings } from '@/lib/studio-types';
import { getWorkflowById, USE_CASE_CLUSTERS } from '@/lib/workflows';
import { runWebResearch } from '@/lib/web-research';

interface OrchestrationRequest {
  message: string;
  workflowId: string;
  settings: StudioSettings;
  selectedAgentName?: string;
  selectedAgentDepartment?: string;
  selectedAgentPrompt?: string;
  skillName?: string;
  skillPrompt?: string;
  memorySummary?: string;
  enableWebResearch?: boolean;
  toolContext?: string;
}

const AGENCY_RAW_BASE = 'https://raw.githubusercontent.com/msitarzewski/agency-agents/main';

async function fetchAgentPrompt(path: string) {
  const response = await fetch(`${AGENCY_RAW_BASE}/${path}`, {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Failed to load agency agent prompt at ${path}`);
  }

  return response.text();
}

function composeStageSystemPrompt(input: {
  workflowName: string;
  stageTitle: string;
  stageGoal: string;
  selectedAgentName?: string;
  selectedAgentDepartment?: string;
  selectedAgentPrompt?: string;
  supportAgentLabel: string;
  supportAgentPrompt: string;
  skillName?: string;
  skillPrompt?: string;
  memorySummary?: string;
  toolContext?: string;
}) {
  const selectedAgentBlock = input.selectedAgentPrompt
    ? `Primary specialist: ${input.selectedAgentName || 'Selected agent'} (${input.selectedAgentDepartment || 'general'}).\n${input.selectedAgentPrompt}`
    : 'No primary specialist prompt was provided, so rely on the workflow role and the user request.';

  const skillBlock = input.skillPrompt
    ? `Skill brain active: ${input.skillName || 'Custom skill'}.\n${input.skillPrompt}`
    : 'No custom skill brain is active.';

  const memoryBlock = input.memorySummary
    ? `Persistent memory from previous runs:\n${input.memorySummary}`
    : 'No persistent memory context was provided.';

  const toolkitBlock = input.toolContext
    ? `Available workflow toolkit context:\n${input.toolContext}`
    : 'No extra workflow toolkit context was provided.';

  return [
    `You are operating inside the "${input.workflowName}" workflow.`,
    `Current stage: ${input.stageTitle}.`,
    `Stage goal: ${input.stageGoal}.`,
    `Use concise, grounded, production-minded reasoning.`,
    `Do not roleplay fake capabilities or claim work that was not done.`,
    `Prefer realistic free or low-cost implementation paths when possible.`,
    `Available AI use case clusters from the catalog: ${USE_CASE_CLUSTERS.join(', ')}.`,
    '',
    selectedAgentBlock,
    '',
    skillBlock,
    '',
    memoryBlock,
    '',
    toolkitBlock,
    '',
    `Support specialist: ${input.supportAgentLabel}.`,
    input.supportAgentPrompt,
  ].join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OrchestrationRequest;
    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const workflow = getWorkflowById(body.workflowId);
    const stageResults: OrchestrationResponse['stages'] = [];
    let previousContext = `Original request:\n${body.message.trim()}`;

    if (body.enableWebResearch) {
      const researchHits = await runWebResearch(body.message.trim(), 4);
      const researchDigest = researchHits
        .map((hit, index) => {
          const content = hit.content ? `\nExcerpt: ${hit.content}` : '';
          return `${index + 1}. ${hit.title}\nURL: ${hit.url}\nSnippet: ${hit.snippet}${content}`;
        })
        .join('\n\n');

      stageResults.push({
        id: 'web-research',
        title: 'Web Research Snapshot',
        agentLabel: 'DuckDuckGo + Page Scraper',
        output: researchDigest || 'No web results were captured.',
      });

      previousContext += `\n\n[Web Research Snapshot]\n${researchDigest}`;
    }

    for (const stage of workflow.stages) {
      const supportAgentPrompt = await fetchAgentPrompt(stage.supportAgentPath);
      const stageSystemPrompt = composeStageSystemPrompt({
        workflowName: workflow.name,
        stageTitle: stage.title,
        stageGoal: stage.goal,
        selectedAgentName: body.selectedAgentName,
        selectedAgentDepartment: body.selectedAgentDepartment,
        selectedAgentPrompt: body.selectedAgentPrompt,
        supportAgentLabel: stage.supportAgentLabel,
        supportAgentPrompt,
        skillName: body.skillName,
        skillPrompt: body.skillPrompt,
        memorySummary: body.memorySummary,
        toolContext: body.toolContext,
      });

      const stageUserPrompt = [
        previousContext,
        '',
        `Deliver this stage only: ${stage.goal}`,
        'Return a concrete output, not meta commentary.',
      ].join('\n');

      const output = await generateText({
        ...body.settings,
        systemPrompt: stageSystemPrompt,
        userPrompt: stageUserPrompt,
      });

      stageResults.push({
        id: stage.id,
        title: stage.title,
        agentLabel: stage.supportAgentLabel,
        output,
      });

      previousContext += `\n\n[${stage.title}]\n${output}`;
    }

    const finalSystemPrompt = [
      `You are the final synthesis pass for "${workflow.name}".`,
      'Merge the stage outputs into one coherent final deliverable.',
      'Keep it direct, practical, and free of filler.',
      'Include sections for strategy, architecture or execution flow when relevant, and major risks.',
    ].join('\n');

    const final = await generateText({
      ...body.settings,
      systemPrompt: finalSystemPrompt,
      userPrompt: previousContext,
    });

    return NextResponse.json<OrchestrationResponse>({
      workflowId: workflow.id,
      workflowName: workflow.name,
      final,
      stages: stageResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown orchestration error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
