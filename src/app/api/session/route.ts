import { NextRequest, NextResponse } from "next/server";
import { readJsonFile, writeJsonFile } from "@/lib/server-storage";
import { LearnSession } from "@/lib/types";

const DEFAULT_SESSION: LearnSession = {
  injectedQuestionId: null,
  recentQuestionIds: [],
};

export async function GET() {
  const session = readJsonFile<LearnSession>("learn-session.json", DEFAULT_SESSION);
  return NextResponse.json(session);
}

export async function POST(req: NextRequest) {
  const session: LearnSession = await req.json();
  writeJsonFile("learn-session.json", session);
  return NextResponse.json({ ok: true });
}
