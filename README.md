# The Agency - AI Specialists Platform

A multi-provider AI agent platform built with Next.js, supporting Gemini, OpenRouter, HuggingFace, Ollama, and Claude models. Create specialized AI agents, manage conversations, and deploy applications.

## Features

- **Multi-Provider Support**: Seamlessly switch between Gemini, OpenRouter, HuggingFace, Ollama, and Claude
- **Agent Management**: Create and manage specialized AI agents with custom system instructions
- **Chat Sessions**: Persistent chat history stored in Firestore
- **Custom Tools & Plugins**: Build and install custom tools for agents
- **Deployment Integration**: Deploy to Netlify, Vercel, and Railway directly from the app
- **GitHub Integration**: Push code to GitHub repositories
- **Dark/Light Theme**: Toggle between dark and light modes
- **Responsive Design**: Works on desktop and mobile devices

## Quick Start

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your API keys:

```bash
cp .env.example .env.local
```

### 3. Set Up Firebase

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Google Sign-In)
3. Create a Firestore database
4. Copy your Firebase config to `.env.local`

### 4. Get API Keys

Choose your preferred AI provider(s):

#### Option A: OpenRouter (Recommended for beginners)
- Free tier with access to 200+ models
- Get key: https://openrouter.ai/keys
- Supports Gemini, Claude, Llama, and more

#### Option B: HuggingFace
- Free tier: ~1000 requests/day
- Get token: https://huggingface.co/settings/tokens
- Supports Llama, Mistral, Gemma, and more

#### Option C: Gemini
- Free tier available
- Get key: https://aistudio.google.com/app/apikey
- Google's latest AI models

#### Option D: Ollama (Local)
- Run models locally without API keys
- Download: https://ollama.ai
- Requires local installation

#### Option E: Claude (via OpenRouter)
- Use OpenRouter API key for Claude access
- Supports Claude 3.5 Sonnet, Haiku, and Opus

### 5. Run Development Server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

### Default Settings

The app comes with sensible defaults:
- **Default Provider**: Gemini
- **Default Model**: Gemini 1.5 Flash
- **Temperature**: 0.7 (balanced between precise and creative)
- **Language**: Bosnian (all responses in Bosnian)

### Changing Providers

1. Click the **Settings** button (gear icon)
2. Select your preferred provider
3. Enter your API key (if required)
4. Choose a model from the dropdown
5. Click **Save Settings**

### Local Development with Ollama

1. Install Ollama from https://ollama.ai
2. Run: `ollama serve`
3. In another terminal: `ollama pull llama2` (or your preferred model)
4. In app settings, select "Ollama (Local)" provider
5. Model name should match installed model (e.g., `llama2`)

## Project Structure

```
├── app/
│   ├── api/chat/route.ts          # Chat API endpoint (supports all providers)
│   ├── globals.css                 # Global styles
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Home page
├── components/
│   ├── Chat.tsx                    # Main chat interface
│   ├── Dashboard.tsx               # Main dashboard
│   ├── ChatHistory.tsx             # Chat history sidebar
│   ├── ModelManager.tsx            # Model selection UI
│   ├── PromptEditor.tsx            # System prompt editor
│   └── ModelManager.tsx            # Model activation
├── lib/
│   ├── firebase.ts                 # Firebase configuration
│   ├── github.ts                   # GitHub agent loading
│   ├── pluginStore.ts              # Available plugins
│   ├── publicApis.ts               # Public API search
│   └── utils.ts                    # Utility functions
├── hooks/
│   └── use-mobile.ts               # Mobile detection hook
├── .env.example                    # Environment variables template
├── firebase-blueprint.json         # Firestore schema
├── next.config.ts                  # Next.js configuration
├── package.json                    # Dependencies
└── tsconfig.json                   # TypeScript configuration
```

## API Providers Comparison

| Provider | Free Tier | Models | Speed | Setup |
|----------|-----------|--------|-------|-------|
| **OpenRouter** | ✅ Yes | 200+ | Fast | Easy |
| **HuggingFace** | ✅ Yes (~1k/day) | 100+ | Medium | Easy |
| **Gemini** | ✅ Yes | 5+ | Fast | Easy |
| **Ollama** | ✅ Yes (Local) | 50+ | Varies | Medium |
| **Claude** | ❌ No (via OpenRouter) | 3 | Fast | Easy |

## Firestore Collections

- **customModels**: User-created AI models
- **customTools**: User-created tools and plugins
- **chatSessions**: Chat history per user and agent
- **usageLogs**: API usage tracking for rate limiting
- **publicApis**: Curated public API database

## Rate Limiting

- **Default**: 15 requests per minute per user
- Tracked in Firestore `usageLogs` collection
- Helps prevent API abuse and manage costs

## Deployment

### Deploy to Vercel

```bash
vercel deploy
```

### Deploy to Netlify

```bash
netlify deploy
```

### Deploy to Railway

```bash
railway up
```

## Troubleshooting

### "Provider not supported" error
- Make sure your API key is set in settings
- Check that the provider is enabled in `.env.local`

### "Failed to connect to Ollama"
- Ensure Ollama is running: `ollama serve`
- Check Ollama URL in settings (default: `http://localhost:11434`)
- Pull a model: `ollama pull llama2`

### Firebase authentication issues
- Verify Firebase config in `.env.local`
- Enable Google Sign-In in Firebase Console
- Check Firestore security rules

### Rate limit exceeded
- Wait 1 minute before making new requests
- Check usage logs in Firestore
- Consider upgrading to paid API tier

## Environment Variables Reference

```env
# AI Providers
GEMINI_API_KEY=your_key
OPENROUTER_KEY=your_key
HF_TOKEN=your_token
OLLAMA_URL=http://localhost:11434

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_id
# ... other Firebase variables

# Deployment
GITHUB_TOKEN=your_token
NETLIFY_TOKEN=your_token
VERCEL_TOKEN=your_token
RAILWAY_TOKEN=your_token

# App
APP_URL=http://localhost:3000
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

## Credits

Built with:
- [Next.js](https://nextjs.org/) - React framework
- [Firebase](https://firebase.google.com/) - Backend services
- [TailwindCSS](https://tailwindcss.com/) - Styling
- [Framer Motion](https://www.framer.com/motion/) - Animations
- [Lucide React](https://lucide.dev/) - Icons
