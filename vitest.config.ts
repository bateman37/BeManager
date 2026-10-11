import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // Partidos completos con proyección del rebote ofensivo (sesión v2-9): un partido ronda 2–3 s.
    testTimeout: 60_000,
    include: ["src/**/*.test.ts", "modules/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@match": path.resolve(__dirname, "./modules/match"),
    },
  },
});
