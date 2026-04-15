import { NextResponse } from "next/server";
import { readJsonFile } from "@/lib/server-storage";
import { Question } from "@/lib/types";

export async function GET() {
  const questions = readJsonFile<Question[]>("questions.json", []);
  return NextResponse.json(questions);
}
