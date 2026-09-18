import { FRACTURE, SENTINEL_X } from "../data/opponents";
import type { AgentConfig, Seed } from "../engine";

/** Attack-heavy player archetype. */
export const STRIKER: AgentConfig = {
  agentId: "eval-striker",
  displayName: "STRIKER",
  modules: {
    coreIdentity: "Blade Pattern",
    memory: "Strike Echo",
    sigilSecurity: "Thin Guard",
    rules: "Commit Forward",
    strategy: "Pressure First"
  },
  skillIds: ["skill-logic-storm", "skill-override-pulse"]
};

/** Disrupt-focused player archetype. */
export const DISRUPTOR: AgentConfig = {
  agentId: "eval-disruptor",
  displayName: "DISRUPTOR",
  modules: {
    coreIdentity: "Noise Lattice",
    memory: "Signal Drift",
    sigilSecurity: "Soft Aegis",
    rules: "Break Sync",
    strategy: "Drain Then Strike"
  },
  skillIds: ["skill-signal-breach", "skill-signal-exposure"]
};

/** Defense plus attack player archetype. */
export const BULWARK: AgentConfig = {
  agentId: "eval-bulwark",
  displayName: "BULWARK",
  modules: {
    coreIdentity: "Stone Kernel",
    memory: "Hold Pattern",
    sigilSecurity: "Thick Ward",
    rules: "Absorb First",
    strategy: "Guard Then Counter"
  },
  skillIds: ["skill-null-pulse", "skill-override-pulse"]
};

/** Held-out: identity defense + override attack. */
export const AEGIS: AgentConfig = {
  agentId: "eval-aegis",
  displayName: "AEGIS",
  modules: {
    coreIdentity: "Mirror Kernel",
    memory: "Ward Echo",
    sigilSecurity: "Prism Veil",
    rules: "Reflect First",
    strategy: "Anchor Then Strike"
  },
  skillIds: ["skill-core-identity", "skill-override-pulse"]
};

/** Held-out: storm attack + breach disrupt. */
export const TEMPEST: AgentConfig = {
  agentId: "eval-tempest",
  displayName: "TEMPEST",
  modules: {
    coreIdentity: "Gale Pattern",
    memory: "Storm Cache",
    sigilSecurity: "Thin Lattice",
    rules: "Open Breach",
    strategy: "Flood Then Pierce"
  },
  skillIds: ["skill-logic-storm", "skill-signal-breach"]
};

/** Held-out: drift attack + exposure disrupt. */
export const MNEMONIC: AgentConfig = {
  agentId: "eval-mnemonic",
  displayName: "MNEMONIC",
  modules: {
    coreIdentity: "Archive Self",
    memory: "Recall Drift",
    sigilSecurity: "Soft Seal",
    rules: "Leak Then Hit",
    strategy: "Expose Weakness"
  },
  skillIds: ["skill-logic-drift", "skill-signal-exposure"]
};

/** Dev-split player archetypes only. */
export const PLAYER_ARCHETYPES: readonly AgentConfig[] = [STRIKER, DISRUPTOR, BULWARK];

/** Held-out-split player archetypes only (structurally independent of dev). */
export const HELDOUT_ARCHETYPES: readonly AgentConfig[] = [AEGIS, TEMPEST, MNEMONIC];

export type PlayerPolicyId = "greedy" | "seeded-random";

export type EvalSplit = "dev" | "heldout";

export interface MatchScenario {
  id: string;
  playerConfig: AgentConfig;
  cpuConfig: AgentConfig;
  playerPolicy: PlayerPolicyId;
  seed: Seed;
}

const OPPONENTS: readonly AgentConfig[] = [FRACTURE, SENTINEL_X];
const POLICY_IDS: readonly PlayerPolicyId[] = ["greedy", "seeded-random"];

function opponentSlug(opponent: AgentConfig): string {
  if (opponent.agentId === FRACTURE.agentId) {
    return "fracture";
  }
  if (opponent.agentId === SENTINEL_X.agentId) {
    return "sentinel-x";
  }
  return opponent.agentId;
}

function archetypeSlug(archetype: AgentConfig): string {
  if (archetype.agentId === STRIKER.agentId) {
    return "striker";
  }
  if (archetype.agentId === DISRUPTOR.agentId) {
    return "disruptor";
  }
  if (archetype.agentId === BULWARK.agentId) {
    return "bulwark";
  }
  if (archetype.agentId === AEGIS.agentId) {
    return "aegis";
  }
  if (archetype.agentId === TEMPEST.agentId) {
    return "tempest";
  }
  if (archetype.agentId === MNEMONIC.agentId) {
    return "mnemonic";
  }
  return archetype.agentId;
}

function seedsForSplit(split: EvalSplit): readonly number[] {
  if (split === "dev") {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  }
  return [101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
}

function archetypesForSplit(split: EvalSplit): readonly AgentConfig[] {
  if (split === "dev") {
    return PLAYER_ARCHETYPES;
  }
  return HELDOUT_ARCHETYPES;
}

export function buildMatchSuite(split: EvalSplit): MatchScenario[] {
  const scenarios: MatchScenario[] = [];

  for (const archetype of archetypesForSplit(split)) {
    for (const playerPolicy of POLICY_IDS) {
      for (const cpuConfig of OPPONENTS) {
        for (const seed of seedsForSplit(split)) {
          const id = `${archetypeSlug(archetype)}__${playerPolicy}__${opponentSlug(cpuConfig)}__s${seed}`;
          scenarios.push({
            id,
            playerConfig: archetype,
            cpuConfig,
            playerPolicy,
            seed
          });
        }
      }
    }
  }

  scenarios.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return scenarios;
}

/** Stable stratum key: archetype × playerPolicy × opponent (seed excluded). */
export function scenarioStratumKey(scenario: MatchScenario): string {
  return `${scenario.playerConfig.agentId}__${scenario.playerPolicy}__${scenario.cpuConfig.agentId}`;
}

/**
 * Deterministic stratified sample: round-robin across strata in lexicographic
 * key order, taking at most one scenario per stratum before revisiting any.
 * Within a stratum, scenarios are already ordered by id (lowest seed first).
 */
export function selectDiverseScenarios(
  suite: readonly MatchScenario[],
  n: number
): MatchScenario[] {
  if (n <= 0) {
    return [];
  }

  const byStratum = new Map<string, MatchScenario[]>();
  for (const scenario of suite) {
    const key = scenarioStratumKey(scenario);
    const list = byStratum.get(key);
    if (list === undefined) {
      byStratum.set(key, [scenario]);
    } else {
      list.push(scenario);
    }
  }

  for (const list of byStratum.values()) {
    list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  const stratumKeys = [...byStratum.keys()].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  );

  const selected: MatchScenario[] = [];
  let round = 0;
  while (selected.length < n) {
    let added = false;
    for (const key of stratumKeys) {
      if (selected.length >= n) {
        break;
      }
      const list = byStratum.get(key)!;
      const pick = list[round];
      if (pick !== undefined) {
        selected.push(pick);
        added = true;
      }
    }
    if (!added) {
      break;
    }
    round += 1;
  }

  return selected;
}
