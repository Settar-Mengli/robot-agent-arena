/**
 * F15: visit each demo screen and assert locked honesty / chrome cues.
 * textContent dumps are truncated in assertions; full dumps live in the Build report.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { App } from "./App";
import {
  CPU_HONESTY_ONE_LINE,
  HOME_HONESTY_ONE_LINE,
  HONESTY_ONE_LINE
} from "./HonestyStrip";
import { TOUR_KEY } from "./tour/FirstVisitTour";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("demo visible copy (F15)", () => {
  it("Home / Setup cpu / Watch / Beat the AI / Leaderboard / How it works honesty modes", async () => {
    window.localStorage.setItem(TOUR_KEY, "1");
    render(<App />);

    expect(screen.getByTestId("honesty-one-line")).toHaveTextContent(
      HOME_HONESTY_ONE_LINE
    );

    fireEvent.click(screen.getByTestId("cta-live-ai"));
    await waitFor(() => {
      expect(screen.getByTestId("battle-setup")).toBeInTheDocument();
    });
    expect(
      within(screen.getByTestId("battle-setup")).getByTestId("honesty-one-line")
    ).toHaveTextContent(CPU_HONESTY_ONE_LINE);
    expect(screen.getByTestId("setup-opponent-blurb").textContent).not.toMatch(
      /seed/i
    );

    fireEvent.click(screen.getByTestId("brand-home"));
    fireEvent.click(screen.getByTestId("cta-watch"));
    await waitFor(
      () => {
        expect(screen.getByTestId("watch-battle-view")).toBeInTheDocument();
      },
      { timeout: 15000 }
    );
    expect(screen.getByTestId("watch-gemini-note")).toHaveTextContent(
      "These recordings use Gemini (6 fights)."
    );
    expect(
      within(screen.getByTestId("watch-battle-view")).getByTestId(
        "honesty-one-line"
      )
    ).toHaveTextContent(HONESTY_ONE_LINE);
    expect(screen.getByTestId("watch-leave")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("nav-lab"));
    await waitFor(
      () => {
        expect(screen.getByTestId("decision-lab")).toBeInTheDocument();
      },
      { timeout: 15000 }
    );
    const lab = screen.getByTestId("decision-lab");
    expect(lab.textContent).toMatch(/How we measure|Beat the AI|Pick a move/i);
    expect(within(lab).getByTestId("honesty-one-line")).toHaveTextContent(
      HONESTY_ONE_LINE
    );
    expect(screen.getByTestId("challenge-show-answer")).toHaveAttribute(
      "title",
      "Pick a move first"
    );
    expect(screen.getByTestId("challenge-sticky-bar").className).not.toMatch(
      /-mx-/
    );

    fireEvent.click(screen.getByTestId("lab-advanced-toggle"));
    fireEvent.click(screen.getByRole("tab", { name: "Compare" }));
    await waitFor(() => {
      expect(screen.getByTestId("lab-compare")).toBeInTheDocument();
    });
    const compare = screen.getByTestId("lab-compare");
    expect(compare.textContent).toMatch(/Compared on \d+ situations/);
    expect(compare.textContent).not.toMatch(/miss score|Cohort/i);
    const suiteSelect = screen.getByLabelText(/Test set/i);
    expect(suiteSelect.textContent).toBe("Small check set (13 situations)");

    fireEvent.click(screen.getByRole("tab", { name: /Situations/i }));
    const situations = await screen.findByRole("tabpanel", {
      name: /Situations/i
    });
    expect(situations.textContent ?? "").not.toMatch(/__/);
    expect(situations.textContent ?? "").not.toMatch(/miss score/i);

    fireEvent.click(screen.getByRole("tab", { name: /Diagnostics/i }));
    const diag = await screen.findByTestId("lab-diagnostics");
    expect(diag.textContent).toMatch(/How costly the mistakes were/);
    expect(diag.textContent).toMatch(/Matches the published results/);
    expect(diag.textContent).not.toMatch(/\{0\}|∞|\(0,10]/);

    fireEvent.click(screen.getByTestId("nav-leaderboard"));
    await waitFor(
      () => {
        expect(screen.getByTestId("leaderboard-view")).toBeInTheDocument();
      },
      { timeout: 15000 }
    );
    expect(
      within(screen.getByTestId("leaderboard-view")).getByTestId(
        "honesty-one-line"
      )
    ).toHaveTextContent(HONESTY_ONE_LINE);
    expect(
      screen.getAllByTestId("leaderboard-chart-scale").length
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("nav-methodology"));
    await waitFor(
      () => {
        expect(screen.getByTestId("methodology-view")).toBeInTheDocument();
      },
      { timeout: 15000 }
    );
    expect(
      within(screen.getByTestId("methodology-view")).getByTestId(
        "honesty-one-line"
      )
    ).toHaveTextContent(HONESTY_ONE_LINE);
  }, 60000);
});
