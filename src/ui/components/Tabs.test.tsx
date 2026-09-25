import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { Tabs, panelId, tabId } from "./Tabs";

afterEach(() => {
  cleanup();
});

function Harness() {
  const [value, setValue] = useState("a");
  const prefix = "test-tabs";
  return (
    <div>
      <Tabs
        idPrefix={prefix}
        items={[
          { id: "a", label: "Alpha" },
          { id: "b", label: "Beta" },
          { id: "c", label: "Gamma" }
        ]}
        value={value}
        onChange={setValue}
      />
      <div
        role="tabpanel"
        id={panelId(prefix, "a")}
        aria-labelledby={tabId(prefix, "a")}
        hidden={value !== "a"}
      >
        Panel A
      </div>
      <div
        role="tabpanel"
        id={panelId(prefix, "b")}
        aria-labelledby={tabId(prefix, "b")}
        hidden={value !== "b"}
      >
        Panel B
      </div>
    </div>
  );
}

describe("Tabs a11y", () => {
  it("sets aria-controls and aria-selected", () => {
    render(<Harness />);
    const alpha = screen.getByRole("tab", { name: "Alpha" });
    expect(alpha).toHaveAttribute("aria-selected", "true");
    expect(alpha).toHaveAttribute(
      "aria-controls",
      panelId("test-tabs", "a")
    );
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      tabId("test-tabs", "a")
    );
  });

  it("ArrowRight moves selection", () => {
    render(<Harness />);
    const list = screen.getByRole("tablist");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
