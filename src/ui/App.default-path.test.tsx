import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { lazy, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ViewErrorBoundary } from "./components/ViewErrorBoundary";
import {
  findForbiddenTechnicalText,
  FORBIDDEN_DEFAULT_PATH
} from "./copy/forbidden-default-path";
import { LANDING_H1, LANDING_SUPPORT } from "./landing/LandingView";
import { TOUR_KEY } from "./tour/FirstVisitTour";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(TOUR_KEY, "1");
});

function assertClean(el: HTMLElement) {
  const hit = findForbiddenTechnicalText(el.textContent ?? "");
  expect(hit).toBeNull();
}

function collectSelectText(root: HTMLElement): string {
  return Array.from(root.querySelectorAll("select, option"))
    .map((n) => n.textContent ?? "")
    .join("\n");
}

describe("forbidden-default-path matcher", () => {
  it("catches the exact old strings from the pre-fix UI", () => {
    const olds = [
      "aegis__greedy__fracture__s101",
      "heldout:base:tempest__greedy__fracture__s101",
      "greedy",
      "Session n=3",
      "deterministic",
      "fictional sigil",
      "miss score 2.00",
      "Your miss score: 0.00",
      "computer foe",
      "Seed",
      "schema assert failed",
      "quota",
      "serialize",
      "agent around its declared"
    ];
    for (const s of olds) {
      expect(findForbiddenTechnicalText(s), s).not.toBeNull();
    }
    expect(FORBIDDEN_DEFAULT_PATH.length).toBeGreaterThan(15);
  });
});

describe("App default path", () => {
  it("LandingView support copy matches locked sentence and new H1", () => {
    render(<App />);
    expect(screen.getByTestId("landing-support")).toHaveTextContent(
      LANDING_SUPPORT
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      LANDING_H1
    );
  });

  it("HonestyStrip full on home; compact More elsewhere", async () => {
    render(<App />);
    expect(screen.getByTestId("honesty-strip")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    await waitFor(() => {
      expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    });
    expect(screen.getByTestId("honesty-strip-compact")).toBeInTheDocument();
    fireEvent.click(screen.getByText("More"));
    expect(screen.getByText(/Small samples cannot rank models/i)).toBeTruthy();
  });

  it("forbids technical tokens on landing, Arena 3+ turns, Watch 3+ turns, tour, honesty", async () => {
    window.localStorage.removeItem(TOUR_KEY);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("first-visit-tour")).toBeInTheDocument();
    });
    assertClean(screen.getByTestId("first-visit-tour"));
    assertClean(screen.getByTestId("landing-view"));

    fireEvent.click(screen.getByTestId("tour-dismiss"));
    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    await waitFor(() => {
      expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    });

    for (let i = 0; i < 3; i += 1) {
      const buttons = screen.getAllByRole("button", { name: /Logic Storm/i });
      fireEvent.click(buttons[0]!);
      await Promise.resolve();
    }
    assertClean(screen.getByTestId("arena-view"));
    fireEvent.click(screen.getByText("More"));
    assertClean(screen.getByTestId("honesty-strip-compact"));

    fireEvent.click(screen.getByTestId("brand-home"));
    fireEvent.click(screen.getByTestId("cta-watch"));
    await waitFor(() => {
      expect(screen.getByTestId("watch-battle-view")).toBeInTheDocument();
    });
    const select = screen.getByTestId("watch-match-select");
    assertClean(select);
    expect(findForbiddenTechnicalText(collectSelectText(select))).toBeNull();
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByTestId("watch-next"));
    }
    assertClean(screen.getByTestId("watch-battle-view"));
  });
});

describe("FirstVisitTour", () => {
  it("shows on landing only, advances, closes on CTA, persists", async () => {
    window.localStorage.removeItem(TOUR_KEY);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("first-visit-tour")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("tour-next"));
    expect(screen.getByTestId("first-visit-tour").textContent ?? "").toMatch(
      /Watch \(2\/3\)/
    );
    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    await waitFor(() => {
      expect(screen.queryByTestId("first-visit-tour")).toBeNull();
    });
    expect(window.localStorage.getItem(TOUR_KEY)).toBe("1");
    expect(screen.getByTestId("arena-view")).toBeInTheDocument();
  });

  it("FirstVisitTour dismiss persists in localStorage", async () => {
    window.localStorage.removeItem(TOUR_KEY);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId("first-visit-tour")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("tour-dismiss"));
    expect(window.localStorage.getItem(TOUR_KEY)).toBe("1");
    expect(screen.queryByTestId("first-visit-tour")).toBeNull();
  });
});

describe("Clear save + mobile menu", () => {
  it("Clear-save confirm flow; disabled when empty", () => {
    render(<App />);
    const clear = screen.getByTestId("clear-slot") as HTMLButtonElement;
    expect(clear.disabled).toBe(true);

    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    fireEvent.click(screen.getByTestId("save-slot"));
    expect(
      (screen.getByTestId("clear-slot") as HTMLButtonElement).disabled
    ).toBe(false);
    fireEvent.click(screen.getByTestId("clear-slot"));
    expect(screen.getByTestId("clear-slot-confirm")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("clear-slot-cancel"));
    expect(screen.queryByTestId("clear-slot-confirm")).toBeNull();
    fireEvent.click(screen.getByTestId("clear-slot"));
    fireEvent.click(screen.getByTestId("clear-slot-yes"));
    expect(
      (screen.getByTestId("clear-slot") as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("Save/Load inside Menu at mobile width", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: String(query).includes("max-width"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    );
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 375
    });
    render(<App />);
    const nav = screen.getByTestId("primary-nav");
    expect(nav.contains(screen.getByTestId("save-controls"))).toBe(true);
    fireEvent.click(screen.getByTestId("nav-menu"));
    expect(screen.getByTestId("save-slot")).toBeInTheDocument();
    expect(screen.getByTestId("load-slot")).toBeInTheDocument();
  });
});

describe("ViewErrorBoundary", () => {
  it("shows plain message and Home for a throwing child", () => {
    function Boom(): React.JSX.Element {
      throw new Error("lazy fail");
    }
    const onHome = vi.fn();
    render(
      <ViewErrorBoundary onHome={onHome}>
        <Boom />
      </ViewErrorBoundary>
    );
    expect(screen.getByTestId("view-error-boundary")).toHaveTextContent(
      "Couldn't load this screen."
    );
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onHome).toHaveBeenCalled();
  });

  it("shows plain message when a lazy import rejects under Suspense", async () => {
    const RejectLazy = lazy(() =>
      Promise.reject(new Error("chunk load failed"))
    );
    const onHome = vi.fn();
    // Suppress React error boundary console noise for intentional reject.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ViewErrorBoundary onHome={onHome}>
        <Suspense fallback={<p>Loading…</p>}>
          <RejectLazy />
        </Suspense>
      </ViewErrorBoundary>
    );
    await waitFor(() => {
      expect(screen.getByTestId("view-error-boundary")).toHaveTextContent(
        "Couldn't load this screen."
      );
    });
    spy.mockRestore();
  });
});
