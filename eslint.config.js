import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly"
      }
    }
  },
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
            "**/inference/**",
            "**/eval",
            "**/eval/**"
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
          patterns: [
            "**/engine",
            "**/engine/**",
            "**/agent",
            "**/agent/**",
            "**/eval",
            "**/eval/**"
          ]
        }
      ]
    }
  },
  {
    files: ["src/agent/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["**/eval", "**/eval/**"]
        }
      ]
    }
  },
  {
    files: ["src/env/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "**/agent",
            "**/agent/**",
            "**/eval",
            "**/eval/**",
            "**/inference",
            "**/inference/**"
          ]
        }
      ]
    }
  },
  {
    files: ["src/ui/**/*.ts", "src/ui/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "**/eval",
            "**/eval/**",
            "node:*",
            "fs",
            "fs/**",
            "path",
            "path/**",
            "child_process",
            "os",
            "worker_threads",
            "module"
          ]
        }
      ]
    }
  },
  {
    files: ["src/agent/baselines/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "agent baselines must be deterministic — no Math.random"
        },
        {
          object: "Date",
          property: "now",
          message: "agent baselines must be pure — no clock access"
        }
      ]
    }
  }
);
