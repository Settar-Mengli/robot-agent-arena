import type { EnvSeed } from "../seed-rng";
import type { EnvironmentOf } from "../contract";
import {
  SEAL_ACTIONS,
  SEAL_ENERGY_CAP,
  SEAL_MAX_TURNS,
  SEAL_PRESSURE_LOSS,
  SEAL_WIN,
  type SealActionId,
  type SealState
} from "./types";

export function initialSealState(seed: EnvSeed): SealState {
  void seed;
  return {
    turn: 1,
    maxTurns: SEAL_MAX_TURNS,
    energy: 0,
    seal: 0,
    pressure: 0,
    braced: false,
    bracedLastTurn: false
  };
}

export function isSealTerminal(state: SealState): boolean {
  return (
    state.seal >= SEAL_WIN ||
    state.pressure >= SEAL_PRESSURE_LOSS ||
    state.turn > state.maxTurns
  );
}

export function sealTerminalValue(state: SealState): number {
  if (state.seal >= SEAL_WIN) {
    return 100 - state.turn;
  }
  if (state.pressure >= SEAL_PRESSURE_LOSS) {
    return -100;
  }
  if (state.turn > state.maxTurns) {
    return state.seal - state.pressure;
  }
  return 0;
}

export function isSealActionLegal(
  state: SealState,
  action: SealActionId
): boolean {
  if (isSealTerminal(state)) {
    return false;
  }
  switch (action) {
    case "channel":
      return true;
    case "inscribe":
      return state.energy >= 2;
    case "vent":
      return state.energy >= 1 && state.pressure >= 1;
    case "brace":
      return state.energy >= 1 && !state.bracedLastTurn;
    default:
      return false;
  }
}

export function sealLegalActions(state: SealState): SealActionId[] {
  return SEAL_ACTIONS.filter((a) => isSealActionLegal(state, a));
}

export function sealEquippedActions(state: SealState): readonly SealActionId[] {
  void state;
  return SEAL_ACTIONS;
}

function applyVaultPressure(state: SealState): SealState {
  // Locked: pressure only on spike turns (else 0). Provisional else+1 made wins unreachable.
  let hit = state.turn % 3 === 0 ? 2 : 0;
  if (state.braced) {
    hit = Math.max(0, hit - 1);
  }
  return {
    ...state,
    pressure: Math.min(SEAL_PRESSURE_LOSS, state.pressure + hit),
    braced: false
  };
}

export function applySealAction(
  state: SealState,
  action: SealActionId
): SealState {
  if (!isSealActionLegal(state, action)) {
    throw new Error(`illegal seal action ${action} at turn ${state.turn}`);
  }

  let next: SealState = {
    ...state,
    bracedLastTurn: false
  };

  switch (action) {
    case "channel":
      next = {
        ...next,
        energy: Math.min(SEAL_ENERGY_CAP, next.energy + 2)
      };
      break;
    case "inscribe":
      next = {
        ...next,
        energy: next.energy - 2,
        seal: Math.min(SEAL_WIN, next.seal + 1)
      };
      break;
    case "vent":
      next = {
        ...next,
        energy: next.energy - 1,
        pressure: Math.max(0, next.pressure - 1)
      };
      break;
    case "brace":
      next = {
        ...next,
        energy: next.energy - 1,
        braced: true,
        bracedLastTurn: true
      };
      break;
  }

  next = applyVaultPressure(next);
  next = { ...next, turn: next.turn + 1 };
  return next;
}

export function sealMemoStateKey(state: SealState): string {
  return [
    state.turn,
    state.energy,
    state.seal,
    state.pressure,
    state.braced ? 1 : 0,
    state.bracedLastTurn ? 1 : 0
  ].join("|");
}

export function sealDecisionStateKey(
  state: SealState,
  action: SealActionId
): string {
  return `${sealMemoStateKey(state)}#${action}`;
}

export const resonanceSealEnvironment: EnvironmentOf<SealState, SealActionId> =
  {
    start(seed: EnvSeed): SealState {
      return initialSealState(seed);
    },
    isTerminal: isSealTerminal,
    apply(state, action) {
      return { state: applySealAction(state, action) };
    },
    equippedActions: sealEquippedActions,
    legalActions: sealLegalActions,
    terminalValue: sealTerminalValue,
    memoStateKey: sealMemoStateKey,
    decisionStateKey: sealDecisionStateKey
  };
