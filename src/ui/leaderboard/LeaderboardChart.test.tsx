import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { LeaderboardChart } from "./LeaderboardChart";
import pack from "../data/leaderboard.v1.json";

afterEach(() => {
  cleanup();
});

describe("LeaderboardChart", () => {
  const suite = (
    pack as {
      suites: Array<{
        suiteId: string;
        label?: string;
        groups: string[][];
        rows: Array<{
          id: string;
          label?: string;
          n: number;
          rate?: number;
          wilson: { low: number; high: number };
          insufficientEvidence: boolean;
        }>;
      }>;
    }
  ).suites.find((s) => s.suiteId === "adversarial-heldout-ext")!;

  it("whiskers and table match JSON rate/wilson for two rows", () => {
    render(<LeaderboardChart suite={suite} />);
    const geminiBase = suite.rows.find((r) => r.id === "gemini:base")!;
    const groqBase = suite.rows.find((r) => r.id === "groq:base")!;
    expect(geminiBase).toBeTruthy();
    expect(groqBase).toBeTruthy();

    const lowG = (geminiBase.wilson.low * 100).toFixed(1);
    const highG = (geminiBase.wilson.high * 100).toFixed(1);
    const midG = ((geminiBase.rate ?? 0) * 100).toFixed(1);
    const whiskers = screen.getAllByTestId("leaderboard-whisker");
    const match = whiskers.find(
      (el) =>
        el.getAttribute("data-low") === lowG &&
        el.getAttribute("data-high") === highG &&
        el.getAttribute("data-mid") === midG
    );
    expect(match).toBeTruthy();

    const table = screen.getByTestId("leaderboard-table");
    expect(table.textContent).toContain(`${midG}%`);
    expect(table.textContent).toContain(`${lowG}%`);
    expect(table.textContent).toContain(`${highG}%`);

    const lowQ = (groqBase.wilson.low * 100).toFixed(1);
    const highQ = (groqBase.wilson.high * 100).toFixed(1);
    const midQ = ((groqBase.rate ?? 0) * 100).toFixed(1);
    expect(table.textContent).toContain(`${midQ}%`);
    expect(table.textContent).toContain(`${lowQ}%`);
    expect(table.textContent).toContain(`${highQ}%`);
  });

  it("renders axis tick labels 0% through 100% and shares scale width", () => {
    render(<LeaderboardChart suite={suite} />);
    const axis = screen.getByTestId("leaderboard-axis");
    for (const t of ["0%", "25%", "50%", "75%", "100%"]) {
      expect(axis.textContent).toContain(t);
    }
    const scale = screen.getByTestId("leaderboard-chart-scale");
    expect(scale.contains(axis)).toBe(true);
    expect(scale.contains(screen.getAllByTestId("leaderboard-whisker")[0]!)).toBe(
      true
    );
  });

  it("shows exact overlap badge when a group has multiple rows", () => {
    const multi = suite.groups.find((g) => g.length > 1);
    expect(multi).toBeTruthy();
    render(<LeaderboardChart suite={suite} />);
    expect(
      screen.getAllByText("Can't be separated with this data").length
    ).toBeGreaterThan(0);
  });
});
