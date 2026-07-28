import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decryptSecret } from "../crypto";
import { createOpenAIAdapter } from "./openai";
import { createAnthropicAdapter } from "./anthropic";
import { createGoogleAdapter } from "./google";
import { createXaiAdapter } from "./xai";
import { createMistralAdapter } from "./mistral";
import {
  MissingProviderKeyError,
  ProviderCapabilityError,
  PROVIDER_NAMES,
  PROVIDER_SUPPORTS_IMAGE_EDITING,
  type AiProviderAdapter,
  type ProviderName,
} from "./types";

const KEY_COLUMN_BY_PROVIDER = {
  openai: "openaiApiKey",
  anthropic: "anthropicApiKey",
  google: "googleApiKey",
  xai: "xaiApiKey",
  mistral: "mistralApiKey",
} as const satisfies Record<ProviderName, keyof typeof usersTable.$inferSelect>;

const ADAPTER_FACTORY: Record<ProviderName, (apiKey: string) => AiProviderAdapter> = {
  openai: createOpenAIAdapter,
  anthropic: createAnthropicAdapter,
  google: createGoogleAdapter,
  xai: createXaiAdapter,
  mistral: createMistralAdapter,
};

/** Per-provider fallback keys the server operator can configure, mirroring
 * the existing OPENAI_API_KEY pattern -- used when a user hasn't added
 * their own key for whichever provider they've selected. */
const ENV_FALLBACK_BY_PROVIDER: Record<ProviderName, string | undefined> = {
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_API_KEY,
  xai: process.env.XAI_API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
};

function normalizeProvider(value: string | null | undefined): ProviderName {
  return (PROVIDER_NAMES as readonly string[]).includes(value ?? "") ? (value as ProviderName) : "openai";
}

/**
 * Resolves the AI provider adapter and model names to use for a given
 * user, based on their Account & AI settings (modelProvider, textModel,
 * imageModel) -- this is the piece that was missing before: those settings
 * were stored and shown in the UI, but nothing on the server ever read
 * them, so every request went to OpenAI regardless of what a user
 * configured. Falls back to "openai" for any unrecognized/unset provider
 * value, matching the schema's own default.
 *
 * Throws MissingProviderKeyError if neither the user's own (decrypted) key
 * nor a server-wide fallback env var is available for the selected
 * provider -- callers should catch this and surface a clear
 * "add your <Provider> API key" message (see routes/images.ts,
 * routes/ads.ts).
 */
export async function resolveProviderForUser(
  userId: number,
  options: { requireImageEditing?: boolean } = {},
): Promise<{
  adapter: AiProviderAdapter;
  textModel: string;
  imageModel: string;
}> {
  const [user] = await db
    .select({
      modelProvider: usersTable.modelProvider,
      textModel: usersTable.textModel,
      imageModel: usersTable.imageModel,
      openaiApiKey: usersTable.openaiApiKey,
      anthropicApiKey: usersTable.anthropicApiKey,
      googleApiKey: usersTable.googleApiKey,
      xaiApiKey: usersTable.xaiApiKey,
      mistralApiKey: usersTable.mistralApiKey,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const provider = normalizeProvider(user?.modelProvider);

  // Check capability before requiring a key: a provider that can't do image
  // editing at all can't do it regardless of whether a key is configured,
  // so that's the more useful error to surface first.
  if (options.requireImageEditing && !PROVIDER_SUPPORTS_IMAGE_EDITING[provider]) {
    throw new ProviderCapabilityError(provider, "editImage");
  }

  const keyColumn = KEY_COLUMN_BY_PROVIDER[provider];
  const encryptedKey = user?.[keyColumn] ?? null;
  const apiKey = decryptSecret(encryptedKey) ?? ENV_FALLBACK_BY_PROVIDER[provider];

  if (!apiKey) {
    throw new MissingProviderKeyError(provider);
  }

  return {
    adapter: ADAPTER_FACTORY[provider](apiKey),
    textModel: user?.textModel || "gpt-4.1",
    imageModel: user?.imageModel || "gpt-image-1",
  };
}
