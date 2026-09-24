import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/__tests__/**",
        "src/**/types.ts",
        "src/**/index.ts",
        "src/**/*.test.ts",
        "src/**/*.test.tsx"
      ]
    },
    projects: [
      {
        test: {
          name: "node",
          include: ["src/__tests__/**/*.test.ts"],
          environment: "node",
          setupFiles: ["./src/test-setup-drift-warn.ts"]
        }
      },
      {
        plugins: [react()],
        test: {
          name: "ui",
          include: ["src/ui/**/*.test.ts", "src/ui/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./src/test-setup-drift-warn.ts"]
        }
      }
    ]
  }
});
