# Spaced Repetition Algorithm

Flashleet uses a **binary SM-2** algorithm — the same core algorithm behind Anki, adapted for a simple know / don't-know interface with response-time-based quality grading.

## The core idea

Each card carries its own **ease factor (EF)**, initialised at 2.5. After every correct review, the next interval is:

```
next_interval = previous_interval × EF × interval_modifier
```

Cards you repeatedly struggle with drift toward EF = 1.3 (shorter intervals, seen more often). Cards you nail consistently drift toward EF = 2.5 (longer intervals, spaced further out). Every card finds its own natural rhythm.

## Quality grades from response time

Since the interface is binary (Know It / Don't Know), response time acts as a proxy for how confident you were:

| Response time | SM-2 quality | Effect on ease factor |
|---|---|---|
| < 30 seconds | 5 — Easy | EF + 0.10 |
| 30 – 120 seconds | 4 — Good | EF ± 0.00 |
| > 120 seconds | 3 — Hard | EF − 0.14 |

## Interval schedule

| Situation | Interval |
|---|---|
| 1st correct answer | 1 day |
| 2nd correct answer | 6 days |
| 3rd+ correct answer | `previous × EF × interval_modifier` |
| Fast answer (< 30s) | above × easy bonus (default 1.3×) |
| Wrong answer (lapse) | lapse interval (default 1 hour), EF − 0.20 |

## Progress states

Displayed on each card and in the stats page — based on consecutive correct answers:

| Streak | State |
|---|---|
| 0 | New |
| 1 | Learning |
| 2 – 4 | Review |
| 5+ | Mastered |

## Tunable parameters

All four are adjustable in Settings → Spaced Repetition:

| Parameter | Default | What it does |
|---|---|---|
| **Interval Modifier** | 1.0× | Global multiplier on every interval. Drop to ~0.7× for more frequent reviews, raise to ~1.5× if your retention is high. |
| **Starting Ease** | 2.5 | The ease factor new cards begin with. Lower if new cards are spacing out too fast. |
| **Easy Bonus** | 1.3× | Extra multiplier on top of a normal interval when you answer in under 30 seconds. |
| **Lapse Interval** | 1 hour | How soon a failed card reappears. Options: 10 min, 30 min, 1 hr, 4 hrs, 1 day. |

---

## Queue system

### Global queue vs local batch

There are two distinct queues:

**Global queue** — your entire card library sorted by priority. This is the source of truth. Order:
1. **Injected** — cards you pinned from Search (unseen or due only; see below)
2. **Due** — cards whose review interval has expired, oldest first
3. **New** — never-seen cards, in problem-ID order
4. **Upcoming** — not yet due, soonest expiring first

Within each bucket, cards seen in your last 5 reviews are pushed to the back to avoid back-to-back repeats.

**Local batch** — a frozen snapshot of the top N cards from the global queue (N = your session size). This is what you actually review. It does not change mid-session even if new cards become due while you're studying.

### Session flow

```
Global queue  →  startBatch (takes top N)  →  Local batch
                                                    ↓
                                              Answer cards
                                                    ↓
                                           Session done screen
                                                    ↓
                                    Continue → startBatch again
```

The local batch is **persisted to disk** (`batchIds` + `batchIndex` in `learn-session.json`). If you refresh mid-session, you resume exactly where you left off — the same cards in the same order.

### Injecting cards from Search

Clicking **+ Queue** on any problem in the Search page appends its ID to `injectedQuestionIds` in the session file. These IDs are **separate from the local batch** — they wait in the global queue until the current batch finishes.

When `startBatch` runs next (on Continue or fresh load with no saved batch):
1. Injected IDs that are **unseen or due** are pulled to the front of the new batch, in the order they were added.
2. Remaining slots are filled from the natural priority order.
3. Consumed IDs are removed from `injectedQuestionIds`. IDs that didn't fit the session size stay for the next batch.
4. Stale injections (cards that were already answered and aren't due yet) are silently cleaned up — they fall into the upcoming bucket instead of being force-injected.

### Recent cards

The session tracks the last 10 answered card IDs in `recentQuestionIds`. `buildQueue` uses the most recent 5 to deprioritise cards you just saw, pushing them to the back of their bucket. This prevents the same card from appearing twice in a row across session boundaries.

### Source files

| File | Purpose |
|---|---|
| [`src/lib/queue.ts`](../src/lib/queue.ts) | `buildQueue` — deterministic priority ordering |
| [`src/lib/scheduler.ts`](../src/lib/scheduler.ts) | SM-2 interval calculation, `isDue` |
| [`src/components/LearnTab.tsx`](../src/components/LearnTab.tsx) | `startBatch`, `advanceInBatch`, session persistence |
| [`src/app/api/session/route.ts`](../src/app/api/session/route.ts) | Session read/write API |
