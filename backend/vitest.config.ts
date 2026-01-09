import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/__tests__/app.test.ts"], // Integration tests require DB setup
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
