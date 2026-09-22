import { useMemo, useState } from "react";
import {
  insufficientEvidence,
  type DecisionLabCaseV3,
  type DecisionLabPackV3
} from "../../decision-lab";
import { MVP_SKILL_CATALOG } from "../../engine";

export type ChallengeViewProps = {
  pack: DecisionLabPackV3;
};

type ChallengeRound = {
  case: DecisionLabCaseV3;
  pick: string | null;
  revealed: boolean;
};

function skillLabel(id: string): string {
  return (
    MVP_SKILL_CATALOG.skills.find((s) => s.skillId === id)?.displayName ?? id
  );
}

function eligibleCases(pack: DecisionLabPackV3): DecisionLabCaseV3[] {
  return pack.cases.filter((c) => {
    if (c.equippedSkillIds.length < 1) return false;
    return Object.values(c.policies).some(
      (p) => p.status === "recorded" && p.source === "llm"
    );
  });
}

export function ChallengeView({ pack }: ChallengeViewProps): React.JSX.Element {
  const pool = useMemo(() => eligibleCases(pack), [pack]);
  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState<ChallengeRound[]>([]);

  const current = pool[index] ?? null;

  function reveal() {
    if (current === null || pick === null) return;
    setRevealed(true);
    setHistory((h) => [
      ...h,
      { case: current, pick, revealed: true }
    ]);
  }

  function next() {
    setPick(null);
    setRevealed(false);
    setIndex((i) => (i + 1) % Math.max(1, pool.length));
  }

  const userRegrets = history.map((h) => {
    const v = h.case.oracle.values[h.pick!];
    const best = Math.max(...Object.values(h.case.oracle.values));
    return best - (v ?? best);
  });
  const meanUser =
    userRegrets.length === 0
      ? 0
      : userRegrets.reduce((a, b) => a + b, 0) / userRegrets.length;

  const modelRegrets = history.map((h) => {
    const llm = Object.values(h.case.policies).filter(
      (p) => p.status === "recorded" && p.source === "llm"
    );
    if (llm.length === 0) return 0;
    return Math.min(...llm.map((p) => (p.status === "recorded" ? p.regret : 0)));
  });
  const meanModel =
    modelRegrets.length === 0
      ? 0
      : modelRegrets.reduce((a, b) => a + b, 0) / modelRegrets.length;

  const greedyWins = history.filter((h) => {
    const g = h.case.policies.greedy;
    if (g === undefined || g.status !== "recorded" || h.pick === null) {
      return false;
    }
    const userVal = h.case.oracle.values[h.pick] ?? 0;
    return userVal >= g.chosenValue;
  }).length;
  const vsGreedyRate =
    history.length === 0 ? 0 : greedyWins / history.length;
  const sessionInsuff = insufficientEvidence({ n: history.length });

  if (current === null) {
    return (
      <p className="mt-6 text-stone-400" data-testid="lab-challenge">
        No eligible challenge cases in this pack.
      </p>
    );
  }

  const bestVal = Math.max(...Object.values(current.oracle.values));
  const userRegret =
    pick === null
      ? null
      : bestVal - (current.oracle.values[pick] ?? bestVal);

  return (
    <section data-testid="lab-challenge" className="mt-6 space-y-4">
      <p className="text-sm text-stone-400">
        You vs the model — pick a skill from the observation, then reveal
        oracle regret vs recorded arms. Pack scoring only; no network.
      </p>

      <div className="rounded border border-stone-800 p-4">
        <p className="text-sm text-stone-500">{current.snapshotId}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-stone-500">CPU</p>
            <p>
              HP {current.observation.cpu.health}/{current.observation.cpu.maxHealth} ·
              E {current.observation.cpu.energy} · Def {current.observation.cpu.defense}
            </p>
          </div>
          <div>
            <p className="text-stone-500">Player</p>
            <p>
              HP {current.observation.player.health}/{current.observation.player.maxHealth} ·
              E {current.observation.player.energy} · Def{" "}
              {current.observation.player.defense}
            </p>
          </div>
        </div>

        <fieldset className="mt-4" disabled={revealed}>
          <legend className="text-sm text-stone-300">Your pick</legend>
          <ul className="mt-2 space-y-2">
            {current.equippedSkillIds.map((id) => {
              const aff = current.affordability.find((a) => a.skillId === id);
              return (
                <li key={id}>
                  <label className="flex items-center gap-2 text-stone-200">
                    <input
                      type="radio"
                      name="challenge-pick"
                      value={id}
                      checked={pick === id}
                      onChange={() => setPick(id)}
                    />
                    <span>
                      {skillLabel(id)}
                      {aff && !aff.affordable ? " (unaffordable)" : ""}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-amber-700 px-3 py-1 text-sm text-amber-100 disabled:opacity-40"
            disabled={pick === null || revealed}
            onClick={reveal}
          >
            Reveal
          </button>
          <button
            type="button"
            className="rounded border border-stone-600 px-3 py-1 text-sm"
            onClick={next}
          >
            Next case
          </button>
        </div>

        {revealed && pick !== null ? (
          <div className="mt-4 space-y-2 text-sm text-stone-300" aria-live="polite">
            <p>
              Your regret: {userRegret?.toFixed(2)} (best{" "}
              {current.oracle.best.map(skillLabel).join(", ")})
            </p>
            {Object.entries(current.policies).map(([key, pol]) => {
              if (pol.status !== "recorded") {
                return (
                  <p key={key}>
                    {key}: unavailable
                  </p>
                );
              }
              return (
                <p key={key}>
                  {key}: chose {skillLabel(pol.executedSkillId)} · regret{" "}
                  {pol.regret.toFixed(2)}
                  {pol.optimal ? " · optimal" : ""}
                </p>
              );
            })}
          </div>
        ) : null}
      </div>

      <div data-testid="challenge-session" className="text-sm text-stone-400">
        <p>
          Session n={history.length} · mean user regret {meanUser.toFixed(2)} ·
          mean best-model regret {meanModel.toFixed(2)} · win-rate vs greedy{" "}
          {(vsGreedyRate * 100).toFixed(0)}%
        </p>
        {sessionInsuff ? (
          <p className="text-amber-300/90">
            insufficient evidence (session n&lt;30)
          </p>
        ) : null}
      </div>
    </section>
  );
}
