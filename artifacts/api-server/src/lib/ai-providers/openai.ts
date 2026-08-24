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

    async editImage({ image, mimeType, prompt, model, size, quality, inputFidelity, background }: ImageEditRequest) {
      const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
      const imageFile = new File([new Uint8Array(image)], `image.${extension}`, { type: mimeType });
      const usesAlwaysHighFidelityModel = model === "gpt-image-2" || model.startsWith("gpt-image-2-");

      const result = await client.images.edit({
        model,
        image: imageFile,
        prompt,
        size: size ?? "auto",
        quality: quality ?? "high",
        background,
        // GPT Image 2 always uses high input fidelity and rejects attempts to
        // configure it. Older full-size GPT Image models default to low, so
        // explicitly request high fidelity for those models.
        ...(!usesAlwaysHighFidelityModel ? { input_fidelity: inputFidelity ?? "high" } : {}),
      });

      const b64 = result.data?.[0]?.b64_json;
      if (!b64) {
        throw new Error("No image data returned from OpenAI");
      }
      return { base64: b64 };
    },
  };
}
