import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("shows recorded costs without changing move order or affordability behavior", () => {
    const current = pack.cases.find(
      (c) => c.equippedSkillIds.length > 0 && Object.values(c.policies).some(
        (p) => p.status === "recorded" && p.source === "llm"
      )
    )!;
    const firstId = current.equippedSkillIds[0]!;
    const recordedPack = {
      ...pack,
      cases: [{
        ...current,
        affordability: [
          { skillId: firstId, energyCost: 99, affordable: false },
          ...current.affordability.filter((a) => a.skillId !== firstId)
        ]
      }]
    };
    render(<ChallengeView pack={recordedPack} />);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((radio) => radio.value)).toEqual(current.equippedSkillIds);
    const firstCard = radios[0]!.closest("label")!;
    expect(within(firstCard).getByText("Cost: 99 energy")).toBeInTheDocument();
    expect(within(firstCard).getByText("Not enough energy")).toBeInTheDocument();
    expect(radios[0]).not.toBeDisabled();
    fireEvent.click(radios[0]!);
    expect(radios[0]).toBeChecked();
    expect(screen.getByTestId("challenge-show-answer")).toBeEnabled();
    expect(screen.queryByTestId("challenge-reveal")).not.toBeInTheDocument();
  });

  it("keeps the answer hidden until reveal, then locks the pick until the next situation", () => {
    render(<ChallengeView pack={pack} />);
    const radios = screen.getAllByRole("radio");
    const showAnswer = screen.getByTestId("challenge-show-answer");
    expect(radios.length).toBeGreaterThan(1);
    expect(screen.queryByTestId("challenge-reveal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("challenge-ai-group")).not.toBeInTheDocument();
    fireEvent.click(showAnswer);
    expect(screen.queryByTestId("challenge-reveal")).not.toBeInTheDocument();

    fireEvent.click(radios[0]!);
    expect(screen.queryByTestId("challenge-reveal")).not.toBeInTheDocument();
    expect(screen.getByTestId("challenge-session")).toHaveTextContent("No answers yet.");

    fireEvent.click(showAnswer);
    expect(screen.getByTestId("challenge-reveal")).toBeInTheDocument();
    expect(showAnswer).toBeDisabled();
    for (const radio of radios) expect(radio).toBeDisabled();
    fireEvent.click(radios[1]!);
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();
    fireEvent.click(showAnswer);
    expect(screen.getByTestId("challenge-session")).toHaveTextContent(
      /1 of 1 best picks|0 of 1 best picks/
    );

    fireEvent.click(screen.getByRole("button", { name: "Next situation" }));
    expect(screen.queryByTestId("challenge-reveal")).not.toBeInTheDocument();
    expect(showAnswer).toBeDisabled();
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeDisabled();
      expect(radio).not.toBeChecked();
    }
  });

  it("shows the CPU observation as your resources and the player as the opponent", () => {
    const current = pack.cases.find(
      (c) => c.equippedSkillIds.length > 0 && Object.values(c.policies).some(
        (p) => p.status === "recorded" && p.source === "llm"
      )
    )!;
    const resourcePack = {
      ...pack,
      cases: [{
        ...current,
        observation: {
          cpu: { ...current.observation.cpu, health: 7, energy: 4, defense: 2 },
          player: { ...current.observation.player, health: 21, energy: 3, defense: 5 }
        }
      }]
    };
    render(<ChallengeView pack={resourcePack} />);
    const yours = within(screen.getByTestId("challenge-you-side"));
    const opponent = within(screen.getByTestId("challenge-opponent-side"));
    expect(yours.getByText("HP").nextElementSibling).toHaveTextContent(
      `7/${current.observation.cpu.maxHealth}`
    );
    expect(yours.getByText("Energy").nextElementSibling).toHaveTextContent(
      `4/${current.observation.cpu.maxEnergy}`
    );
    expect(yours.getByText("Defense").nextElementSibling).toHaveTextContent("2");
    expect(opponent.getByText("HP").nextElementSibling).toHaveTextContent(
      `21/${current.observation.player.maxHealth}`
    );
    expect(opponent.getByText("Energy").nextElementSibling).toHaveTextContent(
      `3/${current.observation.player.maxEnergy}`
    );
    expect(opponent.getByText("Defense").nextElementSibling).toHaveTextContent("5");
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
    expect(session.textContent ?? "").toMatch(/\d of 1 best picks/);
    expect(session.textContent ?? "").toMatch(/Average gap vs best move/);
    expect(session.textContent ?? "").not.toMatch(/\bn=/);
    expect(session.textContent ?? "").not.toMatch(/mean/);
    expect(findForbiddenTechnicalText(session.textContent ?? "")).toBeNull();
  });

  it("shows session wrap after three answers", () => {
    render(<ChallengeView pack={pack} />);
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getAllByRole("radio")[0]!);
      fireEvent.click(screen.getByTestId("challenge-show-answer"));
      if (i < 2) {
        expect(screen.queryByTestId("challenge-session-wrap")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Next situation" }));
      }
    }
    const wrap = screen.getByTestId("challenge-session-wrap");
    expect(wrap.textContent ?? "").toMatch(/So far: \d+ best picks out of 3/);
    expect(findForbiddenTechnicalText(wrap.textContent ?? "")).toBeNull();
  });

  it("Next situation stays disabled until answer is shown", () => {
    render(<ChallengeView pack={pack} />);
    const next = screen.getByTestId("challenge-next") as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("radio")[0]!);
    expect(next.disabled).toBe(true);
    fireEvent.click(screen.getByTestId("challenge-show-answer"));
    expect(next.disabled).toBe(false);
  });
});
