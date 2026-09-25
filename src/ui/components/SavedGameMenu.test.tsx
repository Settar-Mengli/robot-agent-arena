import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SavedGameMenu } from "./SavedGameMenu";

afterEach(() => {
  cleanup();
});

const base = {
  saveAllowed: true,
  savePresent: true,
  clearConfirm: false,
  saveDisabledTitle: "Save is available during Build, Setup, Battle, or Watch",
  onSave: vi.fn(),
  onLoad: vi.fn(),
  onClearRequest: vi.fn(),
  onClearConfirm: vi.fn(),
  onClearCancel: vi.fn()
};

describe("SavedGameMenu disclosure", () => {
  it("toggles aria-expanded and exposes save testids when open", () => {
    render(<SavedGameMenu {...base} />);
    const trigger = screen.getByTestId("saved-game-trigger");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("save-slot")).toBeInTheDocument();
    expect(screen.getByTestId("load-slot")).toBeInTheDocument();
    expect(screen.getByTestId("clear-slot")).toBeInTheDocument();
  });

  it("Escape closes and returns focus to trigger", () => {
    render(<SavedGameMenu {...base} />);
    const trigger = screen.getByTestId("saved-game-trigger");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(trigger);
  });

  it("outside click closes", () => {
    render(
      <div>
        <button type="button" data-testid="outside">
          Outside
        </button>
        <SavedGameMenu {...base} />
      </div>
    );
    fireEvent.click(screen.getByTestId("saved-game-trigger"));
    expect(screen.getByTestId("saved-game-trigger")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.getByTestId("saved-game-trigger")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });
});
