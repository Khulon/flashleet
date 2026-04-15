import { Question, CardState, UserSettings, LearnSession } from "./types";
import { isDue } from "./scheduler";

/**
 * Returns the same deterministic ordered list used by both:
 *  - the Queue drawer (for display)
 *  - selectNextCard (so the card you see IS the top of the queue)
 *
 * Order: injected → due (oldest first) → new (by id) → upcoming (soonest first)
 * Recent cards are deprioritised to the back of each bucket.
 */
export function buildQueue(
  questions: Question[],
  cardStates: Record<number, CardState>,
  settings: UserSettings,
  session: LearnSession,
  excludeId?: number,
): Question[] {
  const filtered = questions.filter((q) => {
    if (excludeId !== undefined && q.id === excludeId) return false;
    const diffOk = settings.selectedDifficulties.includes(q.difficulty);
    const tagOk =
      settings.selectedTags.length === 0 ||
      q.tags.some((t) => settings.selectedTags.includes(t));
    return diffOk && tagOk;
  });

  if (filtered.length === 0) return [];

  const recentIds = new Set(session.recentQuestionIds.slice(-5));
  const now = new Date();

  // Injected card goes first (skip if it's the excluded one)
  const injected: Question[] = [];
  if (session.injectedQuestionId !== null && session.injectedQuestionId !== excludeId) {
    const q = filtered.find((q) => q.id === session.injectedQuestionId);
    if (q) injected.push(q);
  }

  const rest = filtered.filter((q) => q.id !== session.injectedQuestionId);

  // Due cards (not new), oldest nextDueAt first
  const due = rest
    .filter((q) => {
      const st = cardStates[q.id];
      return st && st.progress !== "new" && isDue(st);
    })
    .sort((a, b) =>
      new Date(cardStates[a.id].nextDueAt).getTime() -
      new Date(cardStates[b.id].nextDueAt).getTime()
    );

  // New cards, by question id (stable order)
  const newCards = rest
    .filter((q) => !cardStates[q.id] || cardStates[q.id].progress === "new")
    .sort((a, b) => a.id - b.id);

  // Not-yet-due cards, soonest first
  const upcoming = rest
    .filter((q) => {
      const st = cardStates[q.id];
      return st && st.progress !== "new" && !isDue(st);
    })
    .sort((a, b) =>
      new Date(cardStates[a.id].nextDueAt).getTime() -
      new Date(cardStates[b.id].nextDueAt).getTime()
    );

  // Within each bucket: non-recent first, then recent
  const order = (arr: Question[]) => [
    ...arr.filter((q) => !recentIds.has(q.id)),
    ...arr.filter((q) => recentIds.has(q.id)),
  ];

  return [...injected, ...order(due), ...order(newCards), ...order(upcoming)];
}

/** Always returns the top of the deterministic queue. */
export function selectNextCard(
  questions: Question[],
  cardStates: Record<number, CardState>,
  settings: UserSettings,
  session: LearnSession,
): Question | null {
  const queue = buildQueue(questions, cardStates, settings, session);
  return queue[0] ?? null;
}
