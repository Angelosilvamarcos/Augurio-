const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const FALLBACK_MODELS = [
  DEFAULT_MODEL,
  "gemini-3.7-flash",
  "gemini-3.5-flash-lite",
].filter((model, index, list) => list.indexOf(model) === index);

function wait(ms: number) {
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
              },
            }),
          }
        );

        const data = await response.json();

        if (response.ok) {
          const text = data?.candidates?.[0]?.content?.parts
            ?.map((part: { text?: string }) => part.text || "")
            .join("")
            .trim();

          if (!text) {
            throw new Error("Gemini não retornou texto.");
          }

          return {
            text,
            model: data?.modelVersion || model,
          };
        }

        lastError = data?.error?.message || `Erro Gemini HTTP ${response.status}.`;

        // 503/429 podem ser indisponibilidade/capacidade temporária.
        // Fazemos uma segunda tentativa antes de trocar de modelo.
        if (response.status === 503 || response.status === 429) {
          await wait(attempt === 0 ? 800 : 1600);
          continue;
        }

        throw new Error(lastError);
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;

        if (attempt === 0 && /high demand|overload|unavailable|503|429/i.test(lastError)) {
          await wait(800);
          continue;
        }

        break;
      }
    }
  }

  throw new Error(`Gemini indisponível após tentativas e modelos alternativos: ${lastError}`);
}
