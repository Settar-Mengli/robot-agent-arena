import { useState, useSyncExternalStore } from "react";
import {
  determineBattleOutcome,
  isBattleOver,
  startBattle,
  type AgentConfig,
  type Seed
} from "../engine";
import { CPU_OPPONENTS } from "../data/opponents";
import { ArenaView } from "./arena/ArenaView";
import { ResultsView } from "./arena/ResultsView";
import { WatchBattleView } from "./arena/WatchBattleView";
import { BuilderForm } from "./builder/BuilderForm";
import { DecisionLabView } from "./lab/DecisionLabView";
import {
  clearSlot,
  loadSlot,
  saveSlot
} from "./persist/save-slot";
import {
  createBattleViewStore,
  type PlayTurnFn
} from "./store/battle-view";

type Screen = "builder" | "setup" | "battle" | "lab" | "watch";
type ArenaMode = "free" | "watch";

const DEFAULT_SEED = "arena-1";

export type AppProps = {
  /** Test seam: inject deferred/slow playTurn. Production omits this. */
  playTurn?: PlayTurnFn;
};

export function App({ playTurn }: AppProps = {}) {
  const [store] = useState(() => createBattleViewStore());
  const battle = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  );

  const [screen, setScreen] = useState<Screen>("builder");
  const [arenaMode, setArenaMode] = useState<ArenaMode>("free");
  const [playerConfig, setPlayerConfig] = useState<AgentConfig | null>(null);
  const [opponent, setOpponent] = useState<AgentConfig>(CPU_OPPONENTS[0]!);
  const [seed, setSeed] = useState<string>(DEFAULT_SEED);
  const [watchMatchId, setWatchMatchId] = useState<string | undefined>(
    undefined
  );
  const [persistMessage, setPersistMessage] = useState<string | null>(null);

  function beginBattle(
    player: AgentConfig,
    cpu: AgentConfig,
    battleSeed: Seed
  ) {
    const runtime = startBattle(player, cpu, battleSeed);
    store.getState().resetBattle(runtime);
    setScreen("battle");
  }

  function onContinueFromBuilder(config: AgentConfig) {
    setPlayerConfig(config);
    setScreen("setup");
  }

  function onStartFromSetup() {
    if (playerConfig === null) {
      return;
    }
    const parsedSeed = parseSeed(seed);
    beginBattle(playerConfig, opponent, parsedSeed);
  }

  function onRestart() {
    if (playerConfig === null) {
      return;
    }
    beginBattle(playerConfig, opponent, parseSeed(seed));
  }

  function onReturnToBuilder() {
    store.getState().clearBattle();
    setScreen("builder");
  }

  const runtime = battle.runtime;
  const terminal =
    runtime !== null && isBattleOver(runtime.session);
  const outcome =
    terminal && runtime
      ? (runtime.turns[runtime.turns.length - 1]?.outcome ??
        determineBattleOutcome(
          runtime.player,
          runtime.cpu,
          runtime.session.turn,
          runtime.session.maxTurns
        ))
      : undefined;

  function onSave() {
    if (playerConfig === null && arenaMode === "free") {
      setPersistMessage("Build an agent before saving.");
      return;
    }
    const draftPlayer =
      playerConfig ??
      ({
        agentId: "unsaved",
        displayName: "Unsaved",
        modules: {
          coreIdentity: "-",
          memory: "-",
          sigilSecurity: "-",
          rules: "-",
          strategy: "-"
        },
        skillIds: ["skill-logic-storm", "skill-override-pulse"]
      } satisfies AgentConfig);
    const result = saveSlot(
      {
        draft: {
          playerConfig: draftPlayer,
          opponentId: opponent.agentId,
          seed
        },
        mode: arenaMode,
        ...(arenaMode === "watch" && watchMatchId !== undefined
          ? { watch: { matchId: watchMatchId } }
          : {}),
        runtime: arenaMode === "free" ? battle.runtime : null,
        battleOver: Boolean(terminal),
        ...(outcome !== undefined ? { lastOutcome: outcome } : {})
      },
      { inFlight: battle.status === "inFlight" }
    );
    if (!result.ok) {
      setPersistMessage(
        result.reason === "in_flight"
          ? "Cannot save while a turn is resolving."
          : `Save failed (${result.reason}).`
      );
      return;
    }
    setPersistMessage("Saved to local slot.");
  }

  function onLoad() {
    const loaded = loadSlot();
    if (!loaded.ok) {
      setPersistMessage(
        loaded.reason === "empty" ? "No save slot." : loaded.message
      );
      return;
    }
    const slot = loaded.slot;
    const cpu =
      CPU_OPPONENTS.find((o) => o.agentId === slot.draft.opponentId) ??
      CPU_OPPONENTS[0]!;
    setPlayerConfig(slot.draft.playerConfig);
    setOpponent(cpu);
    setSeed(slot.draft.seed);
    setArenaMode(slot.mode);
    if (slot.mode === "watch") {
      setWatchMatchId(slot.watch?.matchId);
      store.getState().clearBattle();
      setScreen("watch");
    } else if (slot.runtime !== null) {
      store.getState().resetBattle(slot.runtime);
      setScreen("battle");
    } else {
      store.getState().clearBattle();
      setScreen("setup");
    }
    setPersistMessage(`Loaded save from ${slot.savedAt}.`);
  }

  function onClearSave() {
    clearSlot();
    setPersistMessage("Save slot cleared.");
  }

  const inArenaNav =
    screen === "builder" ||
    screen === "setup" ||
    screen === "battle" ||
    screen === "watch";

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 px-6 py-8">
        <p className="text-sm tracking-[0.2em] text-stone-400 uppercase">
          Agent evaluation framework
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          AGENT ARENA
        </h1>
        <nav className="mt-4 flex flex-wrap gap-3" aria-label="Primary">
          <button
            type="button"
            className={
              inArenaNav
                ? "text-sm font-medium text-amber-400"
                : "text-sm text-stone-400 hover:text-stone-200"
            }
            onClick={() => {
              if (screen === "lab") {
                setScreen(arenaMode === "watch" ? "watch" : "builder");
              }
            }}
          >
            Builder / Arena
          </button>
          <button
            type="button"
            className={
              screen === "lab"
                ? "text-sm font-medium text-amber-400"
                : "text-sm text-stone-400 hover:text-stone-200"
            }
            onClick={() => setScreen("lab")}
          >
            Decision Lab
          </button>
        </nav>
        {inArenaNav ? (
          <div
            className="mt-4 flex flex-wrap gap-2"
            role="group"
            aria-label="Arena mode"
          >
            <button
              type="button"
              className={
                arenaMode === "free"
                  ? "rounded border border-amber-700 px-3 py-1 text-sm text-amber-200"
                  : "rounded border border-stone-700 px-3 py-1 text-sm text-stone-400"
              }
              onClick={() => {
                setArenaMode("free");
                if (screen === "watch") {
                  setScreen("builder");
                }
              }}
              data-testid="mode-free"
            >
              Free play (greedy)
            </button>
            <button
              type="button"
              className={
                arenaMode === "watch"
                  ? "rounded border border-amber-700 px-3 py-1 text-sm text-amber-200"
                  : "rounded border border-stone-700 px-3 py-1 text-sm text-stone-400"
              }
              onClick={() => {
                setArenaMode("watch");
                store.getState().clearBattle();
                setScreen("watch");
              }}
              data-testid="mode-watch"
            >
              Watch recorded
            </button>
          </div>
        ) : null}
        {inArenaNav ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded border border-stone-700 px-3 py-1 text-sm text-stone-300"
              onClick={onSave}
              data-testid="save-slot"
            >
              Save
            </button>
            <button
              type="button"
              className="rounded border border-stone-700 px-3 py-1 text-sm text-stone-300"
              onClick={onLoad}
              data-testid="load-slot"
            >
              Load
            </button>
            <button
              type="button"
              className="rounded border border-stone-700 px-3 py-1 text-sm text-stone-400"
              onClick={onClearSave}
              data-testid="clear-slot"
            >
              Clear save
            </button>
            {persistMessage ? (
              <p className="text-sm text-stone-400" role="status">
                {persistMessage}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        {screen === "lab" ? <DecisionLabView /> : null}

        {screen === "watch" ? (
          <WatchBattleView
            onLeave={onReturnToBuilder}
            initialMatchId={watchMatchId}
            onMatchIdChange={setWatchMatchId}
          />
        ) : null}

        {screen === "builder" ? (
          <BuilderForm
            initialConfig={playerConfig}
            onContinue={onContinueFromBuilder}
          />
        ) : null}

        {screen === "setup" && playerConfig !== null ? (
          <BattleSetup
            player={playerConfig}
            opponent={opponent}
            seed={seed}
            onOpponentChange={setOpponent}
            onSeedChange={setSeed}
            onStart={onStartFromSetup}
            onBack={() => setScreen("builder")}
          />
        ) : null}

        {screen === "battle" && (!terminal || outcome === undefined) ? (
          <ArenaView
            store={store}
            onLeave={onReturnToBuilder}
            playTurn={playTurn}
          />
        ) : null}

        {screen === "battle" && terminal && outcome !== undefined ? (
          <ResultsView
            outcome={outcome}
            turns={runtime!.turns}
            onRestart={onRestart}
            onReturnToBuilder={onReturnToBuilder}
          />
        ) : null}
      </main>
    </div>
  );
}

function parseSeed(raw: string): Seed {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return DEFAULT_SEED;
  }
  if (/^-?\d+$/.test(trimmed)) {
    const asNumber = Number(trimmed);
    if (Number.isSafeInteger(asNumber)) {
      return asNumber;
    }
  }
  return trimmed;
}

function BattleSetup(props: {
  player: AgentConfig;
  opponent: AgentConfig;
  seed: string;
  onOpponentChange: (config: AgentConfig) => void;
  onSeedChange: (seed: string) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <section aria-labelledby="setup-heading" data-testid="battle-setup">
      <h2 id="setup-heading" className="text-2xl font-semibold text-stone-100">
        Battle setup
      </h2>
      <p className="mt-2 text-stone-400">
        Player: {props.player.displayName}. Opponent is a{" "}
        <strong className="font-medium text-stone-200">greedy CPU</strong>{" "}
        baseline (deterministic; not an LLM). Choose opponent and seed.
      </p>

      <fieldset className="mt-8">
        <legend className="text-sm text-stone-300">Opponent (greedy CPU)</legend>
        <ul className="mt-3 space-y-2">
          {CPU_OPPONENTS.map((cpu) => (
            <li key={cpu.agentId}>
              <label className="flex items-center gap-3 text-stone-200">
                <input
                  type="radio"
                  name="opponent"
                  value={cpu.agentId}
                  checked={props.opponent.agentId === cpu.agentId}
                  onChange={() => props.onOpponentChange(cpu)}
                />
                <span>
                  <span className="font-medium">{cpu.displayName}</span>
                  <span className="block text-sm text-stone-500">
                    {cpu.skillIds.join(", ")}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="mt-6">
        <label htmlFor="battle-seed" className="block text-sm text-stone-300">
          Seed
        </label>
        <input
          id="battle-seed"
          type="text"
          value={props.seed}
          onChange={(event) => props.onSeedChange(event.target.value)}
          className="mt-2 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100"
          autoComplete="off"
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded bg-amber-600 px-4 py-2 font-medium text-stone-950 hover:bg-amber-500"
          onClick={props.onStart}
        >
          Start battle
        </button>
        <button
          type="button"
          className="rounded border border-stone-600 px-4 py-2 text-stone-200 hover:bg-stone-900"
          onClick={props.onBack}
        >
          Back to Builder
        </button>
      </div>
    </section>
  );
}
