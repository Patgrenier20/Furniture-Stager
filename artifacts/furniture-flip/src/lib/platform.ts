/**
 * The Play-distributed build appends this marker in capacitor.config.ts.
 * Keeping the check in one place prevents Android-only policy behavior from
 * leaking into the normal web experience.
 */
export function isAndroidPlayApp(): boolean {
  return typeof navigator !== "undefined"
    && navigator.userAgent.includes("FurniFlipAndroid/");
}
