import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn("OPENAI_API_KEY is not set; generation endpoints will fail until it is provided.");
}

export function createOpenAIClient(apiKeyOverride?: string | null) {
  return new OpenAI({
    apiKey: apiKeyOverride ?? apiKey ?? "missing-openai-key",
  });
}

export const openai = createOpenAIClient();
