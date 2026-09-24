/**
 * Resonance Seal — Batch 5 / D-052 second reference environment.
 *
 * Final locked rules (non-degeneracy adjustments from provisional):
 * - channel grants +2 energy (cap 5) — provisional +1 made seal≥3 unreachable
 * - vault pressure: +2 on turns where turn%3===0, else +0 (provisional else +1
 *   made win unreachable even with brace/vent)
 * - brace costs 1 energy and cannot be used on consecutive turns (anti-stall)
 * - vent requires energy >= 1 and pressure >= 1
 * - inscribe requires energy >= 2
 * Oracle = exact best response to a fixed vault pressure script (not an equilibrium).
 * Metrics are never comparable to the robot battle (different value scale).
 */

export type SealActionId = "channel" | "inscribe" | "vent" | "brace";

export const SEAL_ACTIONS: readonly SealActionId[] = [
  "channel",
  "inscribe",
  "vent",
  "brace"
] as const;

export const SEAL_MAX_TURNS = 8;
export const SEAL_ENERGY_CAP = 5;
export const SEAL_WIN = 3;
export const SEAL_PRESSURE_LOSS = 5;

export type SealState = {
  turn: number;
  maxTurns: number;
  energy: number;
  seal: number;
  pressure: number;
  braced: boolean;
  bracedLastTurn: boolean;
};

export type SealOracleResult = {
  values: Record<SealActionId, number>;
  best: SealActionId[];
  exact: true;
};
