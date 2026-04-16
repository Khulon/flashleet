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
git clone https://github.com/Khulon/FlashLeet.git
cd FlashLeet
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Your progress saves to `data/*.json` in the project root — local, private, no account needed.

---

## Deploying

### Fly.io (recommended — has a free tier)

Fly.io's free tier includes persistent volumes, which is what this app needs to save your progress between deploys.

**1. Install flyctl and log in**
```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

**2. Set your app name**

Open `fly.toml` and change the `app` field to a unique name of your choice:
```toml
app = 'your-app-name'
```

**3. Create the persistent volume**
```bash
fly volumes create flashleet_data --size 1
```

**4. Deploy**
```bash
fly deploy
```

Your app will be live at `https://your-app-name.fly.dev`. Progress (card states, settings) persists in the volume across deploys.


## Questions dataset

The dataset ships with **3,450 problems**. Premium problems are missing or have incomplete descriptions. If you want to add or correct a problem, see [`docs/contributing.md`](docs/contributing.md).

---

## Docs

- [`docs/algorithm.md`](docs/algorithm.md) — how the SM-2 spaced repetition algorithm works, all tunable parameters
- [`docs/contributing.md`](docs/contributing.md) — how to add/fix questions, contribute code

---

## License

MIT
