import { describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { InfoTip } from "./InfoTip";
import { GLOSSARY_IDS } from "../copy/glossary";

afterEach(() => {
  cleanup();
});

describe("InfoTip", () => {
  it("toggles aria-expanded and reveals controlled region on click", () => {
    render(<InfoTip termId="energy" />);
    const btn = screen.getByTestId("info-tip-energy");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    const panelId = btn.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)?.hidden).toBe(false);
  });

  it("Escape closes and focus remains on the button", () => {
    render(<InfoTip termId="seed" />);
    const btn = screen.getByTestId("info-tip-seed");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(btn, { key: "Escape" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(btn);
  });

  it("has no role=dialog", () => {
    render(<InfoTip termId="missScore" />);
    fireEvent.click(screen.getByTestId("info-tip-missScore"));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("glossary contains all required ids", () => {
    expect(GLOSSARY_IDS.length).toBe(10);
  });
});
