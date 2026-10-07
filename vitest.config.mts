import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // route tests import "@/..." like the app does
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // lib/gemini.ts is server-only; the real package throws outside Next's server bundle
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
});
