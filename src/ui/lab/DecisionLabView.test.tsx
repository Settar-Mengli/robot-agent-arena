import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DecisionLabView } from "./DecisionLabView";

afterEach(() => {
  cleanup();
});

describe("DecisionLabView", () => {
  it("defaults to Challenge", () => {
    render(<DecisionLabView />);
    expect(screen.getByTestId("lab-challenge")).toBeTruthy();
    expect(screen.getByText(/Static demo/i)).toBeTruthy();
    expect(screen.queryByTestId("lab-compare")).toBeNull();
  });

  it("loads pack and shows compare cohort behind Advanced", async () => {
    render(<DecisionLabView />);
    fireEvent.click(screen.getByTestId("lab-advanced-toggle"));
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(await screen.findByTestId("lab-compare")).toBeTruthy();
    expect(screen.getByText(/Cohort size/i)).toBeTruthy();
  });

  it("opens diagnostics behind Advanced and returns to Your turn", () => {
    render(<DecisionLabView />);
    fireEvent.click(screen.getByTestId("lab-advanced-toggle"));
    fireEvent.click(screen.getByRole("button", { name: "Diagnostics" }));
    expect(screen.getByTestId("lab-diagnostics")).toBeTruthy();
    expect(screen.getByTestId("lab-vs-published")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Your turn" }));
    expect(screen.getByTestId("lab-challenge")).toBeTruthy();
  });

  it("Advanced off hides Compare Diagnostics and llm keys", () => {
    render(<DecisionLabView />);
    expect(screen.queryByRole("button", { name: "Compare" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Diagnostics" })).toBeNull();
    expect(document.body.textContent ?? "").not.toMatch(/\bllm:/i);
  });
});
