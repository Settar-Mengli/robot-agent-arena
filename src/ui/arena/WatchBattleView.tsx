import { useEffect, useMemo, useState } from "react";
import { HonestyLine } from "../components/HonestyLine";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import rawPack from "./pack/arena-replay.v1.json";
import {
  assertArenaReplayPackV1,
  type ArenaReplayMatch,
  type ArenaReplayPackV1
} from "./pack/schema";
import { CombatantBars } from "./CombatantBars";
import { RobotFigure } from "./RobotFigure";
import { narrateSkillExchange } from "./turn-narration";

function loadPack(raw: unknown): ArenaReplayPackV1 {
  return assertArenaReplayPackV1(raw);
}

export type WatchBattleViewProps = {
  onLeave: () => void;
  initialMatchId?: string;
  onMatchIdChange?: (matchId: string) => void;
};

function providerLabel(provider: string): string {
  if (provider === "gemini") return "Gemini";
  if (provider === "groq") return "Groq";
  return provider;
}

function variantPromptLabel(variant: "base" | "grounded"): string {
  return variant === "grounded" ? "facts prompt" : "basic prompt";
}

export function matchSelectLabel(
  match: ArenaReplayMatch,
  index: number,
  packProvider: string
): string {
  const provider = providerLabel(match.provider || packProvider);
  return `${match.playerConfig.displayName} vs ${match.cpuConfig.displayName} — ${provider}, ${variantPromptLabel(match.variant)} (match ${index + 1})`;
}

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
        <h1 id="watch-heading" tabIndex={-1} className="text-2xl font-semibold">
          Watch a recorded AI battle
        </h1>
        <p className="mt-2 text-stone-400">No recorded matches available.</p>
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

  const playerName = match.playerConfig.displayName;
  const cpuName = match.cpuConfig.displayName;

  const narration =
    lastTurn !== undefined
      ? narrateSkillExchange(
          playerName,
          cpuName,
          lastTurn.playerSkillId,
          lastTurn.cpuSkillId
        )
      : [];

  const storyLog = match.turns
    .slice(0, clamped)
    .map((turn, idx) => ({
      turn: idx + 1,
      lines: narrateSkillExchange(
        playerName,
        cpuName,
        turn.playerSkillId,
        turn.cpuSkillId
      )
    }))
    .reverse();

  return (
    <section aria-labelledby="watch-heading" data-testid="watch-battle-view" className="pb-24">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1
          id="watch-heading"
          tabIndex={-1}
          className="text-2xl font-semibold text-stone-100"
        >
          Watch a recorded AI battle
        </h1>
        <p className="text-sm text-stone-400">
          Turn {clamped} / {maxFrame}
          {finished ? " · complete" : null}
        </p>
      </div>

      <div className="mt-2" data-testid="watch-honesty-line">
        <HonestyLine />
      </div>

      <label className="mt-6 block text-sm text-stone-400">
        Match
        <select
          className="mt-1 min-h-11 w-full rounded border aa-border bg-stone-900 px-3 py-2 text-stone-100"
          value={matchId}
          onChange={(e) => {
            setMatchId(e.target.value);
            setFrameIndex(0);
          }}
          data-testid="watch-match-select"
        >
          {pack.matches.map((m, i) => (
            <option key={m.matchId} value={m.matchId}>
              {matchSelectLabel(m, i, pack.provider)}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Card className="p-3">
          <RobotFigure side="player" />
          <CombatantBars
            title="Player (recorded plan)"
            name={player.displayName}
            health={player.health}
            maxHealth={player.maxHealth}
            energy={player.energy}
            maxEnergy={player.maxEnergy}
            defense={player.defense}
          />
        </Card>
        <Card className="p-3">
          <RobotFigure side="cpu" />
          <CombatantBars
            title="Recorded AI"
            name={cpu.displayName}
            health={cpu.health}
            maxHealth={cpu.maxHealth}
            energy={cpu.energy}
            maxEnergy={cpu.maxEnergy}
            defense={cpu.defense}
          />
        </Card>
      </div>

      {lastTurn ? (
        <div
          className="mt-6 space-y-2 text-sm text-stone-300"
          aria-live="polite"
          data-testid="watch-latest-narration"
        >
          {narration.map((line, i) => (
            <p key={`n-${i}`}>{line}</p>
          ))}
          {reasonText ? (
            <p className="text-stone-400">
              What the AI wrote:{" "}
              <span className="text-stone-200">{reasonText.slice(0, 280)}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 text-sm text-stone-400">Start of match.</p>
      )}

      <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center gap-3 border-t aa-border bg-stone-950/95 py-3">
        <Button
          variant="secondary"
          disabled={clamped === 0}
          onClick={() => setFrameIndex((i) => Math.max(0, i - 1))}
        >
          Previous
        </Button>
        <Button
          variant="primary"
          disabled={clamped >= maxFrame}
          onClick={() => setFrameIndex((i) => Math.min(maxFrame, i + 1))}
          data-testid="watch-next"
        >
          Next turn
        </Button>
        <Button variant="secondary" onClick={() => setFrameIndex(0)}>
          Reset
        </Button>
        <Button
          variant="ghost"
          className="ml-auto"
          onClick={onLeave}
          data-testid="watch-leave"
        >
          Leave
        </Button>
      </div>

      {storyLog.length > 0 ? (
        <details className="mt-6" data-testid="watch-story-log" open>
          <summary className="cursor-pointer text-sm font-medium text-stone-300">
            Battle story
          </summary>
          <ol className="mt-3 space-y-3 text-sm text-stone-300">
            {storyLog.map((entry) => (
              <li
                key={entry.turn}
                className={
                  entry.turn === clamped
                    ? "rounded border border-amber-700 bg-amber-950/30 px-3 py-2"
                    : "rounded border aa-border px-3 py-2"
                }
                data-current={entry.turn === clamped ? "true" : "false"}
              >
                <p className="font-medium text-stone-200">Turn {entry.turn}</p>
                <ul className="mt-1 space-y-1 text-stone-400">
                  {entry.lines.map((line, i) => (
                    <li key={`${entry.turn}-${i}`}>{line}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {finished ? (
        <p className="mt-4 text-sm text-stone-300" data-testid="watch-outcome">
          Outcome: {formatOutcome(match.outcome.result)}
        </p>
      ) : null}
    </section>
  );
}

function formatOutcome(result: string): string {
  if (result === "player-victory") return "Player won";
  if (result === "cpu-victory") return "AI side won";
  if (result === "draw") return "Draw";
  return result;
}
