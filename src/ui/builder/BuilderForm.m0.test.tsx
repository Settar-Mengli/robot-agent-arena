import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { MVP_SKILL_CATALOG } from "../../engine";
import { findForbiddenTechnicalText } from "../copy/forbidden-default-path";
import { skillPlainDescription } from "../copy/skill-plain";
import { BuilderForm } from "./BuilderForm";

afterEach(() => cleanup());

describe("BuilderForm M0 plain skills", () => {
  it("shows plain skill descriptions, not catalog summaries", () => {
    render(<BuilderForm />);
    const section = screen
      .getByRole("heading", { name: "Build your own robot" })
      .closest("section");
    expect(section).not.toBeNull();
    for (const skill of MVP_SKILL_CATALOG.skills) {
      expect(
        screen.getByText(skillPlainDescription(skill.skillId))
      ).toBeInTheDocument();
      expect(screen.queryByText(skill.summary)).toBeNull();
    }
    expect(findForbiddenTechnicalText(section!.textContent ?? "")).toBeNull();
    expect(screen.getByText(/Equipped moves/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check robot" })).toHaveClass(
      "min-h-11"
    );
  });
});
