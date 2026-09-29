import type { ToolDefinition } from "./types";

const registry: ToolDefinition[] = [
  {
    name: "claude",
    description: "Raciocínio, planejamento, análise e síntese.",
    permission: "read",
    status: "ready",
  },
  {
    name: "grok",
    description: "Modelo adicional para raciocínio, continuidade e recuperação.",
    permission: "read",
    status: "ready",
  },
  {
    name: "gemini",
    description: "Modelo secundário para continuidade e recuperação.",
    permission: "read",
    status: "ready",
  },
  {
    name: "github",
    description: "Ler e modificar repositórios, branches, commits e pull requests.",
    permission: "write",
    status: "planned",
    requiresConfirmation: true,
  },
  {
    name: "web",
    description: "Pesquisar informações públicas e consultar páginas.",
    permission: "read",
    status: "planned",
  },
  {
    name: "files",
    description: "Ler, analisar e organizar arquivos disponibilizados ao agente.",
    permission: "read",
    status: "planned",
  },
  {
    name: "supabase",
    description: "Persistir memória, tarefas, eventos e estado operacional.",
    permission: "write",
    status: "planned",
  },
  {
    name: "local-agent",
    description: "Executar ações no computador através de uma ponte local segura.",
    permission: "sensitive",
    status: "offline",
    requiresConfirmation: true,
  },
];

export function listTools(): ToolDefinition[] {
  return registry.map((tool) => ({ ...tool }));
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.find((tool) => tool.name === name);
}

export function getReadyTools(): ToolDefinition[] {
  return registry.filter((tool) => tool.status === "ready");
}

export function registryForPrompt(): string {
  return registry
    .map(
      (tool) =>
        `- ${tool.name}: ${tool.description} | status=${tool.status} | permission=${tool.permission} | confirmation=${Boolean(tool.requiresConfirmation)}`
    )
    .join("\n");
}
