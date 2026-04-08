# Agencija OS

A mobile-first AI orchestration studio built with Next.js, combining Agency Agents specialist prompts, DeerFlow-style workflow trains, real web research, persistent memory, and reusable skill brains.

## Features

- **Workflow Orchestration**: Multi-stage pipelines driven by real specialist prompts from `agency-agents`
- **Real Web Research**: DuckDuckGo HTML search plus page scraping, without mock results
- **Skill Brain Profiles**: Save reusable operational prompts that shape future workflow runs
- **Persistent Memory**: Store orchestration runs locally or sync them to Firestore when signed in
- **Export / Import**: Move skill brains and memory runs as JSON
- **Workflow Toolkits**: Inject per-workflow tool context into orchestration
- **Multi-Provider Support**: Gemini, OpenRouter, HuggingFace, and Ollama
- **Responsive Swipe UI**: Mobile-first interface with swipeable work surfaces

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your API keys:

```bash
cp .env.example .env.local
```

### 3. Set Up Firebase

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication with Google Sign-In
3. Create a Firestore database
4. Copy your Firebase config to `.env.local`
5. Deploy [`/root/Agencija/firestore.rules`](/root/Agencija/firestore.rules) so `studioRuns` and `skillBrains` are protected per-user

### 4. Get API Keys

Choose one or more providers:

- **OpenRouter**: [openrouter.ai/keys](https://openrouter.ai/keys)
- **Hugging Face**: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
- **Gemini**: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- **Ollama**: local runtime from [ollama.ai](https://ollama.ai)

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Studio Overview

The studio has six main surfaces:

- `Studio`: run workflows with selected agents, optional skill brain, memory, and web research
- `Flows`: choose orchestration trains
- `Agents`: browse live `agency-agents` specialists
- `Memory`: review and reload previous runs
- `Brain`: create, save, export, and import skill profiles
- `Stack`: provider credentials and architecture notes

## Cloud Sync vs Local Mode

- Signed out: memory and skill brains are stored locally in browser storage
- Signed in with Google: `studioRuns` and `skillBrains` sync to Firestore for that user

## Export / Import

- Skill brains export as `agencija-skill-brains.json`
- Memory runs export as `agencija-run-memory.json`
- Import works in both local mode and cloud mode
- In cloud mode imported items are written into Firestore

## Local Development with Ollama

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Run `ollama serve`
3. Pull a model, for example `ollama pull llama3`
4. In the app choose `Ollama` provider
5. Make sure the model name in the UI matches the installed model

## Project Structure

```text
├── app/
│   ├── api/chat/route.ts           # Legacy chat endpoint
│   ├── api/orchestrate/route.ts    # Multi-stage orchestration endpoint
│   ├── api/web/research/route.ts   # Search + scrape backend
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── AgencyStudio.tsx            # Main mobile-first orchestration studio
│   ├── Chat.tsx                    # Legacy chat interface
│   ├── Dashboard.tsx               # Legacy dashboard
│   ├── ChatHistory.tsx
│   ├── ModelManager.tsx
│   └── PromptEditor.tsx
├── lib/
│   ├── firebase.ts
│   ├── github.ts
│   ├── llm.ts
│   ├── studio-types.ts
│   ├── toolkits.ts
│   ├── web-research.ts
│   ├── workflows.ts
│   ├── pluginStore.ts
│   ├── publicApis.ts
│   └── utils.ts
├── firebase-blueprint.json
├── firestore.rules
└── .env.example
```

## Providers Comparison

| Provider | Free Tier | Models | Setup |
|----------|-----------|--------|-------|
| OpenRouter | Yes | 200+ | Easy |
| HuggingFace | Yes (~1k/day) | 100+ | Easy |
| Gemini | Yes | 5+ | Easy |
| Ollama | Yes (Local) | Many | Medium |

## Firestore Collections

- `customModels`: user-created AI models
- `customTools`: user-created tools and plugins
- `chatSessions`: chat history per user and agent
- `usageLogs`: API usage tracking for rate limiting
- `publicApis`: curated public API database
- `studioRuns`: persistent orchestration runs per authenticated user
- `skillBrains`: reusable skill profiles per authenticated user

## Workflow Architecture

Each run can include:

- selected `agency-agents` specialist prompt
- selected workflow train
- optional saved skill brain prompt
- compressed memory summary from recent runs
- real web research snapshot
- workflow-specific toolkit context

The orchestration route executes multiple model calls, one per stage, and then a final synthesis pass.

## Build Notes

- `npx tsc --noEmit` should pass cleanly
- in constrained environments `next build` may be killed during typecheck by memory pressure even when code is valid
- if that happens locally, retry with:

```bash
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

## Troubleshooting

### Failed to connect to Ollama

- ensure Ollama is running with `ollama serve`
- confirm the configured URL, usually `http://localhost:11434`
- confirm the requested model is installed

### Firebase authentication or sync issues

- verify Firebase config in `.env.local`
- enable Google Sign-In in Firebase Console
- deploy the latest Firestore rules
- confirm authenticated users can read and write only their own `studioRuns` and `skillBrains`

### Rate limit exceeded

- wait 1 minute before making new requests
- check `usageLogs` in Firestore

## Environment Variables Reference

```env
GEMINI_API_KEY=your_key
OPENROUTER_KEY=your_key
HF_TOKEN=your_token
OLLAMA_URL=http://localhost:11434

NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_id
APP_URL=http://localhost:3000
```

## Credits

Built on top of:

- [agency-agents](https://github.com/msitarzewski/agency-agents)
- [500-AI-Agents-Projects](https://github.com/ashishpatel26/500-AI-Agents-Projects)
- [Next.js](https://nextjs.org/)
- [Firebase](https://firebase.google.com/)
