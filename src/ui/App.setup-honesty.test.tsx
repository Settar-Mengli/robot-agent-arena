import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import {
  HONESTY_ONE_LINE,
  LIVE_HONESTY_ONE_LINE
} from "./HonestyStrip";
import { TOUR_KEY } from "./tour/FirstVisitTour";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(TOUR_KEY, "1");
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

async function goToSetup() {
  fireEvent.click(screen.getByTestId("nav-build"));
  fillValidBuilder();
  fireEvent.click(screen.getByRole("button", { name: /Check robot/i }));
  fireEvent.click(
    screen.getByRole("button", { name: /Continue to battle setup/i })
  );
  expect(screen.getByTestId("battle-setup")).toBeInTheDocument();
}

describe("BattleSetup honesty vs live intent", () => {
  it("reveal Live control accessible name is clean UTF-8", async () => {
    render(<App />);
    await goToSetup();
    const reveal = screen.getByTestId("reveal-live-opponent");
    expect(reveal).toHaveAccessibleName(/Live AI opponent \(OpenRouter\)/);
    expect(reveal.textContent ?? "").toMatch(/Live AI opponent \(OpenRouter\)/);
    expect(reveal.textContent ?? "").not.toContain("â");
  });

  it("live enabled with key: live strip, no CPU/recorded claims", async () => {
    render(<App />);
    await goToSetup();
    fireEvent.click(screen.getByTestId("reveal-live-opponent"));
    const panel = await screen.findByTestId("live-opponent-panel");
    fireEvent.click(within(panel).getByTestId("live-opponent-toggle"));
    fireEvent.change(within(panel).getByTestId("live-api-key"), {
      target: { value: "sk-or-v1-setup-test" }
    });

    const setup = screen.getByTestId("battle-setup");
    const text = setup.textContent ?? "";
    expect(within(setup).getByTestId("honesty-one-line")).toHaveTextContent(
      LIVE_HONESTY_ONE_LINE
    );
    expect(text).not.toMatch(/Recorded examples, not live AI/);
    expect(text).not.toMatch(/Opponent: simple computer \(not an AI\)/);
    expect(screen.getByTestId("setup-opponent-blurb").textContent).toMatch(
      /Opponent: live AI/
    );
  });

  it("live disabled: recorded strip and CPU copy", async () => {
    render(<App />);
    await goToSetup();
    const setup = screen.getByTestId("battle-setup");
    expect(within(setup).getByTestId("honesty-one-line")).toHaveTextContent(
      HONESTY_ONE_LINE
    );
    expect(screen.getByTestId("setup-opponent-blurb").textContent).toMatch(
      /Opponent: simple computer \(not an AI\)/
    );
  });

  it("live toggle on then off restores CPU copy", async () => {
    render(<App />);
    await goToSetup();
    fireEvent.click(screen.getByTestId("reveal-live-opponent"));
    const panel = await screen.findByTestId("live-opponent-panel");
    fireEvent.click(within(panel).getByTestId("live-opponent-toggle"));
    fireEvent.change(within(panel).getByTestId("live-api-key"), {
      target: { value: "sk-or-v1-setup-test" }
    });
    await waitFor(() => {
      expect(screen.getByTestId("honesty-one-line")).toHaveTextContent(
        LIVE_HONESTY_ONE_LINE
      );
    });
    fireEvent.click(within(panel).getByTestId("live-opponent-toggle"));
    await waitFor(() => {
      expect(screen.getByTestId("honesty-one-line")).toHaveTextContent(
        HONESTY_ONE_LINE
      );
    });
    expect(screen.getByTestId("setup-opponent-blurb").textContent).toMatch(
      /Opponent: simple computer \(not an AI\)/
    );
  });
});
