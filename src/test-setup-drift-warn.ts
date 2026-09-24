/**
 * Warn when SNAPSHOT_DRIFT is set during a plain local test run.
 * CI drift jobs set SNAPSHOT_DRIFT=1 intentionally — they also set CI=true.
 */
export function warnIfSnapshotDriftInPlainTest(): void {
  if (process.env.SNAPSHOT_DRIFT !== "1") return;
  if (process.env.CI === "true" || process.env.CI === "1") return;
  // eslint-disable-next-line no-console
  console.warn(
    "[vitest] SNAPSHOT_DRIFT=1 is set. Plain `npm test` will run long drift-guard tests and may hit vitest onTaskUpdate worker errors (issue #28). Clear it: Remove-Item Env:SNAPSHOT_DRIFT (PowerShell) or unset SNAPSHOT_DRIFT."
  );
}

warnIfSnapshotDriftInPlainTest();
