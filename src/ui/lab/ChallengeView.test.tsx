import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { assertDecisionLabPackV3 } from "../../decision-lab";
import { findForbiddenTechnicalText } from "../copy/forbidden-default-path";
import rawPack from "./pack/decision-lab.v3.json";
import { ChallengeView } from "./ChallengeView";

afterEach(() => {
  cleanup();
});

describe("ChallengeView", () => {
  const pack = assertDecisionLabPackV3(rawPack);

  it("session starts with No answers yet and omits model-rank label", () => {
    render(<ChallengeView pack={pack} />);
    expect(screen.getByTestId("challenge-session")).toHaveTextContent(
      "No answers yet."
    );
    expect(screen.queryByText(/Too little data to rank models/i)).toBeNull();
    expect(screen.getByTestId("challenge-you-side")).toHaveTextContent(
      /You \(in the AI/
    );
    expect(screen.getByTestId("challenge-opponent-side")).toHaveTextContent(
      /Opponent \(follows a fixed plan\)/
    );
  });

  it("Show answer is enabled after a pick", () => {
    render(<ChallengeView pack={pack} />);
    const btn = screen.getByTestId("challenge-show-answer") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("radio")[0]!);
    expect(btn.disabled).toBe(false);
  });

  it("guided reveal: best path and worse path with plain sentences", () => {
    render(<ChallengeView pack={pack} guided />);
    const case0 = pack.cases.find((c) =>
      Object.values(c.policies).some(
        (p) => p.status === "recorded" && p.source === "llm"
      )
    )!;
    const best = case0.oracle.best[0]!;
    const radios = screen.getAllByRole("radio");
    const bestRadio = radios.find(
      (r) => (r as HTMLInputElement).value === best
    );
    expect(bestRadio).toBeTruthy();
    fireEvent.click(bestRadio!);
    fireEvent.click(screen.getByTestId("challenge-show-answer"));
    const reveal = screen.getByTestId("challenge-reveal");
    expect(reveal).toHaveTextContent("You picked the best move.");
    expect(findForbiddenTechnicalText(reveal.textContent ?? "")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Next situation/i }));
    const worse = screen
      .getAllByRole("radio")
      .find((r) => !(r as HTMLInputElement).disabled);
    fireEvent.click(worse!);
    // Prefer a non-best if available
    const nonBest = screen
      .getAllByRole("radio")
      .find(
        (r) =>
          (r as HTMLInputElement).value !==
          pack.cases.find((c) => c.equippedSkillIds.length > 0)?.oracle.best[0]
      );
    if (nonBest) {
      fireEvent.click(nonBest);
      fireEvent.click(screen.getByTestId("challenge-show-answer"));
      const r2 = screen.getByTestId("challenge-reveal");
      expect(r2.textContent ?? "").toMatch(/points worse than the best move/);
      expect(findForbiddenTechnicalText(r2.textContent ?? "")).toBeNull();
      expect(r2.textContent ?? "").not.toMatch(/skill-/);
    }
  });

  it("groups identical recorded-AI picks on reveal", () => {
    render(<ChallengeView pack={pack} guided />);
    fireEvent.click(screen.getAllByRole("radio")[0]!);
    fireEvent.click(screen.getByTestId("challenge-show-answer"));
    const reveal = screen.getByTestId("challenge-reveal");
    expect(reveal.textContent ?? "").toMatch(/picked|All \d+ recorded AI/);
  });

  it("keeps visual selection after Reveal", () => {
    render(<ChallengeView pack={pack} />);
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]!);
    fireEvent.click(screen.getByTestId("challenge-show-answer"));
    const selected = screen
      .getByTestId("challenge-reveal")
      .closest("section")
      ?.querySelector('[data-selected="true"]');
    expect(selected).toBeTruthy();
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
  });

  it("session summary after answer uses plain counts", () => {
    render(<ChallengeView pack={pack} />);
    fireEvent.click(screen.getAllByRole("radio")[0]!);
    fireEvent.click(screen.getByTestId("challenge-show-answer"));
    const session = screen.getByTestId("challenge-session");
    expect(session.textContent ?? "").toMatch(/You: 1 answers/);
    expect(session.textContent ?? "").not.toMatch(/\bn=/);
    expect(session.textContent ?? "").not.toMatch(/mean/);
  });
});
