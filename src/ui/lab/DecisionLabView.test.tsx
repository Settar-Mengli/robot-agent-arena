import {
  cleanup,
  fireEvent,
  render,
  screen,
  within
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import {
  DecisionLabView,
  InspectorPanel,
  filterLabCases,
  DEFAULT_LAB_FILTERS
} from "./DecisionLabView";
import {
  assertDecisionLabPackV1,
  type DecisionLabPackV1
} from "../../decision-lab";
import rawPack from "./pack/decision-lab.v1.json";
import tiesPackRaw from "./__fixtures__/oracle-ties.pack.json";

afterEach(() => {
  cleanup();
});

describe("Decision Lab", () => {
  it("loads committed pack via assertDecisionLabPackV1", () => {
    const pack = assertDecisionLabPackV1(rawPack);
    expect(pack.schemaVersion).toBe(1);
    expect(pack.suite.snapshotCount).toBe(13);
    expect(pack.cases).toHaveLength(13);
  });

  it("rejects wrong schemaVersion", () => {
    expect(() =>
      assertDecisionLabPackV1({ ...rawPack, schemaVersion: 99 })
    ).toThrow(/schemaVersion/i);
  });

  it("browse → inspect shows oracle best ids", () => {
    render(<DecisionLabView />);
    expect(screen.getByTestId("decision-lab")).toBeInTheDocument();
    expect(screen.getByTestId("lab-browse")).toBeInTheDocument();

    const pack = assertDecisionLabPackV1(rawPack) as DecisionLabPackV1;
    const first = pack.cases[0]!;
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(first.snapshotId) })
    );

    const inspector = screen.getByTestId("lab-inspector");
    expect(inspector).toBeInTheDocument();
    const bestList = within(inspector).getByTestId("lab-oracle-best");
    for (const id of first.oracle.best) {
      expect(
        within(bestList).getByText(new RegExp(`^${id}`))
      ).toBeInTheDocument();
    }
    expect(
      within(inspector).getByText(/fixed player policy/i)
    ).toBeInTheDocument();
  });

  it("compare reports n and exclusions", () => {
    render(<DecisionLabView />);
    fireEvent.click(screen.getByRole("button", { name: /^Compare$/i }));
    const compare = screen.getByTestId("lab-compare");
    expect(compare).toBeInTheDocument();
    expect(within(compare).getByText(/Cohort n=/i)).toBeInTheDocument();
    expect(within(compare).getByText(/Excluded/i)).toBeInTheDocument();
  });

  it("download report triggers blob download", () => {
    const click = vi.fn();
    const createObjectURL = vi.fn(() => "blob:lab-report");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL
    });
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === "a") {
        Object.defineProperty(el, "click", { value: click });
      }
      return el;
    });

    render(<DecisionLabView />);
    fireEvent.click(
      screen.getByRole("button", { name: /Download JSON report/i })
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});

describe("Decision Lab browse filters", () => {
  it("filters by taxonomy bucket", () => {
    render(<DecisionLabView />);
    const pack = assertDecisionLabPackV1(rawPack);
    const optimalIds = new Set(
      pack.cases
        .filter(
          (c) =>
            c.policies["llm:base"].taxonomy === "optimal" ||
            c.policies["llm:grounded"].taxonomy === "optimal"
        )
        .map((c) => c.snapshotId)
    );
    fireEvent.change(screen.getByLabelText(/^Taxonomy$/i), {
      target: { value: "optimal" }
    });
    for (const id of optimalIds) {
      expect(
        screen.getByRole("button", { name: new RegExp(id) })
      ).toBeInTheDocument();
    }
    expect(screen.queryByTestId("lab-browse-empty")).not.toBeInTheDocument();
  });

  it("filters by arm status recorded", () => {
    render(<DecisionLabView />);
    fireEvent.change(screen.getByLabelText(/^Policy arm$/i), {
      target: { value: "llm:base" }
    });
    fireEvent.change(screen.getByLabelText(/^Arm status$/i), {
      target: { value: "recorded" }
    });
    expect(screen.getByText(/Showing 13 cases/i)).toBeInTheDocument();
    expect(screen.queryByTestId("lab-browse-empty")).not.toBeInTheDocument();
  });

  it("filters by regret > 0 on selected arm", () => {
    render(<DecisionLabView />);
    fireEvent.change(screen.getByLabelText(/^Policy arm$/i), {
      target: { value: "llm:base" }
    });
    fireEvent.change(screen.getByLabelText(/Regret \(selected arm\)/i), {
      target: { value: "regret_gt_0" }
    });
    const pack = assertDecisionLabPackV1(rawPack);
    const expected = pack.cases.filter(
      (c) =>
        c.policies["llm:base"].status === "recorded" &&
        c.policies["llm:base"].regret > 0
    );
    expect(screen.getByText(new RegExp(`Showing ${expected.length} cases`))).toBeInTheDocument();
  });

  it("filters by optimal regret = 0", () => {
    render(<DecisionLabView />);
    fireEvent.change(screen.getByLabelText(/^Policy arm$/i), {
      target: { value: "llm:base" }
    });
    fireEvent.change(screen.getByLabelText(/Regret \(selected arm\)/i), {
      target: { value: "optimal" }
    });
    const pack = assertDecisionLabPackV1(rawPack);
    const expected = pack.cases.filter(
      (c) =>
        c.policies["llm:base"].status === "recorded" &&
        c.policies["llm:base"].regret === 0
    );
    expect(
      screen.getByText(
        new RegExp(
          `Showing ${expected.length} case${expected.length === 1 ? "" : "s"}`
        )
      )
    ).toBeInTheDocument();
  });

  it("shows empty state when no cases match", () => {
    render(<DecisionLabView />);
    fireEvent.change(screen.getByLabelText(/^Taxonomy$/i), {
      target: { value: "unavailable" }
    });
    expect(screen.getByTestId("lab-browse-empty")).toBeInTheDocument();
    expect(screen.getByText(/Showing 0 cases/i)).toBeInTheDocument();
  });

  it("filterLabCases empty for unavailable status on committed pack", () => {
    const pack = assertDecisionLabPackV1(rawPack);
    const out = filterLabCases(pack.cases, {
      ...DEFAULT_LAB_FILTERS,
      status: "unavailable",
      arm: "llm:base"
    });
    expect(out).toHaveLength(0);
  });
});

describe("Decision Lab oracle ties fixture", () => {
  it("assert accepts constructed ties pack and Inspector lists all best ids", () => {
    const pack = assertDecisionLabPackV1(tiesPackRaw);
    expect(pack.cases).toHaveLength(1);
    const c = pack.cases[0]!;
    expect(c.oracle.ties).toBe(true);
    expect(c.oracle.best.length).toBeGreaterThan(1);

    render(<InspectorPanel case={c} />);
    expect(screen.getByText(/Tied optima/i)).toBeInTheDocument();
    const bestList = screen.getByTestId("lab-oracle-best");
    for (const id of c.oracle.best) {
      expect(
        within(bestList).getByText(new RegExp(`^${id}`))
      ).toBeInTheDocument();
    }
  });

  it("DecisionLabView loads ties pack via packOverride", () => {
    render(<DecisionLabView packOverride={tiesPackRaw} />);
    fireEvent.click(screen.getByRole("button", { name: /ties-case-1/i }));
    expect(screen.getByTestId("lab-inspector")).toBeInTheDocument();
    expect(screen.getByText(/Tied optima/i)).toBeInTheDocument();
    const bestList = screen.getByTestId("lab-oracle-best");
    expect(within(bestList).getByText(/^skill-alpha/)).toBeInTheDocument();
    expect(within(bestList).getByText(/^skill-beta/)).toBeInTheDocument();
  });
});

describe("App Decision Lab nav", () => {
  it("opens Lab from header without breaking Builder", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /Builder/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Decision Lab/i }));
    expect(screen.getByTestId("decision-lab")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Builder \/ Arena/i }));
    expect(screen.getByRole("heading", { name: /Builder/i })).toBeInTheDocument();
  });
});
