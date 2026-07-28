/**
 * Shared contract every AI provider adapter implements, so routes/images.ts
 * and routes/ads.ts can call a user's chosen provider without knowing
 * anything about that provider's actual SDK or wire format.
 *
 * Not every provider can do everything -- Anthropic, xAI, and Mistral have
 * no image-editing API today (confirmed against each provider's current
 * docs; see resolve.ts and each adapter file for specifics), so
 * `supportsImageEditing` lets callers check before attempting a capability
 * a provider simply doesn't have, and editImage() throws
 * ProviderCapabilityError for adapters where it's false, rather than
 * silently doing something unexpected.
 */

export type ProviderName = "openai" | "anthropic" | "google" | "xai" | "mistral";

export const PROVIDER_NAMES: readonly ProviderName[] = ["openai", "anthropic", "google", "xai", "mistral"];

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  mistral: "Mistral",
};

/**
 * Whether a provider can do image editing at all, independent of whether
 * the current user has a key configured for it. Checking this before
 * resolving a key (see routes/images.ts) means a user who picks a
 * provider with no image API gets "Anthropic doesn't support image
 * editing" instead of the less useful "add your Anthropic API key" --
 * they'd still hit the same wall after adding one.
 */
export const PROVIDER_SUPPORTS_IMAGE_EDITING: Record<ProviderName, boolean> = {
  openai: true,
  anthropic: false,
  google: true,
  xai: false,
  mistral: false,
};

export interface TextGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens?: number;
  /** Ask the provider to return a JSON object with no surrounding prose. */
  jsonResponse?: boolean;
}

export interface ImageEditRequest {
  image: Buffer;
  mimeType: string;
  prompt: string;
  model: string;
  /** Only meaningful to providers with explicit size controls; others ignore it. */
  size?: string;
}

export interface AiProviderAdapter {
  name: ProviderName;
  supportsImageEditing: boolean;
  generateText(req: TextGenerationRequest): Promise<string>;
  editImage(req: ImageEditRequest): Promise<{ base64: string }>;
}

export class ProviderCapabilityError extends Error {
  constructor(
    public readonly provider: ProviderName,
    public readonly capability: "editImage",
  ) {
    super(`${provider} does not support ${capability}`);
    this.name = "ProviderCapabilityError";
  }
}

export class MissingProviderKeyError extends Error {
  constructor(public readonly provider: ProviderName) {
    super(`missing_${provider}_key`);
    this.name = "MissingProviderKeyError";
  }
}

/** Strips ```json / ``` code fences some providers wrap JSON responses in
 * despite being asked for a bare JSON object (Anthropic and Gemini both do
 * this more often than OpenAI does). Safe to run on already-bare JSON. */
export function stripJsonCodeFence(content: string): string {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1] : trimmed;
}
