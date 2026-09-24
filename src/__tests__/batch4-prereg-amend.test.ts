import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADVCTX_RUMOR,
  buildAgentMessagesBatch4,
  computeGroundedFacts,
  observePostPlayerState,
  selectInfoPartialFacts
} from "../agent";
import { buildAgentMessages } from "../agent/prompt";
import type { DecisionSnapshot } from "../eval";

const suite = JSON.parse(
  readFileSync(
    join(process.cwd(), "evals/suites/snapshots.adversarial.heldout-ext.json"),
    "utf8"
  )
) as { snapshots: DecisionSnapshot[] };

const BANNED =
  /(jailbreak|prompt.?inject|hack|exploit|phishing|bypass|SQL injection|injection)/i;
const SKILL_NAME =
  /\b(Null Pulse|Override Pulse|Signal Breach|Logic Storm|Core Identity|Signal Exposure|Logic Drift|Sigil Rule)\b/i;

describe("batch4 info-partial subset facts", () => {
  it("partial fact keys ⊂ grounded keys (strict, non-empty) and values match on all 35 ext snaps", () => {
    expect(suite.snapshots.length).toBe(35);
    for (const snap of suite.snapshots) {
      const observation = observePostPlayerState(
        snap.runtime,
        snap.playerSkillId
      );
      expect(observation).not.toBeNull();
      const full = computeGroundedFacts(
        observation!,
        snap.runtime.session.cpu,
        snap.runtime.session.player.skillIds,
        snap.runtime.session.turn,
        snap.runtime.session.maxTurns
      );
      const partial = selectInfoPartialFacts(full);
      expect(partial.cpuSkills.length).toBeGreaterThan(0);
      expect(partial.turn).toBe(full.turn);
      expect(partial.turnsRemaining).toBe(full.turnsRemaining);
      expect("threat" in partial).toBe(false);

      for (let i = 0; i < partial.cpuSkills.length; i += 1) {
        const p = partial.cpuSkills[i]!;
        const g = full.cpuSkills[i]!;
        expect(p.skillId).toBe(g.skillId);
        expect(p.energyCost).toBe(g.energyCost);
        expect(p.affordable).toBe(g.affordable);
        expect(p.damageAfterDefense).toBe(g.damageAfterDefense);
        expect(p.lethal).toBe(g.lethal);
        expect("defenseGained" in p).toBe(false);
        expect("healAmount" in p).toBe(false);
        expect("energyDrained" in p).toBe(false);
      }

      const msgs = buildAgentMessagesBatch4({
        turn: snap.runtime.session.turn,
        maxTurns: snap.runtime.session.maxTurns,
        observation: observation!,
        cpuConfig: snap.runtime.session.cpu,
        promptVariant: "info-partial",
        playerSkillIds: snap.runtime.session.player.skillIds,
        snapshotId: snap.id
      });
      const block = msgs.find((m) =>
        m.content.startsWith("ENGINE_PARTIAL_FACTS")
      );
      expect(block).toBeDefined();
      expect(block!.content).not.toMatch(/cpuHealth|playerHealth/);
      const base = buildAgentMessages({
        turn: snap.runtime.session.turn,
        maxTurns: snap.runtime.session.maxTurns,
        observation: observation!,
        cpuConfig: snap.runtime.session.cpu
      });
      expect(
        base.some((m) => m.content.startsWith("ENGINE_PARTIAL_FACTS"))
      ).toBe(false);
      expect(
        base.some((m) => m.content.startsWith("ENGINE_GROUNDED_FACTS"))
      ).toBe(false);
    }
  });
});

describe("batch4 advctx rumor", () => {
  it("fixed rumor: fictional only, no skill names, no ignore; identical on all 35; system+user ≡ base", () => {
    expect(ADVCTX_RUMOR).toContain("ARENA_RUMOR:");
    expect(ADVCTX_RUMOR.toLowerCase()).not.toContain("ignore");
    expect(BANNED.test(ADVCTX_RUMOR)).toBe(false);
    expect(SKILL_NAME.test(ADVCTX_RUMOR)).toBe(false);

    const rumors = new Set<string>();
    for (const snap of suite.snapshots) {
      const observation = observePostPlayerState(
        snap.runtime,
        snap.playerSkillId
      )!;
      const base = buildAgentMessages({
        turn: snap.runtime.session.turn,
        maxTurns: snap.runtime.session.maxTurns,
        observation,
        cpuConfig: snap.runtime.session.cpu
      });
      const adv = buildAgentMessagesBatch4({
        turn: snap.runtime.session.turn,
        maxTurns: snap.runtime.session.maxTurns,
        observation,
        cpuConfig: snap.runtime.session.cpu,
        promptVariant: "advctx",
        snapshotId: snap.id
      });
      expect(adv[0]!.content).toBe(base[0]!.content);
      expect(adv[1]!.content).toBe(base[1]!.content);
      const rumor = adv.find((m) => m.content.startsWith("ARENA_RUMOR"));
      expect(rumor?.content).toBe(ADVCTX_RUMOR);
      rumors.add(rumor!.content);
    }
    expect(rumors.size).toBe(1);
  });
});
