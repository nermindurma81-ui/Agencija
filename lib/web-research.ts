import { WebResearchHit } from '@/lib/studio-types';

function decodeDuckDuckGoUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl, 'https://duckduckgo.com');
    const uddg = parsed.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : rawUrl;
  } catch {
    return rawUrl;
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchWeb(query: string, limit = 5): Promise<WebResearchHit[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AgencijaBot/1.0; +http://localhost)',
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Search failed with status ${response.status}`);
  }

  const html = await response.text();
  const matches = Array.from(
    html.matchAll(
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/gi
    )
  );

  return matches.slice(0, limit).map((match) => ({
    url: decodeDuckDuckGoUrl(match[1]),
    title: stripHtml(match[2]),
    snippet: stripHtml(match[3]),
  }));
}

export async function scrapeUrl(url: string, maxChars = 4000) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AgencijaBot/1.0; +http://localhost)',
      Accept: 'text/html,application/xhtml+xml',
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Scrape failed with status ${response.status}`);
  }

  const html = await response.text();
  const text = stripHtml(html);
  return text.slice(0, maxChars);
}

export async function runWebResearch(query: string, limit = 4) {
  const hits = await searchWeb(query, limit);
  const enriched = await Promise.all(
    hits.map(async (hit) => {
      try {
        const content = await scrapeUrl(hit.url, 2500);
        return { ...hit, content };
      } catch {
        return hit;
      }
    })
  );

  return enriched;
}
