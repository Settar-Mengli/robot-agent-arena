import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DecisionLabView } from "./DecisionLabView";
import { ComparePanel } from "./ComparePanel";
import { assertDecisionLabPackV3 } from "../../decision-lab";
import rawPack from "./pack/decision-lab.v3.json";

afterEach(() => {
  cleanup();
});

describe("ComparePanel via DecisionLabView", () => {
  it("groq base→grounded: 13 matched, 1 changed, 2.15→2.00", async () => {
    render(<DecisionLabView />);
    fireEvent.click(screen.getByTestId("lab-advanced-toggle"));
    fireEvent.click(screen.getByRole("tab", { name: "Compare" }));
    await screen.findByTestId("lab-compare");
    fireEvent.change(screen.getByTestId("compare-model"), {
      target: { value: "1" }
    });
    expect(screen.getByTestId("compare-matched")).toHaveTextContent(
      "Situations matched: 13"
    );
    expect(screen.getByTestId("compare-changed")).toHaveTextContent(
      "Decisions changed: 1 / 13"
    );
    expect(screen.getByTestId("compare-mean")).toHaveTextContent("2.15 → 2.00");
  });

  it("gemini base vs groq base: 13 matched, 2.00→2.15", async () => {
    render(<DecisionLabView />);
    fireEvent.click(screen.getByTestId("lab-advanced-toggle"));
    fireEvent.click(screen.getByRole("tab", { name: "Compare" }));
    await screen.findByTestId("lab-compare");
    fireEvent.change(screen.getByTestId("compare-mode"), {
      target: { value: "cross-model" }
    });
    expect(
      screen.getByText(/Comparing Gemini Basic prompt to Groq Basic prompt/i)
    ).toBeTruthy();
    expect(screen.getByTestId("compare-matched")).toHaveTextContent(
      "Situations matched: 13"
    );
    expect(screen.getByTestId("compare-mean")).toHaveTextContent("2.00 → 2.15");
  });
});

describe("Compare evidence labels", () => {
  const pack = assertDecisionLabPackV3(rawPack);

  it("shows evidence label when insufficientEvidence is true and hides when false", () => {
    const { rerender } = render(
      <ComparePanel
        pack={pack}
        suiteId="heldout-adversarial"
        forceInsufficientEvidence={true}
      />
    );
    expect(screen.getByTestId("lab-insufficient-evidence")).toBeTruthy();
    expect(screen.getByTestId("lab-insufficient-evidence").textContent).toMatch(
      /Too little data to rank models \(\d+ situations\)/
    );

    rerender(
      <ComparePanel
        pack={pack}
        suiteId="heldout-adversarial"
        forceInsufficientEvidence={false}
      />
    );
    expect(screen.queryByTestId("lab-insufficient-evidence")).toBeNull();
  });
});

describe("DiagnosticsPanel via DecisionLabView", () => {
  it("DiagnosticsPanel does not render pack wording substring", () => {
    render(<DecisionLabView />);
    fireEvent.click(screen.getByTestId("lab-advanced-toggle"));
    fireEvent.click(screen.getByRole("tab", { name: "Diagnostics" }));
    expect(screen.getByTestId("lab-diagnostics")).toBeTruthy();

    expect(document.body.textContent ?? "").not.toMatch(
      /coincided with lower regret/
    );
    expect(screen.getByTestId("cluster-honesty")).toBeTruthy();
    expect(screen.getAllByTestId("help-ranking-row").length).toBeGreaterThan(0);
  });
});
