import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

interface ChatRequest {
  message: string;
  agentName: string;
  systemInstruction: string;
  model: string;
  temperature: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    
    if (!body.message || !body.message.trim()) {
      return NextResponse.json({ error: 'Poruka ne može biti prazna' }, { status: 400 });
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
