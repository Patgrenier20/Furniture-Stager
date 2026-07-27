import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV, the recommended size for AES-GCM

let cachedKey: Buffer | null = null;

/**
 * Resolves the 256-bit encryption key from ENCRYPTION_KEY (base64-encoded).
 * Cached after the first successful parse so we're not re-decoding the env
 * var on every request.
 */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" ` +
        "and set it in the environment before storing or reading provider API keys.",
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly 32 bytes (a base64-encoded 256-bit key); got ${key.length} bytes.`,
    );
  }

  cachedKey = key;
  return key;
}

/**
 * Encrypts a secret (e.g. a user-supplied AI provider API key) for storage
 * at rest, using AES-256-GCM. The IV and auth tag are stored alongside the
 * ciphertext in a single colon-delimited string so a plain TEXT column can
 * hold the whole envelope and decryptSecret can round-trip it.
 *
 * Passing null/undefined/"" returns null unchanged, so callers can apply
 * this unconditionally to optional settings-form fields without extra
 * branching (see routes/settings.ts).
 */
export function encryptSecret(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === "") return null;

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/**
 * Decrypts a value previously written by encryptSecret.
 *
 * Values written before this change are plain-text API keys with no
 * colon-delimited envelope. Rather than throwing (and breaking every
 * existing user's configured key the moment this deploys), a value that
 * doesn't match the encrypted envelope's shape is returned unchanged and
 * treated as legacy plaintext. It gets encrypted automatically the next
 * time the user saves their AI settings (routes/settings.ts always encrypts
 * on write), so keys migrate to the encrypted format gradually as users
 * touch their settings again.
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;

  const parts = stored.split(":");
  if (parts.length !== 3) {
    return stored;
  }

  const [ivB64, authTagB64, ciphertextB64] = parts;

  try {
    const key = getKey();
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    // A malformed or tampered envelope should fail closed (treat the key as
    // unusable) rather than crash the request that triggered the read.
    return null;
  }
}
