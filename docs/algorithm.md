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

## Source

The algorithm lives in [`src/lib/scheduler.ts`](../src/lib/scheduler.ts).
