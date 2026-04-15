import { NextRequest, NextResponse } from "next/server";
import { readJsonFile } from "@/lib/server-storage";
import { UserSettings } from "@/lib/types";

interface GenerateRequest {
  type: "notes" | "code";
  questionTitle: string;
  questionDescription: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  tags: string[];
  difficulty: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  selectedDifficulties: ["Easy", "Medium", "Hard"],
  selectedTags: [],
  sessionSize: 10,
  ai: {
    provider: "openai",
    apiKey: "",
    baseUrl: "",
    model: "gpt-4o-mini",
    promptNotes: "You are a coding interview coach. Given the following LeetCode problem, write concise study notes covering: the core insight/pattern, time and space complexity, edge cases to watch for, and any helpful mnemonics. Be brief and practical — max 150 words.",
    promptCode: "You are a coding interview coach. Given the following LeetCode problem, write a clean Python solution with a brief inline comment explaining the key idea. Include the function signature. Aim for the optimal approach.",
  },
};

export async function POST(req: NextRequest) {
  const body: GenerateRequest = await req.json();
  const settings = readJsonFile<UserSettings>("user-settings.json", DEFAULT_SETTINGS);
  const ai = { ...DEFAULT_SETTINGS.ai, ...(settings.ai ?? {}) };

  if (!ai.apiKey) {
    return NextResponse.json({ error: "No API key configured. Add one in Settings → AI." }, { status: 400 });
  }

  // Build the problem context string
  const examplesStr = body.examples
    .map((ex, i) => `Example ${i + 1}:\n  Input: ${ex.input}\n  Output: ${ex.output}${ex.explanation ? `\n  Explanation: ${ex.explanation}` : ""}`)
    .join("\n");
  const constraintsStr = body.constraints.length > 0 ? `\nConstraints:\n${body.constraints.map(c => `  - ${c}`).join("\n")}` : "";

  const problemContext = `Problem: ${body.questionTitle} (${body.difficulty})
Tags: ${body.tags.join(", ")}

${body.questionDescription}

${examplesStr}${constraintsStr}`;

  const systemPrompt = body.type === "notes" ? ai.promptNotes : ai.promptCode;

  // Resolve base URL — supports OpenAI, DeepSeek, and custom
  let baseUrl = "https://api.openai.com/v1";
  if (ai.provider === "deepseek") baseUrl = "https://api.deepseek.com/v1";
  if (ai.baseUrl) baseUrl = ai.baseUrl.replace(/\/$/, "");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ai.apiKey}`,
      },
      body: JSON.stringify({
        model: ai.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: problemContext },
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `API error ${response.status}: ${err}` }, { status: 502 });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ result: text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
