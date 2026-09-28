import { randomUUID } from "crypto";
import { registryForPrompt } from "./tool-registry";
import { askGemini } from "./gemini";
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

  const system = [
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
  ].join("\n");

  let text = "";
  let modelUsed = "";

  if (apiKey) {
    try {
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
          system,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();

      if (response.ok) {
        text = Array.isArray(data?.content)
          ? data.content
              .filter((block: { type?: string }) => block.type === "text")
              .map((block: { text?: string }) => block.text || "")
              .join("\n")
              .trim()
          : "";
        modelUsed = data?.model || MODEL;
      }
    } catch {
      // Fallback to Gemini below.
    }
  }

  if (!text && process.env.GEMINI_API_KEY) {
    const result = await askGemini(prompt, system);
    text = result.text;
    modelUsed = result.model;
  }

  if (!text) {
    if (!apiKey && !process.env.GEMINI_API_KEY) {
      throw new Error("Nenhum modelo configurado. Adicione ANTHROPIC_API_KEY ou GEMINI_API_KEY.");
    }
    throw new Error("Os modelos configurados não retornaram um plano.");
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
      `Plano gerado pelo modelo ${modelUsed}.`,
      "Nenhuma ação externa foi declarada como executada sem ferramenta operacional.",
    ],
    blockers: [...new Set(blockers)],
  };
}

