import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/**/types.ts", "src/**/index.ts"]
    },
    projects: [
      {
        test: {
          name: "node",
          include: ["src/__tests__/**/*.test.ts"],
          environment: "node"
        }
      },
      {
        test: {
          name: "ui",
          include: ["src/ui/**/*.test.ts", "src/ui/**/*.test.tsx"],
          environment: "jsdom"
        }
      }
    ]
  }
});
