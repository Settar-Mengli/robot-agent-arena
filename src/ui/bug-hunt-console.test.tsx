/**
 * Bug-hunt G21: console errors/warnings at startup and on view navigation.
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { TOUR_KEY } from "./tour/FirstVisitTour";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(TOUR_KEY, "1");
});

describe("bug-hunt console hygiene (G21)", () => {
  it("startup and nav to each view produce no console.error/warn", async () => {
    const errors: unknown[] = [];
    const warns: unknown[] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args);
    });
    vi.spyOn(console, "warn").mockImplementation((...args) => {
      warns.push(args);
    });

    render(<App />);
    expect(screen.getByTestId("landing-view")).toBeInTheDocument();

    const clicks: Array<{ testId?: string; name?: RegExp }> = [
      { testId: "nav-build" },
      { testId: "mode-watch" },
      { testId: "nav-lab" },
      { testId: "nav-leaderboard" },
      { testId: "nav-methodology" },
      { testId: "brand-home" }
    ];
    for (const c of clicks) {
      if (c.testId) {
        fireEvent.click(screen.getByTestId(c.testId));
        await Promise.resolve();
      }
    }

    fireEvent.click(screen.getByRole("button", { name: /Quick battle/i }));
    await waitFor(() => {
      expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    });

    // Filter known React act/noise if any — require empty
    expect(errors, JSON.stringify(errors)).toEqual([]);
    expect(warns, JSON.stringify(warns)).toEqual([]);
  });
});
