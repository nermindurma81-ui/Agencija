import { NextRequest, NextResponse } from 'next/server';
import { runWebResearch, scrapeUrl } from '@/lib/web-research';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.url) {
      const content = await scrapeUrl(body.url);
      return NextResponse.json({ url: body.url, content });
    }

    if (!body.query?.trim()) {
      return NextResponse.json({ error: 'query or url is required' }, { status: 400 });
    }

    const results = await runWebResearch(body.query, body.limit || 4);
    return NextResponse.json({ query: body.query, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Web research failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
