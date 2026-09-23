import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { CombatantBars } from "./CombatantBars";

afterEach(() => {
  cleanup();
});

describe("CombatantBars", () => {
  it("exposes aria-valuenow / min / max on progressbars", () => {
    const { container } = render(
      <CombatantBars
        title="Your robot"
        name="AEGIS"
        health={42}
        maxHealth={100}
        energy={3}
        maxEnergy={10}
        defense={2}
      />
    );
    const bars = container.querySelectorAll('[role="progressbar"]');
    expect(bars.length).toBe(2);
    expect(bars[0]!.getAttribute("aria-valuenow")).toBe("42");
    expect(bars[0]!.getAttribute("aria-valuemin")).toBe("0");
    expect(bars[0]!.getAttribute("aria-valuemax")).toBe("100");
    expect(bars[1]!.getAttribute("aria-valuenow")).toBe("3");
    expect(bars[1]!.getAttribute("aria-valuemin")).toBe("0");
    expect(bars[1]!.getAttribute("aria-valuemax")).toBe("10");
  });
});
