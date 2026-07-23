import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Minimal config so tests can use the same `@/` path alias as the app
// (tsconfig `paths`) and run in a Node environment.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
