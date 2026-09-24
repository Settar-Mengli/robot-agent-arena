import { useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";
import {
  isBattleOver,
  MVP_SKILL_CATALOG,
  type SkillId,
  type TurnRecord
} from "../../engine";
import { InfoTip } from "../components/InfoTip";
import { skillLabel } from "../copy/skill-label";
import { skillPlainDescription } from "../copy/skill-plain";
import { HonestyStrip } from "../HonestyStrip";
import { createGreedyPlayTurn } from "../play/cpu-turn";
import type { BattleViewStore, PlayTurnFn } from "../store/battle-view";
import { CombatantBars } from "./CombatantBars";
import {
  opponentBarTitle,
  opponentModeLine,
  type OpponentMode
} from "./opponent-mode";
import { RobotFigure } from "./RobotFigure";
import { narrateTurn } from "./turn-narration";

export type ArenaViewProps = {
  store: StoreApi<BattleViewStore>;
  onLeave: () => void;
  /** Optional test seam; defaults to greedy CPU play. */
  playTurn?: PlayTurnFn;
  /** Opt-in live opponent failure notice (fallback to simple computer). */
  liveNotice?: string | null;
  /** Honesty label: cpu / live LLM / live fallen back this turn. */
  opponentMode?: OpponentMode;
  /** Live model id when opponentMode is live (for the label). */
  liveModelId?: string;
};

function energyCost(skillId: SkillId): number | undefined {
  return MVP_SKILL_CATALOG.skills.find((s) => s.skillId === skillId)?.energyCost;
}

export function ArenaView({
  store,
  onLeave,
  playTurn,
  liveNotice,
  opponentMode = "cpu",
  liveModelId = ""
}: ArenaViewProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const runtime = state.runtime;
  const greedy = playTurn ?? createGreedyPlayTurn();
  const modeLine = opponentModeLine(opponentMode, liveModelId);
  const barTitle = opponentBarTitle(opponentMode, liveModelId);

  if (runtime === null) {
    return (
      <section aria-labelledby="arena-heading">
        <h1 id="arena-heading" tabIndex={-1} className="text-2xl font-semibold">
          Arena
        </h1>
        <p className="mt-2 text-stone-400">No active battle.</p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded border border-stone-600 px-4 py-2"
          onClick={onLeave}
        >
          Home
        </button>
      </section>
    );
  }

  const terminal = isBattleOver(runtime.session);
  const inFlight = state.status === "inFlight";
  const actionsDisabled = inFlight || terminal;
  const lastTurn = runtime.turns[runtime.turns.length - 1];
  const playerMotion =
    lastTurn?.actions.some(
      (a) => a.actor === "player" && a.defenseGained > 0
    )
      ? "defend"
      : lastTurn?.actions.some(
            (a) => a.actor === "cpu" && a.damageDealt > 0
          )
        ? "hit"
        : "idle";
  const cpuMotion =
    lastTurn?.actions.some((a) => a.actor === "cpu" && a.defenseGained > 0)
      ? "defend"
      : lastTurn?.actions.some(
            (a) => a.actor === "player" && a.damageDealt > 0
          )
        ? "hit"
        : "idle";

  const latestLines =
    lastTurn !== undefined
      ? narrateTurn(
          lastTurn,
          runtime.player.displayName,
          runtime.cpu.displayName
        )
      : [];

  return (
    <section aria-labelledby="arena-heading" data-testid="arena-view">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1
          id="arena-heading"
          tabIndex={-1}
          className="text-2xl font-semibold text-stone-100"
        >
          Arena
        </h1>
        <p className="text-sm text-stone-400">
          Turn {runtime.session.turn} / {runtime.session.maxTurns}
          {inFlight ? " · resolving…" : null}
        </p>
      </div>
      <p className="mt-2 text-sm text-stone-400" data-testid="arena-opponent-line">
        {modeLine}
      </p>
      <div className="mt-3">
        <HonestyStrip variant="compact" />
      </div>
      {opponentMode === "live-fallback" && liveNotice ? (
        <p
          className="mt-3 text-sm text-amber-300"
          role="status"
          data-testid="arena-live-notice"
        >
          {liveNotice} Falling back to simple computer. This turn: simple
          computer.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <RobotFigure side="player" motion={playerMotion} />
          <CombatantBars
            title="Your robot"
            name={runtime.player.displayName}
            health={runtime.player.health}
            maxHealth={runtime.player.maxHealth}
            energy={runtime.player.energy}
            maxEnergy={runtime.player.maxEnergy}
            defense={runtime.player.defense}
          />
        </div>
        <div>
          <RobotFigure side="cpu" motion={cpuMotion} />
          <CombatantBars
            title={barTitle}
            name={runtime.cpu.displayName}
            health={runtime.cpu.health}
            maxHealth={runtime.cpu.maxHealth}
            energy={runtime.cpu.energy}
            maxEnergy={runtime.cpu.maxEnergy}
            defense={runtime.cpu.defense}
          />
        </div>
      </div>

      {state.lastError ? (
        <div
          role="alert"
          className="mt-6 rounded border border-red-800 bg-red-950/40 px-4 py-3 text-red-200"
          data-testid="arena-error"
        >
          <p className="font-medium">Turn failed</p>
          <p className="mt-1 text-sm">{state.lastError.message}</p>
        </div>
      ) : null}

      <fieldset className="mt-8" disabled={actionsDisabled}>
        <legend className="text-sm text-stone-300">
          Your moves
          <InfoTip termId="energy" />
        </legend>
        <ul className="mt-3 flex flex-wrap gap-3">
          {runtime.session.player.skillIds.map((skillId) => {
            const cost = energyCost(skillId);
            const unaffordable =
              cost !== undefined && runtime.player.energy < cost;
            const hint = skillPlainDescription(skillId);
            return (
              <li key={skillId}>
                <button
                  type="button"
                  className={
                    unaffordable
                      ? "min-h-11 rounded border border-amber-900/60 bg-stone-900/40 px-4 py-2 text-left font-medium text-stone-400 hover:bg-stone-900 disabled:cursor-not-allowed"
                      : "min-h-11 rounded border border-stone-600 bg-stone-900 px-4 py-2 text-left font-medium text-stone-100 hover:border-stone-500 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                  }
                  disabled={actionsDisabled}
                  title={hint}
                  data-unaffordable={unaffordable ? "true" : "false"}
                  onClick={() =>
                    store.getState().dispatchTurn(skillId, greedy)
                  }
                >
                  <span className="block">{skillLabel(skillId)}</span>
                  <span
                    className={
                      unaffordable
                        ? "mt-1 block text-xs font-normal text-stone-400"
                        : "mt-1 block text-xs font-normal text-stone-400"
                    }
                  >
                    {hint}
                  </span>
                  {unaffordable ? (
                    <span className="mt-1 block text-xs font-normal text-amber-200">
                      Not enough energy — may switch to a safe stabilize
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {latestLines.length > 0 ? (
        <div
          className="mt-4 space-y-1 text-sm text-stone-300"
          aria-live="polite"
          data-testid="arena-latest-narration"
        >
          {latestLines.map((line, i) => (
            <p key={`latest-${i}`}>{line}</p>
          ))}
        </div>
      ) : null}

      <TurnHistory
        turns={runtime.turns}
        playerName={runtime.player.displayName}
        cpuName={runtime.cpu.displayName}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-11 rounded border border-stone-600 px-4 py-2 text-stone-200 hover:bg-stone-900"
          onClick={onLeave}
        >
          Leave
        </button>
      </div>
    </section>
  );
}

function TurnHistory(props: {
  turns: TurnRecord[];
  playerName: string;
  cpuName: string;
}) {
  if (props.turns.length === 0) {
    return <p className="mt-8 text-sm text-stone-400">No turns yet.</p>;
  }

  const newestFirst = [...props.turns].reverse();

  return (
    <div className="mt-8" data-testid="turn-history">
      <h2 className="text-sm font-medium text-stone-300">Battle log</h2>
      <ol
        className="mt-3 space-y-3 text-sm text-stone-300"
        data-testid="arena-log"
      >
        {newestFirst.map((turn) => (
          <li
            key={turn.turn}
            className="rounded border border-stone-800 px-3 py-2"
          >
            <p className="font-medium text-stone-200">Turn {turn.turn}</p>
            <ul className="mt-1 space-y-1 text-stone-400">
              {narrateTurn(turn, props.playerName, props.cpuName).map(
                (line, index) => (
                  <li key={`${turn.turn}-${index}`}>{line}</li>
                )
              )}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
