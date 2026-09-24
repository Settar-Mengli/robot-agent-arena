import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
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
import { BuilderForm } from "./builder/BuilderForm";
import { InfoTip } from "./components/InfoTip";
import { ViewErrorBoundary } from "./components/ViewErrorBoundary";
import { skillLabel } from "./copy/skill-label";
import { QUICKSTART_ROBOT } from "./data/quickstart-robot";
import { HonestyStrip } from "./HonestyStrip";
import { LandingView } from "./landing/LandingView";
import {
  clearSlot,
  loadSlot,
  saveSlot,
  SAVE_SLOT_KEY
} from "./persist/save-slot";
import {
  plainLoadMessage,
  plainSaveMessage
} from "./persist/persist-messages";
import {
  buildSavePayload,
  saveAllowedForView
} from "./persist/build-save-payload";
import {
  createBattleViewStore,
  type PlayTurnFn
} from "./store/battle-view";
import { TOUR_KEY } from "./tour/FirstVisitTour";
import { EMPTY_LIVE_CONFIG } from "./live/live-config";
import type { LiveOpponentConfig } from "./live/live-config";
import type { OpponentMode } from "./arena/opponent-mode";

const WatchBattleView = lazy(() =>
  import("./arena/WatchBattleView").then((m) => ({
    default: m.WatchBattleView
  }))
);
const DecisionLabView = lazy(() =>
  import("./lab/DecisionLabView").then((m) => ({
    default: m.DecisionLabView
  }))
);
const LiveOpponentPanel = lazy(() =>
  import("./live/LiveOpponentPanel").then((m) => ({
    default: m.LiveOpponentPanel
  }))
);
const LeaderboardView = lazy(() =>
  import("./leaderboard/LeaderboardView").then((m) => ({
    default: m.LeaderboardView
  }))
);
const MethodologyView = lazy(() =>
  import("./methodology/MethodologyView").then((m) => ({
    default: m.MethodologyView
  }))
);

export type AppView =
  | { kind: "home" }
  | { kind: "builder" }
  | { kind: "setup" }
  | { kind: "battle" }
  | { kind: "watch"; matchId?: string }
  | { kind: "lab" }
  | { kind: "leaderboard" }
  | { kind: "methodology" };

const DEFAULT_SEED = "arena-1";
const SAVE_DISABLED_TITLE =
  "Save is available during Build, Setup, Battle, or Watch";

export type AppProps = {
  playTurn?: PlayTurnFn;
};

function hasSaveSlot(): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(SAVE_SLOT_KEY);
    return raw !== null && raw !== "";
  } catch {
    return false;
  }
}

export function App({ playTurn }: AppProps = {}) {
  const [store] = useState(() => createBattleViewStore());
  const battle = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  );

  const [view, setView] = useState<AppView>({ kind: "home" });
  const [playerConfig, setPlayerConfig] = useState<AgentConfig | null>(null);
  const [opponent, setOpponent] = useState<AgentConfig>(CPU_OPPONENTS[0]!);
  const [seed, setSeed] = useState<string>(DEFAULT_SEED);
  const [watchMatchId, setWatchMatchId] = useState<string | undefined>(
    undefined
  );
  const [persistMessage, setPersistMessage] = useState<string | null>(null);
  const [guidedPath, setGuidedPath] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [savePresent, setSavePresent] = useState(() => hasSaveSlot());
  const [tourCloseSignal, setTourCloseSignal] = useState(0);
  const mainHeadingRef = useRef<HTMLElement | null>(null);
  const [liveConfig, setLiveConfig] =
    useState<LiveOpponentConfig>(EMPTY_LIVE_CONFIG);
  const [livePlayTurn, setLivePlayTurn] = useState<PlayTurnFn | undefined>(
    undefined
  );
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const [showLivePanel, setShowLivePanel] = useState(false);

  function clearLiveSession() {
    setLiveConfig(EMPTY_LIVE_CONFIG);
    setLivePlayTurn(undefined);
    setLiveNotice(null);
  }

  function deriveOpponentMode(): OpponentMode {
    const liveActive =
      liveConfig.enabled &&
      liveConfig.apiKey.trim() !== "" &&
      livePlayTurn !== undefined;
    if (!liveActive) return "cpu";
    if (liveNotice !== null) return "live-fallback";
    const source = battle.lastResult?.trace?.source;
    if (source !== undefined && source !== "llm") return "live-fallback";
    return "live";
  }

  function refreshSavePresent() {
    setSavePresent(hasSaveSlot());
  }

  function beginBattle(
    player: AgentConfig,
    cpu: AgentConfig,
    battleSeed: Seed,
    turnFn?: PlayTurnFn
  ) {
    if (turnFn !== undefined) {
      setLivePlayTurn(() => turnFn);
    } else {
      setLivePlayTurn(undefined);
    }
    setLiveNotice(null);
    const runtime = startBattle(player, cpu, battleSeed);
    store.getState().resetBattle(runtime);
    setView({ kind: "battle" });
  }

  function onContinueFromBuilder(config: AgentConfig) {
    setPlayerConfig(config);
    setView({ kind: "setup" });
  }

  async function onStartFromSetup() {
    if (playerConfig === null) return;
    let turnFn: PlayTurnFn | undefined = playTurn;
    if (liveConfig.enabled && liveConfig.apiKey.trim() !== "") {
      const { createLivePlayTurn } = await import("./live/createLivePlayTurn");
      turnFn = createLivePlayTurn({
        apiKey: liveConfig.apiKey.trim(),
        modelId: liveConfig.modelId,
        onNotice: (message) => setLiveNotice(message)
      });
    }
    beginBattle(playerConfig, opponent, parseSeed(seed), turnFn);
  }

  async function onRestart() {
    if (playerConfig === null) return;
    let turnFn: PlayTurnFn | undefined = playTurn;
    if (liveConfig.enabled && liveConfig.apiKey.trim() !== "") {
      const { createLivePlayTurn } = await import("./live/createLivePlayTurn");
      turnFn = createLivePlayTurn({
        apiKey: liveConfig.apiKey.trim(),
        modelId: liveConfig.modelId,
        onNotice: (message) => setLiveNotice(message)
      });
    }
    beginBattle(playerConfig, opponent, parseSeed(seed), turnFn);
  }

  function goHome() {
    clearLiveSession();
    setView({ kind: "home" });
    setGuidedPath(false);
    setNavOpen(false);
    setClearConfirm(false);
  }

  function onLeaveToHome() {
    store.getState().clearBattle();
    goHome();
  }

  function bumpTourClose() {
    try {
      globalThis.localStorage?.setItem(TOUR_KEY, "1");
    } catch {
      /* ignore */
    }
    setTourCloseSignal((n) => n + 1);
  }

  function onQuickBattle() {
    bumpTourClose();
    setPlayerConfig(QUICKSTART_ROBOT);
    setOpponent(CPU_OPPONENTS[0]!);
    setSeed(DEFAULT_SEED);
    beginBattle(QUICKSTART_ROBOT, CPU_OPPONENTS[0]!, DEFAULT_SEED);
  }

  function onBeatAi() {
    bumpTourClose();
    setGuidedPath(true);
    setView({ kind: "lab" });
  }

  function onWatchCta() {
    bumpTourClose();
    store.getState().clearBattle();
    setView({ kind: "watch" });
  }

  function onBuildCta() {
    bumpTourClose();
    setView({ kind: "builder" });
  }

  const runtime = battle.runtime;
  const terminal = runtime !== null && isBattleOver(runtime.session);
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

  const focusKey =
    view.kind === "battle" && terminal && outcome !== undefined
      ? "results"
      : view.kind === "battle"
        ? "arena"
        : view.kind;

  useEffect(() => {
    const idByKey: Record<string, string> = {
      home: "landing-heading",
      builder: "builder-heading",
      setup: "setup-heading",
      arena: "arena-heading",
      results: "results-heading",
      watch: "watch-heading",
      lab: "lab-heading",
      leaderboard: "leaderboard-heading",
      methodology: "methodology-heading"
    };
    const wantedId = idByKey[focusKey];
    let attempts = 0;
    let raf = 0;
    const tryFocus = () => {
      const el =
        (wantedId !== undefined
          ? document.getElementById(wantedId)
          : null) ?? document.querySelector("main h1");
      if (el instanceof HTMLElement) {
        el.focus();
        return;
      }
      if (attempts < 60) {
        attempts += 1;
        raf = requestAnimationFrame(tryFocus);
      }
    };
    tryFocus();
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [focusKey]);

  const saveAllowed = saveAllowedForView(view.kind);

  function onSave() {
    if (!saveAllowed) return;
    if (
      (view.kind === "builder" ||
        view.kind === "setup" ||
        view.kind === "battle") &&
      playerConfig === null
    ) {
      setPersistMessage("Build a robot before saving.");
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

    const payload = buildSavePayload({
      viewKind: view.kind,
      playerConfig: draftPlayer,
      opponentId: opponent.agentId,
      seed,
      storeRuntime: battle.runtime,
      watchMatchId,
      battleOver: Boolean(terminal),
      ...(outcome !== undefined ? { lastOutcome: outcome } : {})
    });

    const result = saveSlot(payload, {
      inFlight: battle.status === "inFlight"
    });
    if (!result.ok) {
      setPersistMessage(plainSaveMessage(result));
      return;
    }
    setPersistMessage("Saved to this device.");
    refreshSavePresent();
  }

  function onLoad() {
    const loaded = loadSlot();
    if (!loaded.ok) {
      setPersistMessage(plainLoadMessage(loaded));
      return;
    }
    clearLiveSession();
    const slot = loaded.slot;
    const cpu =
      CPU_OPPONENTS.find((o) => o.agentId === slot.draft.opponentId) ??
      CPU_OPPONENTS[0]!;
    setPlayerConfig(slot.draft.playerConfig);
    setOpponent(cpu);
    setSeed(slot.draft.seed);
    const when = new Date(slot.savedAt);
    const locale = Number.isNaN(when.getTime())
      ? slot.savedAt
      : when.toLocaleString();

    if (slot.mode === "watch") {
      setWatchMatchId(slot.watch?.matchId);
      store.getState().clearBattle();
      setView({ kind: "watch", matchId: slot.watch?.matchId });
      setPersistMessage(
        "Loaded a Watch save. A free-play fight is only restored when you saved during that fight. Your robot draft is ready under Build your own robot."
      );
    } else if (slot.runtime !== null) {
      store.getState().resetBattle(slot.runtime);
      setView({ kind: "battle" });
      setPersistMessage(`Loaded your saved fight (saved ${locale}).`);
    } else {
      store.getState().clearBattle();
      setView({ kind: "setup" });
      setPersistMessage(`Loaded your robot draft (saved ${locale}).`);
    }
  }

  function onClearSaveRequest() {
    if (!savePresent) return;
    setClearConfirm(true);
  }

  function onClearSaveConfirm() {
    clearSlot();
    setClearConfirm(false);
    setPersistMessage("Save slot cleared.");
    refreshSavePresent();
  }

  const navBtn = (active: boolean) =>
    active
      ? "min-h-11 text-sm font-medium text-amber-400"
      : "min-h-11 text-sm text-stone-400 hover:text-stone-200";

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded focus-visible:bg-amber-600 focus-visible:px-3 focus-visible:py-2 focus-visible:text-stone-950"
      >
        Skip to main content
      </a>
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <header className="border-b border-stone-800 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <button
                type="button"
                className="text-left"
                onClick={goHome}
                data-testid="brand-home"
              >
                <p className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  AGENT ARENA
                </p>
              </button>
            </div>
            <button
              type="button"
              className="min-h-11 min-w-11 rounded border border-stone-600 px-3 text-sm sm:hidden"
              aria-expanded={navOpen}
              aria-controls="primary-nav"
              onClick={() => setNavOpen((v) => !v)}
              data-testid="nav-menu"
            >
              Menu
            </button>
          </div>
          <nav
            id="primary-nav"
            className={
              navOpen
                ? "mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4"
                : "mt-4 hidden flex-col gap-2 sm:flex sm:flex-row sm:flex-wrap sm:gap-4"
            }
            aria-label="Primary"
            data-testid="primary-nav"
          >
            <button
              type="button"
              className={navBtn(view.kind === "home")}
              onClick={goHome}
            >
              Home
            </button>
            <button
              type="button"
              className={navBtn(
                view.kind === "builder" || view.kind === "setup"
              )}
              onClick={() => {
                setView({ kind: "builder" });
                setNavOpen(false);
              }}
              data-testid="nav-build"
            >
              Build your own robot
            </button>
            <button
              type="button"
              className={navBtn(view.kind === "watch")}
              onClick={() => {
                store.getState().clearBattle();
                setView({ kind: "watch", matchId: watchMatchId });
                setNavOpen(false);
              }}
              data-testid="mode-watch"
            >
              Watch a recorded AI battle
            </button>
            <button
              type="button"
              className={navBtn(view.kind === "lab")}
              onClick={() => {
                setView({ kind: "lab" });
                setNavOpen(false);
              }}
              data-testid="nav-lab"
            >
              Lab
            </button>
            <button
              type="button"
              className={navBtn(view.kind === "leaderboard")}
              onClick={() => {
                setView({ kind: "leaderboard" });
                setNavOpen(false);
              }}
              data-testid="nav-leaderboard"
            >
              Leaderboard
            </button>
            <button
              type="button"
              className={navBtn(view.kind === "methodology")}
              onClick={() => {
                setView({ kind: "methodology" });
                setNavOpen(false);
              }}
              data-testid="nav-methodology"
            >
              Methodology
            </button>

            <div
              className={
                navOpen
                  ? "mt-2 flex flex-col gap-2 border-t border-stone-800 pt-2 sm:mt-0 sm:flex-row sm:flex-wrap sm:items-center sm:border-0 sm:pt-0"
                  : "mt-0 hidden flex-col gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center"
              }
              data-testid="save-controls"
            >
              {saveAllowed ? (
                <button
                  type="button"
                  className="min-h-11 rounded border border-stone-700 px-3 py-2 text-sm text-stone-300"
                  onClick={onSave}
                  data-testid="save-slot"
                >
                  Save
                </button>
              ) : (
                <button
                  type="button"
                  className="min-h-11 cursor-not-allowed rounded border border-stone-800 px-3 py-2 text-sm text-stone-400 opacity-60"
                  disabled
                  title={SAVE_DISABLED_TITLE}
                  data-testid="save-slot"
                >
                  Save
                </button>
              )}
              <button
                type="button"
                className="min-h-11 rounded border border-stone-700 px-3 py-2 text-sm text-stone-300"
                onClick={onLoad}
                data-testid="load-slot"
              >
                Load
              </button>
              {clearConfirm ? (
                <span
                  className="flex flex-wrap items-center gap-2 text-sm text-stone-300"
                  data-testid="clear-slot-confirm"
                >
                  Clear saved game?
                  <button
                    type="button"
                    className="min-h-11 rounded bg-amber-600 px-3 py-2 text-stone-950"
                    onClick={onClearSaveConfirm}
                    data-testid="clear-slot-yes"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded border border-stone-600 px-3 py-2"
                    onClick={() => setClearConfirm(false)}
                    data-testid="clear-slot-cancel"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="min-h-11 rounded border border-stone-700 px-3 py-2 text-sm text-stone-400 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={onClearSaveRequest}
                  disabled={!savePresent}
                  data-testid="clear-slot"
                >
                  Clear save
                </button>
              )}
              {persistMessage ? (
                <p className="text-sm text-stone-400" role="status">
                  {persistMessage}
                </p>
              ) : null}
            </div>
          </nav>
        </header>

        <main
          id="main"
          ref={mainHeadingRef as React.RefObject<HTMLElement>}
          className="py-8 sm:py-10"
        >
          {view.kind === "home" ? (
            <LandingView
              onBeatAi={onBeatAi}
              onQuickBattle={onQuickBattle}
              onWatch={onWatchCta}
              onBuild={onBuildCta}
              tourCloseSignal={tourCloseSignal}
            />
          ) : null}

          {view.kind === "lab" ? (
            <ViewErrorBoundary onHome={goHome}>
              <Suspense fallback={<p className="text-stone-400">Loadingâ€¦</p>}>
                <DecisionLabView
                  guided={guidedPath}
                  onWatch={() => {
                    store.getState().clearBattle();
                    setView({ kind: "watch" });
                  }}
                  onHome={goHome}
                />
              </Suspense>
            </ViewErrorBoundary>
          ) : null}

          {view.kind === "leaderboard" ? (
            <ViewErrorBoundary onHome={goHome}>
              <Suspense fallback={<p className="text-stone-400">Loadingâ€¦</p>}>
                <LeaderboardView onHome={goHome} />
              </Suspense>
            </ViewErrorBoundary>
          ) : null}

          {view.kind === "methodology" ? (
            <ViewErrorBoundary onHome={goHome}>
              <Suspense fallback={<p className="text-stone-400">Loadingâ€¦</p>}>
                <MethodologyView onHome={goHome} />
              </Suspense>
            </ViewErrorBoundary>
          ) : null}

          {view.kind === "watch" ? (
            <ViewErrorBoundary onHome={goHome}>
              <Suspense fallback={<p className="text-stone-400">Loadingâ€¦</p>}>
                <WatchBattleView
                  onLeave={onLeaveToHome}
                  initialMatchId={watchMatchId ?? view.matchId}
                  onMatchIdChange={setWatchMatchId}
                />
              </Suspense>
            </ViewErrorBoundary>
          ) : null}

          {view.kind === "builder" ? (
            <BuilderForm
              initialConfig={playerConfig}
              onContinue={onContinueFromBuilder}
            />
          ) : null}

          {view.kind === "setup" && playerConfig !== null ? (
            <BattleSetup
              player={playerConfig}
              opponent={opponent}
              seed={seed}
              onOpponentChange={setOpponent}
              onSeedChange={setSeed}
              onStart={() => {
                void onStartFromSetup();
              }}
              onBack={() => setView({ kind: "builder" })}
              showLivePanel={showLivePanel}
              onRevealLivePanel={() => setShowLivePanel(true)}
              liveNotice={liveNotice}
              liveConfig={liveConfig}
              onLiveConfigChange={setLiveConfig}
              onHome={goHome}
            />
          ) : null}

          {view.kind === "battle" && (!terminal || outcome === undefined) ? (
            <ArenaView
              store={store}
              onLeave={onLeaveToHome}
              playTurn={livePlayTurn ?? playTurn}
              liveNotice={liveNotice}
              opponentMode={deriveOpponentMode()}
              liveModelId={liveConfig.modelId}
            />
          ) : null}

          {view.kind === "battle" && terminal && outcome !== undefined ? (
            <ResultsView
              outcome={outcome}
              turns={runtime!.turns}
              playerName={runtime!.player.displayName}
              cpuName={runtime!.cpu.displayName}
              finalPlayer={runtime!.player}
              finalCpu={runtime!.cpu}
              onRestart={onRestart}
              onReturnHome={onLeaveToHome}
              opponentMode={deriveOpponentMode()}
              liveModelId={liveConfig.modelId}
            />
          ) : null}
        </main>
      </div>
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
  showLivePanel: boolean;
  onRevealLivePanel: () => void;
  liveNotice: string | null;
  liveConfig: LiveOpponentConfig;
  onLiveConfigChange: (config: LiveOpponentConfig) => void;
  onHome: () => void;
}) {
  const liveIntent =
    props.liveConfig.enabled && props.liveConfig.apiKey.trim() !== "";
  const setupOpponentMode: OpponentMode = liveIntent ? "live" : "cpu";

  return (
    <section aria-labelledby="setup-heading" data-testid="battle-setup">
      <h1
        id="setup-heading"
        tabIndex={-1}
        className="text-2xl font-semibold text-stone-100"
      >
        Battle setup
      </h1>
      <p className="mt-2 text-stone-400" data-testid="setup-opponent-blurb">
        {liveIntent ? (
          <>
            Player: {props.player.displayName}. Opponent: live AI (
            {props.liveConfig.modelId}). Answers are not recorded evidence and
            can vary. Choose a standby computer and seed
            <InfoTip termId="seed" />.
          </>
        ) : (
          <>
            Player: {props.player.displayName}. Opponent: simple computer (not an
            AI). Choose opponent and seed
            <InfoTip termId="seed" />.
          </>
        )}
      </p>
      <div className="mt-3">
        <HonestyStrip variant="compact" opponentMode={setupOpponentMode} />
      </div>

      <fieldset className="mt-8">
        <legend className="text-sm text-stone-300">
          {liveIntent
            ? "Standby computer (if live is off or fails)"
            : "Opponent (simple computer)"}
        </legend>
        <ul className="mt-3 space-y-2">
          {CPU_OPPONENTS.map((cpu) => (
            <li key={cpu.agentId}>
              <label className="flex min-h-11 items-center gap-3 text-stone-200">
                <input
                  type="radio"
                  name="opponent"
                  value={cpu.agentId}
                  checked={props.opponent.agentId === cpu.agentId}
                  onChange={() => props.onOpponentChange(cpu)}
                />
                <span>
                  <span className="font-medium">{cpu.displayName}</span>
                  <span className="block text-sm text-stone-400">
                    {cpu.skillIds.map(skillLabel).join(", ")}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="mt-6">
        <label htmlFor="battle-seed" className="block text-sm text-stone-300">
          Replay code
          <InfoTip termId="seed" />
        </label>
        <input
          id="battle-seed"
          type="text"
          value={props.seed}
          onChange={(event) => props.onSeedChange(event.target.value)}
          className="mt-2 min-h-11 w-full rounded border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100"
          autoComplete="off"
        />
      </div>

      {props.showLivePanel ? (
        <ViewErrorBoundary onHome={props.onHome}>
          <Suspense
            fallback={<p className="mt-6 text-stone-400">Loadingâ€¦</p>}
          >
            <LiveOpponentPanel
              config={props.liveConfig}
              onConfigChange={props.onLiveConfigChange}
              notice={props.liveNotice}
            />
          </Suspense>
        </ViewErrorBoundary>
      ) : (
        <button
          type="button"
          className="mt-8 min-h-11 text-left text-sm text-stone-400 underline-offset-2 hover:text-stone-300 hover:underline"
          onClick={props.onRevealLivePanel}
          data-testid="reveal-live-opponent"
        >
          Live AI opponent (OpenRouter) â€” optional
        </button>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-11 rounded bg-amber-600 px-4 py-2 font-medium text-stone-950 hover:bg-amber-500"
          onClick={props.onStart}
        >
          Start battle
        </button>
        <button
          type="button"
          className="min-h-11 rounded border border-stone-600 px-4 py-2 text-stone-200 hover:bg-stone-900"
          onClick={props.onBack}
        >
          Back
        </button>
      </div>
    </section>
  );
}

