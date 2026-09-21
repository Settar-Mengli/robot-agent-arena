import { describe, expect, it } from "vitest";
import {
  classifyFromTrace,
  classifyRecordedTaxonomy,
  assertDecisionLabPackV1,
  PROMPT_TEMPLATE_FILES
} from "../decision-lab";

describe("decision-lab taxonomy", () => {
  it("classifies unavailable on fixture_miss", () => {
    expect(
      classifyFromTrace(
        {
          source: "fallback",
          fallbackReason: "all_providers_failed",
          failures: [{ status: 599, reason: "fixture_miss" }]
        },
        10
      )
    ).toBe("unavailable");
  });

  it("classifies infrastructure_failure for provider/budget/cancel", () => {
    expect(
      classifyRecordedTaxonomy({
        regret: 5,
        source: "fallback",
        fallbackReason: "all_providers_failed"
      })
    ).toBe("infrastructure_failure");
    expect(
      classifyRecordedTaxonomy({
        regret: 0,
        source: "fallback",
        fallbackReason: "budget_exceeded"
      })
    ).toBe("infrastructure_failure");
    expect(
      classifyRecordedTaxonomy({
        regret: 0,
        source: "fallback",
        fallbackReason: "cancelled"
      })
    ).toBe("infrastructure_failure");
  });

  it("classifies invalid_output for parse/validation failures", () => {
    expect(
      classifyRecordedTaxonomy({
        regret: 2,
        source: "fallback",
        fallbackReason: "invalid_output"
      })
    ).toBe("invalid_output");
    expect(
      classifyRecordedTaxonomy({
        regret: 2,
        source: "llm",
        validationOk: false
      })
    ).toBe("invalid_output");
  });

  it("classifies suboptimal and optimal from regret", () => {
    expect(classifyRecordedTaxonomy({ regret: 1.5 })).toBe("suboptimal");
    expect(classifyRecordedTaxonomy({ regret: 0 })).toBe("optimal");
  });
});

describe("assertDecisionLabPackV1", () => {
  it("rejects wrong schemaVersion", () => {
    expect(() => assertDecisionLabPackV1({ schemaVersion: 99 })).toThrow(
      /schemaVersion/
    );
  });

  it("lists expected prompt template files constant", () => {
    expect(PROMPT_TEMPLATE_FILES).toEqual([
      "src/agent/prompt.ts",
      "src/engine/skills.ts",
      "src/agent/grounding.ts"
    ]);
  });
});
