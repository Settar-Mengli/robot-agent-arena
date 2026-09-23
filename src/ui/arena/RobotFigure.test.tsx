import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RobotFigure } from "./RobotFigure";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RobotFigure", () => {
  it("omits animation class when prefers-reduced-motion is true", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    );
    const { getByTestId } = render(
      <RobotFigure side="player" motion="hit" />
    );
    const el = getByTestId("robot-player");
    expect(el.getAttribute("data-reduced-motion")).toBe("true");
    expect(el.classList.contains("robot-motion-hit")).toBe(false);
  });

  it("applies animation class when reduced motion is false", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    );
    const { getByTestId } = render(
      <RobotFigure side="cpu" motion="defend" />
    );
    const el = getByTestId("robot-cpu");
    expect(el.getAttribute("data-reduced-motion")).toBe("false");
    expect(el.classList.contains("robot-motion-defend")).toBe(true);
  });
});
