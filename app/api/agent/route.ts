import { NextResponse } from "next/server";
import { planTask } from "../../../lib/agent/orchestrator";
import { saveAgentTask, recordAgentEvent } from "../../../lib/agent/memory";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const provider =
      body?.provider === "claude" || body?.provider === "gemini"
        ? body.provider
        : "auto";

    if (!prompt) {
      return NextResponse.json(
        { error: "Informe uma tarefa para o Augurio." },
        { status: 400 }
      );
    }

    const result = await planTask(prompt, provider);

    let taskId: string | null = null;

    if (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        taskId = await saveAgentTask({
          objective: result.objective,
          prompt,
          model: result.model,
          plan: result.plan,
          status: result.status,
        });

        await recordAgentEvent({
          taskId,
          eventType: "plan_created",
          message: `Plano criado pelo modelo ${result.model}.`,
          metadata: { provider, blockers: result.blockers },
        });
      } catch (memoryError) {
        const memoryMessage =
          memoryError instanceof Error ? memoryError.message : "Falha desconhecida de memória.";
        result.evidence = [...result.evidence, `Memória Supabase: falhou — ${memoryMessage}`];
      }
    }

    return NextResponse.json({ ...result, taskId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado no Orchestrator.";

    const status = message.includes("não configurada") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
