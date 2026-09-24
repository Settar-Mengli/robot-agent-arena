import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MethodologyView } from "./MethodologyView";

describe("MethodologyView", () => {
  it("renders core sections and Advanced prereg path", () => {
    render(<MethodologyView />);
    expect(screen.getByTestId("methodology-view")).toBeInTheDocument();
    expect(screen.getByText("What we measure")).toBeInTheDocument();
    expect(screen.getByText("Recorded vs live")).toBeInTheDocument();
    expect(
      screen.getByText("docs/preregistration-batch4.md")
    ).toBeInTheDocument();
  });
});
