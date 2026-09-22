import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export async function main(): Promise<void> {
  const dir = "evals/fixtures";
  const files = readdirSync(dir).filter(
    (f) => f.endsWith(".json") && f !== "manifest.json"
  );
  let bad = 0;
  let secret = 0;
  const byHost: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  const byPrompt = { json: 0, freetext: 0, other: 0 };
  for (const f of files) {
    const j = JSON.parse(readFileSync(join(dir, f), "utf8")) as {
      request?: {
        host?: string;
        model?: string;
        messages?: Array<{ role?: string; content?: string }>;
      };
      response?: unknown;
    };
    const host = j.request?.host ?? "?";
    const model = String(j.request?.model ?? "?");
    byHost[host] = (byHost[host] ?? 0) + 1;
    byModel[model] = (byModel[model] ?? 0) + 1;
    const resp = JSON.stringify(j.response ?? {});
    if (
      /"id"\s*:/.test(resp) ||
      /"created"\s*:/.test(resp) ||
      resp.includes("extra_content") ||
      resp.includes("thought_signature")
    ) {
      bad += 1;
    }
    const blob = resp + JSON.stringify(j.request ?? {});
    if (/AIza[0-9A-Za-z_-]{10,}|gsk_[0-9A-Za-z]{10,}|sk-[0-9A-Za-z]{10,}/.test(blob)) {
      secret += 1;
    }
    const sys =
      j.request?.messages?.find((m) => m.role === "system")?.content ?? "";
    if (sys.includes("JSON object")) byPrompt.json += 1;
    else if (sys.includes("plain text") || sys.includes("Reply in plain"))
      byPrompt.freetext += 1;
    else byPrompt.other += 1;
  }
  console.log(
    JSON.stringify({ files: files.length, bad, secret, byHost, byModel, byPrompt }, null, 2)
  );
}
