import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const browserProviders = path.resolve(
  root,
  "src/inference/providers.browser.ts"
);

function openRouterProvidersOnly(): Plugin {
  return {
    name: "openrouter-providers-only",
    enforce: "pre",
    resolveId(source, importer) {
      if (process.env.VITEST !== undefined) return null;
      if (!importer) return null;
      const norm = source.replace(/\\/g, "/");
      if (
        norm === "./providers-active" ||
        norm.endsWith("/providers-active") ||
        norm.endsWith("/providers-active.ts")
      ) {
        return browserProviders;
      }
      return null;
    }
  };
}

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [openRouterProvidersOnly(), react(), tailwindcss()]
});
