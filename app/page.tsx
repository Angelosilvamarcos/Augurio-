"use client";
import { useState } from "react";
import { ArrowUpRight, Brain, ShieldCheck, Zap } from "lucide-react";

const tasks = [
  ["Analisar projeto Augurio", "Planejando", "Agora", false],
  ["Estruturar integração Claude", "Concluída", "Hoje", true],
  ["Preparar arquitetura Gemini", "Concluída", "Hoje", true],
  ["Criar Tool Registry", "Aguardando", "Hoje", false],
];

const tools = [
  ["Claude", "Agente principal", "Conectado"],
  ["Gemini", "Fallback resiliente", "Configurado"],
  ["GitHub", "Código e PRs", "Disponível"],
  ["Web", "Pesquisa e navegação", "Disponível"],
  ["Arquivos", "Documentos e dados", "Local Agent"],
  ["MCP", "Ferramentas externas", "Disponível"],
];

function formatResult(data: any): string {
  if (!data?.plan) return data?.response || "Augurio concluiu a etapa.";
  const lines = [
    `Status: ${data.status}`,
    "",
    `Objetivo: ${data.objective}`,
    "",
    "Plano:",
    ...data.plan.steps.map((step: any, index: number) =>
      `${index + 1}. ${step.action}${step.tool ? ` [${step.tool}]` : ""}${step.requiresConfirmation ? " — confirmação necessária" : ""}`
    ),
  ];
  if (data.blockers?.length) {
    lines.push("", "Dependências:", ...data.blockers.map((item: string) => `• ${item}`));
  }
  return lines.join("\n");
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [model, setModel] = useState("");

  async function run(provider: "auto" | "gemini" = "auto") {
    if (!prompt.trim() || running) return;

    setRunning(true);
    setMessage("Augurio está planejando a execução…");
    setModel("");

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, provider }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Falha na comunicação com Claude.");
      }

      setMessage(formatResult(data));
      setModel(data?.model ? `Modelo: ${data.model}` : "Augurio Orchestrator");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Augu<span>rio</span></div>
        <nav className="nav">
          <button className="active">⌂ Command Center</button>
          <button>◈ Tarefas</button>
          <button>◉ Ferramentas</button>
          <button>◎ Memória</button>
          <button>⚙ Configurações</button>
        </nav>
        <div style={{ height: 28 }} />
        <div className="status">
          <span className="dot" /> Núcleo online<br />
          <span style={{ marginLeft: 14 }}>Claude + Gemini configurados</span>
        </div>
      </aside>

      <main className="main">
        <div className="top">
          <div>
            <div className="eyebrow">Agente adaptativo</div>
            <div className="title">O que você quer que eu faça?</div>
            <div className="muted">
              Descreva a tarefa. O Model Router escolhe o modelo disponível e prepara a próxima etapa de execução.
            </div>
          </div>
          <ShieldCheck size={28} color="#69b7ff" />
        </div>

        <div className="grid">
          <section>
            <div className="card command">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex.: analise meu projeto, encontre o erro e prepare uma correção…"
                disabled={running}
              />
              <div className="actions">
                <div className="chips">
                  <span className="chip"><Brain size={12} /> Planejar</span>
                  <span className="chip"><Zap size={12} /> Adaptar</span>
                  <span className="chip"><ShieldCheck size={12} /> Validar</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="secondary" onClick={() => run("gemini")} disabled={running || !prompt.trim()}>
                    Testar Gemini
                  </button>
                  <button className="primary" onClick={() => run("auto")} disabled={running || !prompt.trim()}>
                    {running ? "Consultando…" : "Executar"} <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>
            </div>

            {message && (
              <div className="card" style={{ marginTop: 18 }}>
                <div className="eyebrow">{model || "Augurio"}</div>
                <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, marginBottom: 0 }}>{message}</p>
              </div>
            )}

            <div className="card" style={{ marginTop: 18 }}>
              <h3>Atividade recente</h3>
              {tasks.map((t, i) => (
                <div className="task" key={i}>
                  <span className={"indicator " + (t[3] ? "done" : "wait")} />
                  <div>
                    <b>{t[0]}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{t[1]}</div>
                  </div>
                  <span className="muted" style={{ fontSize: 11 }}>{t[2]}</span>
                </div>
              ))}
            </div>
          </section>

          <aside>
            <div className="card">
              <h3>Estado do sistema</h3>
              <div className="metric"><span>Model Router</span><b>Ativo</b></div>
              <div className="metric"><span>Claude</span><b>Conectado</b></div>
              <div className="metric"><span>Gemini</span><b>Configurado</b></div>
              <div className="metric"><span>GitHub</span><b>Disponível</b></div>
              <div className="metric"><span>Local Agent</span><span className="muted">Offline</span></div>
            </div>

            <div className="card" style={{ marginTop: 18 }}>
              <h3>Tool Registry</h3>
              <div className="tools">
                {tools.map(([a, b, c]) => (
                  <div className="tool" key={a}>
                    <b>{a}</b>
                    <span>{b}</span>
                    <div style={{ marginTop: 8, color: "#69b7ff", fontSize: 10 }}>{c}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
