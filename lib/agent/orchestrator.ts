import { randomUUID } from "crypto";
import { getTool, registryForPrompt } from "./tool-registry";
import { askGemini } from "./gemini";
import { askOpenAI } from "./openai";
import { askGrok } from "./grok";
import { askFreeLLMAPI, isFreeLLMAPIConfigured } from "./freellmapi";
import { executeGitHubStep } from "./github";
import type { AgentPlan, AgentResult } from "./types";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

type Provider = "auto" | "freellmapi" | "openai" | "claude" | "gemini" | "grok";

function parsePlan(text: string): AgentPlan {
  const cleaned = text
    .replace(/^\s*\`\`\`json\s*/i, "")
    .replace(/\s*\`\`\`\s*$/i, "")
    .trim();

  let parsed: unknown;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start < 0 || end <= start) {
      throw new Error("O modelo não retornou um plano JSON válido.");
    }

    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      throw new Error("O modelo retornou JSON inválido.");
    }
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { objective?: unknown }).objective !== "string" ||
    !Array.isArray((parsed as { steps?: unknown }).steps)
  ) {
    throw new Error("O modelo retornou um plano em formato inválido.");
  }

  const data = parsed as {
    objective: string;
    steps: unknown[];
    notes?: unknown;
  };

  return {
    objective: data.objective,
    steps: data.steps.map((item) => {
      const step = (item || {}) as Record<string, unknown>;

      return {
        id: typeof step.id === "string" ? step.id : randomUUID(),
        action: String(step.action || ""),
        tool: typeof step.tool === "string" ? step.tool : undefined,
        reason: String(step.reason || ""),
        requiresConfirmation: Boolean(step.requiresConfirmation),
        input:
          step.input && typeof step.input === "object"
            ? (step.input as Record<string, unknown>)
            : undefined,
      };
    }),
    notes: Array.isArray(data.notes) ? data.notes.map(String) : [],
  };
}

function getToolStatus(toolName: string): "ready" | "planned" | "offline" {
  return getTool(toolName)?.status || "offline";
}

async function askClaude(
  prompt: string,
  system: string
): Promise<{ text: string; model: string }> {
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
      model: CLAUDE_MODEL,
      max_tokens: 2500,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message || `Claude respondeu HTTP ${response.status}.`;
    throw new Error(message);
  }

  const text = Array.isArray(data?.content)
    ? data.content
        .filter((block: { type?: string }) => block.type === "text")
        .map((block: { text?: string }) => block.text || "")
        .join("\n")
        .trim()
    : "";

  if (!text) {
    throw new Error("Claude não retornou texto.");
  }

  return {
    text,
    model: data?.model || CLAUDE_MODEL,
  };
}

function buildSystemPrompt(): string {
  return [
    "Você é o planejador central do agente Augurio.",
    "Transforme a solicitação do usuário em um plano operacional mínimo e verificável.",
    "Não alegue execução de ações externas. Você está planejando, não executando.",
    "Use somente ferramentas presentes no Tool Registry.",
    "Se uma ferramenta estiver planned ou offline, marque a dependência e não invente que ela foi usada.",
    "A resposta deve ser somente JSON válido, sem markdown.",
    "",
    "Tool Registry:",
    registryForPrompt(),
    "",
    "Formato obrigatório:",
    '{"objective":"...","steps":[{"id":"1","action":"...","tool":"github","reason":"...","requiresConfirmation":false,"input":{"operation":"read_file","repository":"owner/repo","path":"README.md","ref":"main"}}],"notes":["..."]}',
  ].join("\n");
}

async function executeWithProvider(
  prompt: string,
  plan: AgentPlan,
  provider: Provider,
  modelUsed: string
): Promise<{ text: string; model: string }> {
  const executionSystem = [
    "Você é o executor do agente Augurio.",
    "O planejamento abaixo já foi feito. Agora execute intelectualmente a tarefa do usuário e entregue o resultado final.",
    "Não apenas descreva um plano. Resolva, calcule, analise ou produza o resultado solicitado.",
    "Se a tarefa exigir uma ferramenta externa que não esteja operacional, explique a limitação em vez de inventar execução.",
    "Mostre o raciocínio necessário de forma concisa e apresente uma resposta final clara.",
    "",
    `Tarefa do usuário: ${prompt}`,
    `Plano: ${JSON.stringify(plan)}`,
  ].join("\n");

  if (provider === "gemini") return askGemini(prompt + "\n\nExecute este plano e entregue o resultado final.", executionSystem);
  if (provider === "claude") return askClaude(prompt + "\n\nExecute este plano e entregue o resultado final.", executionSystem);
  if (provider === "openai") return askOpenAI(prompt + "\n\nExecute este plano e entregue o resultado final.", executionSystem);
  if (provider === "grok") return askGrok(prompt + "\n\nExecute este plano e entregue o resultado final.", executionSystem);
  if (provider === "freellmapi") return askFreeLLMAPI(prompt + "\n\nExecute este plano e entregue o resultado final.", executionSystem);

  const normalized = modelUsed.toLowerCase();
  if (normalized.includes("gemini")) return askGemini(prompt, executionSystem);
  if (normalized.includes("claude")) return askClaude(prompt, executionSystem);
  if (normalized.includes("grok")) return askGrok(prompt, executionSystem);
  if (normalized.includes("openai") || normalized.startsWith("gpt")) return askOpenAI(prompt, executionSystem);
  if (normalized.includes("freellmapi")) return askFreeLLMAPI(prompt, executionSystem);
  return askClaude(prompt, executionSystem);
}

export async function executeTask(
  prompt: string,
  plan: AgentPlan,
  provider: Provider,
  modelUsed: string
): Promise<{ text: string; model: string }> {
  const toolSteps = plan.steps.filter((step) => step.tool);

  for (const step of toolSteps) {
    if (step.tool === "github") {
      const result = await executeGitHubStep(step.input);
      return {
        text: [
          `Ferramenta GitHub executada: ${result.summary}`,
          "",
          result.text,
        ].join("\n"),
        model: "tool:github",
      };
    }

    const status = getToolStatus(step.tool as string);
    if (status !== "ready") {
      throw new Error(`A ferramenta "${step.tool}" ainda não está operacional.`);
    }
  }

  return executeWithProvider(prompt, plan, provider, modelUsed);
}

export async function planTask(
  prompt: string,
  provider: Provider = "auto"
): Promise<AgentResult> {
  const system = buildSystemPrompt();
  let text = "";
  let modelUsed = "";
  const attempts: string[] = [];

  if (
    (provider === "auto" || provider === "freellmapi") &&
    isFreeLLMAPIConfigured()
  ) {
    try {
      const result = await askFreeLLMAPI(prompt, system);
      text = result.text;
      modelUsed = `FreeLLMAPI → ${result.model}`;
      attempts.push(`FreeLLMAPI: sucesso (${result.model})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      attempts.push(`FreeLLMAPI: falhou — ${message}`);
      if (provider === "freellmapi") throw error;
    }
  }

  if (provider === "freellmapi" && !text) {
    throw new Error(
      "FreeLLMAPI não está configurado. Defina FREELLMAPI_BASE_URL e FREELLMAPI_API_KEY."
    );
  }

  if (!text && (provider === "auto" || provider === "openai")) {
    try {
      const result = await askOpenAI(prompt, system);
      text = result.text;
      modelUsed = result.model;
      attempts.push(`OpenAI: sucesso (${result.model})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      attempts.push(`OpenAI: falhou — ${message}`);
    }
  }

  if (!text && (provider === "auto" || provider === "claude")) {
    try {
      const result = await askClaude(prompt, system);
      text = result.text;
      modelUsed = result.model;
      attempts.push(`Claude: sucesso (${result.model})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      attempts.push(`Claude: falhou — ${message}`);
    }
  }

  if (!text && (provider === "auto" || provider === "grok")) {
    try {
      const result = await askGrok(prompt, system);
      text = result.text;
      modelUsed = result.model;
      attempts.push(`Grok: sucesso (${result.model})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      attempts.push(`Grok: falhou — ${message}`);
    }
  }

  if (!text && (provider === "auto" || provider === "gemini")) {
    try {
      const result = await askGemini(prompt, system);
      text = result.text;
      modelUsed = result.model;
      attempts.push(`Gemini: sucesso (${result.model})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      attempts.push(`Gemini: falhou — ${message}`);
    }
  }

  if (!text) {
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY && !process.env.XAI_API_KEY) {
      throw new Error(
        "Nenhum modelo configurado. Configure o FreeLLMAPI ou uma chave de provedor direto."
      );
    }

    throw new Error(
      `Nenhum modelo conseguiu gerar um plano. ${attempts.join(" | ")}`
    );
  }

  const plan = parsePlan(text);

  const blockers = plan.steps
    .filter(
      (step) => Boolean(step.tool) && getToolStatus(step.tool as string) !== "ready"
    )
    .map(
      (step) =>
        `Ferramenta "${step.tool}" ainda não está operacional.`
    );

  return {
    objective: plan.objective,
    status: blockers.length ? "blocked" : "planned",
    model: modelUsed,
    plan,
    evidence: [
      `Plano gerado pelo modelo ${modelUsed}.`,
      ...attempts,
      "Nenhuma ação externa foi declarada como executada sem ferramenta operacional.",
    ],
    blockers: [...new Set(blockers)],
  };
}
