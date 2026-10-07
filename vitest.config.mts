import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // route tests import "@/..." like the app does
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
