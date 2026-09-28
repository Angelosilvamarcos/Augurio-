const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const FALLBACK_MODELS = [
  DEFAULT_MODEL,
  "gemini-3.7-flash",
  "gemini-3.6-flash",
].filter((model, index, list) => list.indexOf(model) === index);

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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-goog-api-key": apiKey,
            },
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

        if (response.status === 429 || response.status === 503) {
          await wait(attempt === 0 ? 800 : 1600);
          continue;
        }

        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;

        if (
          attempt === 0 &&
          /high demand|overload|unavailable|timeout|503|429/i.test(lastError)
        ) {
          await wait(800);
          continue;
        }

        break;
      }
    }
  }

  throw new Error(
    `Gemini indisponível após tentar ${FALLBACK_MODELS.join(", ")}: ${lastError}`
  );
}
