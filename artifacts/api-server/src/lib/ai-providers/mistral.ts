import OpenAI from "openai";
import type { AiProviderAdapter, TextGenerationRequest } from "./types";
import { ProviderCapabilityError } from "./types";

/**
 * Mistral's La Plateforme chat completions endpoint follows the same wire
 * format as OpenAI's Chat Completions API -- the official migration guide
 * (docs.mistral.ai/resources/migration-guides) confirms it's a base-URL and
 * model-name swap, no different client needed. See
 * https://docs.mistral.ai/api/endpoint/chat.
 *
 * Mistral has no image generation or editing API. editImage throws a
 * capability error so callers get a clear message instead of a confusing
 * 404/400 from a nonexistent endpoint.
 */
export function createMistralAdapter(apiKey: string): AiProviderAdapter {
  const client = new OpenAI({ apiKey, baseURL: "https://api.mistral.ai/v1" });

  return {
    name: "mistral",
    supportsImageEditing: false,

    async generateText({ systemPrompt, userPrompt, model, maxTokens, jsonResponse }: TextGenerationRequest) {
      const completion = await client.chat.completions.create({
        model,
        max_tokens: maxTokens ?? 600,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        ...(jsonResponse ? { response_format: { type: "json_object" as const } } : {}),
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content returned from Mistral");
      }
      return content;
    },

    async editImage() {
      throw new ProviderCapabilityError("mistral", "editImage");
    },
  };
}
