import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function stubViewport(width: number) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes("max-width")
        ? width < 640
        : width >= 640,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  );
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    get: () => width
  });
}

describe("layout viewport smoke", () => {
  for (const width of [380, 1440] as const) {
    it(`Home/Lab/Leaderboard/Methodology at ${width}px have sticky padding classes`, async () => {
      stubViewport(width);
      render(<App />);
      expect(screen.getByTestId("landing-view")).toBeInTheDocument();

      if (width < 640) {
        fireEvent.click(screen.getByTestId("nav-menu"));
      }
      fireEvent.click(screen.getByTestId("nav-lab"));
      await waitFor(
        () => {
          expect(screen.getByTestId("decision-lab")).toBeInTheDocument();
        },
        { timeout: 15000 }
      );
      expect(screen.getByTestId("decision-lab").className).toMatch(/pb-24/);

      if (width < 640) {
        fireEvent.click(screen.getByTestId("nav-menu"));
      }
      fireEvent.click(screen.getByTestId("nav-leaderboard"));
      await waitFor(
        () => {
          expect(screen.getByTestId("leaderboard-view")).toBeInTheDocument();
        },
        { timeout: 15000 }
      );

      if (width < 640) {
        fireEvent.click(screen.getByTestId("nav-menu"));
      }
      fireEvent.click(screen.getByTestId("nav-methodology"));
      await waitFor(
        () => {
          expect(screen.getByTestId("methodology-view")).toBeInTheDocument();
        },
        { timeout: 15000 }
      );
    });
  }

  it("cta-live-ai Setup shows live panel copy without enabling live", async () => {
    stubViewport(1440);
    render(<App />);
    fireEvent.click(screen.getByTestId("cta-live-ai"));
    await waitFor(
      () => {
        expect(screen.getByTestId("battle-setup")).toBeInTheDocument();
      },
      { timeout: 15000 }
    );
    const panel = await screen.findByTestId("live-opponent-panel", {}, { timeout: 15000 });
    const setup = screen.getByTestId("battle-setup");
    const text = `${setup.textContent ?? ""}${panel.textContent ?? ""}`;
    expect(text).toMatch(/Battle setup|Start battle|More options/i);
    expect(text).toMatch(/Live AI opponent|OpenRouter/i);
    expect(
      (screen.getByTestId("live-opponent-toggle") as HTMLInputElement).checked
    ).toBe(false);
  });
});
