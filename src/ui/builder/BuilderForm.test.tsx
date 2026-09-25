import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { BuilderForm } from "./BuilderForm";

afterEach(() => {
  cleanup();
});

function fillModules() {
  fireEvent.change(screen.getByLabelText("Robot identity"), {
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

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "UNIT-ALPHA" }
  });
  fillModules();
  fireEvent.click(screen.getByRole("checkbox", { name: /Override Pulse/i }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Logic Storm/i }));
}

function submitForm() {
  fireEvent.click(screen.getByRole("button", { name: /Check robot/i }));
}

describe("BuilderForm", () => {
  it("shows a validated configuration after a complete valid submission", () => {
    render(<BuilderForm />);
    fillValidForm();
    submitForm();

    const summary = screen.getByTestId("validated-config");
    expect(summary).toHaveTextContent("Ready");
    expect(summary).toHaveTextContent("UNIT-ALPHA");
    expect(summary).toHaveAttribute("role", "status");
    expect(
      screen.queryByRole("button", { name: /Continue to battle setup/i })
    ).toBeNull();
  });

  it("shows Continue only while validated, and calls onContinue with that config", () => {
    const continues: string[] = [];
    render(
      <BuilderForm
        onContinue={(config) => {
          continues.push(config.displayName);
        }}
      />
    );
    expect(
      screen.queryByRole("button", { name: /Continue to battle setup/i })
    ).toBeNull();

    fillValidForm();
    submitForm();
    const continueBtn = screen.getByRole("button", {
      name: /Continue to battle setup/i
    });
    fireEvent.click(continueBtn);
    expect(continues).toEqual(["UNIT-ALPHA"]);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "EDITED" }
    });
    expect(
      screen.queryByRole("button", { name: /Continue to battle setup/i })
    ).toBeNull();
  });

  it("seeds fields from initialConfig without minting a new agentId", () => {
    const initial = {
      agentId: "fixed-agent-id",
      displayName: "SEEDED",
      modules: {
        coreIdentity: "Steady Vanguard",
        memory: "Pattern Recall",
        sigilSecurity: "Aegis Layer",
        rules: "Never Skip Verification",
        strategy: "Measured Pressure"
      },
      skillIds: ["skill-override-pulse", "skill-logic-storm"] as const
    };
    let continuedId = "";
    render(
      <BuilderForm
        initialConfig={{ ...initial, skillIds: [...initial.skillIds] }}
        onContinue={(c) => {
          continuedId = c.agentId;
        }}
      />
    );
    expect(screen.getByLabelText("Display name")).toHaveValue("SEEDED");
    submitForm();
    fireEvent.click(
      screen.getByRole("button", { name: /Continue to battle setup/i })
    );
    expect(continuedId).toBe("fixed-agent-id");
  });

  it("keeps agentId stable when the display name changes after re-validate", () => {
    let firstId = "";
    let secondId = "";
    render(
      <BuilderForm
        onContinue={(c) => {
          if (firstId === "") firstId = c.agentId;
          else secondId = c.agentId;
        }}
      />
    );
    fillValidForm();
    submitForm();
    fireEvent.click(
      screen.getByRole("button", { name: /Continue to battle setup/i })
    );

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "SECOND" }
    });
    expect(screen.queryByTestId("validated-config")).toBeNull();

    submitForm();
    fireEvent.click(
      screen.getByRole("button", { name: /Continue to battle setup/i })
    );
    expect(secondId).toBe(firstId);
    expect(firstId).toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
  });

  it("clears validated results when the display name changes", () => {
    render(<BuilderForm />);
    fillValidForm();
    submitForm();
    expect(screen.getByTestId("validated-config")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "CHANGED" }
    });
    expect(screen.queryByTestId("validated-config")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears validated results when a module field changes", () => {
    render(<BuilderForm />);
    fillValidForm();
    submitForm();
    expect(screen.getByTestId("validated-config")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Memory"), {
      target: { value: "Updated Memory" }
    });
    expect(screen.queryByTestId("validated-config")).toBeNull();
  });

  it("clears validated results when selected skills change", () => {
    render(<BuilderForm />);
    fillValidForm();
    submitForm();
    expect(screen.getByTestId("validated-config")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Logic Storm/i }));
    expect(screen.queryByTestId("validated-config")).toBeNull();
  });

  it("clears old errors when the form is edited", () => {
    render(<BuilderForm />);
    fillModules();
    fireEvent.click(screen.getByRole("checkbox", { name: /Override Pulse/i }));
    submitForm();
    expect(screen.getByRole("alert")).toHaveTextContent(/displayName/i);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "NOW-NAMED" }
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("disables extra skills at the slot limit, then allows reselect after deselect", () => {
    render(<BuilderForm />);
    fillModules();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "UNIT-LIMIT" }
    });

    const override = screen.getByRole("checkbox", { name: /Override Pulse/i });
    const logicStorm = screen.getByRole("checkbox", { name: /Logic Storm/i });
    const coreIdentity = screen.getByRole("checkbox", {
      name: /Core Identity/i
    });

    fireEvent.click(override);
    fireEvent.click(logicStorm);
    expect(override).toBeChecked();
    expect(logicStorm).toBeChecked();
    expect(coreIdentity).toBeDisabled();

    fireEvent.click(logicStorm);
    expect(logicStorm).not.toBeChecked();
    expect(coreIdentity).not.toBeDisabled();

    fireEvent.click(coreIdentity);
    expect(coreIdentity).toBeChecked();
    expect(logicStorm).toBeDisabled();
  });

  it("surfaces an actionable error when display name is empty", () => {
    render(<BuilderForm />);
    fillModules();
    fireEvent.click(screen.getByRole("checkbox", { name: /Override Pulse/i }));
    submitForm();

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
    submitForm();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/at least one skill/i);
  });
});
