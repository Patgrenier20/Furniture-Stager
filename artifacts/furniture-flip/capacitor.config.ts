import type { CapacitorConfig } from "@capacitor/cli";

const productionUrl = process.env.FURNIFLIP_WEB_URL ?? "https://furniflip.app";

const config: CapacitorConfig = {
  appId: "com.furniflip.app",
  appName: "FurniFlip",
  webDir: "dist/public",
  server: {
    // The hosted app and API share one HTTPS origin, which preserves the
    // existing secure cookie authentication and /api rewrite behavior.
    url: productionUrl,
    cleartext: false,
    appendUserAgent: "FurniFlipAndroid/1.0",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#f7f4ef",
  },
};

export default config;
