import { NextResponse } from "next/server";
import { askSecondaryModel } from "../../../lib/agent/model-router";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "Informe uma solicitação." }, { status: 400 });
    }

    const result = await askSecondaryModel(prompt);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar Gemini.";
    const status = message.includes("GEMINI_API_KEY") ? 503 : 502;

    return NextResponse.json({ error: message }, { status });
  }
}
