import { describe, expect, it } from "vitest";
import {
  CPU_OPPONENT_COUNT,
  DEFAULT_MAX_TURNS,
  FICTIONAL_TERMS,
  MAX_TURNS,
  MVP_SKILL_COUNT
} from "../engine/constants";

describe("engine constants", () => {
  it("defines locked MVP numeric constants", () => {
    expect(MAX_TURNS).toBe(20);
    expect(DEFAULT_MAX_TURNS).toBe(MAX_TURNS);
    expect(MVP_SKILL_COUNT).toBe(8);
    expect(CPU_OPPONENT_COUNT).toBe(2);
  });

  it("defines the approved fictional terminology list", () => {
    expect(FICTIONAL_TERMS).toEqual([
      "Signal Breach",
      "Null Pulse",
      "Override Pulse",
      "Core Identity",
      "Logic Storm",
      "Sigil Rule",
      "Signal Exposure",
      "Logic Drift"
    ]);
  });
});
