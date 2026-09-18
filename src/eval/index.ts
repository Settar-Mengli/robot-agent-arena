export {
  AEGIS,
  BULWARK,
  DISRUPTOR,
  HELDOUT_ARCHETYPES,
  MNEMONIC,
  PLAYER_ARCHETYPES,
  STRIKER,
  TEMPEST,
  buildMatchSuite,
  scenarioStratumKey,
  selectDiverseScenarios
} from "./scenarios";
export type {
  EvalSplit,
  MatchScenario,
  PlayerPolicyId
} from "./scenarios";

export {
  greedyCpuPolicy,
  greedyPlayer,
  llmCpuPolicy,
  mix,
  optimalCpuPolicy,
  pickBestByCatalogOrder,
  randomCpuPolicy,
  resolvePlayerPolicy,
  seededRandomPlayer
} from "./policies";
export type {
  CpuDecideResult,
  CpuPolicy,
  CpuPolicyId,
  OptimalCpuPolicy,
  PlayerPolicy
} from "./policies";

export { bestResponse, regret } from "./oracle";
export type {
  BestResponseOptions,
  BestResponseResult,
  MemoScope
} from "./oracle";

export { generateSnapshots } from "./snapshots";
export type { DecisionSnapshot, SnapshotSuite } from "./snapshots";

export { runMatch, runSuite } from "./match";
export type { MatchResult, MatchTurnRecord, RunSuiteOptions } from "./match";

export {
  createMemoryStore,
  createRecordingFetch,
  createReplayFetch,
  fixtureKey
} from "./transport";
export type {
  FixtureRecord,
  FixtureStore,
  RecordingFetch,
  RecordingFetchOptions,
  RecordingFetchStats
} from "./transport";

export {
  aggregateLlm,
  aggregateMatches,
  metricsForChosenMoves,
  percentile,
  randomPolicyExpectation,
  wilsonInterval
} from "./metrics";
export type {
  LlmAggregate,
  MatchAggregate,
  ProviderLlmAggregate,
  SnapshotPolicyMetrics,
  WilsonInterval
} from "./metrics";

export {
  evalGreedySnapshots,
  evalLlmSnapshots,
  evalRandomSnapshots
} from "./snapshot-eval";
export type { SnapshotEvalResult } from "./snapshot-eval";

export {
  buildEvalMarkdownShell,
  extractBaselineBlock,
  renderBaselineBlock,
  upsertBaselineBlock
} from "./report";
export type { BaselineReport, BaselineSplitReport } from "./report";
