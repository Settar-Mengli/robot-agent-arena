import { useSyncExternalStore } from "react";
import type { StoreApi } from "zustand/vanilla";
import {
  isBattleOver,
  MVP_SKILL_CATALOG,
  type SkillId,
  type TurnRecord
} from "../../engine";
import { createGreedyPlayTurn } from "../play/cpu-turn";
import type { BattleViewStore, PlayTurnFn } from "../store/battle-view";

export type ArenaViewProps = {
  store: StoreApi<BattleViewStore>;
  onLeave: () => void;
  /** Optional test seam; defaults to greedy CPU play. */
  playTurn?: PlayTurnFn;
};

function skillLabel(skillId: SkillId): string {
  const skill = MVP_SKILL_CATALOG.skills.find((s) => s.skillId === skillId);
  return skill?.displayName ?? skillId;
}

function energyCost(skillId: SkillId): number | undefined {
  return MVP_SKILL_CATALOG.skills.find((s) => s.skillId === skillId)?.energyCost;
}

export function ArenaView({ store, onLeave, playTurn }: ArenaViewProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const runtime = state.runtime;
  const greedy = playTurn ?? createGreedyPlayTurn();

  if (runtime === null) {
    return (
      <section aria-labelledby="arena-heading">
        <h2 id="arena-heading" className="text-2xl font-semibold">
          Arena
        </h2>
        <p className="mt-2 text-stone-400">No active battle.</p>
        <button
          type="button"
          className="mt-4 rounded border border-stone-600 px-4 py-2"
          onClick={onLeave}
        >
          Return to Builder
        </button>
      </section>
    );
  }

  const terminal = isBattleOver(runtime.session);
  const inFlight = state.status === "inFlight";
  const actionsDisabled = inFlight || terminal;

  return (
    <section aria-labelledby="arena-heading" data-testid="arena-view">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="arena-heading" className="text-2xl font-semibold text-stone-100">
          Arena
        </h2>
        <p className="text-sm text-stone-400">
          Turn {runtime.session.turn} / {runtime.session.maxTurns}
          {inFlight ? " · resolving…" : null}
        </p>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <CombatantPanel
          title="Player"
          name={runtime.player.displayName}
          health={runtime.player.health}
          maxHealth={runtime.player.maxHealth}
          energy={runtime.player.energy}
          maxEnergy={runtime.player.maxEnergy}
          defense={runtime.player.defense}
        />
        <CombatantPanel
          title="CPU"
          name={runtime.cpu.displayName}
          health={runtime.cpu.health}
          maxHealth={runtime.cpu.maxHealth}
          energy={runtime.cpu.energy}
          maxEnergy={runtime.cpu.maxEnergy}
          defense={runtime.cpu.defense}
        />
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
        <legend className="text-sm text-stone-300">Equipped skills</legend>
        <ul className="mt-3 flex flex-wrap gap-3">
          {runtime.session.player.skillIds.map((skillId) => {
            const cost = energyCost(skillId);
            const unaffordable =
              cost !== undefined && runtime.player.energy < cost;
            return (
              <li key={skillId}>
                <button
                  type="button"
                  className="rounded bg-amber-600 px-4 py-2 font-medium text-stone-950 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={actionsDisabled}
                  onClick={() =>
                    store.getState().dispatchTurn(skillId, greedy)
                  }
                >
                  {skillLabel(skillId)}
                  {unaffordable ? (
                    <span className="ml-2 text-xs font-normal text-stone-800">
                      (unaffordable — engine may fallback)
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <TurnHistory turns={runtime.turns} />

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded border border-stone-600 px-4 py-2 text-stone-200 hover:bg-stone-900"
          onClick={onLeave}
        >
          Return to Builder
        </button>
      </div>
    </section>
  );
}

function CombatantPanel(props: {
  title: string;
  name: string;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  defense: number;
}) {
  return (
    <div className="rounded border border-stone-800 bg-stone-900/50 px-4 py-4">
      <p className="text-xs tracking-wide text-stone-500 uppercase">
        {props.title}
      </p>
      <p className="mt-1 text-lg font-medium text-stone-100">{props.name}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-stone-300">
        <div>
          <dt className="text-stone-500">Health</dt>
          <dd>
            {props.health} / {props.maxHealth}
          </dd>
        </div>
        <div>
          <dt className="text-stone-500">Energy</dt>
          <dd>
            {props.energy} / {props.maxEnergy}
          </dd>
        </div>
        <div>
          <dt className="text-stone-500">Defense</dt>
          <dd>{props.defense}</dd>
        </div>
      </dl>
    </div>
  );
}

function TurnHistory(props: { turns: TurnRecord[] }) {
  if (props.turns.length === 0) {
    return <p className="mt-8 text-sm text-stone-500">No turns yet.</p>;
  }

  return (
    <div className="mt-8" data-testid="turn-history">
      <h3 className="text-sm font-medium text-stone-300">Turn history</h3>
      <ol className="mt-3 space-y-3 text-sm text-stone-300">
        {props.turns.map((turn) => (
          <li
            key={turn.turn}
            className="rounded border border-stone-800 px-3 py-2"
          >
            <p className="font-medium text-stone-200">Turn {turn.turn}</p>
            <ul className="mt-1 space-y-1 text-stone-400">
              {turn.actions.map((action, index) => (
                <li key={`${turn.turn}-${action.actor}-${index}`}>
                  {action.actor}: {action.selectedSkillId}
                  {action.fallback
                    ? ` → ${action.resolvedSkillId} (fallback)`
                    : ` → ${action.resolvedSkillId}`}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
