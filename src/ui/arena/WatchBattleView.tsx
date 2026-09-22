import { useEffect, useMemo, useState } from "react";
import { MVP_SKILL_CATALOG } from "../../engine";
import rawPack from "./pack/arena-replay.v1.json";
import {
  assertArenaReplayPackV1,
  type ArenaReplayMatch,
  type ArenaReplayPackV1
} from "./pack/schema";

function loadPack(raw: unknown): ArenaReplayPackV1 {
  return assertArenaReplayPackV1(raw);
}

function skillLabel(skillId: string): string {
  const skill = MVP_SKILL_CATALOG.skills.find((s) => s.skillId === skillId);
  return skill?.displayName ?? skillId;
}

export type WatchBattleViewProps = {
  onLeave: () => void;
  /** Restore a saved match id when present in the pack. */
  initialMatchId?: string;
  /** Notify App when the selected recorded match changes (save slot). */
  onMatchIdChange?: (matchId: string) => void;
};

export function WatchBattleView({
  onLeave,
  initialMatchId,
  onMatchIdChange
}: WatchBattleViewProps) {
  const pack = useMemo(() => loadPack(rawPack), []);
  const defaultId = pack.matches[0]?.matchId ?? "";
  const [matchId, setMatchId] = useState(() => {
    if (
      initialMatchId !== undefined &&
      pack.matches.some((m) => m.matchId === initialMatchId)
    ) {
      return initialMatchId;
    }
    return defaultId;
  });
  const match: ArenaReplayMatch | undefined = pack.matches.find(
    (m) => m.matchId === matchId
  );
  /** frameIndex 0 = start; 1..n = after turn n */
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (
      initialMatchId !== undefined &&
      initialMatchId !== matchId &&
      pack.matches.some((m) => m.matchId === initialMatchId)
    ) {
      setMatchId(initialMatchId);
      setFrameIndex(0);
    }
  }, [initialMatchId, matchId, pack.matches]);

  useEffect(() => {
    if (matchId !== "") {
      onMatchIdChange?.(matchId);
    }
  }, [matchId, onMatchIdChange]);

  if (match === undefined) {
    return (
      <section aria-labelledby="watch-heading">
        <h2 id="watch-heading" className="text-2xl font-semibold">
          Watch recorded
        </h2>
        <p className="mt-2 text-stone-400">No recorded matches in pack.</p>
        <button
          type="button"
          className="mt-4 rounded border border-stone-600 px-4 py-2"
          onClick={onLeave}
        >
          Back
        </button>
      </section>
    );
  }

  const maxFrame = match.turns.length;
  const clamped = Math.min(frameIndex, maxFrame);
  const player =
    clamped === 0
      ? match.startedPlayer
      : match.turns[clamped - 1]!.endedPlayer;
  const cpu =
    clamped === 0 ? match.startedCpu : match.turns[clamped - 1]!.endedCpu;
  const lastTurn = clamped > 0 ? match.turns[clamped - 1] : undefined;
  const finished = clamped === maxFrame;
  const reasonText =
    lastTurn?.trace?.validation &&
    typeof lastTurn.trace.validation === "object" &&
    lastTurn.trace.validation !== null &&
    "reason" in lastTurn.trace.validation &&
    typeof (lastTurn.trace.validation as { reason?: unknown }).reason ===
      "string"
      ? (lastTurn.trace.validation as { reason: string }).reason
      : lastTurn?.trace?.rawText;

  return (
    <section aria-labelledby="watch-heading" data-testid="watch-battle-view">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="watch-heading" className="text-2xl font-semibold text-stone-100">
          Watch recorded
        </h2>
        <p className="text-sm text-stone-400">
          Frame {clamped} / {maxFrame}
          {finished ? " · complete" : null}
        </p>
      </div>

      <p
        className="mt-2 rounded border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-100"
        role="status"
      >
        Recorded replay · {pack.provider}/{pack.model} · {match.variant} · fixed
        player policy ({match.playerPolicy}) · not live AI
      </p>

      <label className="mt-6 block text-sm text-stone-400">
        Match
        <select
          className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100"
          value={matchId}
          onChange={(e) => {
            setMatchId(e.target.value);
            setFrameIndex(0);
          }}
          data-testid="watch-match-select"
        >
          {pack.matches.map((m) => (
            <option key={m.matchId} value={m.matchId}>
              [{m.variant}] {m.scenarioId}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <CombatantPanel
          title="Player (recorded policy)"
          name={player.displayName}
          health={player.health}
          maxHealth={player.maxHealth}
          energy={player.energy}
          maxEnergy={player.maxEnergy}
          defense={player.defense}
        />
        <CombatantPanel
          title="CPU (recorded LLM)"
          name={cpu.displayName}
          health={cpu.health}
          maxHealth={cpu.maxHealth}
          energy={cpu.energy}
          maxEnergy={cpu.maxEnergy}
          defense={cpu.defense}
        />
      </div>

      {lastTurn ? (
        <div className="mt-6 space-y-2 text-sm text-stone-300" aria-live="polite">
          <p>
            Turn {lastTurn.turn}: player{" "}
            <strong>{skillLabel(lastTurn.playerSkillId)}</strong> → CPU{" "}
            <strong>{skillLabel(lastTurn.cpuSkillId)}</strong>
            {lastTurn.trace?.source ? ` · source ${lastTurn.trace.source}` : null}
          </p>
          {reasonText ? (
            <p className="text-stone-400">
              Model-stated reason:{" "}
              <span className="text-stone-200">{reasonText.slice(0, 280)}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 text-sm text-stone-500">Start of match.</p>
      )}

      {finished ? (
        <p className="mt-4 text-sm text-stone-300" data-testid="watch-outcome">
          Outcome: {match.outcome.result} ({match.outcome.reason})
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded border border-stone-600 px-4 py-2 disabled:opacity-40"
          disabled={clamped === 0}
          onClick={() => setFrameIndex((i) => Math.max(0, i - 1))}
        >
          Prev
        </button>
        <button
          type="button"
          className="rounded border border-amber-700 bg-amber-950/40 px-4 py-2 text-amber-100 disabled:opacity-40"
          disabled={clamped >= maxFrame}
          onClick={() => setFrameIndex((i) => Math.min(maxFrame, i + 1))}
          data-testid="watch-next"
        >
          Next turn
        </button>
        <button
          type="button"
          className="rounded border border-stone-600 px-4 py-2"
          onClick={() => setFrameIndex(0)}
        >
          Reset
        </button>
        <button
          type="button"
          className="rounded border border-stone-600 px-4 py-2"
          onClick={onLeave}
        >
          Leave
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
    <div className="rounded border border-stone-800 bg-stone-900/50 p-4">
      <p className="text-xs tracking-wide text-stone-500 uppercase">{props.title}</p>
      <p className="mt-1 text-lg font-medium text-stone-100">{props.name}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-stone-300">
        <div>
          <dt className="text-stone-500">HP</dt>
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
