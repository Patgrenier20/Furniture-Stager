import { GoogleGenAI } from "@google/genai";
import type { AiProviderAdapter, TextGenerationRequest, ImageEditRequest } from "./types";

/**
 * Google is the one provider besides OpenAI that can genuinely do
 * text-and-image-to-image editing today, via Gemini's "image" model family
 * (e.g. gemini-2.5-flash-image, gemini-3.1-flash-image). Confirmed against
 * https://ai.google.dev/gemini-api/docs/generate-content/image-generation:
 * you pass the source image as an inlineData part alongside a text prompt
 * in the same generateContent call used for plain text, and the edited
 * image comes back as an inlineData part in the response rather than a
 * separate endpoint/method the way OpenAI splits images.edit from
 * chat.completions.
 *
 * generateContent has no explicit "size" control the way OpenAI's
 * images.edit does, so ImageEditRequest.size is accepted for interface
 * compatibility but has no effect here.
 */
export function createGoogleAdapter(apiKey: string): AiProviderAdapter {
  const ai = new GoogleGenAI({ apiKey });

  return {
    name: "google",
    supportsImageEditing: true,

    async generateText({ systemPrompt, userPrompt, model, jsonResponse }: TextGenerationRequest) {
      const contents = jsonResponse
        ? `${systemPrompt}\n\n${userPrompt}\n\nRespond with a single valid JSON object only -- no markdown code fences, no commentary before or after it.`
        : `${systemPrompt}\n\n${userPrompt}`;

      const response = await ai.models.generateContent({ model, contents });
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const textPart = parts.find((part) => typeof part.text === "string" && part.text.length > 0);

      if (!textPart?.text) {
        throw new Error("No text content returned from Google");
      }
      return textPart.text;
    },

    async editImage({ image, mimeType, prompt, model }: ImageEditRequest) {
      const contents = [{ text: prompt }, { inlineData: { mimeType, data: image.toString("base64") } }];

      const response = await ai.models.generateContent({ model, contents });
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((part) => !!part.inlineData?.data);

      if (!imagePart?.inlineData?.data) {
        throw new Error("No image data returned from Google");
      }
      return { base64: imagePart.inlineData.data };
    },
  };
}
