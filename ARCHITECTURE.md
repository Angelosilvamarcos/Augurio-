# Augurio Architecture

## Core
- Next.js web application
- Orchestrator: task intake, planning, execution loop, validation and recovery
- Model Gateway: FreeLLMAPI as the preferred multi-provider router, with direct provider fallback for resilience
- Tool Registry: typed capabilities with permissions, timeout, retry and audit metadata
- Memory: task context and durable preferences through Supabase in the next phase
- Local Agent: future secure bridge for browser, files and terminal

## Execution contract
1. Understand task
2. Build minimal plan
3. Select relevant tools/models
4. Execute steps
5. Validate outputs
6. Retry or replan on failure
7. Ask confirmation for sensitive actions
8. Return evidence-backed result

## Safety
The web UI never claims local computer access unless a Local Agent is connected and authorized. Secrets live only in deployment environment variables.
