# PROGRESS

## Status Snapshot
- Date: 2026-09-19
- Branch: `fix/duplicate-state-suites`; base `main` @ `b0dac3c`
- Current state: **D-035 + D-036 code shipped.** Snapshot suites assert distinct states. Multi-variant comparisons require a `--models` pin; unpinned mixture recordings are **not** committed. **A2 result pending** the operator’s pinned record (D-034). CI `eval:replay --suite all` remains red on absent keys until that run is committed.
- Test count: **~307** (`npm run coverage`)
- Verification: typecheck / lint / coverage / SNAPSHOT_DRIFT drift-guards / `eval:replay --suite all` (expect fixture_miss until pinned fixtures land)
- Working tree: do not merge until verify + drift are green after the pinned record

## Operator re-record (keys required) — pinned

```powershell
npm run eval:record -- --suite all --variants base,grounded,grounded-v2 --snapshot-suite adversarial --max-matches 2 --models groq:openai/gpt-oss-20b
```

Recommend **groq** (lighter rate-limit load than gemini in the unpinned runs). Quota: CLI prints projection (cap 300). Unpinned local leftover fixtures are discarded for publish; the pinned run regenerates/reuses keys by hash.

Bench-only refill (already pinned):

```powershell
npm run eval:record -- --suite heldout --variants base,grounded --snapshot-suite adversarial --max-matches 0 --models gemini:gemini-3.5-flash-lite
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models gemini:gemini-3.5-flash-lite --variants base,grounded
```

## Completed
- Repository baseline and governance files exist.
- Legal, safety, naming, architecture, MVP scope, and non-goal constraints are recorded.
- Engine / inference / agent / eval spine through M-BENCH (see prior commits).
- **A1 hardening** (PR #27); **A2 code** (`grounded-v2` / `agent-v4-grounded`).
- **D-035** distinct-state suites + sample-count honesty.
- **D-036** pinning required for multi-variant comparisons; manifest records pin; unpinned recordings not published.

## Current Work
- A2 / D-034 published comparative result still **pending pinned operator record**. Unpinned instability documented in EVAL.md; unsupported “one decision worse” reading retracted.

## Blockers
- Operator pinned record with API keys (quota reset). Then commit those fixtures + manifest pin fields; CI verify can go green.

## Tracked Issues
- One npm audit vulnerability remains a tracked later investigation item.
- Do not run `npm audit fix` or upgrade dependencies without explicit approval.
- D-026 closed as won't-fix under D-033 (known limitations: small n, seed correlation).
- Memory ablation variants remain unmeasured.
- Multi-model bench rows await operator record.

## Exact Next Step
- Operator: pinned command above. Then publish D-034 results in EVAL.md from that run only. Then A3.
