import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MoveFacts } from "./MoveFacts";

afterEach(() => cleanup());

describe("MoveFacts", () => {
  it.each([
    ["skill-core-identity", "Defense", 1, "Add up to 3 defense"],
    ["skill-signal-exposure", "Disrupt", 2, "Attack power 2 · Drain up to 2 opponent energy"],
    ["skill-logic-drift", "Healing", 2, "Restore up to 5 HP"],
    ["skill-null-pulse", "Defense", 2, "Add up to 5 defense"],
    ["skill-signal-breach", "Disrupt", 3, "Attack power 4 · Drain up to 2 opponent energy"],
    ["skill-sigil-rule", "Defense", 1, "Add up to 2 defense"],
    ["skill-override-pulse", "Attack", 4, "Attack power 7"],
    ["skill-logic-storm", "Attack", 5, "Attack power 9"]
  ] as const)("shows the catalog cost and effect for %s", (skillId, category, cost, effect) => {
    const { container } = render(<MoveFacts skillId={skillId} />);
    expect(screen.getByText(category)).toBeInTheDocument();
    expect(screen.getByText(`Cost: ${cost} energy`)).toBeInTheDocument();
    expect(screen.getByText(effect)).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/damage|best move|recommended/i);
  });

  it("uses a supplied recorded cost, including zero, instead of the catalog cost", () => {
    const { rerender } = render(
      <MoveFacts skillId="skill-logic-storm" energyCost={3} />
    );
    expect(screen.getByText("Cost: 3 energy")).toBeInTheDocument();
    expect(screen.queryByText("Cost: 5 energy")).not.toBeInTheDocument();
    expect(screen.getByText("Attack power 9")).toBeInTheDocument();

    rerender(<MoveFacts skillId="skill-logic-storm" energyCost={0} />);
    expect(screen.getByText("Cost: 0 energy")).toBeInTheDocument();
  });

  it("does not invent effect details for an unknown recorded move", () => {
    const { container, rerender } = render(
      <MoveFacts skillId="unknown-move" energyCost={6} />
    );
    expect(container).toHaveTextContent("Cost: 6 energy");
    expect(container.textContent).toBe("Cost: 6 energy");

    rerender(<MoveFacts skillId="unknown-move" />);
    expect(container).toBeEmptyDOMElement();
  });
});
