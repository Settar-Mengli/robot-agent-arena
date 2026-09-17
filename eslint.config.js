import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/engine/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "engine must be deterministic — use the injected seeded rng"
        },
        {
          object: "Date",
          property: "now",
          message: "engine must be pure — no clock access"
        }
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "react",
            "react-dom",
            "zustand",
            "**/store/**",
            "**/components/**",
            "**/agent",
            "**/agent/**",
            "**/inference",
            "**/inference/**"
          ]
        }
      ]
    }
  },
  {
    files: ["src/inference/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["**/engine", "**/engine/**", "**/agent", "**/agent/**"]
        }
      ]
    }
  }
);
