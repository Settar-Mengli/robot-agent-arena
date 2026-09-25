import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { LeaderboardView } from "./LeaderboardView";
import { findForbiddenTechnicalText } from "../copy/forbidden-default-path";

describe("LeaderboardView", () => {
  it("renders recorded suites from the pack with friendly labels", () => {
    render(<LeaderboardView />);
    expect(screen.getByTestId("leaderboard-view")).toBeInTheDocument();
    expect(
      screen.getByTestId("leaderboard-suite-adversarial-heldout-ext")
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("leaderboard-chart").length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByTestId("leaderboard-table").length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByTestId("leaderboard-group").length).toBeGreaterThan(
      0
    );
    const text = screen.getByTestId("leaderboard-view").textContent ?? "";
    expect(screen.getByTestId("leaderboard-not-ranking")).toHaveTextContent(
      /Overlapping uncertainty bands are not a ranking/
    );
    expect(text).toMatch(/Hard test set/);
    expect(text).toMatch(/Gemini · Basic prompt|Gemini · Asked twice/);
    expect(text).not.toMatch(/base-repeat/);
    expect(text).not.toMatch(/\badvctx\b/);
    expect(
      findForbiddenTechnicalText(text)
    ).toBeNull();
  });
});
