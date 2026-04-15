import { NextRequest, NextResponse } from "next/server";
import { readJsonFile, writeJsonFile } from "@/lib/server-storage";
import { CardState } from "@/lib/types";

export async function GET() {
  const states = readJsonFile<Record<number, CardState>>("card-states.json", {});
  return NextResponse.json(states);
}

export async function POST(req: NextRequest) {
  const state: CardState = await req.json();
  const states = readJsonFile<Record<number, CardState>>("card-states.json", {});
  states[state.questionId] = state;
  writeJsonFile("card-states.json", states);
  return NextResponse.json({ ok: true });
}
