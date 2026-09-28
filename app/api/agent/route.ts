import { NextResponse } from "next/server";
import { planTask } from "../../../lib/agent/orchestrator";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";\n    const provider = body?.provider === "claude" || body?.provider === "gemini" ? body.provider : "auto";

    if (!prompt) {
      return NextResponse.json(
        { error: "Informe uma tarefa para o Augurio." },
        { status: 400 }
      );
    }

    const result = await planTask(prompt, provider);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado no Orchestrator.";

    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
