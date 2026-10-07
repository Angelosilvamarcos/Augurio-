"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Brain, CheckCircle2, Database, Github, Globe, Settings, ShieldCheck, Wrench, Zap } from "lucide-react";

type Tab = "center" | "tasks" | "tools" | "memory" | "settings";

const toolInfo = [
  ["Claude", "Agente principal", "Conectado", "Modelo principal"],
  ["Gemini", "Fallback resiliente", "Configurado", "Teste de modelo"],
  ["GitHub", "Código e PRs", "Disponível", "Integração de código"],
  ["Web", "Pesquisa e navegação", "Disponível", "Pesquisa externa"],
  ["Arquivos", "Documentos e dados", "Local Agent", "Arquivos locais"],
  ["MCP", "Ferramentas externas", "Disponível", "Ferramentas conectadas"],
];

function formatResult(data: any): string {
  if (data?.response) return [data.status ? `Status: ${data.status}` : "", data.response].filter(Boolean).join("\n\n");
  if (!data?.plan) return "Augurio concluiu a etapa.";
  return [
    `Status: ${data.status}`, "",
    `Objetivo: ${data.objective}`, "",
    "Plano:",
    ...data.plan.steps.map((step: any, index: number) =>
      `${index + 1}. ${step.action}${step.tool ? ` [${step.tool}]` : ""}${step.requiresConfirmation ? " — confirmação necessária" : ""}`
    ),
    ...(data.blockers?.length ? ["", "Dependências:", ...data.blockers.map((x: string) => `• ${x}`)] : []),
  ].join("\n");
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("center");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [model, setModel] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  async function loadMemory() {
    setMemoryLoading(true);
    try {
      const r = await fetch("/api/tasks");
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Falha ao carregar memória.");
      setTasks(data.tasks || []);
      setEvents(data.events || []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha ao carregar memória.");
    } finally {
      setMemoryLoading(false);
    }
  }

  useEffect(() => { loadMemory(); }, []);

  async function run(provider: "auto" | "gemini" = "auto") {
    if (!prompt.trim() || running) return;
    setRunning(true); setMessage("Augurio está planejando a execução…"); setModel("");
    try {
      const response = await fetch("/api/agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, provider }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Falha na comunicação com o agente.");
      setMessage(formatResult(data));
      setModel(data?.model ? `Modelo: ${data.model}` : "Augurio Orchestrator");
      await loadMemory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally { setRunning(false); }
  }

  const nav = [
    ["center", "⌂ Command Center"], ["tasks", "◈ Tarefas"], ["tools", "◉ Ferramentas"],
    ["memory", "◎ Memória"], ["settings", "⚙ Configurações"],
  ] as const;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Augu<span>rio</span></div>
        <nav className="nav">
          {nav.map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => { setTab(id); if (id === "tasks" || id === "memory") loadMemory(); }}>{label}</button>)}
        </nav>
        <div style={{ height: 28 }} />
        <div className="status"><span className="dot" /> Núcleo online<br /><span style={{ marginLeft: 14 }}>Claude + Gemini configurados</span></div>
      </aside>

      <main className="main">
        <div className="top">
          <div>
            <div className="eyebrow">Agente adaptativo</div>
            <div className="title">{tab === "center" ? "O que você quer que eu faça?" : nav.find(x => x[0] === tab)?.[1].replace(/^[^ ]+ /, "")}</div>
            <div className="muted">{tab === "center" ? "Descreva a tarefa. O Model Router escolhe o modelo disponível e prepara a execução." : "Esta área agora está conectada ao núcleo do Augurio."}</div>
          </div>
          <ShieldCheck size={28} color="#69b7ff" />
        </div>

        {tab === "center" && <div className="grid">
          <section>
            <div className="card command">
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ex.: analise meu projeto, encontre o erro e prepare uma correção…" disabled={running} />
              <div className="actions">
                <div className="chips"><span className="chip"><Brain size={12}/> Planejar</span><span className="chip"><Zap size={12}/> Adaptar</span><span className="chip"><ShieldCheck size={12}/> Validar</span></div>
                <div style={{display:"flex",gap:8}}>
                  <button className="secondary" onClick={() => run("gemini")} disabled={running || !prompt.trim()}>Testar Gemini</button>
                  <button className="primary" onClick={() => run("auto")} disabled={running || !prompt.trim()}>{running ? "Consultando…" : "Executar"} <ArrowUpRight size={15}/></button>
                </div>
              </div>
            </div>
            {message && <div className="card" style={{marginTop:18}}><div className="eyebrow">{model || "Augurio"}</div><p style={{whiteSpace:"pre-wrap",lineHeight:1.65,marginBottom:0}}>{message}</p></div>}
          </section>
          <aside>
            <SystemStatus />
            <div className="card" style={{marginTop:18}}><h3>Tool Registry</h3><ToolGrid selectedTool={selectedTool} onSelect={setSelectedTool}/></div>
          </aside>
        </div>}

        {tab === "tasks" && <div className="card"><h3>Tarefas reais</h3>{memoryLoading ? <p>Carregando…</p> : tasks.length ? tasks.map(t => <div className="task" key={t.id}><span className="indicator done"/><div><b>{t.objective}</b><div className="muted" style={{fontSize:12}}>{t.status} · {t.model}</div></div><span className="muted" style={{fontSize:11}}>{new Date(t.created_at).toLocaleString("pt-BR")}</span></div>) : <p className="muted">Nenhuma tarefa registrada ainda.</p>}</div>}

        {tab === "memory" && <div className="grid"><section><div className="card"><h3>Memória do agente</h3><p className="muted">Eventos registrados no Supabase.</p>{events.length ? events.map(e => <div className="task" key={e.id}><span className="indicator done"/><div><b>{e.event_type}</b><div className="muted" style={{fontSize:12}}>{e.message}</div></div><span className="muted" style={{fontSize:11}}>{new Date(e.created_at).toLocaleString("pt-BR")}</span></div>) : <p className="muted">Nenhum evento registrado.</p>}</div></section><aside><SystemStatus/></aside></div>}

        {tab === "tools" && <div className="card"><h3>Tool Registry</h3><p className="muted">Clique em uma ferramenta para ver sua função.</p><ToolGrid selectedTool={selectedTool} onSelect={setSelectedTool}/>{selectedTool && <div className="card" style={{marginTop:18}}><b>{selectedTool}</b><p className="muted">{toolInfo.find(x => x[0] === selectedTool)?.[3]}</p></div>}</div>}

        {tab === "settings" && <div className="grid"><section><div className="card"><h3>Configurações</h3><div className="metric"><span>Gemini</span><b>Configurado</b></div><div className="metric"><span>Claude</span><b>Conectado</b></div><div className="metric"><span>Supabase</span><b>Memória ativa</b></div><p className="muted" style={{marginTop:18}}>As chaves secretas ficam no ambiente do servidor e não são exibidas aqui.</p></div></section><aside><SystemStatus/></aside></div>}
      </main>
    </div>
  );
}

function SystemStatus() {
  return <div className="card"><h3>Estado do sistema</h3><div className="metric"><span>Model Router</span><b>Ativo</b></div><div className="metric"><span>Claude</span><b>Conectado</b></div><div className="metric"><span>Gemini</span><b>Configurado</b></div><div className="metric"><span>GitHub</span><b>Disponível</b></div><div className="metric"><span>Supabase</span><b>Memória ativa</b></div></div>;
}

function ToolGrid({selectedTool,onSelect}:{selectedTool:string|null,onSelect:(x:string)=>void}) {
  const icons:any={Claude:Brain,Gemini:Zap,GitHub:Github,Web:Globe,Arquivos:Database,MCP:Wrench};
  return <div className="tools">{toolInfo.map(([a,b,c])=>{const I=icons[a];return <button className="tool" key={a} onClick={()=>onSelect(a)} style={{textAlign:"left",cursor:"pointer",border:"1px solid rgba(105,183,255,.15)"}}><I size={15}/><b>{a}</b><span>{b}</span><div style={{marginTop:8,color:"#69b7ff",fontSize:10}}>{c}</div></button>})}</div>;
}
