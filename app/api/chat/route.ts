import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

interface ChatRequest {
  message: string;
  agentName: string;
  systemInstruction: string;
  model: string;
  temperature: number;
  provider: 'huggingface' | 'openrouter' | 'ollama';
  userId?: string;
  hfToken?: string;
  openRouterKey?: string;
  ollamaUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();

    if (!body.message || !body.message.trim()) {
      return NextResponse.json({ error: 'Poruka ne može biti prazna' }, { status: 400 });
    }

    const userId = typeof body.userId === 'string' && body.userId.trim() ? body.userId.trim() : null;

    // Rate Limiting
    if (userId) {
      const oneMinuteAgo = Date.now() - 60 * 1000;
      const usageQuery = query(
        collection(db, 'usageLogs'),
        where('userId', '==', userId),
        where('timestamp', '>=', oneMinuteAgo)
      );
      const usageSnapshot = await getDocs(usageQuery);
      if (usageSnapshot.size >= 15) {
        return NextResponse.json({ error: 'Previše zahtjeva. Molimo sačekajte minut.' }, { status: 429 });
      }
    }

    if (userId) {
      await addDoc(collection(db, 'usageLogs'), {
        userId,
        agentId: body.agentName,
        model: body.model,
        provider: body.provider,
        timestamp: Date.now()
      });
    }

    const systemPrompt = `TI SI ${body.agentName}. ${body.systemInstruction}. Odgovaraj na bosanskom jeziku.`;

    // ── HuggingFace Inference API ──────────────────────────────────────────
    if (body.provider === 'huggingface') {
      const hfToken = body.hfToken || process.env.HF_TOKEN || '';

      const hfRes = await fetch(
        `https://api-inference.huggingface.co/models/${body.model}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: body.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: body.message },
            ],
            temperature: body.temperature ?? 0.7,
            max_tokens: 2048,
            stream: true,
          }),
        }
      );

      if (!hfRes.ok) {
        const err = await hfRes.text();
        return NextResponse.json({ error: `HuggingFace greška: ${err}` }, { status: hfRes.status });
      }

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const reader = hfRes.body!.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              for (const line of chunk.split('\n')) {
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (data === '[DONE]') continue;
                try {
                  const json = JSON.parse(data);
                  const delta = json.choices?.[0]?.delta?.content;
                  if (delta) controller.enqueue(encoder.encode(delta));
                } catch { /* skip malformed */ }
              }
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(readable, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // ── OpenRouter ────────────────────────────────────────────────────────
    if (body.provider === 'openrouter') {
      const orKey = body.openRouterKey || process.env.OPENROUTER_KEY || '';

      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${orKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://agency.app',
          'X-Title': 'The Agency',
        },
        body: JSON.stringify({
          model: body.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: body.message },
          ],
          temperature: body.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (!orRes.ok) {
        const err = await orRes.text();
        return NextResponse.json({ error: `OpenRouter greška: ${err}` }, { status: orRes.status });
      }

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const reader = orRes.body!.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              for (const line of chunk.split('\n')) {
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (data === '[DONE]') continue;
                try {
                  const json = JSON.parse(data);
                  const delta = json.choices?.[0]?.delta?.content;
                  if (delta) controller.enqueue(encoder.encode(delta));
                } catch { /* skip */ }
              }
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(readable, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // ── Ollama (Local) ────────────────────────────────────────────────────────
    if (body.provider === 'ollama') {
      const ollamaUrl = body.ollamaUrl || 'http://localhost:11434';

      const ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: body.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: body.message },
          ],
          temperature: body.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (!ollamaRes.ok) {
        const err = await ollamaRes.text();
        return NextResponse.json({ error: `Ollama greška: ${err}` }, { status: ollamaRes.status });
      }

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const reader = ollamaRes.body!.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              for (const line of chunk.split('\n')) {
                if (!line.trim()) continue;
                try {
                  const json = JSON.parse(line);
                  if (json.message?.content) {
                    controller.enqueue(encoder.encode(json.message.content));
                  }
                } catch { /* skip malformed */ }
              }
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(readable, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({ error: 'Nepodržani provider.' }, { status: 400 });

  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: error.message || 'Greška pri obradi zahtjeva' }, { status: 500 });
  }
}
