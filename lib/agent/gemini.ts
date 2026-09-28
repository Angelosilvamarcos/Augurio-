const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const FALLBACK_MODELS = [
  DEFAULT_MODEL,
  "gemini-3.7-flash",
  "gemini-3.6-flash",
].filter((model, index, list) => list.indexOf(model) === index);

const REQUEST_TIMEOUT_MS = 2500;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  modelVersion?: string;
  error?: {
    message?: string;
  };
};

export async function askGemini(
  prompt: string,
  system?: string
): Promise<{ text: string; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }

  let lastError = "Erro ao consultar a API Gemini.";

  for (const model of FALLBACK_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          body: JSON.stringify({
            systemInstruction: system
              ? { parts: [{ text: system }] }
              : undefined,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 2500,
              temperature: 0.2,
            },
          }),
        }
      );

      const data = (await response.json()) as GeminiResponse;

      if (response.ok) {
        const text = (data.candidates?.[0]?.content?.parts || [])
          .map((part) => part.text || "")
          .join("")
          .trim();

        if (text) {
          return {
            text,
            model: data.modelVersion || model,
          };
        }

        lastError = "Gemini não retornou texto.";
      } else {
        lastError =
          data.error?.message || `Erro Gemini HTTP ${response.status}.`;
      }

      // Um modelo indisponível não deve travar a tarefa.
      // O Router passa imediatamente ao próximo modelo.
      if (response.status === 429 || response.status === 503) {
        continue;
      }

      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      // Timeout, indisponibilidade de rede ou erro transitório:
      // tenta o próximo modelo sem bloquear a execução.
      continue;
    }
  }

  throw new Error(
    `Gemini indisponível após testar ${FALLBACK_MODELS.join(", ")}: ${lastError}`
  );
}
