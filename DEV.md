# LeetLearn

A local-first spaced repetition flashcard app for coding interview prep. Combines LeetCode-style problems with Anki-style scheduling and speed-aware intervals.

## Quick Start

```bash
npm install
npm run dev
# → http://localhost:3000
```

Drop your `questions.json` into `/data/` to replace the sample problems.

---

## File Structure

```
leetlearn/
├── data/                          # JSON flat-file database (gitignore if private)
│   ├── questions.json             # Static problem dataset (you provide this)
│   ├── card-states.json           # Per-card SRS state, notes, code (auto-generated)
│   ├── user-settings.json         # Difficulty/tag filters, session size, AI config
│   └── learn-session.json         # Injected card queue, recent card IDs
│
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout — renders PersistentLearn + Nav
│   │   ├── page.tsx               # Redirects / → /learn
│   │   ├── globals.css            # Design system: CSS vars, component classes
│   │   │
│   │   ├── learn/page.tsx         # Stub — returns null (content in PersistentLearn)
│   │   ├── search/page.tsx        # Search + filter + inject-to-queue
│   │   ├── stats/page.tsx         # Mastery stats, per-tag/difficulty breakdown
│   │   ├── settings/page.tsx      # Difficulty, tags, session size, AI config
│   │   │
│   │   └── api/
│   │       ├── questions/         # GET  — reads data/questions.json
│   │       ├── card-states/       # GET + POST — reads/writes data/card-states.json
│   │       ├── settings/          # GET + POST — reads/writes data/user-settings.json
│   │       ├── session/           # GET + POST — reads/writes data/learn-session.json
│   │       └── ai-generate/       # POST — proxies to OpenAI-compatible API
│   │
│   ├── components/
│   │   ├── LearnTab.tsx           # The full Learn page component (~980 lines)
│   │   ├── PersistentLearn.tsx    # Keeps LearnTab alive in layout (never unmounts)
│   │   ├── Nav.tsx                # Bottom nav pill with optimistic active state
│   │   ├── QueueDrawer.tsx        # Slide-in drawer showing upcoming card order
│   │   ├── DifficultyBadge.tsx    # Easy/Medium/Hard coloured badge
│   │   └── ProgressBadge.tsx      # new/learning/review/mastered badge
│   │
│   └── lib/
│       ├── types.ts               # All TypeScript interfaces
│       ├── storage.ts             # Fetch wrappers with in-memory cache
│       ├── server-storage.ts      # fs read/write for API routes (server-only)
│       ├── queue.ts               # buildQueue() + selectNextCard()
│       ├── scheduler.ts           # SRS interval logic, updateCardState()
│       ├── useTimer.ts            # Stopwatch hook (start/stop/formatted)
│       └── useDebounce.ts         # Generic debounce hook
```

---

## Architecture: Why the Nav Feels Instant

### The Problem with Next.js Navigation

Normal Next.js page navigation unmounts the current page and mounts the next one. For the Learn page this takes ~500ms–1s on mobile because it has:
- 4 parallel API fetches
- CodeMirror (heavy editor, ~200KB JS)
- Touch event listeners
- Timer, batch queue, swipe state

### The Fix: PersistentLearn

`LearnTab.tsx` lives **inside the root layout** via `PersistentLearn.tsx`, not inside any page route. This means it **never unmounts** regardless of which URL the user is on.

```
layout.tsx
  └── <PersistentLearn />     ← mounts once at app start, lives forever
  └── {children}              ← other pages (search, stats, settings) render here
  └── <Nav />
```

When the user is on `/search`, `/stats`, or `/settings`:
- `PersistentLearn` hides the Learn div with `visibility: hidden; pointer-events: none; position: fixed; z-index: -1`
- The component is still mounted, timer still ticking, all state preserved
- No unmount → no remount → zero lag when returning

When the user navigates back to `/learn`:
- The inline styles are removed — Learn is instantly visible
- No data fetch, no component mount, no loading screen

### Nav Active State

`Nav.tsx` uses **optimistic active state** — a local `useState` that updates immediately on tap, independently of `usePathname`:

```ts
const handleTap = (href) => {
  setActive(href);    // instant — same frame as the tap
  router.push(href);  // Next.js navigation starts in background
};

// Sync when navigation actually completes (handles back/forward too)
useEffect(() => {
  setActive(hrefFromPath(pathname));
}, [pathname]);
```

This means the nav highlight moves the moment you tap, even if the page takes 300ms to load.

### In-Memory Data Cache

`storage.ts` caches all API responses in module-level variables. After the first page load, every `getQuestions()`, `getCardStates()` etc. returns **synchronously** from memory:

```ts
let _questions: Question[] | null = null;

export async function getQuestions(): Promise<Question[]> {
  if (_questions) return _questions;   // instant on return visits
  const res = await fetch("/api/questions");
  _questions = await res.json();
  return _questions;
}
```

Write functions (`saveCardState`, `saveLearnSession` etc.) update the cache AND persist to disk simultaneously, so reads always reflect the latest state.

---

## Spaced Repetition Algorithm

### CardState fields

| Field | Description |
|---|---|
| `progress` | `new` → `learning` → `review` → `mastered` |
| `nextDueAt` | ISO timestamp of when the card is next due |
| `intervalHours` | Current spacing interval in hours |
| `successStreak` | Consecutive "Know It" answers |
| `failureStreak` | Consecutive "Don't Know" answers |
| `lastResponseTimeMs` | How long the user took to answer |
| `totalAttempts` | Total number of reviews |

### Intervals

**Know It** (success streak determines which interval):
```
streak 1 → 24h
streak 2 → 72h
streak 3 → 168h  (1 week)
streak 4 → 504h  (3 weeks)
streak 5+ → 1440h (2 months)
```

**Don't Know** (resets success streak, uses failure streak):
```
failure 1 → 7h
failure 2 → 24h
failure 3+ → 70h
```

### Speed Multiplier

Response time adjusts the "Know It" interval:

| Speed | Threshold | Multiplier |
|---|---|---|
| Fast | < 30 seconds | ×1.4 |
| Normal | 30–120 seconds | ×1.1 |
| Slow | > 120 seconds | ×0.9 |

### Progress States

Determined by `successStreak` after each answer:
```
streak 0       → "new"
streak 1       → "learning"
streak 2–4     → "review"
streak 5+      → "mastered"
```
Any "Don't Know" answer resets to `"learning"` regardless of previous streak.

---

## Queue Algorithm

`buildQueue()` in `src/lib/queue.ts` produces a **deterministic ordered list** used by both the queue drawer (display) and `selectNextCard()` (actual card served). They are always in sync.

### Priority order within a session batch:

1. **Injected card** — from Search page "Study →" button; goes first
2. **Due cards** — cards where `nextDueAt ≤ now`, sorted oldest-due first
3. **New cards** — never attempted, sorted by question ID (stable)
4. **Upcoming cards** — not yet due, sorted by soonest `nextDueAt`

Within each bucket, recently-seen cards (last 5) are pushed to the back to avoid immediate repetition.

### Session batches

The full queue is sliced to `sessionSize` (default 10, configurable in Settings). When the batch is exhausted, a "Session complete" screen appears with accuracy stats. The user can then start the next batch of 10.

### Injecting a card from Search

```
Search page → "Study →" → saves injectedQuestionId to learn-session.json
                         → calls window.__setTab?.("learn")  (no-op on /learn)
                         → LearnTab picks it up at next startBatch / advanceInBatch
```

The injected card is placed at the front of the queue, then `injectedQuestionId` is cleared so it isn't reused.

---

## Swipe / Touch System

The flashcard supports both mouse drag (desktop) and touch swipe (mobile). These are handled by **two separate systems** to work around browser limitations:

### Why two systems?

On mobile Safari/Chrome, when a touch starts on a `<textarea>`, the browser claims that touch stream for the textarea's scroll behavior **before** pointer events bubble up. `setPointerCapture` and `preventDefault` have no effect at that point.

**Solution:** Register non-passive `touchmove` listeners directly on the DOM node via `useEffect`. Non-passive listeners can call `e.preventDefault()`, which steals the horizontal gesture away from the textarea's scroll handler.

### Touch handlers (mobile)

Registered in a `useEffect` with `{ passive: false }` on the card wrapper element:

```
touchstart  → record start position (passive — let native events fire)
touchmove   → detect direction (first 5px of movement)
              if vertical → bail out, let textarea/page scroll
              if horizontal → call preventDefault(), animate card
touchend    → if was dragging: commit answer if past threshold, else snap back
              if was tap: flip card (unless tap was on interactive element)
```

### Pointer handlers (desktop / mouse)

React synthetic pointer events on the card wrapper:
- `onPointerDown` — record start position
- `onPointerMove` — determine direction, call `setPointerCapture` once horizontal confirmed
- `onPointerUp` — commit or snap back; tap detection for flip

### Zero-rerender drag

Card translation during swipe uses **direct DOM mutation**, not React state:

```ts
const applyDragStyle = (dx: number) => {
  cardWrapRef.current.style.transform = `translateX(${dx}px) rotate(${deg}deg)`;
  dragXRef.current = dx;
  // Also update tint overlays and swipe labels imperatively
};
```

`setIsDragging(true)` fires only **once** per swipe (when horizontal direction is confirmed), not on every pointermove. This keeps the card at 60fps even on low-end phones.

### When touch listeners are active

The `useEffect` that registers listeners has `isActive` as a dependency. When `isActive = false`, no touch listeners are registered. This matters because **a non-passive `touchmove` listener anywhere in the document forces Safari to check JS before every scroll event** — making the entire app feel sluggish.

Currently `isActive = true` always (since `LearnTab` is always mounted in the layout). If you ever move back to a tab-switching architecture, restore the `isActive` check to prevent the listener from being active while the Learn tab is hidden.

---

## AI Integration

### Settings

In Settings → AI Assistance:
- **Provider**: OpenAI, DeepSeek, or Custom (any OpenAI-compatible endpoint)
- **API Key**: stored in `data/user-settings.json` — never leaves your machine except to the chosen provider
- **Model**: e.g. `gpt-4o-mini`, `deepseek-chat`
- **Base URL**: auto-set for OpenAI/DeepSeek, configurable for custom
- **Prompts**: editable system prompts for Notes and Code generation

### How it works

`POST /api/ai-generate` in `src/app/api/ai-generate/route.ts`:
1. Reads AI settings from `data/user-settings.json` on the server
2. Builds a problem context string (description + examples + constraints)
3. POSTs to `{baseUrl}/chat/completions` with the user's key
4. Returns the completion text

The front-end (`LearnTab.tsx`) calls this when the user taps **✨ AI Generate** on the back of a card. The result fills the notes or code textarea and autosaves.

---

## Data Files

All data lives in `/data/` as JSON. No database, no auth.

### `questions.json`

Static problem list. You provide this. Schema:
```json
{
  "id": 1,
  "title": "Two Sum",
  "difficulty": "Easy",
  "description": "...",
  "examples": [{ "input": "...", "output": "...", "explanation": "..." }],
  "constraints": ["..."],
  "follow_up": "...",
  "slug": "two-sum",
  "tags": ["Array", "Hash Table"]
}
```

### `card-states.json`

Keyed by question ID. Auto-created on first answer:
```json
{
  "1": {
    "questionId": 1,
    "notes": "Use a hashmap...",
    "code": "def twoSum(...):",
    "progress": "review",
    "nextDueAt": "2025-04-15T10:00:00.000Z",
    "intervalHours": 72,
    "successStreak": 2,
    "failureStreak": 0,
    "lastResponseTimeMs": 45000,
    "totalAttempts": 3
  }
}
```

### `user-settings.json`

```json
{
  "selectedDifficulties": ["Easy", "Medium", "Hard"],
  "selectedTags": [],
  "sessionSize": 10,
  "ai": {
    "provider": "openai",
    "apiKey": "sk-...",
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4o-mini",
    "promptNotes": "...",
    "promptCode": "..."
  }
}
```

### `learn-session.json`

```json
{
  "injectedQuestionId": null,
  "recentQuestionIds": [1, 53, 70, 121, 20]
}
```

---

## Design System

CSS custom properties defined in `globals.css`:

| Variable | Value | Use |
|---|---|---|
| `--purple` | `#6c63ff` | Primary brand, active states |
| `--purple-lt` | `#ede8ff` | Active nav, tag backgrounds |
| `--green` | `#2ecc71` | Know It button, Easy badge |
| `--red` | `#ff4757` | Don't Know button, Hard badge |
| `--orange` | `#ff9f43` | Medium badge, streaks |
| `--bg` | `#f0f4ff` | Page background |
| `--bg-card` | `#ffffff` | Card surfaces |
| `--font-sans` | Nunito | All UI text |
| `--font-mono` | Fira Code | Code editor, examples |

Key CSS classes: `.card-surface`, `.btn`, `.btn-know`, `.btn-dontknow`, `.badge`, `.badge-easy/medium/hard`, `.badge-new/learning/review/mastered`, `.tag`, `.timer`, `.progress-strip`.

---

## Known Issues / Future Work

- **`isActive` flag**: `LearnTab.tsx` has `const isActive = true` hardcoded. If you ever re-introduce a tab-switching SPA architecture (where LearnTab can be hidden while mounted), restore this to a real check so the non-passive `touchmove` listener is unregistered when hidden.

- **Cache invalidation**: `storage.ts` caches data for the entire browser session. If you open two browser tabs and edit settings in one, the other won't see the changes. Call `invalidateCache()` from `storage.ts` if you need to force a re-fetch.

- **No cloud sync**: All data is local JSON. To sync across devices, replace `server-storage.ts` with a database client (Supabase, PlanetScale, etc.) and add auth.

- **questions.json is static**: There's no UI to add new problems. Add them directly to `data/questions.json` and restart the server.

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + custom CSS vars |
| Animation | Framer Motion |
| Code Editor | CodeMirror 6 via @uiw/react-codemirror |
| Icons | Lucide React |
| Storage | Local JSON files via Node.js `fs` |
| AI | OpenAI-compatible REST API |
