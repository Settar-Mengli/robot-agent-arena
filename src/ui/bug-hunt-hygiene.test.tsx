/**
 * Bug-hunt G22/G23: keyboard walkthrough + garbage tokens in rendered text.
 * Uses fireEvent only (no new packages).
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { TOUR_KEY } from "./tour/FirstVisitTour";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(TOUR_KEY, "1");
});

const GARBAGE =
  /\bNaN\b|\bundefined\b|\bInfinity\b|\[object Object\]|(?<![0-9])-0(?![0-9.])/;

function assertNoGarbage(root: HTMLElement, label: string) {
  const text = root.textContent ?? "";
  const hit = text.match(GARBAGE);
  expect(hit, `${label}: found ${hit?.[0] ?? ""}`).toBeNull();
}

describe("bug-hunt keyboard + render hygiene (G22/G23)", () => {
  it(
    "landing → quick battle → results → Challenge → Watch: focus + no garbage",
    async () => {
    render(<App />);

    const landing = screen.getByTestId("landing-view");
    assertNoGarbage(landing, "landing");

    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    await waitFor(() => {
      expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    });
    expect(document.activeElement?.id).toBe("arena-heading");
    assertNoGarbage(screen.getByTestId("arena-view"), "arena");

    for (let i = 0; i < 40; i += 1) {
      if (screen.queryByTestId("results-view")) break;
      const btn = screen.queryAllByRole("button", { name: /Logic Storm/i })[0];
      if (!btn) break;
      fireEvent.click(btn);
      await Promise.resolve();
    }
    await waitFor(() => {
      expect(screen.getByTestId("results-view")).toBeInTheDocument();
    });
    expect(document.activeElement?.id).toBe("results-heading");
    assertNoGarbage(screen.getByTestId("results-view"), "results");

    fireEvent.click(screen.getByTestId("nav-lab"));
    await waitFor(
      () => {
        expect(screen.getByTestId("lab-challenge")).toBeInTheDocument();
      },
      { timeout: 15000 }
    );
    assertNoGarbage(document.body, "lab-challenge");

    // Watch via landing CTA path: Home then Watch
    fireEvent.click(screen.getByTestId("brand-home"));
    await waitFor(() => {
      expect(screen.getByTestId("landing-view")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("cta-watch"));
    await waitFor(() => {
      expect(screen.getByTestId("watch-battle-view")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("watch-heading");
    });
    assertNoGarbage(screen.getByTestId("watch-battle-view"), "watch");

    const heading = document.getElementById("watch-heading");
    expect(heading?.tabIndex).toBe(-1);
    heading?.focus();
    expect(heading).toHaveFocus();
    },
    20_000
  );
});
