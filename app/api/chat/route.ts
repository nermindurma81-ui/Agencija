import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import puter from 'puter';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';

interface ChatRequest {
  message: string;
  agentName: string;
  systemInstruction: string;
  model: string;
  temperature: number;
  provider: 'gemini' | 'openrouter' | 'ollama' | 'huggingface' | 'claude';
  userId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    
    if (!body.message || !body.message.trim()) {
      return NextResponse.json({ error: 'Poruka ne može biti prazna' }, { status: 400 });
    }

    // Rate Limiting: Check usage in the last minute
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const usageQuery = query(
      collection(db, 'usageLogs'),
      where('userId', '==', body.userId),
      where('timestamp', '>=', oneMinuteAgo)
    );
    const usageSnapshot = await getDocs(usageQuery);
    if (usageSnapshot.size >= 10) {
      return NextResponse.json({ error: 'Previše zahtjeva. Molimo sačekajte minut.' }, { status: 429 });
    }

    // Log Usage
    await addDoc(collection(db, 'usageLogs'), {
      userId: body.userId,
      agentId: body.agentName,
      model: body.model,
      provider: body.provider,
      timestamp: Date.now()
    });

    if (body.provider === 'claude') {
      const stream = await puter.ai.chat(body.message, {
        model: body.model,
        system: `TI SI ${body.agentName}. ${body.systemInstruction}. Odgovaraj na bosanskom.`,
        stream: true
      });

      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        }
      });

      return new Response(readableStream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Server nije pravilno konfiguriran' }, { status: 500 });
    }

    const genAI = new (GoogleGenAI as any)(apiKey);
    const model = genAI.getGenerativeModel({
      model: body.model || 'gemini-1.5-flash',
      systemInstruction: `TI SI ${body.agentName}. ${body.systemInstruction}. Odgovaraj na bosanskom.`,
      generationConfig: {
        temperature: body.temperature || 0.7,
      }
    });

    const result = await model.generateContentStream(body.message);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            controller.enqueue(encoder.encode(chunkText));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: error.message || 'Greška pri obradi zahtjeva' }, { status: 500 });
  }
}
