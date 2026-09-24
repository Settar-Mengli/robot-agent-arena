import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { assertDecisionLabPackV3 } from "../../decision-lab";
import rawPack from "./pack/decision-lab.v3.json";
import { ComparePanel } from "./ComparePanel";

afterEach(() => {
  cleanup();
});

describe("ComparePanel self-compare", () => {
  const pack = assertDecisionLabPackV3(rawPack);

  it("disables the matching variant option on the other side", () => {
    render(<ComparePanel pack={pack} suiteId="heldout-adversarial" />);
    const bSelect = screen.getByTestId("compare-variant-b");
    const baseInB = bSelect.querySelector(
      'option[value="base"]'
    ) as HTMLOptionElement;
    expect(baseInB.disabled).toBe(true);

    const aSelect = screen.getByTestId("compare-variant-a");
    const groundedInA = aSelect.querySelector(
      'option[value="grounded"]'
    ) as HTMLOptionElement;
    expect(groundedInA.disabled).toBe(true);
  });

  it("shows pick-different message and skips numbers when variants match", () => {
    render(<ComparePanel pack={pack} suiteId="heldout-adversarial" />);
    fireEvent.change(screen.getByTestId("compare-variant-b"), {
      target: { value: "base" }
    });
    expect(screen.getByTestId("compare-same-variant")).toHaveTextContent(
      "Pick two different variants."
    );
    expect(screen.queryByTestId("compare-matched")).toBeNull();
    expect(screen.queryByTestId("compare-changed")).toBeNull();
    expect(screen.queryByTestId("compare-mean")).toBeNull();
  });
});
