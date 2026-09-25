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
import {
  CPU_HONESTY_ONE_LINE,
  LIVE_HONESTY_ONE_LINE
} from "../HonestyStrip";
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

  function assertClean(root: HTMLElement) {
    expect(findForbiddenTechnicalText(root.textContent ?? "")).toBeNull();
  }

  it("cpu mode shows simple computer and CPU HonestyStrip", () => {
    const store = createBattleViewStore();
    store.getState().resetBattle(runtime);
    render(
      <ArenaView store={store} onLeave={() => {}} opponentMode="cpu" />
    );
    expect(screen.getByTestId("arena-opponent-line")).toHaveTextContent(
      "Opponent: simple computer (not an AI)"
    );
    expect(screen.getByTestId("honesty-one-line")).toHaveTextContent(
      CPU_HONESTY_ONE_LINE
    );
    const text = screen.getByTestId("arena-view").textContent ?? "";
    expect(text).not.toMatch(/Recorded examples, not live AI/);
    assertClean(screen.getByTestId("arena-view"));
  });

  it("live mode names the model and live HonestyStrip (no not-live claim)", () => {
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
    expect(screen.getByTestId("honesty-one-line")).toHaveTextContent(
      LIVE_HONESTY_ONE_LINE
    );
    const text = screen.getByTestId("arena-view").textContent ?? "";
    expect(text).not.toMatch(/Recorded examples, not live AI/);
    expect(text).not.toMatch(/AI answers here are recorded, not live/);
    assertClean(screen.getByTestId("arena-view"));
  });

  it("live-fallback shows this-turn computer, notice, and live HonestyStrip", () => {
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
    expect(screen.getByTestId("honesty-one-line")).toHaveTextContent(
      LIVE_HONESTY_ONE_LINE
    );
    const text = screen.getByTestId("arena-view").textContent ?? "";
    expect(text).not.toMatch(/Recorded examples, not live AI/);
    assertClean(screen.getByTestId("arena-view"));
  });

  it("ResultsView mirrors opponentMode and HonestyStrip for live", () => {
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
    expect(screen.getByTestId("honesty-one-line")).toHaveTextContent(
      LIVE_HONESTY_ONE_LINE
    );
    expect(screen.getByTestId("results-view").textContent).not.toMatch(
      /Recorded examples, not live AI/
    );
    assertClean(screen.getByTestId("results-view"));
  });

  it("ResultsView cpu uses CPU HonestyStrip, not recorded", () => {
    const outcome = {
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
        opponentMode="cpu"
      />
    );
    expect(screen.getByTestId("honesty-one-line")).toHaveTextContent(
      CPU_HONESTY_ONE_LINE
    );
    expect(screen.getByTestId("results-view").textContent).not.toMatch(
      /Recorded examples, not live AI/
    );
    assertClean(screen.getByTestId("results-view"));
  });
});
