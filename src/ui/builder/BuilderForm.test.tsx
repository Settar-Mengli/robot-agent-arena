import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { BuilderForm } from "./BuilderForm";

afterEach(() => {
  cleanup();
});

function fillModules() {
  fireEvent.change(screen.getByLabelText("Core Identity"), {
    target: { value: "Steady Vanguard" }
  });
  fireEvent.change(screen.getByLabelText("Memory"), {
    target: { value: "Pattern Recall" }
  });
  fireEvent.change(screen.getByLabelText("Sigil and Security"), {
    target: { value: "Aegis Layer" }
  });
  fireEvent.change(screen.getByLabelText("Rules"), {
    target: { value: "Never Skip Verification" }
  });
  fireEvent.change(screen.getByLabelText("Strategy"), {
    target: { value: "Measured Pressure" }
  });
}

describe("BuilderForm", () => {
  it("shows a validated configuration after a complete valid submission", () => {
    render(<BuilderForm />);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "UNIT-ALPHA" }
    });
    fillModules();
    fireEvent.click(screen.getByRole("checkbox", { name: /Override Pulse/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Logic Storm/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Validate configuration/i })
    );

    const summary = screen.getByTestId("validated-config");
    expect(summary).toHaveTextContent("Valid configuration");
    expect(summary).toHaveTextContent("UNIT-ALPHA");
    expect(
      screen.queryByRole("button", { name: /Start Battle/i })
    ).toBeNull();
  });

  it("keeps agentId stable when the display name changes", () => {
    render(<BuilderForm />);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "FIRST" }
    });
    fillModules();
    fireEvent.click(screen.getByRole("checkbox", { name: /Override Pulse/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Validate configuration/i })
    );

    const firstSummary = screen.getByTestId("validated-config").textContent ?? "";
    const idMatch = firstSummary.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    expect(idMatch).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "SECOND" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Validate configuration/i })
    );

    const second = screen.getByTestId("validated-config");
    expect(second).toHaveTextContent("SECOND");
    expect(second).toHaveTextContent(idMatch![0]!);
  });

  it("surfaces an actionable error when display name is empty", () => {
    render(<BuilderForm />);

    fillModules();
    fireEvent.click(screen.getByRole("checkbox", { name: /Override Pulse/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Validate configuration/i })
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/displayName/i);
    expect(alert).toHaveTextContent(/non-empty string/i);
    expect(screen.queryByTestId("validated-config")).toBeNull();
  });

  it("surfaces an actionable error when no skills are equipped", () => {
    render(<BuilderForm />);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "UNIT-BETA" }
    });
    fillModules();
    fireEvent.click(
      screen.getByRole("button", { name: /Validate configuration/i })
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/at least one skill/i);
  });
});
