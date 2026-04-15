# Flashleet

Spaced repetition flashcards for LeetCode — so you actually remember the patterns, not just solve them once and forget.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Features

- **3,450 LeetCode problems** pre-loaded (free tier — premium problems are missing or incomplete)
- **SM-2 spaced repetition** — cards you struggle with come back sooner, cards you know get pushed further out
- **Per-card notes & code editor** — write your own solution and notes on the back of each card
- **AI-generated hints** — optionally connect OpenAI, DeepSeek, or any compatible API to auto-generate notes and model solutions
- **Stats dashboard** — mastery breakdown by difficulty, topic, and streak
- **Search & filter** — find any problem by title, difficulty, topic, or progress
- No database, no auth, no setup beyond `npm install`

---

## Getting started

```bash
git clone https://github.com/your-username/flashleet.git
cd flashleet
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Your progress saves to `data/*.json` in the project root — local, private, no account needed.

---

## Deploying

### Railway (recommended)

Railway gives you a persistent filesystem so your progress saves properly, just like running locally.

1. Push your fork to GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo — Railway auto-detects Next.js and deploys

### Vercel ⚠️

Vercel's serverless functions run on a read-only filesystem, so **card states and settings won't persist** between sessions. Fine for a demo, not for actual use. Use Railway/Render/Fly.io if you want your progress to save.

---

## Questions dataset

The dataset ships with **3,450 problems**. Premium problems are missing or have incomplete descriptions. If you want to add or correct a problem, see [`docs/contributing.md`](docs/contributing.md).

---

## Docs

- [`docs/algorithm.md`](docs/algorithm.md) — how the SM-2 spaced repetition algorithm works, all tunable parameters
- [`docs/contributing.md`](docs/contributing.md) — how to add/fix questions, contribute code

---

## License

MIT
