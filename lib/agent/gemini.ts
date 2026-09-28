const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

export async function askGemini(prompt: string, system?: string): Promise<{ text: string; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Erro ao consultar a API Gemini.");
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini não retornou texto.");
  }

  return {
    text,
    model: data?.modelVersion || MODEL,
  };
}
