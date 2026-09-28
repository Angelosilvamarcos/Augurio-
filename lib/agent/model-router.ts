import { askGemini } from "./gemini";

export type ModelProvider = "claude" | "gemini";

export interface ModelResponse {
  provider: ModelProvider;
  model: string;
  text: string;
}

export async function askSecondaryModel(
  prompt: string,
  system?: string
): Promise<ModelResponse> {
  const result = await askGemini(prompt, system);

  return {
    provider: "gemini",
    model: result.model,
    text: result.text,
  };
}

export function getModelStatus() {
  return {
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    primary: "claude",
    secondary: "gemini",
  };
}
