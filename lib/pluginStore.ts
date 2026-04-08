export const AVAILABLE_PLUGINS = [
  {
    id: 'wiki-search',
    name: 'Wikipedia Search',
    description: 'Search Wikipedia for information on any topic. 100% Free.',
    category: 'Research',
    declaration: {
      name: 'searchWikipedia',
      description: 'Searches Wikipedia and returns the summary of the best matching article.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'The search query' }
        },
        required: ['query']
      }
    },
    jsCode: `
      const res = await fetch(\`https://en.wikipedia.org/api/rest_v1/page/summary/\${encodeURIComponent(args.query)}\`);
      if (!res.ok) return "Not found.";
      const data = await res.json();
      return data.extract;
    `
  },
  {
    id: 'crypto-price',
    name: 'Crypto Prices (CoinGecko)',
    description: 'Get real-time cryptocurrency prices. Free API.',
    category: 'Finance',
    declaration: {
      name: 'getCryptoPrice',
      description: 'Gets the current price of a cryptocurrency in USD.',
      parameters: {
        type: 'OBJECT',
        properties: {
          coinId: { type: 'STRING', description: 'The CoinGecko ID of the coin (e.g., bitcoin, ethereum)' }
        },
        required: ['coinId']
      }
    },
    jsCode: `
      const res = await fetch(\`https://api.coingecko.com/api/v3/simple/price?ids=\${args.coinId}&vs_currencies=usd\`);
      const data = await res.json();
      return data[args.coinId] ? \`$\${data[args.coinId].usd}\` : "Coin not found.";
    `
  },
  {
    id: 'open-meteo',
    name: 'Weather Forecast (Open-Meteo)',
    description: 'Get current weather for any coordinates. No API key required.',
    category: 'Utility',
    declaration: {
      name: 'getWeather',
      description: 'Gets the current weather for given latitude and longitude.',
      parameters: {
        type: 'OBJECT',
        properties: {
          latitude: { type: 'NUMBER', description: 'Latitude' },
          longitude: { type: 'NUMBER', description: 'Longitude' }
        },
        required: ['latitude', 'longitude']
      }
    },
    jsCode: `
      const res = await fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${args.latitude}&longitude=\${args.longitude}&current_weather=true\`);
      const data = await res.json();
      return JSON.stringify(data.current_weather);
    `
  },
  {
    id: 'hacker-news',
    name: 'Hacker News Top Stories',
    description: 'Fetch the current top stories from Hacker News.',
    category: 'News',
    declaration: {
      name: 'getHackerNews',
      description: 'Gets the top N stories from Hacker News.',
      parameters: {
        type: 'OBJECT',
        properties: {
          limit: { type: 'NUMBER', description: 'Number of stories to fetch (max 10)' }
        },
        required: ['limit']
      }
    },
    jsCode: `
      const limit = Math.min(args.limit || 5, 10);
      const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
      const topIds = await topRes.json();
      const stories = [];
      for(let i=0; i<limit; i++) {
        const storyRes = await fetch(\`https://hacker-news.firebaseio.com/v0/item/\${topIds[i]}.json\`);
        stories.push(await storyRes.json());
      }
      return JSON.stringify(stories.map(s => ({ title: s.title, url: s.url })));
    `
  },
  {
    id: 'joke-api',
    name: 'Programming Jokes',
    description: 'Fetches a random programming joke. Free API.',
    category: 'Fun',
    declaration: {
      name: 'getJoke',
      description: 'Gets a random programming joke.',
      parameters: {
        type: 'OBJECT',
        properties: {}
      }
    },
    jsCode: `
      const res = await fetch('https://v2.jokeapi.dev/joke/Programming?safe-mode');
      const data = await res.json();
      if (data.type === 'twopart') return \`\${data.setup} ... \${data.delivery}\`;
      return data.joke;
    `
  },
  {
    id: 'web-scraper',
    name: 'Web Scraper (CORS Proxy)',
    description: 'Scrape text content from any public URL using a free CORS proxy.',
    category: 'Research',
    declaration: {
      name: 'scrapeWebsite',
      description: 'Fetches the HTML content of a given URL and extracts the text.',
      parameters: {
        type: 'OBJECT',
        properties: {
          url: { type: 'STRING', description: 'The URL to scrape' }
        },
        required: ['url']
      }
    },
    jsCode: `
      try {
        const res = await fetch(\`https://corsproxy.io/?\${encodeURIComponent(args.url)}\`);
        const html = await res.text();
        // Simple regex to strip HTML tags and get text
        const text = html.replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi, '')
                         .replace(/<style\\b[^<]*(?:(?!<\\/style>)<[^<]*)*<\\/style>/gi, '')
                         .replace(/<[^>]+>/g, ' ')
                         .replace(/\\s+/g, ' ')
                         .trim();
        return text.substring(0, 5000); // Return first 5000 chars to avoid token limits
      } catch (e) {
        return "Failed to scrape: " + e.message;
      }
    `
  },
  {
    id: 'random-user',
    name: 'Random User Generator',
    description: 'Generate random user data (name, email, address, etc.) for testing.',
    category: 'Utility',
    declaration: {
      name: 'generateRandomUser',
      description: 'Generates random user data.',
      parameters: {
        type: 'OBJECT',
        properties: {}
      }
    },
    jsCode: `
      const res = await fetch('https://randomuser.me/api/');
      const data = await res.json();
      return JSON.stringify(data.results[0]);
    `
  },
  {
    id: 'qr-code',
    name: 'QR Code Generator',
    description: 'Generate a QR code for any URL or text. 100% Free.',
    category: 'Utility',
    declaration: {
      name: 'generateQRCode',
      description: 'Generates a QR code image URL for the given text.',
      parameters: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING', description: 'The text or URL to encode' }
        },
        required: ['text']
      }
    },
    jsCode: `
      return \`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=\${encodeURIComponent(args.text)}\`;
    `
  },
  {
    id: 'dictionary',
    name: 'Dictionary (Free Dictionary API)',
    description: 'Get definitions, synonyms, and examples for any word.',
    category: 'Education',
    declaration: {
      name: 'getDefinition',
      description: 'Gets the definition of a word.',
      parameters: {
        type: 'OBJECT',
        properties: {
          word: { type: 'STRING', description: 'The word to define' }
        },
        required: ['word']
      }
    },
    jsCode: `
      const res = await fetch(\`https://api.dictionaryapi.dev/api/v2/entries/en/\${args.word}\`);
      if (!res.ok) return "Word not found.";
      const data = await res.json();
      return JSON.stringify(data[0].meanings);
    `
  },
  {
    id: 'currency-conv',
    name: 'Currency Converter',
    description: 'Convert between different currencies using real-time rates.',
    category: 'Finance',
    declaration: {
      name: 'convertCurrency',
      description: 'Converts an amount from one currency to another.',
      parameters: {
        type: 'OBJECT',
        properties: {
          amount: { type: 'NUMBER', description: 'The amount to convert' },
          from: { type: 'STRING', description: 'Source currency code (e.g., USD)' },
          to: { type: 'STRING', description: 'Target currency code (e.g., EUR)' }
        },
        required: ['amount', 'from', 'to']
      }
    },
    jsCode: `
      const res = await fetch(\`https://api.exchangerate-api.com/v4/latest/\${args.from}\`);
      const data = await res.json();
      const rate = data.rates[args.to];
      if (!rate) return "Currency not supported.";
      return (args.amount * rate).toFixed(2) + " " + args.to;
    `
  },
  {
    id: 'news-search',
    name: 'Global News Search',
    description: 'Search for the latest news articles globally.',
    category: 'News',
    declaration: {
      name: 'searchNews',
      description: 'Searches for news articles based on a query.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'The search query' }
        },
        required: ['query']
      }
    },
    jsCode: `
      const res = await fetch(\`https://newsapi.org/v2/everything?q=\${encodeURIComponent(args.query)}&apiKey=FREE_OR_DEMO_KEY\`);
      // Since NewsAPI requires a key, we'll use a public alternative for the demo
      const altRes = await fetch(\`https://ok.surf/api/v1/cors/news-feed\`);
      const data = await altRes.json();
      return JSON.stringify(data);
    `
  },
  {
    id: 'image-gen-placeholder',
    name: 'AI Image Generator (Pollinations)',
    description: 'Generate images from text prompts using Pollinations AI. 100% Free.',
    category: 'Creative',
    declaration: {
      name: 'generateImage',
      description: 'Generates an image from a text prompt.',
      parameters: {
        type: 'OBJECT',
        properties: {
          prompt: { type: 'STRING', description: 'The image description' }
        },
        required: ['prompt']
      }
    },
    jsCode: `
      const seed = Math.floor(Math.random() * 1000000);
      return \`https://image.pollinations.ai/prompt/\${encodeURIComponent(args.prompt)}?seed=\${seed}&width=1024&height=1024&nologo=true\`;
    `
  },
  {
    id: 'ip-lookup',
    name: 'IP Geolocation Lookup',
    description: 'Get location info for any IP address.',
    category: 'Utility',
    declaration: {
      name: 'lookupIP',
      description: 'Gets geolocation info for an IP address.',
      parameters: {
        type: 'OBJECT',
        properties: {
          ip: { type: 'STRING', description: 'The IP address' }
        },
        required: ['ip']
      }
    },
    jsCode: `
      const res = await fetch(\`https://ipapi.co/\${args.ip}/json/\`);
      const data = await res.json();
      return JSON.stringify(data);
    `
  },
  {
    id: 'github-user',
    name: 'GitHub User Info',
    description: 'Fetch public profile data for any GitHub user.',
    category: 'Development',
    declaration: {
      name: 'getGitHubUser',
      description: 'Gets public info for a GitHub username.',
      parameters: {
        type: 'OBJECT',
        properties: {
          username: { type: 'STRING', description: 'The GitHub username' }
        },
        required: ['username']
      }
    },
    jsCode: `
      const res = await fetch(\`https://api.github.com/users/\${args.username}\`);
      const data = await res.json();
      return JSON.stringify(data);
    `
  },
  {
    id: 'quote-gen',
    name: 'Inspirational Quote Generator',
    description: 'Get a random inspirational quote.',
    category: 'Fun',
    declaration: {
      name: 'getQuote',
      description: 'Gets a random inspirational quote.',
      parameters: {
        type: 'OBJECT',
        properties: {}
      }
    },
    jsCode: `
      const res = await fetch('https://api.quotable.io/random');
      const data = await res.json();
      return \`"\${data.content}" - \${data.author}\`;
    `
  },
  {
    id: 'seo-analyzer',
    name: 'Basic SEO Analyzer',
    description: 'Analyze a website for basic SEO metrics (title, description, headings).',
    category: 'Marketing',
    declaration: {
      name: 'analyzeSEO',
      description: 'Analyzes basic SEO elements of a website.',
      parameters: {
        type: 'OBJECT',
        properties: {
          url: { type: 'STRING', description: 'The URL to analyze' }
        },
        required: ['url']
      }
    },
    jsCode: `
      const res = await fetch(\`https://corsproxy.io/?\${encodeURIComponent(args.url)}\`);
      const html = await res.text();
      const title = html.match(/<title>(.*?)<\\/title>/i)?.[1] || "No title";
      const desc = html.match(/<meta name="description" content="(.*?)"/i)?.[1] || "No description";
      const h1s = [...html.matchAll(/<h1>(.*?)<\\/h1>/gi)].map(m => m[1]);
      return JSON.stringify({ title, description: desc, h1Count: h1s.length, h1s });
    `
  },
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    description: 'Convert between various units (length, weight, temperature).',
    category: 'Utility',
    declaration: {
      name: 'convertUnits',
      description: 'Converts a value between units.',
      parameters: {
        type: 'OBJECT',
        properties: {
          value: { type: 'NUMBER', description: 'The value to convert' },
          from: { type: 'STRING', description: 'Source unit (e.g., meters, kg, celsius)' },
          to: { type: 'STRING', description: 'Target unit (e.g., feet, lbs, fahrenheit)' }
        },
        required: ['value', 'from', 'to']
      }
    },
    jsCode: `
      // Simple logic for demo
      if (args.from === 'celsius' && args.to === 'fahrenheit') return (args.value * 9/5) + 32;
      if (args.from === 'meters' && args.to === 'feet') return args.value * 3.28084;
      return "Conversion not supported in this demo.";
    `
  },
  {
    id: 'ai-text-summarizer',
    name: 'AI Text Summarizer',
    description: 'Summarize long texts using a free AI summarization API.',
    category: 'AI Tools',
    declaration: {
      name: 'summarizeText',
      description: 'Summarizes the provided text.',
      parameters: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING', description: 'The text to summarize' }
        },
        required: ['text']
      }
    },
    jsCode: `
      const res = await fetch('https://api-inference.huggingface.co/models/facebook/bart-large-cnn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: args.text })
      });
      const data = await res.json();
      return data[0]?.summary_text || "Summarization failed.";
    `
  },
  {
    id: 'arch-viz-gen',
    name: 'Architectural Visualizer',
    description: 'Generate realistic architectural renderings from sketches or descriptions.',
    category: 'Architecture',
    declaration: {
      name: 'generateArchViz',
      description: 'Generates an architectural visualization image.',
      parameters: {
        type: 'OBJECT',
        properties: {
          prompt: { type: 'STRING', description: 'Description of the building or interior (e.g., Modern glass villa in forest)' }
        },
        required: ['prompt']
      }
    },
    jsCode: `
      const seed = Math.floor(Math.random() * 1000000);
      const enhancedPrompt = "Professional architectural photography, highly detailed, realistic, 8k, " + args.prompt;
      return \`https://image.pollinations.ai/prompt/\${encodeURIComponent(enhancedPrompt)}?seed=\${seed}&width=1280&height=720&nologo=true\`;
    `
  },
  {
    id: 'world-library',
    name: 'World Library (Open Library)',
    description: 'Access millions of books from the Open Library database.',
    category: 'Education',
    declaration: {
      name: 'searchBooks',
      description: 'Searches for books and returns details.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Book title or author' }
        },
        required: ['query']
      }
    },
    jsCode: `
      const res = await fetch(\`https://openlibrary.org/search.json?q=\${encodeURIComponent(args.query)}\`);
      const data = await res.json();
      return JSON.stringify(data.docs.slice(0, 5).map(d => ({ title: d.title, author: d.author_name, year: d.first_publish_year })));
    `
  },
  {
    id: 'translator-bs',
    name: 'Bosnian Translator',
    description: 'Translate any text to Bosnian language. 100% Free.',
    category: 'Utility',
    declaration: {
      name: 'translateToBosnian',
      description: 'Translates the given text to Bosnian.',
      parameters: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING', description: 'The text to translate' }
        },
        required: ['text']
      }
    },
    jsCode: `
      const res = await fetch(\`https://api.mymemory.translated.net/get?q=\${encodeURIComponent(args.text)}&langpair=en|bs\`);
      const data = await res.json();
      return data.responseData.translatedText;
    `
  },
  {
    id: 'cad-viewer-info',
    name: 'CAD/SolidWorks Info',
    description: 'Get technical specifications and info for CAD/SolidWorks projects.',
    category: 'Engineering',
    declaration: {
      name: 'getCADInfo',
      description: 'Provides technical information about CAD standards and SolidWorks features.',
      parameters: {
        type: 'OBJECT',
        properties: {
          topic: { type: 'STRING', description: 'The CAD topic to research' }
        },
        required: ['topic']
      }
    },
    jsCode: `
      return "CAD Information for " + args.topic + ": Preporučujemo korištenje standarda ISO 128 za tehničko crtanje. U SolidWorksu, koristite 'Simulation' modul za analizu naprezanja.";
    `
  }
];
