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
  llmPolicyIdForVariant,
  mix,
  optimalCpuPolicy,
  parseVariantsList,
  pickBestByCatalogOrder,
  projectQuotaCalls,
  assertQuotaWithinCap,
  randomCpuPolicy,
  resolvePlayerPolicy,
  seededRandomPlayer,
  variantPromptVersion,
  variantToPlayOptions,
  LLM_VARIANTS,
  QUOTA_CALL_CAP,
  QUOTA_DECISIONS_PER_MATCH
} from "./policies";
export type {
  CpuDecideResult,
  CpuPolicy,
  CpuPolicyId,
  LlmCpuPolicyOptions,
  LlmVariant,
  OptimalCpuPolicy,
  PlayerPolicy
} from "./policies";

export { bestResponse, regret } from "./oracle";
export type {
  BestResponseOptions,
  BestResponseResult,
  MemoScope
} from "./oracle";

export {
  countRegretTail,
  countStakeTail,
  generateAdversarialSnapshots,
  generatePivotalSnapshots,
  generateSnapshots,
  selectAdversarialSnapshots,
  selectPivotalSnapshots,
  valueSpread,
  ADVERSARIAL_MIN_REGRET,
  ADVERSARIAL_TARGET_COUNT,
  ADVERSARIAL_REGRET_TAIL_THRESHOLDS,
  PIVOTAL_MIN_SPREAD,
  PIVOTAL_TARGET_COUNT,
  STAKE_TAIL_THRESHOLDS
} from "./snapshots";
export type {
  AdversarialDecisionSnapshot,
  AdversarialSnapshotSuite,
  DecisionSnapshot,
  PivotalDecisionSnapshot,
  PivotalSnapshotSuite,
  RegretTailCounts,
  SnapshotSuite,
  StakeTailCounts
} from "./snapshots";

export { runMatch, runSuite } from "./match";
export type { MatchResult, MatchTurnRecord, RunSuiteOptions } from "./match";

export {
  computeDecisionHeadroom,
  decideDiscriminationVerdict,
  formatDiscriminationSummary,
  intervalsDisjoint,
  runDiscriminationReport,
  summarizeDiscriminationReport,
  SPREAD_THRESHOLD
} from "./discriminate";
export type {
  DecisionHeadroom,
  DiscriminationReport,
  DiscriminationSplitReport,
  DiscriminationSummary,
  PolicyMatchSlice
} from "./discriminate";

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
  deltaVsSuiteBaseline,
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
  SuiteBaselineDelta,
  WilsonInterval
} from "./metrics";

export {
  evalGreedySnapshots,
  evalLlmSnapshots,
  evalRandomSnapshots,
  decisionRecordFromChoice,
  distinctPromptVersions,
  formatSnapshotDecisionsDigest,
  promptVersionMismatchMessage
} from "./snapshot-eval";
export type {
  SnapshotDecisionRecord,
  SnapshotEvalResult
} from "./snapshot-eval";

export {
  buildEvalMarkdownShell,
  extractBaselineBlock,
  renderBaselineBlock,
  upsertBaselineBlock
} from "./report";
export type { BaselineReport, BaselineSplitReport } from "./report";

export {
  assertCommittedManifestScenarioIds,
  assertScenarioIdsInSuite,
  fixtureFileExists,
  mergeManifest,
  manifestPathFor,
  manifestVariantsFor,
  readManifest,
  readManifestSync,
  resolveVariantRun,
  selectScenariosByIds,
  variantsFromManifestSplit,
  writeManifest
} from "./manifest";
export type {
  FixtureManifest,
  ManifestModelEntry,
  ManifestSplit,
  ManifestVariant,
  ManifestVariantEntry
} from "./manifest";

export {
  discoverVariantScenarioIds,
  listFixtureHostModels,
  scenarioMatchFixturesPresent
} from "./fixture-presence";
export type { HostModelPair } from "./fixture-presence";

export {
  KNOWN_PROVIDERS,
  parseModelsFlag,
  pinnedInferenceEnv,
  pinMismatchMessage,
  loadPricing,
  lookupCostUsd,
  pricingKey,
  projectBenchQuotaCalls,
  assertBenchQuotaWithinCap,
  buildFailureTaxonomy,
  computeConsistencyMetrics,
  consistencySampleForSnapshot,
  aggregateLiveLatencies,
  buildBenchRow
} from "./bench";
export type {
  KnownProvider,
  ModelPin,
  PricingEntry,
  PricingTable,
  FailureTaxonomy,
  ConsistencySample,
  ConsistencyMetrics,
  BenchLatency,
  BenchRow,
  BenchRowKey
} from "./bench";
