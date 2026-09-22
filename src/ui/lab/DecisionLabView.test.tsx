import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DecisionLabView } from "./DecisionLabView";

afterEach(() => {
  cleanup();
});

describe("DecisionLabView", () => {
  it("loads pack and shows compare cohort", async () => {
    render(<DecisionLabView />);
    expect(screen.getByText(/Decision Lab/i)).toBeTruthy();
    expect(screen.getByText(/Static demo/i)).toBeTruthy();
    screen.getByRole("button", { name: "Compare" }).click();
    expect(await screen.findByTestId("lab-compare")).toBeTruthy();
    expect(screen.getByText(/Cohort n=/i)).toBeTruthy();
  });

  it("opens diagnostics and challenge", () => {
    render(<DecisionLabView />);
    fireEvent.click(screen.getByRole("button", { name: "Diagnostics" }));
    expect(screen.getByTestId("lab-diagnostics")).toBeTruthy();
    expect(screen.getByTestId("lab-vs-published")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Challenge" }));
    expect(screen.getByTestId("lab-challenge")).toBeTruthy();
  });
});
