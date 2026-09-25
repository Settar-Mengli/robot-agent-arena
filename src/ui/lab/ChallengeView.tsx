import { useMemo, useState } from "react";
import {
  type DecisionLabCaseV3,
  type DecisionLabPackV3
} from "../../decision-lab";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { MoveFacts } from "../components/MoveFacts";
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

function CombatResources({
  combatant
}: {
  combatant: DecisionLabCaseV3["observation"]["cpu"];
}): React.JSX.Element {
  return (
    <dl className="mt-3 grid grid-cols-3 gap-3">
      <div>
        <dt className="text-xs font-medium text-stone-400">HP</dt>
        <dd className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">
          {combatant.health}<span className="text-sm font-normal text-stone-400">/{combatant.maxHealth}</span>
        </dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-stone-400">Energy</dt>
        <dd className="mt-1 text-lg font-semibold tabular-nums text-sky-300">
          {combatant.energy}<span className="text-sm font-normal text-stone-400">/{combatant.maxEnergy}</span>
        </dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-stone-400">Defense</dt>
        <dd className="mt-1 text-lg font-semibold tabular-nums text-stone-100">
          {combatant.defense}
        </dd>
      </div>
    </dl>
  );
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
    <section data-testid="lab-challenge" className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-amber-300">
          Situation {index + 1} of {pool.length}
        </p>
        <p className="text-sm text-stone-400">Turn {current.turn}</p>
      </div>
      <Card className="space-y-6 bg-stone-900/40 p-4 sm:p-6">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border aa-border bg-stone-950/40 p-4" data-testid="challenge-you-side">
            <p className="font-medium text-amber-300">
              You (in the AI&apos;s place)
            </p>
            <p className="mt-1 text-lg font-semibold text-stone-100">
              {current.observation.cpu.displayName}
            </p>
            <CombatResources combatant={current.observation.cpu} />
          </div>
          <div className="rounded-lg border aa-border bg-stone-950/40 p-4" data-testid="challenge-opponent-side">
            <p className="font-medium text-stone-300">
              Opponent (follows a fixed plan)
            </p>
            <p className="mt-1 text-lg font-semibold text-stone-100">
              {current.observation.player.displayName}
            </p>
            <CombatResources combatant={current.observation.player} />
          </div>
        </div>

        <fieldset aria-describedby="challenge-move-help">
          <legend className="font-semibold text-stone-100">Your pick</legend>
          <p id="challenge-move-help" className="mt-1 text-sm text-stone-400">
            Choose one move, then show the answer. Defense absorbs attack power before HP is lost.
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {current.equippedSkillIds.map((id) => {
              const aff = current.affordability.find((a) => a.skillId === id);
              const selected = pick === id;
              return (
                <li key={id}>
                  <label
                    className={
                      selected
                        ? "flex h-full min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-amber-600 bg-amber-950/40 px-3 py-3 text-amber-50"
                        : "flex h-full min-h-11 cursor-pointer items-start gap-3 rounded-lg border aa-border bg-stone-950/40 px-3 py-3 text-stone-200 hover:border-stone-500"
                    }
                    data-selected={selected ? "true" : "false"}
                  >
                    <input
                      type="radio"
                      name="challenge-pick"
                      className="mt-1 accent-amber-500"
                      value={id}
                      checked={selected}
                      disabled={revealed}
                      onChange={() => {
                        if (!revealed) setPick(id);
                      }}
                    />
                    <span className="min-w-0 font-medium">
                      {skillLabel(id)}
                      <MoveFacts skillId={id} energyCost={aff?.energyCost} />
                      {aff && !aff.affordable ? (
                        <span className="mt-0.5 block text-sm font-normal text-stone-400">
                          Not enough energy
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      </Card>

      {revealed && pick !== null ? (
          <div
            className="space-y-2 text-sm text-stone-300"
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
                <Button variant="secondary" onClick={next}>
                  Try another
                </Button>
                {onWatch ? (
                  <Button variant="secondary" onClick={onWatch}>
                    Watch a recorded fight
                  </Button>
                ) : null}
                {onHome ? (
                  <Button variant="secondary" onClick={onHome}>
                    Home
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

      <div
        className="sm:sticky bottom-0 z-10 mt-4 w-full space-y-2 border-t aa-border bg-stone-950/95 py-3"
        data-testid="challenge-sticky-bar"
      >
        {!revealed && pick === null ? (
          <p className="text-sm text-stone-400">
            Pick a move first to reveal the answer.
          </p>
        ) : null}
        <Button
          variant={showAnswerEnabled ? "primary" : "secondary"}
          className={
            showAnswerEnabled
              ? "w-full"
              : "w-full border-transparent bg-stone-800 text-stone-200 disabled:opacity-100"
          }
          disabled={!showAnswerEnabled}
          title={
            revealed ? "Answer already shown" : showAnswerEnabled ? undefined : "Pick a move first"
          }
          aria-description={
            revealed ? "Answer already shown" : showAnswerEnabled ? undefined : "Pick a move first"
          }
          onClick={reveal}
          data-testid="challenge-show-answer"
        >
          Show answer
        </Button>
        <Button
          variant={revealed ? "primary" : "secondary"}
          className="w-full sm:w-auto"
          onClick={next}
        >
          Next situation
        </Button>
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
