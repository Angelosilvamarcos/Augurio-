export type ToolPermission = "read" | "write" | "sensitive";

export type ToolStatus = "ready" | "planned" | "offline";

export interface ToolDefinition {
  name: string;
  description: string;
  permission: ToolPermission;
  status: ToolStatus;
  requiresConfirmation?: boolean;
}

export interface AgentStep {
  id: string;
  action: string;
  tool?: string;
  reason: string;
  requiresConfirmation: boolean;
}

export interface AgentPlan {
  objective: string;
  steps: AgentStep[];
  notes?: string[];
}

export interface AgentResult {
  objective: string;
  status: "planned" | "blocked" | "completed";\n  model: string;
  plan: AgentPlan;
  evidence: string[];
  blockers: string[];
}
