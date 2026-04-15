import { CardState, UserSettings, LearnSession, Question } from "./types";

// ── In-memory cache ──────────────────────────────────────────────────
// Data is cached after first fetch. Navigating between pages never
// re-fetches unless the data was explicitly mutated via a save* call.
let _questions:  Question[]                    | null = null;
let _cardStates: Record<number, CardState>     | null = null;
let _settings:   UserSettings                  | null = null;
let _session:    LearnSession                  | null = null;

// ── Reads (return cache immediately if available) ────────────────────

export async function getQuestions(): Promise<Question[]> {
  if (_questions) return _questions;
  const res = await fetch("/api/questions");
  if (!res.ok) throw new Error("Failed to fetch questions");
  _questions = await res.json();
  return _questions!;
}

export async function getCardStates(): Promise<Record<number, CardState>> {
  if (_cardStates) return _cardStates;
  const res = await fetch("/api/card-states");
  if (!res.ok) throw new Error("Failed to fetch card states");
  _cardStates = await res.json();
  return _cardStates!;
}

export async function getUserSettings(): Promise<UserSettings> {
  if (_settings) return _settings;
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Failed to fetch settings");
  _settings = await res.json();
  return _settings!;
}

export async function getLearnSession(): Promise<LearnSession> {
  if (_session) return _session;
  const res = await fetch("/api/session");
  if (!res.ok) throw new Error("Failed to fetch session");
  _session = await res.json();
  return _session!;
}

// ── Writes (update cache + persist) ─────────────────────────────────

export async function saveCardState(state: CardState): Promise<void> {
  // Update cache immediately so next read is instant
  if (_cardStates) _cardStates[state.questionId] = state;
  await fetch("/api/card-states", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  _settings = settings;
  await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

export async function saveLearnSession(session: LearnSession): Promise<void> {
  _session = session;
  await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
}

// ── Cache invalidation (call if data may have changed externally) ────
export function invalidateCache() {
  _questions  = null;
  _cardStates = null;
  _settings   = null;
  _session    = null;
}
