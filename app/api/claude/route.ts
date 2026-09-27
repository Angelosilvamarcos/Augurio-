import { NextResponse } from "next/server";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Claude não está configurado. Adicione ANTHROPIC_API_KEY nas variáveis de ambiente." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "Informe uma tarefa para o Augurio." }, { status: 400 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system:
          "Você é o Claude, modelo principal do Augurio. Ajude a planejar e executar tarefas com clareza. " +
          "Não alegue ter executado ações externas sem evidência. Quando uma ferramenta ainda não estiver conectada, " +
          "explique isso e proponha o próximo passo.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Erro ao consultar a API do Claude." },
        { status: response.status }
      );
    }

    const text = Array.isArray(data?.content)
      ? data.content
          .filter((block: { type?: string }) => block.type === "text")
          .map((block: { text?: string }) => block.text || "")
          .join("\n")
          .trim()
      : "";

    return NextResponse.json({
      model: data?.model || MODEL,
      response: text || "Claude retornou uma resposta sem texto.",
      requestId: data?.id || null,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível comunicar com o Claude agora." },
      { status: 500 }
    );
  }
}
