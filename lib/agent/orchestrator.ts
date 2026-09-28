import { randomUUID } from "crypto";
import { registryForPrompt } from "./tool-registry";
import type { AgentPlan, AgentResult } from "./types";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

function extractJson(text: string): AgentPlan {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!parsed || typeof parsed.objective !== "string" || !Array.isArray(parsed.steps)) {
    throw new Error("Claude retornou um plano em formato inválido.");
  }

  return {
    objective: parsed.objective,
    steps: parsed.steps.map((step: any) => ({
      id: typeof step.id === "string" ? step.id : randomUUID(),
      action: String(step.action || ""),
      tool: typeof step.tool === "string" ? step.tool : undefined,
      reason: String(step.reason || ""),
      requiresConfirmation: Boolean(step.requiresConfirmation),
    })),
    notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
  };
}

export async function planTask(prompt: string): Promise<AgentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
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
      max_tokens: 2500,
      system: [
        "Você é o planejador central do agente Augurio.",
        "Transforme a solicitação do usuário em um plano operacional mínimo e verificável.",
        "Não alegue execução de ações externas. Você está planejando, não executando.",
        "Use somente ferramentas presentes no Tool Registry.",
        "Se uma ferramenta estiver planned ou offline, marque a etapa como bloqueada por dependência e não invente que ela foi usada.",
        "A resposta DEVE ser somente JSON válido, sem markdown.",
        "",
        "Tool Registry:",
        registryForPrompt(),
        "",
        "Formato obrigatório:",
        '{"objective":"...","steps":[{"id":"1","action":"...","tool":"claude","reason":"...","requiresConfirmation":false}],"notes":["..."]}',
      ].join("\n"),
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Erro ao consultar Claude.");
  }

  const text = Array.isArray(data?.content)
    ? data.content
        .filter((block: { type?: string }) => block.type === "text")
        .map((block: { text?: string }) => block.text || "")
        .join("\n")
        .trim()
    : "";

  if (!text) {
    throw new Error("Claude não retornou um plano.");
  }

  const plan = extractJson(text);
  const blockers = plan.steps
    .filter((step) => step.tool && !["ready"].includes(requireStatus(step.tool)))
    .map((step) => `Ferramenta "${step.tool}" ainda não está operacional.`);

  return {
    objective: plan.objective,
    status: blockers.length ? "blocked" : "planned",
    plan,
    evidence: [
      `Plano gerado pelo modelo ${data?.model || MODEL}.`,
      "Nenhuma ação externa foi declarada como executada sem ferramenta operacional.",
    ],
    blockers: [...new Set(blockers)],
  };
}

function requireStatus(toolName: string): string {
  const status: Record<string, string> = {
    claude: "ready",
    github: "planned",
    web: "planned",
    files: "planned",
    supabase: "planned",
    "local-agent": "offline",
  };
  return status[toolName] || "offline";
}
