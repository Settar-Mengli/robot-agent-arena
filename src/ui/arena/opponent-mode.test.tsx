import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { createBattleViewStore } from "../store/battle-view";
import { startBattle, determineBattleOutcome } from "../../engine";
import { QUICKSTART_ROBOT } from "../data/quickstart-robot";
import { CPU_OPPONENTS } from "../../data/opponents";
import { ArenaView } from "./ArenaView";
import { ResultsView } from "./ResultsView";
import { opponentModeLine } from "./opponent-mode";
import { findForbiddenTechnicalText } from "../copy/forbidden-default-path";

afterEach(() => {
  cleanup();
});

describe("opponentMode honesty labels", () => {
  const runtime = startBattle(
    QUICKSTART_ROBOT,
    CPU_OPPONENTS[0]!,
    "mode-1",
    5
  );

  it("cpu mode shows simple computer", () => {
    const store = createBattleViewStore();
    store.getState().resetBattle(runtime);
    render(
      <ArenaView store={store} onLeave={() => {}} opponentMode="cpu" />
    );
    expect(screen.getByTestId("arena-opponent-line")).toHaveTextContent(
      "Opponent: simple computer (not an AI)"
    );
    expect(
      findForbiddenTechnicalText(
        screen.getByTestId("arena-view").textContent ?? ""
      )
    ).toBeNull();
  });

  it("live mode names the model and honesty", () => {
    const store = createBattleViewStore();
    store.getState().resetBattle(runtime);
    render(
      <ArenaView
        store={store}
        onLeave={() => {}}
        opponentMode="live"
        liveModelId="openrouter/free"
      />
    );
    const line = opponentModeLine("live", "openrouter/free");
    expect(screen.getByTestId("arena-opponent-line")).toHaveTextContent(line);
    expect(
      findForbiddenTechnicalText(
        screen.getByTestId("arena-view").textContent ?? ""
      )
    ).toBeNull();
  });

  it("live-fallback shows this-turn computer and notice", () => {
    const store = createBattleViewStore();
    store.getState().resetBattle(runtime);
    render(
      <ArenaView
        store={store}
        onLeave={() => {}}
        opponentMode="live-fallback"
        liveModelId="openrouter/free"
        liveNotice="Could not reach the live model."
      />
    );
    expect(screen.getByTestId("arena-opponent-line")).toHaveTextContent(
      "This turn: simple computer."
    );
    expect(screen.getByTestId("arena-live-notice").textContent).toMatch(
      /This turn: simple computer/
    );
    expect(
      findForbiddenTechnicalText(
        screen.getByTestId("arena-view").textContent ?? ""
      )
    ).toBeNull();
  });

  it("ResultsView mirrors opponentMode", () => {
    const outcome =
      determineBattleOutcome(
        runtime.player,
        runtime.cpu,
        runtime.session.turn,
        runtime.session.maxTurns
      ) ?? {
        result: "draw" as const,
        reason: "turn-limit" as const
      };
    render(
      <ResultsView
        outcome={outcome}
        turns={[]}
        playerName="P"
        cpuName="C"
        finalPlayer={runtime.player}
        finalCpu={runtime.cpu}
        onRestart={() => {}}
        onReturnHome={() => {}}
        opponentMode="live"
        liveModelId="openrouter/free"
      />
    );
    expect(screen.getByTestId("results-opponent-line")).toHaveTextContent(
      opponentModeLine("live", "openrouter/free")
    );
    expect(
      findForbiddenTechnicalText(
        screen.getByTestId("results-view").textContent ?? ""
      )
    ).toBeNull();
  });
});
