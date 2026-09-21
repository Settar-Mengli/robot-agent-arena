import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { stepBattle } from "../engine";
import { App } from "./App";
import type { PlayTurnFn, UiTurnResult } from "./store/battle-view";

afterEach(() => {
  cleanup();
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
  fillValidBuilder();
  fireEvent.click(
    screen.getByRole("button", { name: /Validate configuration/i })
  );
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
  it("Builder → setup → Arena → results → restart", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: /Restart battle/i }));
    expect(screen.getByTestId("arena-view")).toBeInTheDocument();
    expect(screen.queryByTestId("results-view")).toBeNull();
    expect(screen.getByText(/No turns yet/i)).toBeInTheDocument();
  });

  it("return to Builder preserves draft via initialConfig", () => {
    render(<App />);
    goToArena();

    fireEvent.click(
      screen.getByRole("button", { name: /Return to Builder/i })
    );
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

    fireEvent.click(
      screen.getByRole("button", { name: /Return to Builder/i })
    );
    expect(screen.getByLabelText("Display name")).toHaveValue("FLOW-UNIT");
    expect(screen.queryByTestId("arena-view")).toBeNull();

    expect(capturedRuntime).not.toBeNull();
    gate.resolve({
      step: stepBattle(capturedRuntime!, "skill-logic-storm")
    });
    await gate.promise;
    await Promise.resolve();

    // Still on Builder — stale resolve did not reopen Arena
    expect(screen.queryByTestId("arena-view")).toBeNull();
    expect(screen.getByLabelText("Display name")).toHaveValue("FLOW-UNIT");
  });
});
