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
    files: ["src/env/resonance-seal/**/*.ts"],
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
            "**/inference/**",
            "**/engine",
            "**/engine/**",
            "node:*",
            "fs",
            "fs/**",
            "path",
            "path/**",
            "child_process",
            "os",
            "worker_threads",
            "module",
            "react",
            "react-dom",
            "react/*",
            "react-dom/*"
          ]
        }
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "document",
          message: "resonance-seal must stay pure — no DOM"
        },
        {
          name: "window",
          message: "resonance-seal must stay pure — no DOM"
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
    files: ["src/ui/live/**/*.{ts,tsx}"],
    ignores: ["src/ui/live/**/*.test.ts", "src/ui/live/**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "process",
              message: "live BYOK must not import process — use in-memory EnvMap only"
            },
            {
              name: "buffer",
              message: "live UI must not import Buffer/buffer"
            },
            {
              name: "node:buffer",
              message: "live UI must not import Buffer/buffer"
            }
          ],
          patterns: [
            "node:*",
            "fs",
            "fs/**",
            "**/eval",
            "**/eval/**"
          ]
        }
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "Buffer",
          message: "live UI must not use Buffer"
        },
        {
          name: "process",
          message: "live BYOK must not read process — inject EnvMap only"
        }
      ]
    }
  },
  {
    files: ["src/ui/live/**/*.test.ts", "src/ui/live/**/*.test.tsx"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-globals": "off"
    }
  },
  {
    files: ["src/decision-lab/**/*.ts"],
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
            "module",
            "react",
            "react-dom",
            "react/*",
            "react-dom/*"
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
