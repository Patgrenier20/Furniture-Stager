import OpenAI from "openai";
import type { AiProviderAdapter, TextGenerationRequest, ImageEditRequest } from "./types";

export function createOpenAIAdapter(apiKey: string): AiProviderAdapter {
  const client = new OpenAI({ apiKey });

  return {
    name: "openai",
    supportsImageEditing: true,

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
        throw new Error("No content returned from OpenAI");
      }
      return content;
    },

    async editImage({ image, prompt, model, size }: ImageEditRequest) {
      const imageFile = new File([new Uint8Array(image)], "image.png", { type: "image/png" });

      const result = await client.images.edit({
        model,
        image: imageFile,
        prompt,
        size: (size as "1024x1024" | "1536x1024" | "1024x1536" | "auto" | undefined) ?? "1024x1024",
      });

      const b64 = result.data?.[0]?.b64_json;
      if (!b64) {
        throw new Error("No image data returned from OpenAI");
      }
      return { base64: b64 };
    },
  };
}
