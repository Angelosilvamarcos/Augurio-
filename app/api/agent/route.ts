import { NextResponse } from "next/server";
import { planTask } from "../../../lib/agent/orchestrator";
import { saveAgentTask, recordAgentEvent, recordModelAttempt } from "../../../lib/agent/memory";
import { executeTask } from "../../../lib/agent/orchestrator";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const provider =
      body?.provider === "freellmapi" || body?.provider === "openai" || body?.provider === "claude" || body?.provider === "gemini" || body?.provider === "grok"
        ? body.provider
        : "auto";

    if (!prompt) {
      return NextResponse.json(
        { error: "Informe uma tarefa para o Augurio." },
        { status: 400 }
      );
    }

    const result = await planTask(prompt, provider);

    let execution: { text: string; model: string } | null = null;
    if (result.status !== "blocked") {
      try {
        execution = await executeTask(prompt, result.plan, provider, result.model);
        result.status = "completed";
        result.evidence = [...result.evidence, `Execução concluída pelo modelo ${execution.model}.`];
      } catch (executionError) {
        const message = executionError instanceof Error ? executionError.message : "Falha na execução.";
        result.evidence = [...result.evidence, `Execução falhou: ${message}`];
      }
    }

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

        await recordModelAttempt({
          taskId,
          provider,
          model: result.model,
          status: execution ? "success" : "failed",
          error: execution ? undefined : result.evidence.at(-1),
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

    return NextResponse.json({ ...result, response: execution?.text || null, executionModel: execution?.model || null, taskId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado no Orchestrator.";

    const status = message.includes("não configurada") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
