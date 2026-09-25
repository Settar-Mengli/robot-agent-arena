import { describe, expect, it } from "vitest";
import {
  leaderboardRowDisplayName,
  providerDisplayName,
  suiteDisplayName,
  variantDisplayName
} from "./display-labels";

describe("display-labels", () => {
  it("maps variants and providers", () => {
    expect(variantDisplayName("base-repeat")).toBe("Asked twice");
    expect(variantDisplayName("advctx")).toBe("Misleading rumor");
    expect(providerDisplayName("gemini")).toBe("Gemini");
    expect(providerDisplayName("groq")).toBe("Groq");
  });

  it("maps suites", () => {
    expect(suiteDisplayName("adversarial-heldout-ext")).toBe(
      "Hard test set (35 situations)"
    );
    expect(suiteDisplayName("adversarial")).toBe(
      "Small check set (13 situations)"
    );
  });

  it("formats leaderboard rows from id", () => {
    expect(
      leaderboardRowDisplayName({ id: "gemini:base-repeat", label: "gemini base-repeat" })
    ).toBe("Gemini · Asked twice");
    expect(
      leaderboardRowDisplayName({
        id: "groq:grounded",
        label: "groq grounded (smaller set)"
      })
    ).toBe("Groq · With facts");
    expect(
      leaderboardRowDisplayName({
        id: "gemini:base:secondary",
        label: "gemini base (smaller set)"
      })
    ).toBe("Gemini · Basic prompt");
  });
});
