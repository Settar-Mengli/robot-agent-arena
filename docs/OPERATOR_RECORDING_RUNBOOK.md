# Operator recording runbook — Batch 2 Evidence+Ship (ES)

**Phase:** operator window after agent phase 1 (+ recording blockers fixed).  
**Branch:** `feat/evidence-ship-es`  
**Hard rules:** keys stay local (never commit); agent does not live-call APIs; on 429 stop and resume the same command (fixture cache skips completed keys).

## 0) Pre-record (required)

1. Open Gemini and Groq free-tier consoles; note remaining RPM/RPD (or equivalent).
2. Paste those limits into chat before running any `eval:record`.
3. If limits are tight, run free-text on **n=13 only** (adversarial heldout, not ext). If even that fails → cut M5 (report `cut-to-Batch-3`).
4. **Revert a damaged local `evals/fixtures/manifest.json`** if a prior partial run rewrote `snapshotSuite` / added incomplete pins:
   ```powershell
   git checkout -- evals/fixtures/manifest.json
   ```
   Keep any valid new fixture JSON files under `evals/fixtures/` (content-hash keys). Do not commit them until phase 2.

## 1) Pacing flags (record-only)

Defaults (also in `.env.example`):

| Flag / env | Default | Recommended |
| --- | ---: | --- |
| `--record-delay-ms` / `RECORD_LIVE_DELAY_MS` | 2000 | **Gemini:** 2500–4000 ms (low free RPM). **Groq:** 1500–2000 ms if RPM ≥ 30. |
| `--max-consecutive-429s` / `RECORD_MAX_CONSECUTIVE_429S` | 5 | Keep 5; stop-early saves quota. |

Cache hits do **not** wait. Retries also use exponential backoff + jitter and honor `Retry-After` when present.

Example:

```powershell
$env:RECORD_LIVE_DELAY_MS="3000"
$env:RECORD_MAX_CONSECUTIVE_429S="5"
```

Or pass flags on each command.

## 2) Required: base + grounded (rerun)

```powershell
# Keys local only — never commit

npm run eval:record -- --suite heldout --snapshot-suite adversarial --variants base,grounded --max-matches 0 --models groq:openai/gpt-oss-20b --record-delay-ms 2000 --max-consecutive-429s 5

npm run eval:record -- --suite heldout --snapshot-suite adversarial-heldout-ext --variants base,grounded --max-matches 0 --models gemini:gemini-3.5-flash-lite --record-delay-ms 3000 --max-consecutive-429s 5

npm run eval:record -- --suite heldout --snapshot-suite adversarial-heldout-ext --variants base,grounded --max-matches 0 --models groq:openai/gpt-oss-20b --record-delay-ms 2000 --max-consecutive-429s 5
```

Gemini adversarial n=13 base+grounded is already recorded on main; do not re-record unless fixtures were invalidated.

Multi-pin: recording `groq` while the manifest already has `gemini` is **allowed** (D-046). Pins accumulate in `variants[].models[]` without wiping gemini provenance.

## 3) M5 free-text (quota-gated)

n=13 first when tight:

```powershell
npm run eval:record -- --suite heldout --snapshot-suite adversarial --variants freetext --max-matches 0 --models gemini:gemini-3.5-flash-lite --record-delay-ms 3000 --max-consecutive-429s 5
npm run eval:record -- --suite heldout --snapshot-suite adversarial --variants freetext --max-matches 0 --models groq:openai/gpt-oss-20b --record-delay-ms 2000 --max-consecutive-429s 5
```

If limits allow both suites, also:

```powershell
npm run eval:record -- --suite heldout --snapshot-suite adversarial-heldout-ext --variants freetext --max-matches 0 --models gemini:gemini-3.5-flash-lite --record-delay-ms 3000 --max-consecutive-429s 5
npm run eval:record -- --suite heldout --snapshot-suite adversarial-heldout-ext --variants freetext --max-matches 0 --models groq:openai/gpt-oss-20b --record-delay-ms 2000 --max-consecutive-429s 5
```

If even n=13 fails: skip all freetext lines; report M5 cut.

## 4) How to read the new summary lines

Look for:

- `record pacing: liveDelayMs=… maxConsecutive429s=…`
- `newly recorded` / `served from cache` / `skipped non-2xx`
- `live HTTP fail by status: 429=N, 500=M, …` — **diagnose rate limits vs other errors**
- `live HTTP fail bodies (redacted): 429: …` — provider message without secrets
- `PARTIAL RECORD: …` — fallbacks present; **do not publish** full-set optimal%/invalid%
- `snapshots[…]: PARTIAL llmOk=A failed=B optimal(llmOk)=…` — quality only on successful LLM decisions
- `RECORD STOPPED: N consecutive HTTP 429…` — exit 1; resume the **same** command later

Each successful (or partial) record run may write `evals/out/bench.live-profile.json` from **live** calls only (gitignored). Keep local until phase 2.

## 5) After recording — report in chat

```text
Batch 2 ES — resume agent phase 2.
Recording is done on branch feat/evidence-ship-es.
Gemini console limit: <…>
Groq console limit: <…>
M5 free-text status: recorded-n13 | recorded-both-suites | cut-to-Batch-3.
Continue from: commit sanitized fixtures → keyless bench summaries → M4 final pack → M6 → M5 pack/docs finalize or D-047 defer (keep code unexposed, no dead UI) → M7.
Do not call live APIs. Follow the approved Batch 2 plan.
```

## 6) Keyless bench (agent phase 2 or operator)

Only after fixtures exist:

```powershell
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models gemini:gemini-3.5-flash-lite,groq:openai/gpt-oss-20b --variants base,grounded --snapshot-suite adversarial --max-matches 0
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models gemini:gemini-3.5-flash-lite,groq:openai/gpt-oss-20b --variants base,grounded --snapshot-suite adversarial-heldout-ext --max-matches 0
```

Then set `singleModelPending: false`, update EVAL, commit live-profile under `evals/out-committed/bench.live-profile.json`.
