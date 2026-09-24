import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stepBattle } from "../engine";
import { CPU_OPPONENTS } from "../data/opponents";
import { App } from "./App";
import { QUICKSTART_ROBOT } from "./data/quickstart-robot";
import {
  SAVE_SLOT_KEY,
  assertSaveSlotV1,
  loadSlot,
  saveSlot
} from "./persist/save-slot";
import type { PlayTurnFn, UiTurnResult } from "./store/battle-view";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("agent-arena.tour.v1", "1");
});

function fillValidBuilder() {
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "FLOW-UNIT" }
  });
  fireEvent.change(screen.getByLabelText("Core Identity"), {
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
}

function goToArena() {
  fireEvent.click(screen.getByTestId("nav-build"));
  fillValidBuilder();
  fireEvent.click(screen.getByRole("button", { name: /Check robot/i }));
  fireEvent.click(
    screen.getByRole("button", { name: /Continue to battle setup/i })
  );
  expect(screen.getByTestId("battle-setup")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Start battle/i }));
  expect(screen.getByTestId("arena-view")).toBeInTheDocument();
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("App battle flow", () => {
  it(
    "Builder → setup → Arena → results → restart",
    async () => {
      render(<App />);
      goToArena();

      for (let i = 0; i < 40; i += 1) {
        if (screen.queryByTestId("results-view")) {
          break;
        }
        const buttons = screen.getAllByRole("button", { name: /Logic Storm/i });
        fireEvent.click(buttons[0]!);
        await Promise.resolve();
      }

      await waitFor(() => {
        expect(screen.getByTestId("results-view")).toBeInTheDocument();
      });
      expect(screen.getByTestId("battle-outcome")).toBeInTheDocument();
      expect(screen.getByTestId("final-hp")).toBeInTheDocument();
      expect(screen.getByTestId("final-hp").textContent ?? "").toMatch(
        /Final HP: you \d+\/\d+ · opponent \d+\/\d+/
      );
      expect(screen.getByTestId("battle-outcome").textContent ?? "").toMatch(
        /FLOW-UNIT|Winner/
      );
      expect(screen.getByTestId("battle-outcome").textContent ?? "").not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-/i
      );
      expect(screen.getByTestId("results-history").textContent ?? "").toMatch(
        /FLOW-UNIT/
      );

      fireEvent.click(screen.getByRole("button", { name: /Fight again/i }));
      expect(screen.getByTestId("arena-view")).toBeInTheDocument();
      expect(screen.queryByTestId("results-view")).toBeNull();
      expect(screen.getByText(/No turns yet/i)).toBeInTheDocument();
    },
    15000
  );

  it("return home then Build preserves draft via initialConfig", () => {
    render(<App />);
    goToArena();

    fireEvent.click(screen.getByRole("button", { name: /^Leave$/i }));
    fireEvent.click(screen.getByTestId("nav-build"));
    expect(screen.getByLabelText("Display name")).toHaveValue("FLOW-UNIT");
    expect(
      screen.getByRole("checkbox", { name: /Logic Storm/i })
    ).toBeChecked();
  });

  it("leave while deferred playTurn pending ignores later resolve", async () => {
    const gate = deferred<UiTurnResult>();
    let capturedRuntime: Parameters<PlayTurnFn>[0] | null = null;
    const playTurn: PlayTurnFn = async (runtime, playerSkillId) => {
      capturedRuntime = runtime;
      void playerSkillId;
      return gate.promise;
    };

    render(<App playTurn={playTurn} />);
    goToArena();

    fireEvent.click(screen.getByRole("button", { name: /Logic Storm/i }));
    expect(screen.getByText(/resolving/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Leave$/i }));
    expect(screen.getByTestId("landing-view")).toBeInTheDocument();
    expect(screen.queryByTestId("arena-view")).toBeNull();

    expect(capturedRuntime).not.toBeNull();
    gate.resolve({
      step: stepBattle(capturedRuntime!, "skill-logic-storm")
    });
    await gate.promise;
    await Promise.resolve();

    expect(screen.queryByTestId("arena-view")).toBeNull();
    expect(screen.getByTestId("landing-view")).toBeInTheDocument();
  });

  it("App save/load: Watch Leave then free battle saves mode free and restores Arena", async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("mode-watch"));
    await waitFor(() => {
      expect(screen.getByTestId("watch-battle-view")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^Leave$/i }));
    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    expect(screen.getByTestId("arena-view")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("save-slot"));
    const raw = window.localStorage.getItem(SAVE_SLOT_KEY);
    expect(raw).toBeTruthy();
    const slot = assertSaveSlotV1(JSON.parse(raw!));
    expect(slot.mode).toBe("free");
    expect(slot.runtime).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Leave$/i }));
    fireEvent.click(screen.getByTestId("load-slot"));
    expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    expect(screen.queryByTestId("watch-battle-view")).toBeNull();
  });

  it("App load: watch slot with null runtime opens Watch and restores draft without throw", async () => {
    saveSlot(
      {
        draft: {
          playerConfig: QUICKSTART_ROBOT,
          opponentId: CPU_OPPONENTS[0]!.agentId,
          seed: "arena-1"
        },
        mode: "watch",
        watch: { matchId: "heldout:base:aegis__greedy__fracture__s101" },
        runtime: null,
        battleOver: false
      },
      { inFlight: false }
    );

    render(<App />);
    fireEvent.click(screen.getByTestId("load-slot"));
    await waitFor(() => {
      expect(screen.getByTestId("watch-battle-view")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Loaded a Watch save/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("nav-build"));
    expect(screen.getByLabelText("Display name")).toHaveValue("AEGIS");
  });

  it("Arena log uses display names after turns", async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    const buttons = screen.getAllByRole("button", { name: /Logic Storm/i });
    fireEvent.click(buttons[0]!);
    await waitFor(() => {
      expect(screen.getByTestId("arena-log").textContent ?? "").toMatch(
        /AEGIS/
      );
    });
    expect(screen.getByTestId("arena-latest-narration").textContent ?? "").toMatch(
      /AEGIS/
    );
  });

  it("save from builder with seeded stale runtime persists runtime null", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("nav-build"));
    fireEvent.click(screen.getByTestId("save-slot"));
    const loaded = loadSlot();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.slot.mode).toBe("free");
      expect(loaded.slot.runtime).toBeNull();
      expect(loaded.slot.draft.playerConfig.displayName).toBe("AEGIS");
    }
  });

  it("save from setup with seeded stale runtime persists runtime null", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    fireEvent.click(screen.getByTestId("nav-build"));
    fireEvent.click(screen.getByRole("button", { name: /Check robot/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Continue to battle setup/i })
    );
    expect(screen.getByTestId("battle-setup")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("save-slot"));
    const loaded = loadSlot();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.slot.runtime).toBeNull();
    }
  });

  it("save from battle persists runtime and mode free", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    fireEvent.click(screen.getByTestId("save-slot"));
    const loaded = loadSlot();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.slot.mode).toBe("free");
      expect(loaded.slot.runtime).not.toBeNull();
    }
  });

  it("save from watch persists mode watch, matchId, runtime null", async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    fireEvent.click(screen.getByTestId("mode-watch"));
    await waitFor(() => {
      expect(screen.getByTestId("watch-battle-view")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("save-slot"));
    const loaded = loadSlot();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.slot.mode).toBe("watch");
      expect(loaded.slot.runtime).toBeNull();
      expect(loaded.slot.watch?.matchId).toBeTruthy();
    }
  });

  it("save control disabled on home with plain title reason", () => {
    render(<App />);
    expect(screen.getByTestId("landing-view")).toBeInTheDocument();
    const save = screen.getByTestId("save-slot") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.title).toMatch(/Save is available during Build/i);
  });

  it("save control disabled on lab with plain title reason", async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("nav-lab"));
    await waitFor(() => {
      expect(screen.getByTestId("decision-lab")).toBeInTheDocument();
    });
    const save = screen.getByTestId("save-slot") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.title).toMatch(/Save is available during Build/i);
  });

  it("Quick start reaches arena-view without Builder", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("cta-quick-battle"));
    expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    expect(screen.queryByLabelText("Display name")).toBeNull();
  });

  it("LandingView primary CTA navigates to Lab", async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("cta-beat-ai"));
    await waitFor(() => {
      expect(screen.getByTestId("lab-challenge")).toBeInTheDocument();
    });
  });
});
