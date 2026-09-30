import type { ModelResponse } from "./types";

const DEFAULT_BASE_URL = "http://localhost:3001";
const DEFAULT_MODEL = "auto:smart";

export function isFreeLLMAPIConfigured(): boolean {
  return Boolean(
    process.env.FREELLMAPI_API_KEY && process.env.FREELLMAPI_BASE_URL
  );
}

export async function askFreeLLMAPI(
  prompt: string,
  system: string
): Promise<{ text: string; model: string }> {
  const apiKey = process.env.FREELLMAPI_API_KEY;
  const baseUrl = process.env.FREELLMAPI_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.FREELLMAPI_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error("FREELLMAPI_API_KEY não configurada.");
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2500,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `FreeLLMAPI respondeu HTTP ${response.status}.`;
    throw new Error(message);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("FreeLLMAPI não retornou texto.");
  }

  return {
    text: text.trim(),
    model:
      data?.model ||
      response.headers.get("x-routed-via") ||
      model,
  };
}
