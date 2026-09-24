import { useMemo, useState } from "react";
import {
  type DecisionLabCaseV3,
  type DecisionLabPackV3
} from "../../decision-lab";
import { InfoTip } from "../components/InfoTip";
import { skillLabel } from "../copy/skill-label";
import { plainPolicyLabel } from "./help-ranking-copy";

export type ChallengeViewProps = {
  pack: DecisionLabPackV3;
  guided?: boolean;
  advanced?: boolean;
  onWatch?: () => void;
  onHome?: () => void;
};

type ChallengeRound = {
  case: DecisionLabCaseV3;
  pick: string | null;
  revealed: boolean;
};

function eligibleCases(pack: DecisionLabPackV3): DecisionLabCaseV3[] {
  return pack.cases.filter((c) => {
    if (c.equippedSkillIds.length < 1) return false;
    return Object.values(c.policies).some(
      (p) => p.status === "recorded" && p.source === "llm"
    );
  });
}

function tagSentence(tags: readonly string[] | undefined): string | null {
  if (tags === undefined || tags.length === 0) return null;
  if (tags.includes("wasted_energy")) {
    return "They spent more energy than a cheaper best move.";
  }
  return null;
}

/** Whole numbers when integer; otherwise one decimal. */
export function formatPlainScore(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function ChallengeView({
  pack,
  guided = false,
  advanced = false,
  onWatch,
  onHome
}: ChallengeViewProps): React.JSX.Element {
  const pool = useMemo(() => eligibleCases(pack), [pack]);
  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState<ChallengeRound[]>([]);

  const current = pool[index] ?? null;

  function reveal() {
    if (current === null || pick === null) return;
    setRevealed(true);
    setHistory((h) => [...h, { case: current, pick, revealed: true }]);
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
    return Math.min(
      ...llm.map((p) => (p.status === "recorded" ? p.regret : 0))
    );
  });
  const meanModel =
    modelRegrets.length === 0
      ? 0
      : modelRegrets.reduce((a, b) => a + b, 0) / modelRegrets.length;

  if (current === null) {
    return (
      <p className="mt-6 text-stone-400" data-testid="lab-challenge">
        No eligible challenge cases in this set.
      </p>
    );
  }

  const bestVal = Math.max(...Object.values(current.oracle.values));
  const userRegret =
    pick === null ? null : bestVal - (current.oracle.values[pick] ?? bestVal);

  const llmPolicies = Object.entries(current.policies).filter(
    ([, pol]) => pol.status === "recorded" && pol.source === "llm"
  );

  const groups = new Map<
    string,
    { keys: string[]; regret: number; tags?: string[] }
  >();
  for (const [key, pol] of llmPolicies) {
    if (pol.status !== "recorded") continue;
    const sid = pol.executedSkillId;
    const existing = groups.get(sid);
    const tags =
      "failureTags" in pol
        ? (pol.failureTags as string[] | undefined)
        : undefined;
    if (existing) {
      existing.keys.push(key);
    } else {
      groups.set(sid, { keys: [key], regret: pol.regret, tags });
    }
  }

  const showAnswerEnabled = pick !== null && !revealed;

  return (
    <section data-testid="lab-challenge" className="mt-6 space-y-4">
      <p className="text-sm text-stone-400">
        Can you beat the AI? Pick a move, then show the answer. Scored from
        saved measurements — no live AI call.
        <InfoTip termId="missScore" />
      </p>
      <div className="rounded border border-stone-800 p-4">
        <div className="mt-1 grid gap-4 text-sm sm:grid-cols-2">
          <div data-testid="challenge-you-side">
            <p className="font-medium text-stone-200">
              You (in the AI&apos;s place)
            </p>
            <p className="mt-1 text-stone-400">
              HP {current.observation.cpu.health}/
              {current.observation.cpu.maxHealth} · Energy{" "}
              {current.observation.cpu.energy} · Defense{" "}
              {current.observation.cpu.defense}
            </p>
          </div>
          <div data-testid="challenge-opponent-side">
            <p className="font-medium text-stone-200">
              Opponent (follows a fixed plan)
            </p>
            <p className="mt-1 text-stone-400">
              HP {current.observation.player.health}/
              {current.observation.player.maxHealth} · Energy{" "}
              {current.observation.player.energy} · Defense{" "}
              {current.observation.player.defense}
            </p>
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm text-stone-300">Your pick</legend>
          <ul className="mt-2 space-y-2">
            {current.equippedSkillIds.map((id) => {
              const aff = current.affordability.find((a) => a.skillId === id);
              const selected = pick === id;
              return (
                <li key={id}>
                  <label
                    className={
                      selected
                        ? "flex min-h-11 items-center gap-2 rounded border border-amber-600 bg-amber-950/40 px-3 py-2 text-amber-50"
                        : "flex min-h-11 items-center gap-2 rounded border border-transparent px-3 py-2 text-stone-200"
                    }
                    data-selected={selected ? "true" : "false"}
                  >
                    <input
                      type="radio"
                      name="challenge-pick"
                      value={id}
                      checked={selected}
                      disabled={revealed}
                      onChange={() => {
                        if (!revealed) setPick(id);
                      }}
                    />
                    <span>
                      {skillLabel(id)}
                      {aff && !aff.affordable ? " (not enough energy)" : ""}
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
            className={
              showAnswerEnabled
                ? "min-h-11 rounded bg-amber-600 px-4 py-2 text-sm font-medium text-stone-950 hover:bg-amber-500"
                : "min-h-11 cursor-not-allowed rounded border border-stone-700 px-3 py-2 text-sm text-stone-400"
            }
            disabled={!showAnswerEnabled}
            onClick={reveal}
            data-testid="challenge-show-answer"
          >
            Show answer
          </button>
          <button
            type="button"
            className="min-h-11 rounded border border-stone-600 px-3 py-2 text-sm"
            onClick={next}
          >
            Next situation
          </button>
        </div>

        {revealed && pick !== null ? (
          <div
            className="mt-4 space-y-2 text-sm text-stone-300"
            aria-live="polite"
            data-testid="challenge-reveal"
          >
            {userRegret === 0 ? (
              <p>You picked the best move.</p>
            ) : (
              <p>
                Your move was {formatPlainScore(userRegret ?? 0)} points worse
                than the best move (
                {current.oracle.best.map(skillLabel).join(", ")}).
              </p>
            )}

            {[...groups.entries()].map(([skillId, g]) => {
              const count = g.keys.length;
              const names = g.keys.map(plainPolicyLabel);
              const tag = tagSentence(g.tags);
              const worse =
                g.regret === 0
                  ? "matched the best move"
                  : `${formatPlainScore(g.regret)} points worse than best`;
              if (count > 1 && groups.size === 1) {
                return (
                  <p key={skillId} data-testid="challenge-ai-group">
                    All {count} recorded AI versions picked {skillLabel(skillId)}{" "}
                    — {worse}.{tag ? ` ${tag}` : ""}
                  </p>
                );
              }
              if (count > 1) {
                return (
                  <p key={skillId} data-testid="challenge-ai-group">
                    {names.join(", ")} all picked {skillLabel(skillId)} —{" "}
                    {worse}.{tag ? ` ${tag}` : ""}
                  </p>
                );
              }
              return (
                <p key={skillId}>
                  {names[0]} picked {skillLabel(skillId)} — {worse}.
                  {tag ? ` ${tag}` : ""}
                </p>
              );
            })}

            {advanced ? (
              <details className="pt-2">
                <summary className="cursor-pointer text-stone-400">
                  Advanced
                </summary>
                <ul className="mt-2 space-y-1 text-stone-400">
                  {llmPolicies.map(([key, pol]) => {
                    if (pol.status !== "recorded") return null;
                    return (
                      <li key={key}>
                        {plainPolicyLabel(key)}: {skillLabel(pol.executedSkillId)}{" "}
                        ({formatPlainScore(pol.regret)} points)
                      </li>
                    );
                  })}
                </ul>
              </details>
            ) : null}

            {guided ? (
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className="min-h-11 rounded border border-stone-600 px-3 py-2 text-sm"
                  onClick={next}
                >
                  Try another
                </button>
                {onWatch ? (
                  <button
                    type="button"
                    className="min-h-11 rounded border border-stone-600 px-3 py-2 text-sm"
                    onClick={onWatch}
                  >
                    Watch a recorded fight
                  </button>
                ) : null}
                {onHome ? (
                  <button
                    type="button"
                    className="min-h-11 rounded border border-stone-600 px-3 py-2 text-sm"
                    onClick={onHome}
                  >
                    Home
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div data-testid="challenge-session" className="text-sm text-stone-400">
        {history.length === 0 ? (
          <p>No answers yet.</p>
        ) : (
          <p>
            You: {history.length} answers, {formatPlainScore(meanUser)} points
            worse than best on average. Best recorded AI:{" "}
            {formatPlainScore(meanModel)}.
          </p>
        )}
      </div>
    </section>
  );
}
