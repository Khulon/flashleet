import { CardState, ProgressState, SRSettings } from "./types";

// ── Defaults ────────────────────────────────────────────────────────────────
export const DEFAULT_SR: SRSettings = {
  startingEase:       2.5,
  intervalModifier:   1.0,
  easyBonus:          1.3,
  lapseIntervalHours: 1,
};

const MIN_EASE = 1.3;
const MAX_EASE = 2.5;

// ── Helpers ──────────────────────────────────────────────────────────────────

// Map response time → SM-2 quality grade (3 = slow/hard, 4 = normal, 5 = fast/easy)
function getQuality(responseTimeMs: number | null): 3 | 4 | 5 {
  if (responseTimeMs === null) return 4;
  const s = responseTimeMs / 1000;
  if (s < 30)  return 5;  // fast:   excellent recall, ease grows
  if (s < 120) return 4;  // normal: good recall, ease unchanged
  return 3;               // slow:   hesitant recall, ease shrinks slightly
}

// SM-2 ease factor update: EF′ = EF + 0.1 − (5−q)·(0.08 + (5−q)·0.02)
// quality 5 → +0.10  |  quality 4 → 0.00  |  quality 3 → −0.14
function updateEaseFactor(ef: number, quality: number): number {
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  return Math.max(MIN_EASE, Math.min(MAX_EASE, ef + delta));
}

function progressFromStreak(streak: number): ProgressState {
  if (streak === 0) return "new";
  if (streak === 1) return "learning";
  if (streak < 5)  return "review";
  return "mastered";
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createInitialCardState(questionId: number): CardState {
  return {
    questionId,
    notes: "",
    code: "",
    progress: "new",
    nextDueAt: new Date().toISOString(),
    intervalHours: 0,
    easeFactor: DEFAULT_SR.startingEase,
    lapses: 0,
    successStreak: 0,
    failureStreak: 0,
    lastResponseTimeMs: null,
    totalAttempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function updateCardState(
  state: CardState,
  knew: boolean,
  responseTimeMs: number,
  sr: SRSettings = DEFAULT_SR,
): CardState {
  const now = new Date();

  // Backfill fields that may be absent on cards saved before this update
  const ef      = state.easeFactor ?? sr.startingEase;
  const lapses  = state.lapses     ?? 0;

  const quality = getQuality(responseTimeMs);

  let newSuccessStreak = state.successStreak;
  let newFailureStreak = state.failureStreak;
  let newLapses        = lapses;
  let newEF            = ef;
  let intervalHours: number;

  if (knew) {
    newSuccessStreak++;
    newFailureStreak = 0;
    newEF = updateEaseFactor(ef, quality);

    // SM-2 graduated intervals
    // streak 1 → 1 day, streak 2 → 6 days, streak 3+ → prev × EF
    if (newSuccessStreak === 1) {
      intervalHours = 24;
    } else if (newSuccessStreak === 2) {
      intervalHours = 144; // 6 days (Anki's default second step)
    } else {
      intervalHours = Math.round(state.intervalHours * newEF);
    }

    // Global interval modifier
    intervalHours = Math.round(intervalHours * sr.intervalModifier);

    // Easy bonus for fast answers (streak ≥ 2 so the card has graduated from step 1)
    if (quality === 5 && newSuccessStreak >= 2) {
      intervalHours = Math.round(intervalHours * sr.easyBonus);
    }

    // Never let interval go backwards
    intervalHours = Math.max(intervalHours, state.intervalHours + 1);

  } else {
    newLapses++;
    newFailureStreak++;
    newSuccessStreak = 0;
    newEF = Math.max(MIN_EASE, ef - 0.2); // lapse penalty
    intervalHours = sr.lapseIntervalHours;
  }

  const nextDueAt = new Date(
    now.getTime() + intervalHours * 60 * 60 * 1000,
  ).toISOString();

  return {
    ...state,
    progress:           progressFromStreak(newSuccessStreak),
    nextDueAt,
    intervalHours,
    easeFactor:         newEF,
    lapses:             newLapses,
    successStreak:      newSuccessStreak,
    failureStreak:      newFailureStreak,
    lastResponseTimeMs: responseTimeMs,
    totalAttempts:      state.totalAttempts + 1,
    updatedAt:          now.toISOString(),
  };
}

export function isDue(state: CardState): boolean {
  return new Date(state.nextDueAt) <= new Date();
}

export function getSpeedLabel(responseTimeMs: number | null): string {
  const q = getQuality(responseTimeMs);
  if (q === 5) return "⚡ Fast";
  if (q === 3) return "🐢 Slow";
  return "✓ Normal";
}
