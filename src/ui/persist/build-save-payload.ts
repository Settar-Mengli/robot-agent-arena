import type { AgentConfig, BattleOutcome, BattleRuntime } from "../../engine";
import type { SaveSlotV1 } from "./save-slot";

export type SaveViewKind =
  | "home"
  | "builder"
  | "setup"
  | "battle"
  | "watch"
  | "lab"
  | "leaderboard"
  | "methodology";

export type BuildSavePayloadInput = {
  viewKind: SaveViewKind;
  playerConfig: AgentConfig;
  opponentId: string;
  seed: string;
  /** Current store runtime — ignored unless viewKind is battle. */
  storeRuntime: BattleRuntime | null;
  watchMatchId?: string;
  battleOver: boolean;
  lastOutcome?: BattleOutcome;
};

/** Pure save payload rules (D-050). Stale storeRuntime never leaks off battle. */
export function buildSavePayload(
  input: BuildSavePayloadInput
): Omit<SaveSlotV1, "schemaVersion" | "savedAt"> {
  const mode = input.viewKind === "watch" ? ("watch" as const) : ("free" as const);
  const runtime = input.viewKind === "battle" ? input.storeRuntime : null;
  return {
    draft: {
      playerConfig: input.playerConfig,
      opponentId: input.opponentId,
      seed: input.seed
    },
    mode,
    ...(input.viewKind === "watch" && input.watchMatchId !== undefined
      ? { watch: { matchId: input.watchMatchId } }
      : {}),
    runtime,
    battleOver: input.viewKind === "battle" ? input.battleOver : false,
    ...(input.viewKind === "battle" && input.lastOutcome !== undefined
      ? { lastOutcome: input.lastOutcome }
      : {})
  };
}

export function saveAllowedForView(kind: SaveViewKind): boolean {
  return (
    kind === "builder" ||
    kind === "setup" ||
    kind === "battle" ||
    kind === "watch"
  );
}
