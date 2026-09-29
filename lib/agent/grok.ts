const DEFAULT_MODEL = process.env.GROK_MODEL || "grok-4.7";
const REQUEST_TIMEOUT_MS = 10000;

type GrokResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  model?: string;
  error?: { message?: string };
};

export async function askGrok(
  prompt: string,
  system?: string
): Promise<{ text: string; model: string }> {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    throw new Error("XAI_API_KEY não configurada.");
  }

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2500,
    }),
  });

  const data = (await response.json()) as GrokResponse;

  if (!response.ok) {
    throw new Error(data.error?.message || `Grok respondeu HTTP ${response.status}.`);
  }

  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("Grok não retornou texto.");
  }

  return {
    text,
    model: data.model || DEFAULT_MODEL,
  };
}
