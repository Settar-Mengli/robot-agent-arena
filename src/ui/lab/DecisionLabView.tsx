import { useMemo, useState, useId } from "react";
import {
  assertDecisionLabPackV3,
  llmPolicyKey,
  type DecisionLabCaseV3,
  type DecisionLabPackV3,
  type DecisionLabTaxonomy,
  type DiagnosticsSummaryV1
} from "../../decision-lab";
import { HonestyLine } from "../components/HonestyLine";
import { skillLabel } from "../copy/skill-label";
import { ChallengeView } from "./ChallengeView";
import { ComparePanel } from "./ComparePanel";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { plainPolicyLabel } from "./help-ranking-copy";
import { suiteDisplayName } from "../copy/display-labels";
import { Tabs, tabId, panelId } from "../components/Tabs";
import rawPack from "./pack/decision-lab.v3.json";
import rawPublished from "./pack/diagnostics.summary.json";

type LabSubview = "challenge" | "situations" | "compare" | "diagnostics";

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

export type DecisionLabViewProps = {
  guided?: boolean;
  onWatch?: () => void;
  onHome?: () => void;
};

export function DecisionLabView({
  guided = false,
  onWatch,
  onHome
}: DecisionLabViewProps = {}): React.JSX.Element {
  const loaded = useMemo(() => loadPack(rawPack), []);
  const published = useMemo(() => loadPublished(rawPublished), []);
  const [advanced, setAdvanced] = useState(false);
  const [subview, setSubview] = useState<LabSubview>("challenge");
  const [filters, setFilters] = useState<LabBrowseFilters>(DEFAULT_LAB_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reactId = useId();

  if (!loaded.ok) {
    return (
      <div className="p-6 text-red-300" role="alert">
        Couldn&apos;t load Beat the AI.
      </div>
    );
  }

  const pack = loaded.pack;
  const arms = policyArmKeys(pack);
  const suiteCases = pack.cases.filter((c) => c.suiteId === filters.suiteId);
  const filtered = suiteCases.filter((c) => caseMatches(c, filters));
  const selected =
    suiteCases.find((c) => c.snapshotId === selectedId) ?? filtered[0] ?? null;

  const tabs: Array<{ id: LabSubview; label: string }> = advanced
    ? [
        { id: "challenge", label: "Your turn" },
        { id: "situations", label: "Situations" },
        { id: "compare", label: "Compare" },
        { id: "diagnostics", label: "Diagnostics" }
      ]
    : [{ id: "challenge", label: "Your turn" }];

  const tabsPrefix = `lab-${reactId.replace(/:/g, "")}`;

  return (
    <div className="text-stone-200 pb-24" data-testid="decision-lab">
      <h1
        id="lab-heading"
        tabIndex={-1}
        className="text-2xl font-semibold text-stone-50"
      >
        Can you beat the AI?
      </h1>
      <p className="mt-2 text-stone-400">
        Pick a move, then show the answer. Scored from saved measurements — no
        live AI call.
      </p>
      <div className="mt-4">
        <HonestyLine />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-1">
        <Tabs
          items={tabs}
          value={subview}
          onChange={(id) => setSubview(id as LabSubview)}
          idPrefix={tabsPrefix}
        />
        <button
          type="button"
          className={
            advanced
              ? "min-h-11 border-b-2 border-amber-500 px-3 py-2 text-sm font-medium text-amber-100"
              : "min-h-11 border-b-2 border-transparent px-3 py-2 text-sm text-stone-400 hover:text-stone-200"
          }
          aria-pressed={advanced}
          data-testid="lab-advanced-toggle"
          onClick={() => {
            setAdvanced((v) => {
              const next = !v;
              if (!next) setSubview("challenge");
              return next;
            });
          }}
        >
          {advanced ? "Hide advanced" : "Advanced"}
        </button>
      </div>

      {advanced && subview !== "challenge" ? (
        <label className="mt-4 block text-sm text-stone-400">
          Test set{" "}
          <select
            className="ml-2 rounded border aa-border bg-stone-900 px-2 py-1"
            value={filters.suiteId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, suiteId: e.target.value }))
            }
          >
            {pack.suites.map((s) => (
              <option key={s.id} value={s.id}>
                {suiteDisplayName(s.id, s.id)} ({s.snapshotCount} situations)
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div
        role="tabpanel"
        id={panelId(tabsPrefix, "challenge")}
        aria-labelledby={tabId(tabsPrefix, "challenge")}
        hidden={subview !== "challenge"}
      >
        {subview === "challenge" ? (
          <ChallengeView
            pack={pack}
            guided={guided}
            advanced={advanced}
            onWatch={onWatch}
            onHome={onHome}
          />
        ) : null}
      </div>
      {advanced ? (
        <>
          <div
            role="tabpanel"
            id={panelId(tabsPrefix, "diagnostics")}
            aria-labelledby={tabId(tabsPrefix, "diagnostics")}
            hidden={subview !== "diagnostics"}
          >
            {subview === "diagnostics" ? (
              <DiagnosticsPanel pack={pack} published={published} />
            ) : null}
          </div>
          <div
            role="tabpanel"
            id={panelId(tabsPrefix, "situations")}
            aria-labelledby={tabId(tabsPrefix, "situations")}
            hidden={subview !== "situations"}
          >
            {subview === "situations" ? (
              <SituationsPanel
                cases={filtered}
                arms={arms}
                filters={filters}
                setFilters={setFilters}
                selected={selected}
                onSelect={setSelectedId}
              />
            ) : null}
          </div>
          <div
            role="tabpanel"
            id={panelId(tabsPrefix, "compare")}
            aria-labelledby={tabId(tabsPrefix, "compare")}
            hidden={subview !== "compare"}
          >
            {subview === "compare" ? (
              <ComparePanel pack={pack} suiteId={filters.suiteId} />
            ) : null}
          </div>
        </>
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

function SituationsPanel(props: {
  cases: DecisionLabCaseV3[];
  arms: string[];
  filters: LabBrowseFilters;
  setFilters: React.Dispatch<React.SetStateAction<LabBrowseFilters>>;
  selected: DecisionLabCaseV3 | null;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const { cases, arms, filters, setFilters, selected, onSelect } = props;
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div>
        <div className="flex flex-wrap gap-3 text-sm">
          <input
            className="min-h-11 rounded border aa-border bg-stone-900 px-2 py-1"
            placeholder="Filter situations"
            value={filters.text}
            onChange={(e) =>
              setFilters((f) => ({ ...f, text: e.target.value }))
            }
          />
          <select
            className="min-h-11 rounded border aa-border bg-stone-900 px-2"
            value={filters.arm}
            onChange={(e) =>
              setFilters((f) => ({ ...f, arm: e.target.value }))
            }
          >
            {arms.map((a) => (
              <option key={a} value={a}>
                {plainPolicyLabel(a)}
              </option>
            ))}
          </select>
        </div>
        <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
          {cases.map((c) => (
            <li key={c.snapshotId}>
              <button
                type="button"
                className="min-h-11 text-left text-stone-300 hover:text-stone-100"
                onClick={() => onSelect(c.snapshotId)}
              >
                Situation {c.turn} · {c.scenarioId}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-stone-400">{cases.length} situations</p>
      </div>
      <div className="text-sm">
        {selected === null ? (
          <p className="text-stone-400">No situation selected.</p>
        ) : (
          <>
            <h3 className="text-lg text-stone-100">
              Situation turn {selected.turn}
            </h3>
            <p className="mt-2">
              Best move: {selected.oracle.best.map(skillLabel).join(", ")}
              {selected.oracle.ties ? " (ties)" : ""}
            </p>
            <ul className="mt-3 space-y-2">
              {arms.map((arm) => {
                const p = selected.policies[arm];
                if (p === undefined) return null;
                return (
                  <li
                    key={arm}
                    className="rounded border aa-border px-3 py-2"
                  >
                    <span className="text-stone-200">
                      {plainPolicyLabel(arm)}
                    </span>
                    : {p.taxonomy}
                    {p.status === "recorded" ? (
                      <span>
                        {" "}
                        · {skillLabel(p.executedSkillId)} · miss score{" "}
                        {p.regret}
                      </span>
                    ) : (
                      <span> · unavailable</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
