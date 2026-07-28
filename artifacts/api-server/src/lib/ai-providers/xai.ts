import OpenAI from "openai";
import type { AiProviderAdapter, TextGenerationRequest } from "./types";
import { ProviderCapabilityError } from "./types";

/**
 * xAI's chat completions endpoint is wire-compatible with the OpenAI SDK --
 * same client, same request/response shapes, just a different base URL and
 * key. See https://docs.x.ai/developers/quickstart.
 *
 * xAI does have image generation (grok-imagine models) behind
 * /v1/images/generations, but as of this writing that's confirmed to be
 * text-to-image only. Documentation on an image *editing* endpoint
 * (feeding in an existing image, not just a text prompt) is inconsistent
 * across sources and no stable, confirmed request shape exists in xAI's
 * own docs.x.ai reference. Rather than ship an image-editing integration
 * against an unconfirmed API, editImage throws a capability error here --
 * this can be added once xAI documents a stable, OpenAI-compatible
 * images.edit-equivalent endpoint.
 */
export function createXaiAdapter(apiKey: string): AiProviderAdapter {
  const client = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });

  return {
    name: "xai",
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
        throw new Error("No content returned from xAI");
      }
      return content;
    },

    async editImage() {
      throw new ProviderCapabilityError("xai", "editImage");
    },
  };
}
