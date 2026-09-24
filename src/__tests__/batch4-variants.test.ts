import { describe, expect, it } from "vitest";
import { SENTINEL_X } from "../data/opponents";
import {
  BATCH4_PROMPT_VERSIONS,
  PROMPT_VERSIONS,
  PROMPT_VERSIONS_ALL,
  buildAgentMessagesBatch4 as buildAgentMessages,
  resolvePromptVersionBatch4 as resolvePromptVersion
} from "../agent";
import type { CombatantState } from "../engine";
import {
  LLM_VARIANTS,
  parseVariantsList,
  variantPromptVersion,
  variantToPlayOptions
} from "../eval";
import { fixtureKey } from "../eval/transport";

const cpu: CombatantState = {
  side: "cpu",
  agentId: SENTINEL_X.agentId,
  displayName: SENTINEL_X.displayName,
  health: 24,
  maxHealth: 30,
  energy: 6,
  maxEnergy: 10,
  defense: 0
};

const player: CombatantState = {
  side: "player",
  agentId: "agent-player-1",
  displayName: "PLAYER-UNIT",
  health: 30,
  maxHealth: 30,
  energy: 1,
  maxEnergy: 10,
  defense: 0
};

const baseInput = {
  turn: 1,
  maxTurns: 20,
  observation: { cpu, player },
  cpuConfig: SENTINEL_X
} as const;

describe("batch4 variants", () => {
  it("registers four new LLM variants with prompt versions", () => {
    expect(LLM_VARIANTS).toContain("base-repeat");
    expect(LLM_VARIANTS).toContain("perturb");
    expect(LLM_VARIANTS).toContain("advctx");
    expect(LLM_VARIANTS).toContain("info-partial");
    expect(variantPromptVersion("base-repeat")).toBe(
      BATCH4_PROMPT_VERSIONS.baseRepeat
    );
    expect(variantPromptVersion("perturb")).toBe(BATCH4_PROMPT_VERSIONS.perturb);
    expect(variantPromptVersion("advctx")).toBe(BATCH4_PROMPT_VERSIONS.advctx);
    expect(variantPromptVersion("info-partial")).toBe(
      BATCH4_PROMPT_VERSIONS.infoPartial
    );
    expect(PROMPT_VERSIONS_ALL.baseRepeat).toBe(BATCH4_PROMPT_VERSIONS.baseRepeat);
    expect(PROMPT_VERSIONS_ALL.v1).toBe(PROMPT_VERSIONS.v1);
    expect(variantToPlayOptions("base-repeat")).toEqual({
      grounding: "off",
      memory: "off",
      promptVariant: "base-repeat"
    });
    expect(variantToPlayOptions("perturb").promptVariant).toBe("perturb");
    expect(variantToPlayOptions("advctx").promptVariant).toBe("advctx");
    expect(variantToPlayOptions("info-partial").promptVariant).toBe(
      "info-partial"
    );
    expect(parseVariantsList("base-repeat,perturb,advctx,info-partial", "record")).toEqual([
      "base-repeat",
      "perturb",
      "advctx",
      "info-partial"
    ]);
  });

  it("base-repeat messages deepEqual base; versions differ", () => {
    const baseMsgs = buildAgentMessages(baseInput);
    const repeatMsgs = buildAgentMessages({
      ...baseInput,
      promptVariant: "base-repeat"
    });
    expect(repeatMsgs).toEqual(baseMsgs);
    expect(resolvePromptVersion({})).toBe(PROMPT_VERSIONS.v1);
    expect(resolvePromptVersion({ promptVariant: "base-repeat" })).toBe(
      BATCH4_PROMPT_VERSIONS.baseRepeat
    );
  });

  it("absent promptVariant keeps base / grounded / freetext message bytes", () => {
    const base = buildAgentMessages(baseInput);
    const withDefault = buildAgentMessages({
      ...baseInput,
      promptVariant: "default"
    });
    expect(withDefault).toEqual(base);

    const free = buildAgentMessages({
      ...baseInput,
      responseFormat: "freetext"
    });
    expect(free[0]!.content).toContain("plain text");
    expect(resolvePromptVersion({ responseFormat: "freetext" })).toBe(
      PROMPT_VERSIONS.freeText
    );
  });

  it("fixtureKey repeat slot distinguishes base-repeat from base", () => {
    const url = "https://example.test/v1/chat/completions";
    const body = {
      model: "m",
      messages: buildAgentMessages(baseInput),
      temperature: 0,
      response_format: { type: "json_object" }
    };
    expect(fixtureKey(url, body, 0)).not.toBe(fixtureKey(url, body, 1));
    expect(fixtureKey(url, body, 0)).toBe(fixtureKey(url, body));
  });

  it("perturb / advctx / info-partial alter messages vs base", () => {
    const base = buildAgentMessages(baseInput);
    const perturb = buildAgentMessages({
      ...baseInput,
      promptVariant: "perturb",
      snapshotId: "snap-a"
    });
    const advctx = buildAgentMessages({
      ...baseInput,
      promptVariant: "advctx"
    });
    const partial = buildAgentMessages({
      ...baseInput,
      promptVariant: "info-partial",
      playerSkillIds: ["skill-override-pulse"]
    });
    expect(perturb).not.toEqual(base);
    expect(perturb[1]!.content).toContain("\n");
    expect(advctx.some((m) => m.content.includes("ARENA_RUMOR"))).toBe(true);
    expect(
      partial.some((m) => m.content.startsWith("ENGINE_PARTIAL_FACTS"))
    ).toBe(true);
    expect(partial.some((m) => m.content.includes("ENGINE_GROUNDED_FACTS"))).toBe(
      false
    );
  });
});
