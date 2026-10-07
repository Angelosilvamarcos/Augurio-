import { NextResponse } from "next/server";
import { listAgentEvents, listAgentTasks } from "../../../lib/agent/memory";

export async function GET() {
  try {
    const [tasks, events] = await Promise.all([
      listAgentTasks(50),
      listAgentEvents(100),
    ]);
    return NextResponse.json({ tasks, events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar memória.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
