const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.6";
const REQUEST_TIMEOUT_MS = 12000;

type OpenAIResponse = {
  output_text?: string;
  model?: string;
  error?: { message?: string };
};

export async function askOpenAI(
  prompt: string,
  system?: string
): Promise<{ text: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      instructions: system,
      input: prompt,
      reasoning: { effort: "medium" },
      max_output_tokens: 2500,
    }),
  });

  const data = (await response.json()) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI respondeu HTTP ${response.status}.`);
  }

  const text = data.output_text?.trim();

  if (!text) {
    throw new Error("OpenAI não retornou texto.");
  }

  return {
    text,
    model: data.model || DEFAULT_MODEL,
  };
}
