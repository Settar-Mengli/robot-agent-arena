import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { LeaderboardView } from "./LeaderboardView";
import { findForbiddenTechnicalText } from "../copy/forbidden-default-path";

describe("LeaderboardView", () => {
  it("renders recorded suites from the pack", () => {
    render(<LeaderboardView />);
    expect(screen.getByTestId("leaderboard-view")).toBeInTheDocument();
    expect(
      screen.getByTestId("leaderboard-suite-adversarial-heldout-ext")
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("leaderboard-group").length).toBeGreaterThan(
      0
    );
    expect(
      findForbiddenTechnicalText(
        screen.getByTestId("leaderboard-view").textContent ?? ""
      )
    ).toBeNull();
  });
});
