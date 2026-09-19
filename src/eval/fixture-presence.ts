/**
 * Key-matched fixture presence: reconstruct each LLM decision's fixture key
 * along the fixture-driven replay path and require the file to exist.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MVP_SKILL_CATALOG } from "../engine";
import {
  buildAgentMessages,
  computeGroundedFacts,
  observePostPlayerState,
  summarizePlayerTendencies,
  validateAgentResponse
} from "../agent";
import { robotEnvironment } from "../env";
import { createDirStore } from "./dir-store";
import { createReplayFetch, fixtureKey } from "./transport";
import {
  resolvePlayerPolicy,
  variantToPlayOptions,
  type LlmVariant
} from "./policies";
import type { MatchScenario } from "./scenarios";
import { fixtureFileExists } from "./manifest";

export type HostModelPair = { host: string; model: string };

/**
 * Scan fixture JSON files for distinct host+model pairs used in keys.
 */
export function listFixtureHostModels(fixturesDir: string): HostModelPair[] {
  const names = readdirSync(fixturesDir).filter(
    (n) => n.endsWith(".json") && n !== "manifest.json"
  );
  const seen = new Map<string, HostModelPair>();
  for (const name of names) {
    try {
      const raw = JSON.parse(
        readFileSync(join(fixturesDir, name), "utf8")
      ) as { request?: { host?: unknown; model?: unknown } };
      const host =
        typeof raw.request?.host === "string" ? raw.request.host : undefined;
      const model =
        typeof raw.request?.model === "string" ? raw.request.model : undefined;
      if (host === undefined || model === undefined) continue;
      const key = `${host}|${model}`;
      if (!seen.has(key)) {
        seen.set(key, { host, model });
      }
    } catch {
      // skip unreadable
    }
  }
  return [...seen.values()].sort((a, b) =>
    a.host < b.host ? -1 : a.host > b.host ? 1 : a.model < b.model ? -1 : 1
  );
}

function urlForHost(host: string): string {
  return `https://${host}/v1/chat/completions`;
}

function findHit(
  messages: unknown,
  hostModels: readonly HostModelPair[],
  fixturesDir: string
): { host: string; model: string; key: string } | undefined {
  for (const pair of hostModels) {
    const body: Record<string, unknown> = {
      model: pair.model,
      messages,
      temperature: 0,
      response_format: { type: "json_object" }
    };
    const key = fixtureKey(urlForHost(pair.host), body);
    if (fixtureFileExists(fixturesDir, key)) {
      return { host: pair.host, model: pair.model, key };
    }
  }
  return undefined;
}

/**
 * Walk one scenario under a variant prompt; for each LLM decision, require
 * that fixtureKey(...) exists on disk for at least one known host+model.
 * Advances using recorded fixture responses so the path matches recording.
 */
export async function scenarioMatchFixturesPresent(
  scenario: MatchScenario,
  variant: LlmVariant,
  fixturesDir: string,
  hostModels: readonly HostModelPair[]
): Promise<boolean> {
  const store = createDirStore(fixturesDir);
  const replay = createReplayFetch(store);
  const playOpts = variantToPlayOptions(variant);
  const playerPolicy = resolvePlayerPolicy(scenario);

  let runtime = robotEnvironment.start(
    scenario.playerConfig,
    scenario.cpuConfig,
    scenario.seed
  );

  while (!robotEnvironment.isTerminal(runtime)) {
    const playerSkillId = playerPolicy(runtime);
    const observation = observePostPlayerState(runtime, playerSkillId);

    if (observation === null) {
      runtime = robotEnvironment.apply(runtime, playerSkillId).runtime;
      continue;
    }

    const groundedFacts =
      playOpts.grounding === "facts"
        ? computeGroundedFacts(
            observation,
            runtime.session.cpu,
            runtime.session.player.skillIds,
            runtime.session.turn,
            runtime.session.maxTurns,
            MVP_SKILL_CATALOG
          )
        : undefined;
    const playerTendencies =
      playOpts.memory === "match"
        ? summarizePlayerTendencies(runtime)
        : undefined;

    const messages = buildAgentMessages({
      turn: runtime.session.turn,
      maxTurns: runtime.session.maxTurns,
      observation,
      cpuConfig: runtime.session.cpu,
      catalog: MVP_SKILL_CATALOG,
      grounding: groundedFacts,
      memory: playerTendencies
    });

    const hit = findHit(messages, hostModels, fixturesDir);
    if (hit === undefined) {
      return false;
    }

    const res = await replay(urlForHost(hit.host), {
      method: "POST",
      body: JSON.stringify({
        model: hit.model,
        messages,
        temperature: 0,
        response_format: { type: "json_object" }
      })
    });
    if (!res.ok) {
      return false;
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    const validation = validateAgentResponse(
      text,
      runtime.session.cpu.skillIds,
      observation.cpu.energy,
      MVP_SKILL_CATALOG
    );
    const selectCpu = validation.ok
      ? () => validation.skillId
      : undefined;
    runtime = robotEnvironment.apply(runtime, playerSkillId, selectCpu).runtime;
  }

  return true;
}

/**
 * Among candidate scenarios, return ids whose match decisions all have
 * committed fixtures for the given variant (key reconstruction + file exists).
 */
export async function discoverVariantScenarioIds(
  candidates: readonly MatchScenario[],
  variant: LlmVariant,
  fixturesDir: string
): Promise<string[]> {
  const hostModels = listFixtureHostModels(fixturesDir);
  if (hostModels.length === 0) {
    return [];
  }
  const found: string[] = [];
  for (const scenario of candidates) {
    const ok = await scenarioMatchFixturesPresent(
      scenario,
      variant,
      fixturesDir,
      hostModels
    );
    if (ok) {
      found.push(scenario.id);
    }
  }
  return found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
