import { getSupabaseServer } from "../supabase/server";
import type { AgentPlan } from "./types";

export async function saveAgentTask(input: {
  objective: string;
  prompt: string;
  model: string;
  plan: AgentPlan;
  status: "planned" | "blocked" | "completed";
}) {
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("agent_tasks")
    .insert({
      objective: input.objective,
      prompt: input.prompt,
      model: input.model,
      plan: input.plan,
      status: input.status,
      current_step: 0,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Falha ao salvar tarefa no Supabase: ${error.message}`);
  return data.id as string;
}

export async function recordModelAttempt(input: {
  taskId: string;
  provider: string;
  model: string;
  status: "success" | "failed";
  error?: string;
}) {
  const supabase = getSupabaseServer();

  const { error } = await supabase.from("agent_model_attempts").insert({
    task_id: input.taskId,
    provider: input.provider,
    model: input.model,
    status: input.status,
    error_message: input.error || null,
  });

  if (error) throw new Error(`Falha ao registrar tentativa de modelo: ${error.message}`);
}

export async function listAgentTasks(limit = 30) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("agent_tasks")
    .select("id, objective, prompt, model, status, current_step, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Falha ao ler tarefas no Supabase: ${error.message}`);
  return data || [];
}

export async function listAgentEvents(limit = 50) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("agent_events")
    .select("id, task_id, event_type, message, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Falha ao ler eventos no Supabase: ${error.message}`);
  return data || [];
}

export async function recordAgentEvent(input: {
  taskId: string;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseServer();

  const { error } = await supabase.from("agent_events").insert({
    task_id: input.taskId,
    event_type: input.eventType,
    message: input.message,
    metadata: input.metadata || {},
  });

  if (error) throw new Error(`Falha ao registrar evento do agente: ${error.message}`);
}
