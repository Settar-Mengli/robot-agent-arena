import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionLabView } from "./DecisionLabView";

describe("DecisionLabView", () => {
  it("loads pack and shows compare cohort", async () => {
    render(<DecisionLabView />);
    expect(screen.getByText(/Decision Lab/i)).toBeTruthy();
    expect(screen.getByText(/Static demo/i)).toBeTruthy();
    screen.getByRole("button", { name: "Compare" }).click();
    expect(await screen.findByTestId("lab-compare")).toBeTruthy();
    expect(screen.getByText(/Cohort n=/i)).toBeTruthy();
  });
});
