import { NextRequest, NextResponse } from "next/server";
import { readJsonFile, writeJsonFile } from "@/lib/server-storage";
import { UserSettings } from "@/lib/types";
import { DEFAULT_SR } from "@/lib/scheduler";

const DEFAULT_SETTINGS: UserSettings = {
  selectedDifficulties: ["Easy", "Medium", "Hard"],
  selectedTags: [],
  sessionSize: 10,
  sr: DEFAULT_SR,
  ai: {
    provider: "openai",
    apiKey: "",
    baseUrl: "",
    model: "gpt-4o-mini",
    promptNotes: "You are a coding interview coach. Given the following LeetCode problem, write concise study notes covering: the core insight/pattern, time and space complexity, edge cases to watch for, and any helpful mnemonics. Be brief and practical — max 150 words.",
    promptCode: "You are a coding interview coach. Given the following LeetCode problem, write a clean Python solution with a brief inline comment explaining the key idea. Include the function signature. Aim for the optimal approach.",
  },
};

export async function GET() {
  const settings = readJsonFile<UserSettings>("user-settings.json", DEFAULT_SETTINGS);
  // Backfill missing fields for existing installs
  const merged: UserSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    sr: { ...DEFAULT_SETTINGS.sr, ...(settings.sr ?? {}) },
    ai: { ...DEFAULT_SETTINGS.ai, ...(settings.ai ?? {}) },
  };
  return NextResponse.json(merged);
}

export async function POST(req: NextRequest) {
  const settings: UserSettings = await req.json();
  writeJsonFile("user-settings.json", settings);
  return NextResponse.json({ ok: true });
}
