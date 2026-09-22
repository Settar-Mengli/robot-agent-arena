import { useMemo, useState } from "react";
import {
  assertDecisionLabPackV3,
  bootstrapMeanCi,
  insufficientEvidence,
  llmPolicyKey,
  wilsonInterval,
  type DecisionLabCaseV3,
  type DecisionLabPackV3,
  type DecisionLabPolicyEvidence,
  type DecisionLabTaxonomy,
  type DiagnosticsSummaryV1
} from "../../decision-lab";
import { ChallengeView } from "./ChallengeView";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import rawPack from "./pack/decision-lab.v3.json";
import rawPublished from "./pack/diagnostics.summary.json";

type LabSubview = "browse" | "inspect" | "compare" | "diagnostics" | "challenge";

export type LabBrowseFilters = {
  text: string;
  taxonomy: TaxonomyFilter;
  arm: string;
  status: StatusFilter;
  regret: RegretFilter;
  suiteId: string;
};

export type TaxonomyFilter = "any" | DecisionLabTaxonomy;
export type StatusFilter = "any" | "recorded" | "unavailable";
export type RegretFilter = "any" | "optimal" | "regret_gt_0";

export const DEFAULT_LAB_FILTERS: LabBrowseFilters = {
  text: "",
  taxonomy: "any",
  arm: "greedy",
  status: "any",
  regret: "any",
  suiteId: "heldout-adversarial"
};

function loadPack(raw: unknown):
  | { ok: true; pack: DecisionLabPackV3 }
  | { ok: false; error: string } {
  try {
    return { ok: true, pack: assertDecisionLabPackV3(raw) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

function loadPublished(raw: unknown): DiagnosticsSummaryV1 | null {
  if (
    raw !== null &&
    typeof raw === "object" &&
    (raw as { schemaVersion?: unknown }).schemaVersion === 1
  ) {
    return raw as DiagnosticsSummaryV1;
  }
  return null;
}

function policyArmKeys(pack: DecisionLabPackV3): string[] {
  const keys = new Set<string>(["greedy"]);
  for (const pin of pack.modelPins) {
    for (const variant of pack.variants) {
      keys.add(llmPolicyKey(pin.provider, pin.model, variant));
    }
  }
  return [...keys].sort((a, b) => (a < b ? -1 : 1));
}

export function DecisionLabView(): React.JSX.Element {
  const loaded = useMemo(() => loadPack(rawPack), []);
  const published = useMemo(() => loadPublished(rawPublished), []);
  const [subview, setSubview] = useState<LabSubview>("browse");
  const [filters, setFilters] = useState<LabBrowseFilters>(DEFAULT_LAB_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!loaded.ok) {
    return (
      <div className="p-6 text-red-300" role="alert">
        Decision Lab pack failed to load: {loaded.error}
      </div>
    );
  }

  const pack = loaded.pack;
  const arms = policyArmKeys(pack);
  const suiteCases = pack.cases.filter((c) => c.suiteId === filters.suiteId);
  const filtered = suiteCases.filter((c) => caseMatches(c, filters));
  const selected =
    suiteCases.find((c) => c.snapshotId === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-stone-200">
      <p className="text-sm text-stone-500" role="status">
        Static demo — recorded evidence only. No live AI calls.
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-stone-50">Decision Lab</h2>
      <p className="mt-2 text-stone-400">
        Offline evidence pack (schema v3). Inspect oracle ties, diagnostics, and
        challenge recorded arms. No universal rankings.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["browse", "Browse"],
            ["inspect", "Inspector"],
            ["compare", "Compare"],
            ["diagnostics", "Diagnostics"],
            ["challenge", "Challenge"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              subview === id
                ? "rounded bg-stone-100 px-3 py-1 text-sm text-stone-900"
                : "rounded border border-stone-700 px-3 py-1 text-sm text-stone-300"
            }
            onClick={() => setSubview(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {subview !== "diagnostics" && subview !== "challenge" ? (
      <label className="mt-4 block text-sm text-stone-400">
        Suite{" "}
        <select
          className="ml-2 rounded border border-stone-700 bg-stone-900 px-2 py-1"
          value={filters.suiteId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, suiteId: e.target.value }))
          }
        >
          {pack.suites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} (n={s.snapshotCount})
            </option>
          ))}
        </select>
      </label>
      ) : null}

      {subview === "diagnostics" ? (
        <DiagnosticsPanel pack={pack} published={published} />
      ) : null}
      {subview === "challenge" ? <ChallengeView pack={pack} /> : null}
      {subview === "browse" ? (
        <BrowsePanel
          cases={filtered}
          arms={arms}
          filters={filters}
          setFilters={setFilters}
          onSelect={(id) => {
            setSelectedId(id);
            setSubview("inspect");
          }}
        />
      ) : null}
      {subview === "inspect" ? (
        <InspectPanel caseRow={selected} arms={arms} />
      ) : null}
      {subview === "compare" ? (
        <ComparePanel pack={pack} suiteId={filters.suiteId} />
      ) : null}
    </div>
  );
}

function caseMatches(c: DecisionLabCaseV3, filters: LabBrowseFilters): boolean {
  if (filters.suiteId !== c.suiteId) {
    return false;
  }
  if (
    filters.text &&
    !`${c.snapshotId} ${c.scenarioId}`.includes(filters.text.trim())
  ) {
    return false;
  }
  const armPolicy = c.policies[filters.arm];
  if (armPolicy === undefined) {
    return false;
  }
  if (filters.status !== "any" && armPolicy.status !== filters.status) {
    return false;
  }
  if (filters.taxonomy !== "any" && armPolicy.taxonomy !== filters.taxonomy) {
    return false;
  }
  if (armPolicy.status === "recorded") {
    if (filters.regret === "optimal" && armPolicy.regret !== 0) {
      return false;
    }
    if (filters.regret === "regret_gt_0" && armPolicy.regret <= 0) {
      return false;
    }
  } else if (filters.regret !== "any") {
    return false;
  }
  return true;
}

function BrowsePanel(props: {
  cases: DecisionLabCaseV3[];
  arms: string[];
  filters: LabBrowseFilters;
  setFilters: React.Dispatch<React.SetStateAction<LabBrowseFilters>>;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const { cases, arms, filters, setFilters, onSelect } = props;
  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-3 text-sm">
        <input
          className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
          placeholder="Filter id"
          value={filters.text}
          onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
        />
        <select
          value={filters.arm}
          onChange={(e) => setFilters((f) => ({ ...f, arm: e.target.value }))}
        >
          {arms.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <ul className="mt-4 space-y-2">
        {cases.map((c) => (
          <li key={c.snapshotId}>
            <button
              type="button"
              className="text-left text-stone-300 hover:text-stone-100"
              onClick={() => onSelect(c.snapshotId)}
            >
              {c.snapshotId}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-stone-500">{cases.length} cases</p>
    </div>
  );
}

function InspectPanel(props: {
  caseRow: DecisionLabCaseV3 | null;
  arms: string[];
}): React.JSX.Element {
  if (props.caseRow === null) {
    return <p className="mt-6 text-stone-500">No case selected.</p>;
  }
  const c = props.caseRow;
  return (
    <div className="mt-6 space-y-3 text-sm">
      <h3 className="text-lg text-stone-100">{c.snapshotId}</h3>
      <p>
        Oracle best: {c.oracle.best.join(", ")}
        {c.oracle.ties ? " (ties)" : ""}
      </p>
      <ul className="space-y-2">
        {props.arms.map((arm) => {
          const p = c.policies[arm];
          if (p === undefined) {
            return null;
          }
          return (
            <li key={arm} className="rounded border border-stone-800 px-3 py-2">
              <span className="text-stone-200">{arm}</span>: {p.taxonomy}
              {p.status === "recorded" ? (
                <span>
                  {" "}
                  · {p.executedSkillId} · regret {p.regret}
                </span>
              ) : (
                <span> · {p.detail}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ComparePanel(props: {
  pack: DecisionLabPackV3;
  suiteId: string;
}): React.JSX.Element {
  const pin = props.pack.modelPins[0]!;
  const baseKey = llmPolicyKey(pin.provider, pin.model, "base");
  const groundedKey = llmPolicyKey(pin.provider, pin.model, "grounded");
  const cohort = props.pack.cases.filter(
    (c) =>
      c.suiteId === props.suiteId &&
      c.policies[baseKey]?.status === "recorded" &&
      c.policies[groundedKey]?.status === "recorded"
  );
  const excluded =
    props.pack.cases.filter((c) => c.suiteId === props.suiteId).length -
    cohort.length;

  let changed = 0;
  let regretBase = 0;
  let regretGrounded = 0;
  let optimalBase = 0;
  let optimalGrounded = 0;
  const baseRegrets: number[] = [];
  const groundedRegrets: number[] = [];

  for (const c of cohort) {
    const base = c.policies[baseKey] as Extract<
      DecisionLabPolicyEvidence,
      { status: "recorded" }
    >;
    const grounded = c.policies[groundedKey] as Extract<
      DecisionLabPolicyEvidence,
      { status: "recorded" }
    >;
    regretBase += base.regret;
    regretGrounded += grounded.regret;
    baseRegrets.push(base.regret);
    groundedRegrets.push(grounded.regret);
    if (base.optimal) optimalBase += 1;
    if (grounded.optimal) optimalGrounded += 1;
    if (base.executedSkillId !== grounded.executedSkillId) changed += 1;
  }

  const n = cohort.length;
  const wilsonBase = wilsonInterval(optimalBase, n);
  const wilsonGrounded = wilsonInterval(optimalGrounded, n);
  const ciBase = bootstrapMeanCi(baseRegrets);
  const ciGrounded = bootstrapMeanCi(groundedRegrets);
  const thin =
    insufficientEvidence({ n, wilson: wilsonBase }) ||
    insufficientEvidence({ n, wilson: wilsonGrounded });

  return (
    <div className="mt-8" data-testid="lab-compare">
      <h3 className="text-lg font-medium text-stone-100">Base vs grounded</h3>
      <p className="mt-2 text-sm text-stone-400" role="status">
        Suite {props.suiteId}. Cohort n={n}. Excluded: {excluded}. Pin{" "}
        {pin.provider}:{pin.model}. No universal rankings.
        {thin ? (
          <span
            className="mt-1 block text-amber-200/90"
            data-testid="lab-insufficient-evidence"
          >
            Insufficient evidence (n&lt;30 or Wilson width ≥0.40).
          </span>
        ) : null}
      </p>
      {n === 0 ? (
        <p className="mt-4 text-stone-500">No comparable recorded pairs.</p>
      ) : (
        <dl className="mt-4 grid gap-2 text-sm text-stone-300 sm:grid-cols-2">
          <div>
            Decisions changed: {changed} / {n}
          </div>
          <div>
            Mean regret: {(regretBase / n).toFixed(4)} →{" "}
            {(regretGrounded / n).toFixed(4)} (CI [{ciBase.low.toFixed(2)},{" "}
            {ciBase.high.toFixed(2)}] → [{ciGrounded.low.toFixed(2)},{" "}
            {ciGrounded.high.toFixed(2)}])
          </div>
          <div>
            Optimal rate: {((optimalBase / n) * 100).toFixed(1)}% →{" "}
            {((optimalGrounded / n) * 100).toFixed(1)}% (Wilson [
            {(wilsonBase.low * 100).toFixed(1)}%,{" "}
            {(wilsonBase.high * 100).toFixed(1)}%] → [
            {(wilsonGrounded.low * 100).toFixed(1)}%,{" "}
            {(wilsonGrounded.high * 100).toFixed(1)}%])
          </div>
        </dl>
      )}
    </div>
  );
}
