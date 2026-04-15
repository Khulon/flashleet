export type Difficulty = "Easy" | "Medium" | "Hard";
export type ProgressState = "new" | "learning" | "review" | "mastered";
export type AiProvider = "openai" | "deepseek" | "custom";

export interface Example {
  input: string;
  output: string;
  explanation?: string;
}

export interface Question {
  id: number;
  title: string;
  difficulty: Difficulty;
  description: string;
  examples: Example[];
  constraints: string[];
  follow_up?: string;
  slug: string;
  tags: string[];
}

export interface CardState {
  questionId: number;
  notes: string;
  code: string;
  progress: ProgressState;
  nextDueAt: string;
  intervalHours: number;
  easeFactor: number;       // SM-2 per-card ease multiplier (1.3 – 2.5)
  lapses: number;           // total times the card was failed (ever)
  successStreak: number;
  failureStreak: number;
  lastResponseTimeMs: number | null;
  totalAttempts: number;
  createdAt: string;
  updatedAt: string;
}

// User-tunable SM-2 parameters
export interface SRSettings {
  startingEase: number;       // initial ease factor for brand-new cards  (default 2.5)
  intervalModifier: number;   // global multiplier on every review interval (default 1.0)
  easyBonus: number;          // extra multiplier when answer is fast/easy  (default 1.3)
  lapseIntervalHours: number; // hours until a failed card reappears        (default 1)
}

export interface AiSettings {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;       // override base URL (for custom / deepseek)
  model: string;         // e.g. gpt-4o, deepseek-chat
  promptNotes: string;   // system prompt for notes generation
  promptCode: string;    // system prompt for code generation
}

export interface UserSettings {
  selectedDifficulties: Difficulty[];
  selectedTags: string[];
  sessionSize: number;   // how many cards per session (default 10)
  sr: SRSettings;
  ai: AiSettings;
}

export interface LearnSession {
  injectedQuestionId: number | null;
  recentQuestionIds: number[];
}
