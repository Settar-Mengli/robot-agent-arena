import { useMemo, useState } from "react";
import {
  assertDecisionLabPackV1,
  type DecisionLabCase,
  type DecisionLabPackV1,
  type DecisionLabPolicyEvidence,
  type DecisionLabTaxonomy
} from "../../decision-lab";
import rawPack from "./pack/decision-lab.v1.json";

type LabSubview = "browse" | "inspect" | "compare";

export type PolicyArm = "greedy" | "llm:base" | "llm:grounded";

export type TaxonomyFilter = "any" | DecisionLabTaxonomy;
export type StatusFilter = "any" | "recorded" | "unavailable";
export type RegretFilter = "any" | "optimal" | "regret_gt_0";

export type LabBrowseFilters = {
  text: string;
  taxonomy: TaxonomyFilter;
  arm: PolicyArm;
  status: StatusFilter;
  regret: RegretFilter;
};

export const DEFAULT_LAB_FILTERS: LabBrowseFilters = {
  text: "",
  taxonomy: "any",
  arm: "llm:base",
  status: "any",
  regret: "any"
};

function loadPack(raw: unknown):
  | { ok: true; pack: DecisionLabPackV1 }
  | { ok: false; error: string } {
  try {
    return { ok: true, pack: assertDecisionLabPackV1(raw) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

function greedyRegret(c: DecisionLabCase): number | null {
  const g = c.policies.greedy;
  return g.status === "recorded" ? g.regret : null;
}

function llmTaxonomy(c: DecisionLabCase, key: "llm:base" | "llm:grounded") {
  return c.policies[key].taxonomy;
}

function policyOf(c: DecisionLabCase, arm: PolicyArm): DecisionLabPolicyEvidence {
  return c.policies[arm];
}

/** Pure browse filter — exported for tests. */
export function filterLabCases(
  cases: readonly DecisionLabCase[],
  filters: LabBrowseFilters
): DecisionLabCase[] {
  const q = filters.text.trim().toLowerCase();
  return cases.filter((c) => {
    if (q !== "") {
      const textHit =
        c.snapshotId.toLowerCase().includes(q) ||
        c.scenarioId.toLowerCase().includes(q) ||
        llmTaxonomy(c, "llm:base").includes(q) ||
        llmTaxonomy(c, "llm:grounded").includes(q);
      if (!textHit) {
        return false;
      }
    }

    if (filters.taxonomy !== "any") {
      const taxHit =
        c.policies["llm:base"].taxonomy === filters.taxonomy ||
        c.policies["llm:grounded"].taxonomy === filters.taxonomy ||
        (c.policies.greedy.status === "recorded" &&
          c.policies.greedy.taxonomy === filters.taxonomy);
      if (!taxHit) {
        return false;
      }
    }

    const armPolicy = policyOf(c, filters.arm);
    if (filters.status !== "any" && armPolicy.status !== filters.status) {
      return false;
    }

    if (filters.regret !== "any") {
      if (armPolicy.status !== "recorded") {
        return false;
      }
      if (filters.regret === "optimal" && armPolicy.regret !== 0) {
        return false;
      }
      if (filters.regret === "regret_gt_0" && !(armPolicy.regret > 0)) {
        return false;
      }
    }

    return true;
  });
}

export type DecisionLabViewProps = {
  /** Test seam: inject raw pack JSON instead of the committed pack. */
  packOverride?: unknown;
};

export function DecisionLabView({ packOverride }: DecisionLabViewProps = {}) {
  const loaded = useMemo(
    () => loadPack(packOverride ?? rawPack),
    [packOverride]
  );
  const [subview, setSubview] = useState<LabSubview>("browse");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<LabBrowseFilters>(DEFAULT_LAB_FILTERS);

  if (!loaded.ok) {
    return (
      <section aria-labelledby="lab-heading" data-testid="lab-error">
        <h2 id="lab-heading" className="text-2xl font-semibold text-stone-100">
          Decision Lab
        </h2>
        <div
          role="alert"
          className="mt-6 rounded border border-red-800 bg-red-950/40 px-4 py-3 text-red-200"
        >
          <p className="font-medium">Evidence pack failed validation</p>
          <p className="mt-2 text-sm">{loaded.error}</p>
        </div>
      </section>
    );
  }

  const { pack } = loaded;
  const selected =
    selectedId === null
      ? null
      : (pack.cases.find((c) => c.snapshotId === selectedId) ?? null);

  const filtered = filterLabCases(pack.cases, filters);

  return (
    <section aria-labelledby="lab-heading" data-testid="decision-lab">
      <h2 id="lab-heading" className="text-2xl font-semibold text-stone-100">
        Decision Lab
      </h2>
      <p className="mt-2 text-stone-400">
        Inspect recorded CPU decisions against an exact best-response oracle
        (fixed player policy — not an equilibrium). Offline evidence only.
      </p>
      <p className="mt-1 text-sm text-stone-500">
        Model pin: {pack.modelPin.provider}:{pack.modelPin.model} · Suite:{" "}
        {pack.suite.split}/{pack.suite.kind} (n={pack.suite.snapshotCount})
      </p>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Decision Lab views">
        {(
          [
            ["browse", "Browse"],
            ["inspect", "Inspect"],
            ["compare", "Compare"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              subview === id
                ? "rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-stone-950"
                : "rounded border border-stone-600 px-3 py-1.5 text-sm text-stone-200"
            }
            onClick={() => setSubview(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {subview === "browse" ? (
        <BrowsePanel
          cases={filtered}
          filters={filters}
          onFiltersChange={setFilters}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setSubview("inspect");
          }}
        />
      ) : null}

      {subview === "inspect" ? (
        selected ? (
          <InspectorPanel case={selected} />
        ) : (
          <p className="mt-8 text-stone-500" role="status">
            Select a case from Browse to inspect evidence.
          </p>
        )
      ) : null}

      {subview === "compare" ? <ComparePanel pack={pack} /> : null}

      <ReportDownload pack={pack} selected={selected} />
    </section>
  );
}

function BrowsePanel(props: {
  cases: DecisionLabCase[];
  filters: LabBrowseFilters;
  onFiltersChange: (next: LabBrowseFilters) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const f = props.filters;
  function patch(partial: Partial<LabBrowseFilters>) {
    props.onFiltersChange({ ...f, ...partial });
  }

  return (
    <div className="mt-8" data-testid="lab-browse">
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-stone-300">
          Browse filters
        </legend>

        <div>
          <label htmlFor="lab-filter-text" className="block text-sm text-stone-400">
            Text search
          </label>
          <input
            id="lab-filter-text"
            type="search"
            value={f.text}
            onChange={(e) => patch({ text: e.target.value })}
            className="mt-2 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100"
            placeholder="snapshot id, scenario…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="lab-filter-taxonomy"
              className="block text-sm text-stone-400"
            >
              Taxonomy
            </label>
            <select
              id="lab-filter-taxonomy"
              value={f.taxonomy}
              onChange={(e) =>
                patch({ taxonomy: e.target.value as TaxonomyFilter })
              }
              className="mt-2 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100"
            >
              <option value="any">Any</option>
              <option value="optimal">optimal</option>
              <option value="suboptimal">suboptimal</option>
              <option value="unavailable">unavailable</option>
              <option value="infrastructure_failure">
                infrastructure_failure
              </option>
              <option value="invalid_output">invalid_output</option>
            </select>
          </div>

          <div>
            <label htmlFor="lab-filter-arm" className="block text-sm text-stone-400">
              Policy arm
            </label>
            <select
              id="lab-filter-arm"
              value={f.arm}
              onChange={(e) => patch({ arm: e.target.value as PolicyArm })}
              className="mt-2 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100"
            >
              <option value="llm:base">llm:base</option>
              <option value="llm:grounded">llm:grounded</option>
              <option value="greedy">greedy</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="lab-filter-status"
              className="block text-sm text-stone-400"
            >
              Arm status
            </label>
            <select
              id="lab-filter-status"
              value={f.status}
              onChange={(e) =>
                patch({ status: e.target.value as StatusFilter })
              }
              className="mt-2 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100"
            >
              <option value="any">Any</option>
              <option value="recorded">recorded</option>
              <option value="unavailable">unavailable</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="lab-filter-regret"
              className="block text-sm text-stone-400"
            >
              Regret (selected arm)
            </label>
            <select
              id="lab-filter-regret"
              value={f.regret}
              onChange={(e) =>
                patch({ regret: e.target.value as RegretFilter })
              }
              className="mt-2 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100"
            >
              <option value="any">Any</option>
              <option value="optimal">optimal (regret = 0)</option>
              <option value="regret_gt_0">regret &gt; 0</option>
            </select>
          </div>
        </div>
      </fieldset>

      <p className="mt-4 text-sm text-stone-500" role="status">
        Showing {props.cases.length} case{props.cases.length === 1 ? "" : "s"}
      </p>

      <ul className="mt-4 space-y-2">
        {props.cases.map((c) => {
          const gr = greedyRegret(c);
          return (
            <li key={c.snapshotId}>
              <button
                type="button"
                className={
                  props.selectedId === c.snapshotId
                    ? "w-full rounded border border-amber-700 bg-amber-950/30 px-3 py-2 text-left"
                    : "w-full rounded border border-stone-800 px-3 py-2 text-left hover:bg-stone-900"
                }
                onClick={() => props.onSelect(c.snapshotId)}
              >
                <span className="font-medium text-stone-100">
                  {c.snapshotId}
                </span>
                <span className="mt-1 block text-sm text-stone-500">
                  turn {c.turn}
                  {gr !== null ? ` · greedy regret ${gr}` : null}
                  {" · "}
                  base {llmTaxonomy(c, "llm:base")}
                  {" / "}
                  grounded {llmTaxonomy(c, "llm:grounded")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {props.cases.length === 0 ? (
        <p className="mt-4 text-stone-500" role="status" data-testid="lab-browse-empty">
          No cases match this filter.
        </p>
      ) : null}
    </div>
  );
}

function PolicyBlock(props: {
  title: string;
  evidence: DecisionLabPolicyEvidence;
}) {
  const e = props.evidence;
  if (e.status === "unavailable") {
    return (
      <div className="rounded border border-stone-700 px-3 py-3">
        <p className="font-medium text-stone-200">{props.title}</p>
        <p className="mt-1 text-sm text-amber-200/90">
          Unavailable ({e.reason}): {e.detail}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded border border-stone-700 px-3 py-3">
      <p className="font-medium text-stone-200">{props.title}</p>
      <dl className="mt-2 space-y-1 text-sm text-stone-400">
        <div>
          <dt className="inline text-stone-500">Executed: </dt>
          <dd className="inline text-stone-200">{e.executedSkillId}</dd>
        </div>
        {e.proposedSkillId !== undefined ? (
          <div>
            <dt className="inline text-stone-500">Proposed: </dt>
            <dd className="inline">{e.proposedSkillId}</dd>
          </div>
        ) : null}
        {e.resolvedSkillId !== undefined ? (
          <div>
            <dt className="inline text-stone-500">Resolved: </dt>
            <dd className="inline">{e.resolvedSkillId}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline text-stone-500">Regret / taxonomy: </dt>
          <dd className="inline">
            {e.regret} · {e.taxonomy}
          </dd>
        </div>
        <div>
          <dt className="inline text-stone-500">Prompt: </dt>
          <dd className="inline">{e.promptVersion}</dd>
        </div>
      </dl>
      {e.trace?.validation !== undefined &&
      typeof e.trace.validation === "object" &&
      e.trace.validation !== null &&
      "reason" in e.trace.validation &&
      typeof (e.trace.validation as { reason?: unknown }).reason ===
        "string" ? (
        <p className="mt-2 text-sm text-stone-400">
          Model-stated rationale (not internal reasoning):{" "}
          <span className="text-stone-200">
            {(e.trace.validation as { reason: string }).reason}
          </span>
        </p>
      ) : null}
      {e.trace?.rawText !== undefined ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-stone-400">
            Raw model response
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-stone-950 p-2 text-xs text-stone-300">
            {e.trace.rawText}
          </pre>
        </details>
      ) : null}
      {e.trace?.messages !== undefined ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-stone-400">
            Prompt messages
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded bg-stone-950 p-2 text-xs text-stone-300">
            {JSON.stringify(e.trace.messages, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

/** Exported for ties / inspector unit tests. */
export function InspectorPanel(props: { case: DecisionLabCase }) {
  const c = props.case;
  const o = c.oracle;
  return (
    <div className="mt-8 space-y-6" data-testid="lab-inspector">
      <div>
        <h3 className="text-lg font-medium text-stone-100">{c.snapshotId}</h3>
        <p className="text-sm text-stone-500">
          Scenario {c.scenarioId} · turn {c.turn}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-stone-800 px-3 py-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">
            CPU (observation)
          </p>
          <p className="mt-1 text-stone-100">{c.observation.cpu.displayName}</p>
          <p className="text-sm text-stone-400">
            HP {c.observation.cpu.health}/{c.observation.cpu.maxHealth} · Energy{" "}
            {c.observation.cpu.energy}/{c.observation.cpu.maxEnergy} · Def{" "}
            {c.observation.cpu.defense}
          </p>
        </div>
        <div className="rounded border border-stone-800 px-3 py-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Player (observation)
          </p>
          <p className="mt-1 text-stone-100">
            {c.observation.player.displayName}
          </p>
          <p className="text-sm text-stone-400">
            HP {c.observation.player.health}/{c.observation.player.maxHealth} ·
            Energy {c.observation.player.energy}/{c.observation.player.maxEnergy}{" "}
            · Def {c.observation.player.defense}
          </p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-stone-300">Equipped / affordability</h4>
        <ul className="mt-2 space-y-1 text-sm text-stone-400">
          {c.affordability.map((a) => (
            <li key={a.skillId}>
              {a.skillId} (cost {a.energyCost})
              {a.affordable ? "" : " — unaffordable at current energy"}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="text-sm font-medium text-stone-300">Oracle</h4>
        <p className="mt-1 text-sm text-stone-500">
          Perspective: {o.perspective}. Best response vs a{" "}
          <strong className="font-normal text-stone-300">
            fixed player policy
          </strong>{" "}
          ({o.fixedPlayerPolicy}). Not a game-theoretic equilibrium. Horizon:
          turn {o.horizon.turn}/{o.horizon.maxTurns} (
          {o.horizon.turnsRemaining} remaining). Exact: {String(o.exact)}.
        </p>
        {o.ties ? (
          <p className="mt-2 text-sm text-amber-200/90" role="status">
            Tied optima — all best actions:
          </p>
        ) : (
          <p className="mt-2 text-sm text-stone-400">Best action(s):</p>
        )}
        <ul
          className="mt-1 list-disc pl-5 text-sm text-stone-200"
          data-testid="lab-oracle-best"
        >
          {o.best.map((id) => (
            <li key={id}>
              {id} (value {o.values[id]})
            </li>
          ))}
        </ul>
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-stone-400">
            All action values
          </summary>
          <ul className="mt-1 space-y-1 text-sm text-stone-400">
            {Object.entries(o.values)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([id, v]) => (
                <li key={id}>
                  {id}: {v}
                </li>
              ))}
          </ul>
        </details>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-stone-300">Policies</h4>
        <PolicyBlock title="Greedy baseline" evidence={c.policies.greedy} />
        <PolicyBlock title="LLM base (agent-v1)" evidence={c.policies["llm:base"]} />
        <PolicyBlock
          title="LLM grounded (agent-v2-grounded)"
          evidence={c.policies["llm:grounded"]}
        />
      </div>
    </div>
  );
}

function ComparePanel(props: { pack: DecisionLabPackV1 }) {
  const cohort = props.pack.cases.filter(
    (c) =>
      c.policies["llm:base"].status === "recorded" &&
      c.policies["llm:grounded"].status === "recorded"
  );
  const excluded = props.pack.cases.length - cohort.length;

  let changed = 0;
  let regretBase = 0;
  let regretGrounded = 0;
  let optimalBase = 0;
  let optimalGrounded = 0;
  const taxonomyCounts: Record<string, number> = {};
  const rows: Array<{
    id: string;
    baseSkill: string;
    groundedSkill: string;
    deltaRegret: number;
    changed: boolean;
  }> = [];

  for (const c of cohort) {
    const base = c.policies["llm:base"];
    const grounded = c.policies["llm:grounded"];
    if (base.status !== "recorded" || grounded.status !== "recorded") {
      continue;
    }
    regretBase += base.regret;
    regretGrounded += grounded.regret;
    if (base.optimal) optimalBase += 1;
    if (grounded.optimal) optimalGrounded += 1;
    taxonomyCounts[`base:${base.taxonomy}`] =
      (taxonomyCounts[`base:${base.taxonomy}`] ?? 0) + 1;
    taxonomyCounts[`grounded:${grounded.taxonomy}`] =
      (taxonomyCounts[`grounded:${grounded.taxonomy}`] ?? 0) + 1;
    const didChange = base.executedSkillId !== grounded.executedSkillId;
    if (didChange) changed += 1;
    rows.push({
      id: c.snapshotId,
      baseSkill: base.executedSkillId,
      groundedSkill: grounded.executedSkillId,
      deltaRegret: grounded.regret - base.regret,
      changed: didChange
    });
  }

  const n = cohort.length;
  return (
    <div className="mt-8" data-testid="lab-compare">
      <h3 className="text-lg font-medium text-stone-100">
        Base vs grounded
      </h3>
      <p className="mt-2 text-sm text-stone-400" role="status">
        Cohort n={n} (both arms recorded). Excluded for missing LLM evidence:{" "}
        {excluded}. Selection: heldout adversarial · pin{" "}
        {props.pack.modelPin.provider}:{props.pack.modelPin.model}. Aggregates
        are recomputed from this displayed cohort only — insufficient evidence
        for universal rankings.
      </p>
      {n === 0 ? (
        <p className="mt-4 text-stone-500">No comparable recorded pairs.</p>
      ) : (
        <>
          <dl className="mt-4 grid gap-2 text-sm text-stone-300 sm:grid-cols-2">
            <div>
              Decisions changed: {changed} / {n}
            </div>
            <div>
              Mean regret base → grounded: {(regretBase / n).toFixed(4)} →{" "}
              {(regretGrounded / n).toFixed(4)}
            </div>
            <div>
              Optimal rate base → grounded:{" "}
              {((optimalBase / n) * 100).toFixed(1)}% →{" "}
              {((optimalGrounded / n) * 100).toFixed(1)}%
            </div>
          </dl>
          <h4 className="mt-6 text-sm font-medium text-stone-300">
            Taxonomy counts (displayed cohort)
          </h4>
          <ul className="mt-2 space-y-1 text-sm text-stone-400">
            {Object.entries(taxonomyCounts)
              .sort(([a], [b]) => (a < b ? -1 : 1))
              .map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
          </ul>
          <h4 className="mt-6 text-sm font-medium text-stone-300">Per case</h4>
          <ul className="mt-2 space-y-2 text-sm">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded border border-stone-800 px-3 py-2 text-stone-400"
              >
                <span className="text-stone-200">{r.id}</span>
                {r.changed ? (
                  <span className="ml-2 text-amber-200/90">changed</span>
                ) : (
                  <span className="ml-2">unchanged</span>
                )}
                <span className="mt-1 block">
                  {r.baseSkill} → {r.groundedSkill} · Δregret {r.deltaRegret}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-6 text-sm text-stone-500">
        No causal “fix” advice is offered. Measured Δ only.
      </p>
    </div>
  );
}

function reportPayload(
  pack: DecisionLabPackV1,
  selected: DecisionLabCase | null
) {
  return {
    schemaVersion: pack.schemaVersion,
    modelPin: pack.modelPin,
    suite: pack.suite,
    inputHashes: pack.inputHashes,
    limitations: pack.limitations,
    reproduce: pack.reproduce,
    selectedSnapshotId: selected?.snapshotId ?? null,
    cases: pack.cases.map((c) => c.snapshotId)
  };
}

function reportMarkdown(
  pack: DecisionLabPackV1,
  selected: DecisionLabCase | null
): string {
  const body = reportPayload(pack, selected);
  const pt = body.inputHashes.promptTemplates;
  const lines = [
    "# Decision Lab evidence report",
    "",
    `- schemaVersion: ${body.schemaVersion}`,
    `- model: ${body.modelPin.provider}:${body.modelPin.model}`,
    `- suite: ${body.suite.split}/${body.suite.kind} (n=${body.suite.snapshotCount})`,
    `- selected: ${body.selectedSnapshotId ?? "(none)"}`,
    "",
    "## Input hashes",
    `- suite: ${body.inputHashes.suite}`,
    `- fixtureManifest: ${body.inputHashes.fixtureManifest}`,
    `- promptTemplates.sha256: ${pt.sha256}`,
    ...pt.files.map((f) => `  - ${f}`),
    `- skillCatalog: ${body.inputHashes.skillCatalog}`,
    `- oracleSource: ${body.inputHashes.oracleSource}`,
    "",
    "## Limitations",
    ...body.limitations.map((l) => `- ${l}`),
    "",
    "## Reproduce",
    ...body.reproduce.map((c) => `- \`${c}\``),
    "",
    "## Cases",
    ...body.cases.map((id) => `- ${id}`),
    ""
  ];
  return lines.join("\n");
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportDownload(props: {
  pack: DecisionLabPackV1;
  selected: DecisionLabCase | null;
}) {
  return (
    <div className="mt-10 border-t border-stone-800 pt-6">
      <h3 className="text-sm font-medium text-stone-300">Evidence report</h3>
      <p className="mt-1 text-sm text-stone-500">
        Download identifiers, provenance hashes, limitations, and reproduce
        commands. Workflow: inspect a failure → read evidence → compare base vs
        grounded → verify the measured Δ.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-stone-600 px-4 py-2 text-sm text-stone-200 hover:bg-stone-900"
          onClick={() =>
            triggerDownload(
              "decision-lab-report.json",
              `${JSON.stringify(reportPayload(props.pack, props.selected), null, 2)}\n`,
              "application/json"
            )
          }
        >
          Download JSON report
        </button>
        <button
          type="button"
          className="rounded border border-stone-600 px-4 py-2 text-sm text-stone-200 hover:bg-stone-900"
          onClick={() =>
            triggerDownload(
              "decision-lab-report.md",
              reportMarkdown(props.pack, props.selected),
              "text/markdown"
            )
          }
        >
          Download Markdown report
        </button>
      </div>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-stone-500">
        {props.pack.limitations.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
