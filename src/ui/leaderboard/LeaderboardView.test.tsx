import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { LeaderboardView } from "./LeaderboardView";

describe("LeaderboardView", () => {
  it("renders empty state when no pack is present", async () => {
    render(<LeaderboardView />);
    expect(
      await screen.findByTestId("leaderboard-empty")
    ).toBeInTheDocument();
  });
});
