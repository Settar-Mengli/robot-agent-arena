import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MethodologyView } from "./MethodologyView";
import { findForbiddenTechnicalText } from "../copy/forbidden-default-path";

describe("MethodologyView", () => {
  it("shows plain robustness findings and passes forbidden crawl", () => {
    render(<MethodologyView />);
    expect(screen.getByTestId("methodology-view")).toBeInTheDocument();
    expect(screen.getByTestId("batch4-findings")).toHaveTextContent(
      "No measurable effect"
    );
    expect(screen.getByTestId("batch4-findings")).toHaveTextContent(
      "1 of 35 answers for Groq"
    );
    expect(
      findForbiddenTechnicalText(
        screen.getByTestId("methodology-default").textContent ?? ""
      )
    ).toBeNull();
  });
});
