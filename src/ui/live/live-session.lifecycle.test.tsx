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
import { App } from "../App";
import { QUICKSTART_ROBOT } from "../data/quickstart-robot";
import { createGreedyPlayTurn } from "../play/cpu-turn";
import { SAVE_SLOT_KEY, saveSlot } from "../persist/save-slot";
import type { PlayTurnFn, UiTurnResult } from "../store/battle-view";
import { TOUR_KEY } from "../tour/FirstVisitTour";

const liveCalls = { n: 0 };
const greedy = createGreedyPlayTurn();

vi.mock("./createLivePlayTurn", () => ({
  createLivePlayTurn: vi.fn(
    (opts: {
      apiKey: string;
      modelId: string;
      onNotice?: (m: string | null) => void;
    }): PlayTurnFn => {
      return async (runtime, playerSkillId) => {
        liveCalls.n += 1;
        if (liveCalls.n === 1) {
          opts.onNotice?.("Could not reach the live model.");
          return greedy(runtime, playerSkillId);
        }
        opts.onNotice?.(null);
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
  });

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
});
