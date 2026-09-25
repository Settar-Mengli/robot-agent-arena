import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders primary with min-h-11", () => {
    render(<Button variant="primary">Go</Button>);
    const btn = screen.getByRole("button", { name: "Go" });
    expect(btn.className).toMatch(/min-h-11/);
    expect(btn.className).toMatch(/bg-amber-600/);
  });

  it("renders secondary by default", () => {
    render(<Button>Alt</Button>);
    expect(screen.getByRole("button", { name: "Alt" }).className).toMatch(
      /aa-border/
    );
  });
});
