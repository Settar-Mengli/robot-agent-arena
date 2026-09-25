import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CPU_OPPONENTS } from "../../data/opponents";
import type { StoreApi } from "zustand/vanilla";
import { App } from "../App";
import { QUICKSTART_ROBOT } from "../data/quickstart-robot";
import { createGreedyPlayTurn } from "../play/cpu-turn";
import { SAVE_SLOT_KEY, saveSlot } from "../persist/save-slot";
import type {
  BattleViewStore,
  PlayTurnFn,
  UiTurnResult
} from "../store/battle-view";
import { TOUR_KEY } from "../tour/FirstVisitTour";

const liveCalls = { n: 0 };
const greedy = createGreedyPlayTurn();

vi.mock("./createLivePlayTurn", () => ({
  createLivePlayTurn: vi.fn(
    (opts: {
      apiKey: string;
      modelId: string;
      onNotice?: (m: string | null) => void;
      signal?: AbortSignal;
      isNoticeCurrent?: () => boolean;
    }): PlayTurnFn => {
      return async (runtime, playerSkillId) => {
        liveCalls.n += 1;
        const emit = (m: string | null) => {
          if (opts.isNoticeCurrent !== undefined && !opts.isNoticeCurrent()) {
            return;
          }
          opts.onNotice?.(m);
        };
        if (liveCalls.n === 1) {
          emit("Could not reach the live model.");
          return greedy(runtime, playerSkillId);
        }
        emit(null);
        const result = await greedy(runtime, playerSkillId);
        const withTrace: UiTurnResult = {
          step: result.step,
          trace: {
            promptVersion: "test",
            turn: runtime.session.turn,
            budgetMs: 0,
            elapsedMs: 0,
            observation: null,
            messages: [],
            attempts: [],
            source: "llm",
            proposedSkillId: runtime.session.cpu.skillIds[0]!
          }
        };
        return withTrace;
      };
    }
  )
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  liveCalls.n = 0;
  vi.clearAllMocks();
});

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem(TOUR_KEY, "1");
  liveCalls.n = 0;
});

function assertKeyAbsent(secret: string) {
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const k = window.localStorage.key(i);
    if (k === null) continue;
    expect(window.localStorage.getItem(k) ?? "").not.toContain(secret);
  }
  for (let i = 0; i < window.sessionStorage.length; i += 1) {
    const k = window.sessionStorage.key(i);
    if (k === null) continue;
    expect(window.sessionStorage.getItem(k) ?? "").not.toContain(secret);
  }
  expect(window.location.href).not.toContain(secret);
}

async function enableLiveAndStart(secret: string) {
  fireEvent.click(screen.getByTestId("nav-build"));
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "LIVE-UNIT" }
  });
  fireEvent.change(screen.getByLabelText("Robot identity"), {
    target: { value: "Steady Vanguard" }
  });
  fireEvent.change(screen.getByLabelText("Memory"), {
    target: { value: "Pattern Recall" }
  });
  fireEvent.change(screen.getByLabelText("Sigil and Security"), {
    target: { value: "Aegis Layer" }
  });
  fireEvent.change(screen.getByLabelText("Rules"), {
    target: { value: "Never Skip Verification" }
  });
  fireEvent.change(screen.getByLabelText("Strategy"), {
    target: { value: "Measured Pressure" }
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /Override Pulse/i }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Logic Storm/i }));
  fireEvent.click(screen.getByRole("button", { name: /Check robot/i }));
  fireEvent.click(
    screen.getByRole("button", { name: /Continue to battle setup/i })
  );
  fireEvent.click(screen.getByTestId("reveal-live-opponent"));
  await waitFor(() => {
    expect(screen.getByTestId("live-opponent-panel")).toBeInTheDocument();
  });
  fireEvent.click(screen.getByTestId("live-opponent-toggle"));
  fireEvent.change(screen.getByTestId("live-api-key"), {
    target: { value: secret }
  });
  fireEvent.click(screen.getByRole("button", { name: /Start battle/i }));
  await waitFor(() => {
    expect(screen.getByTestId("arena-view")).toBeInTheDocument();
  });
}

async function playUntilResults() {
  for (let i = 0; i < 40; i += 1) {
    if (screen.queryByTestId("results-view")) break;
    const buttons = screen.queryAllByRole("button", { name: /Logic Storm/i });
    if (buttons[0]) {
      fireEvent.click(buttons[0]);
      await Promise.resolve();
    } else {
      break;
    }
  }
  await waitFor(() => {
    expect(screen.getByTestId("results-view")).toBeInTheDocument();
  });
}

describe("live session lifecycle (D-053)", () => {
  const SECRET = "sk-live-secret-never-store";

  it(
    "Fight again continues live calls; key never in storage/URL",
    async () => {
      render(<App />);
      await enableLiveAndStart(SECRET);
      assertKeyAbsent(SECRET);

      const before = liveCalls.n;
      fireEvent.click(
        screen.getAllByRole("button", { name: /Logic Storm/i })[0]!
      );
      await waitFor(() => expect(liveCalls.n).toBeGreaterThan(before));
      assertKeyAbsent(SECRET);

      await playUntilResults();
      assertKeyAbsent(SECRET);

      const mid = liveCalls.n;
      fireEvent.click(screen.getByRole("button", { name: /Fight again/i }));
      await waitFor(() => {
        expect(screen.getByTestId("arena-view")).toBeInTheDocument();
      });
      fireEvent.click(
        screen.getAllByRole("button", { name: /Logic Storm/i })[0]!
      );
      await waitFor(() => expect(liveCalls.n).toBeGreaterThan(mid));
      assertKeyAbsent(SECRET);
    },
    20_000
  );

  it("Leave → Load → turn makes 0 live calls", async () => {
    saveSlot(
      {
        draft: {
          playerConfig: QUICKSTART_ROBOT,
          opponentId: CPU_OPPONENTS[0]!.agentId,
          seed: "load-cpu"
        },
        mode: "free",
        runtime: null,
        battleOver: false
      },
      { inFlight: false }
    );

    render(<App />);
    await enableLiveAndStart(SECRET);
    fireEvent.click(screen.getAllByRole("button", { name: /Logic Storm/i })[0]!);
    await waitFor(() => expect(liveCalls.n).toBeGreaterThan(0));

    // Leave via brand home (clears live session)
    fireEvent.click(screen.getByTestId("brand-home"));
    await waitFor(() => {
      expect(screen.getByTestId("landing-view")).toBeInTheDocument();
    });
    assertKeyAbsent(SECRET);

    liveCalls.n = 0;
    {
      const trigger = screen.getByTestId("saved-game-trigger");
      if (trigger.getAttribute("aria-expanded") !== "true") {
        fireEvent.click(trigger);
      }
    }
    fireEvent.click(screen.getByTestId("load-slot"));
    await waitFor(() => {
      expect(screen.getByTestId("battle-setup")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Start battle/i }));
    await waitFor(() => {
      expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Logic Storm/i })[0]!);
    await waitFor(() => {
      expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    });
    // Allow async turn settle
    await new Promise((r) => setTimeout(r, 50));
    expect(liveCalls.n).toBe(0);
    expect(window.localStorage.getItem(SAVE_SLOT_KEY) ?? "").not.toContain(
      SECRET
    );
    assertKeyAbsent(SECRET);
  }, 20_000);

  it("Load without Leave mid-battle clears live; next turn is CPU (0 live calls)", async () => {
    render(<App />);
    await enableLiveAndStart(SECRET);

    fireEvent.click(
      screen.getAllByRole("button", { name: /Logic Storm/i })[0]!
    );
    await waitFor(() => expect(liveCalls.n).toBeGreaterThan(0));
    assertKeyAbsent(SECRET);

    fireEvent.click(screen.getByTestId("saved-game-trigger"));
    const saveBtn = screen
      .getAllByTestId("save-slot")
      .find((el) => !(el as HTMLButtonElement).disabled);
    expect(saveBtn).toBeTruthy();
    fireEvent.click(saveBtn!);
    await waitFor(() => {
      expect(window.localStorage.getItem(SAVE_SLOT_KEY)).toBeTruthy();
    });

    liveCalls.n = 0;
    fireEvent.click(screen.getByTestId("load-slot"));
    await waitFor(() => {
      expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: /Logic Storm/i })[0]!
    );
    await new Promise((r) => setTimeout(r, 80));
    expect(liveCalls.n).toBe(0);
    assertKeyAbsent(SECRET);
  }, 20_000);

  it("failure then success clears the arena live notice", async () => {
    render(<App />);
    await enableLiveAndStart(SECRET);

    fireEvent.click(screen.getAllByRole("button", { name: /Logic Storm/i })[0]!);
    await waitFor(() => {
      expect(screen.getByTestId("arena-live-notice")).toBeInTheDocument();
    });
    assertKeyAbsent(SECRET);

    fireEvent.click(screen.getAllByRole("button", { name: /Logic Storm/i })[0]!);
    await waitFor(() => {
      expect(screen.queryByTestId("arena-live-notice")).not.toBeInTheDocument();
    });
    assertKeyAbsent(SECRET);
  });

  it("late live failure after Leave does not resurrect notice", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const { createLivePlayTurn } = await import("./createLivePlayTurn");
    vi.mocked(createLivePlayTurn).mockImplementationOnce(
      (opts: {
        onNotice?: (m: string | null) => void;
        isNoticeCurrent?: () => boolean;
      }): PlayTurnFn => {
        return async (runtime, playerSkillId) => {
          await gate;
          if (opts.isNoticeCurrent === undefined || opts.isNoticeCurrent()) {
            opts.onNotice?.("Could not reach the live model.");
          }
          return greedy(runtime, playerSkillId);
        };
      }
    );

    render(<App />);
    // Build + setup + enable live without using enableLiveAndStart's Start click path fully
    fireEvent.click(screen.getByTestId("nav-build"));
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "LIVE-UNIT" }
    });
    fireEvent.change(screen.getByLabelText("Robot identity"), {
      target: { value: "Steady Vanguard" }
    });
    fireEvent.change(screen.getByLabelText("Memory"), {
      target: { value: "Pattern Recall" }
    });
    fireEvent.change(screen.getByLabelText("Sigil and Security"), {
      target: { value: "Aegis Layer" }
    });
    fireEvent.change(screen.getByLabelText("Rules"), {
      target: { value: "Never Skip Verification" }
    });
    fireEvent.change(screen.getByLabelText("Strategy"), {
      target: { value: "Measured Pressure" }
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Override Pulse/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Logic Storm/i }));
    fireEvent.click(screen.getByRole("button", { name: /Check robot/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Continue to battle setup/i })
    );
    fireEvent.click(screen.getByTestId("reveal-live-opponent"));
    await waitFor(() => {
      expect(screen.getByTestId("live-opponent-panel")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("live-opponent-toggle"));
    fireEvent.change(screen.getByTestId("live-api-key"), {
      target: { value: SECRET }
    });
    fireEvent.click(screen.getByRole("button", { name: /Start battle/i }));
    await waitFor(() => {
      expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Logic Storm/i })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /^Leave$/i }));
    await waitFor(() => {
      expect(screen.getByTestId("landing-view")).toBeInTheDocument();
    });
    release();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("arena-live-notice")).not.toBeInTheDocument();
    expect(screen.queryByTestId("setup-live-notice")).not.toBeInTheDocument();
    assertKeyAbsent(SECRET);
  }, 20_000);

  it("header Home while deferred turn pending ignores later settle", async () => {
    const gate = deferredTurn();
    let capturedRuntime: Parameters<PlayTurnFn>[0] | null = null;
    const playTurn: PlayTurnFn = async (runtime, playerSkillId) => {
      capturedRuntime = runtime;
      void playerSkillId;
      return gate.promise;
    };

    render(<App playTurn={playTurn} />);
    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Logic Storm/i }));
    expect(screen.getByText(/resolving/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("brand-home"));
    expect(screen.getByTestId("landing-view")).toBeInTheDocument();

    expect(capturedRuntime).not.toBeNull();
    const { stepBattle } = await import("../../engine");
    gate.resolve({
      step: stepBattle(capturedRuntime!, "skill-logic-storm")
    });
    await gate.promise;
    await Promise.resolve();
    expect(screen.queryByTestId("arena-view")).toBeNull();
    expect(screen.getByTestId("landing-view")).toBeInTheDocument();
  });
  it("Start then immediate Home during live import does not open Arena", async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("nav-build"));
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "LIVE-UNIT" }
    });
    fireEvent.change(screen.getByLabelText("Robot identity"), {
      target: { value: "Steady Vanguard" }
    });
    fireEvent.change(screen.getByLabelText("Memory"), {
      target: { value: "Pattern Recall" }
    });
    fireEvent.change(screen.getByLabelText("Sigil and Security"), {
      target: { value: "Aegis Layer" }
    });
    fireEvent.change(screen.getByLabelText("Rules"), {
      target: { value: "Never Skip Verification" }
    });
    fireEvent.change(screen.getByLabelText("Strategy"), {
      target: { value: "Measured Pressure" }
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Override Pulse/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Logic Storm/i }));
    fireEvent.click(screen.getByRole("button", { name: /Check robot/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Continue to battle setup/i })
    );
    fireEvent.click(screen.getByTestId("reveal-live-opponent"));
    await waitFor(() => {
      expect(screen.getByTestId("live-opponent-panel")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("live-opponent-toggle"));
    fireEvent.change(screen.getByTestId("live-api-key"), {
      target: { value: SECRET }
    });

    fireEvent.click(screen.getByRole("button", { name: /Start battle/i }));
    fireEvent.click(screen.getByTestId("brand-home"));
    await waitFor(() => {
      expect(screen.getByTestId("landing-view")).toBeInTheDocument();
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.queryByTestId("arena-view")).toBeNull();
    expect(screen.getByTestId("landing-view")).toBeInTheDocument();
    assertKeyAbsent(SECRET);
  }, 20_000);

  it("A3: Live Start then Setup Back before settle ignores stale start", async () => {
    let store: StoreApi<BattleViewStore> | null = null;
    render(
      <App
        onBattleStore={(s) => {
          store = s;
        }}
      />
    );
    fireEvent.click(screen.getByTestId("nav-build"));
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "LIVE-UNIT" }
    });
    fireEvent.change(screen.getByLabelText("Robot identity"), {
      target: { value: "Steady Vanguard" }
    });
    fireEvent.change(screen.getByLabelText("Memory"), {
      target: { value: "Pattern Recall" }
    });
    fireEvent.change(screen.getByLabelText("Sigil and Security"), {
      target: { value: "Aegis Layer" }
    });
    fireEvent.change(screen.getByLabelText("Rules"), {
      target: { value: "Never Skip Verification" }
    });
    fireEvent.change(screen.getByLabelText("Strategy"), {
      target: { value: "Measured Pressure" }
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Override Pulse/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Logic Storm/i }));
    fireEvent.click(screen.getByRole("button", { name: /Check robot/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Continue to battle setup/i })
    );
    fireEvent.click(screen.getByTestId("reveal-live-opponent"));
    await waitFor(() => {
      expect(screen.getByTestId("live-opponent-panel")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("live-opponent-toggle"));
    fireEvent.change(screen.getByTestId("live-api-key"), {
      target: { value: SECRET }
    });

    fireEvent.click(screen.getByRole("button", { name: /Start battle/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Back$/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("battle-setup")).toBeNull();
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.queryByTestId("arena-view")).toBeNull();
    expect(store!.getState().runtime).toBeNull();
  }, 20_000);

  it("A4: double Start during live import begins exactly one battle", async () => {
    let store: StoreApi<BattleViewStore> | null = null;
    let begins = 0;
    render(
      <App
        onBattleStore={(s) => {
          store = s;
          s.subscribe((state, prev) => {
            if (state.turnEpoch > prev.turnEpoch && state.runtime !== null) {
              begins += 1;
            }
          });
        }}
      />
    );
    fireEvent.click(screen.getByTestId("nav-build"));
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "LIVE-UNIT" }
    });
    fireEvent.change(screen.getByLabelText("Robot identity"), {
      target: { value: "Steady Vanguard" }
    });
    fireEvent.change(screen.getByLabelText("Memory"), {
      target: { value: "Pattern Recall" }
    });
    fireEvent.change(screen.getByLabelText("Sigil and Security"), {
      target: { value: "Aegis Layer" }
    });
    fireEvent.change(screen.getByLabelText("Rules"), {
      target: { value: "Never Skip Verification" }
    });
    fireEvent.change(screen.getByLabelText("Strategy"), {
      target: { value: "Measured Pressure" }
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /Override Pulse/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Logic Storm/i }));
    fireEvent.click(screen.getByRole("button", { name: /Check robot/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Continue to battle setup/i })
    );
    fireEvent.click(screen.getByTestId("reveal-live-opponent"));
    await waitFor(() => {
      expect(screen.getByTestId("live-opponent-panel")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("live-opponent-toggle"));
    fireEvent.change(screen.getByTestId("live-api-key"), {
      target: { value: SECRET }
    });

    const start = screen.getByRole("button", { name: /Start battle/i });
    fireEvent.click(start);
    fireEvent.click(start);

    await waitFor(() => {
      expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getAllByTestId("arena-view")).toHaveLength(1);
    expect(store!.getState().runtime).not.toBeNull();
    expect(begins).toBe(1);
  }, 20_000);

  it("A5: mid-battle Live discover abandons runtime", async () => {
    let store: StoreApi<BattleViewStore> | null = null;
    render(
      <App
        onBattleStore={(s) => {
          store = s;
        }}
      />
    );
    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    await waitFor(() => {
      expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    });
    const residual = store!.getState().runtime!;
    expect(residual).not.toBeNull();
    fireEvent.click(screen.getByTestId("brand-home"));
    await waitFor(() => {
      expect(screen.getByTestId("landing-view")).toBeInTheDocument();
    });
    store!.getState().resetBattle(residual);
    expect(store!.getState().runtime).not.toBeNull();

    fireEvent.click(screen.getByTestId("cta-live-ai"));
    await waitFor(() => {
      expect(screen.getByTestId("battle-setup")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("arena-view")).toBeNull();
    expect(store!.getState().runtime).toBeNull();
  });

  it("A6: guidedPath clears on Watch / Lab / Build / Leaderboard / Methodology / Home", async () => {
    async function enterGuidedAndReveal() {
      fireEvent.click(screen.getByTestId("brand-home"));
      await waitFor(() => {
        expect(screen.getByTestId("landing-view")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId("cta-beat-ai"));
      await waitFor(() => {
        expect(screen.getByTestId("decision-lab")).toBeInTheDocument();
      });
      fireEvent.click(screen.getAllByRole("radio")[0]!);
      fireEvent.click(screen.getByTestId("challenge-show-answer"));
      expect(
        screen.getByRole("button", { name: /Watch a recorded fight/i })
      ).toBeInTheDocument();
    }

    async function assertNotGuidedAfterReveal() {
      fireEvent.click(screen.getAllByRole("radio")[0]!);
      fireEvent.click(screen.getByTestId("challenge-show-answer"));
      expect(
        screen.queryByRole("button", { name: /Watch a recorded fight/i })
      ).toBeNull();
    }

    render(<App />);
    await enterGuidedAndReveal();
    fireEvent.click(screen.getByTestId("mode-watch"));
    await waitFor(() => {
      expect(screen.getByTestId("watch-battle-view")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("nav-lab"));
    await waitFor(() => {
      expect(screen.getByTestId("decision-lab")).toBeInTheDocument();
    });
    await assertNotGuidedAfterReveal();

    await enterGuidedAndReveal();
    fireEvent.click(screen.getByTestId("nav-build"));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Build/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("nav-lab"));
    await waitFor(() => {
      expect(screen.getByTestId("decision-lab")).toBeInTheDocument();
    });
    await assertNotGuidedAfterReveal();

    await enterGuidedAndReveal();
    fireEvent.click(screen.getByTestId("nav-leaderboard"));
    await waitFor(() => {
      expect(screen.getByTestId("leaderboard-view")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("nav-lab"));
    await waitFor(() => {
      expect(screen.getByTestId("decision-lab")).toBeInTheDocument();
    });
    await assertNotGuidedAfterReveal();

    await enterGuidedAndReveal();
    fireEvent.click(screen.getByTestId("nav-methodology"));
    await waitFor(() => {
      expect(screen.getByTestId("methodology-view")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("nav-lab"));
    await waitFor(() => {
      expect(screen.getByTestId("decision-lab")).toBeInTheDocument();
    });
    await assertNotGuidedAfterReveal();

    await enterGuidedAndReveal();
    fireEvent.click(screen.getByTestId("brand-home"));
    await waitFor(() => {
      expect(screen.getByTestId("landing-view")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("nav-lab"));
    await waitFor(() => {
      expect(screen.getByTestId("decision-lab")).toBeInTheDocument();
    });
    await assertNotGuidedAfterReveal();
  }, 30_000);
});

function deferredTurn(): {
  promise: Promise<UiTurnResult>;
  resolve: (value: UiTurnResult) => void;
} {
  let resolve!: (value: UiTurnResult) => void;
  const promise = new Promise<UiTurnResult>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}