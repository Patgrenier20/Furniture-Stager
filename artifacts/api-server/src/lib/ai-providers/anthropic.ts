import Anthropic from "@anthropic-ai/sdk";
import type { AiProviderAdapter, TextGenerationRequest } from "./types";
import { ProviderCapabilityError } from "./types";

/**
 * Anthropic's own documentation is explicit: "Claude is an image
 * understanding model only. It can interpret and analyze images, but it
 * cannot generate, produce, edit, manipulate, or create images." There is
 * no image API to call here at all, so editImage always throws a
 * capability error -- this isn't a gap in this adapter, it's a real gap in
 * what Claude can do.
 *
 * Unlike OpenAI's Chat Completions, the Messages API has no
 * response_format / JSON-mode parameter, so structured output relies on
 * prompting Claude to return bare JSON. Claude fairly often wraps that in
 * a ```json code fence anyway; routes/ads.ts strips that defensively via
 * stripJsonCodeFence before parsing.
 */
export function createAnthropicAdapter(apiKey: string): AiProviderAdapter {
  const client = new Anthropic({ apiKey });

  return {
    name: "anthropic",
    supportsImageEditing: false,

    async generateText({ systemPrompt, userPrompt, model, maxTokens, jsonResponse }: TextGenerationRequest) {
      const prompt = jsonResponse
        ? `${userPrompt}\n\nRespond with a single valid JSON object only -- no markdown code fences, no commentary before or after it.`
        : userPrompt;

      const message = await client.messages.create({
        model,
        max_tokens: maxTokens ?? 600,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = message.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content returned from Anthropic");
      }
      return textBlock.text;
    },

    async editImage() {
      throw new ProviderCapabilityError("anthropic", "editImage");
    },
  };
}
