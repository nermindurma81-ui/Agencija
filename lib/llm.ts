import { GoogleGenAI } from '@google/genai';
import { StudioSettings } from '@/lib/studio-types';

interface CompletionInput extends StudioSettings {
  systemPrompt: string;
  userPrompt: string;
}

function requireValue(value: string | undefined, label: string) {
  if (!value) {
    throw new Error(`${label} is missing.`);
  }
  return value;
}

export async function generateText(input: CompletionInput) {
  const temperature = Number.isFinite(input.temperature) ? input.temperature : 0.4;

  if (input.provider === 'gemini') {
    const apiKey = input.geminiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const client = new GoogleGenAI({ apiKey: requireValue(apiKey, 'Gemini API key') });
    const response = await client.models.generateContent({
      model: input.model || 'gemini-2.0-flash',
      contents: `${input.systemPrompt}\n\nUser request:\n${input.userPrompt}`,
      config: {
        temperature,
      },
    });

    return response.text || '';
  }

  if (input.provider === 'openrouter') {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requireValue(input.openRouterKey || process.env.OPENROUTER_KEY, 'OpenRouter key')}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'Agencija Studio',
      },
      body: JSON.stringify({
        model: input.model,
        temperature,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  if (input.provider === 'huggingface') {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${input.model}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${requireValue(input.huggingFaceKey || process.env.HF_TOKEN, 'Hugging Face token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: input.model,
          temperature,
          max_tokens: 2048,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Hugging Face error: ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  const baseUrl = input.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      stream: false,
      options: {
        temperature,
      },
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.message?.content || '';
}
