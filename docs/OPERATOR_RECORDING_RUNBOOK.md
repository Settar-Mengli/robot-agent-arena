# Operator recording runbook — Batch 2 Evidence+Ship (ES)

**Phase:** operator window after agent phase 1.  
**Branch:** `feat/evidence-ship-es`  
**Hard rules:** keys stay local (never commit); agent does not live-call APIs; on 429 stop and resume the same command next day (fixture cache skips completed keys).

## 0) Pre-record (required)

1. Open Gemini and Groq free-tier consoles; note remaining RPM/RPD (or equivalent).
2. Paste those limits into chat before running any `eval:record`.
3. If limits are tight, run free-text on **n=13 only** (adversarial heldout, not ext). If even that fails → cut M5 (report `cut-to-Batch-3`).

## 1) Required: base + grounded

```powershell
# Keys local only — never commit

npm run eval:record -- --suite heldout --snapshot-suite adversarial --variants base,grounded --max-matches 0 --models groq:openai/gpt-oss-20b
npm run eval:record -- --suite heldout --snapshot-suite adversarial-heldout-ext --variants base,grounded --max-matches 0 --models gemini:gemini-3.5-flash-lite
npm run eval:record -- --suite heldout --snapshot-suite adversarial-heldout-ext --variants base,grounded --max-matches 0 --models groq:openai/gpt-oss-20b
```

Gemini adversarial n=13 base+grounded is already recorded on main; do not re-record unless fixtures were invalidated.

## 2) M5 free-text (quota-gated)

n=13 first when tight:

```powershell
npm run eval:record -- --suite heldout --snapshot-suite adversarial --variants freetext --max-matches 0 --models gemini:gemini-3.5-flash-lite
npm run eval:record -- --suite heldout --snapshot-suite adversarial --variants freetext --max-matches 0 --models groq:openai/gpt-oss-20b
```

If limits allow both suites, also:

```powershell
npm run eval:record -- --suite heldout --snapshot-suite adversarial-heldout-ext --variants freetext --max-matches 0 --models gemini:gemini-3.5-flash-lite
npm run eval:record -- --suite heldout --snapshot-suite adversarial-heldout-ext --variants freetext --max-matches 0 --models groq:openai/gpt-oss-20b
```

If even n=13 fails: skip all freetext lines; report M5 cut.

Each successful record run writes `evals/out/bench.live-profile.json` from **live network calls only** (cache hits excluded). Keep those local until phase 2 merges a committed profile.

## 3) After recording — report in chat

```text
Batch 2 ES — resume agent phase 2.
Recording is done on branch feat/evidence-ship-es.
Gemini console limit: <…>
Groq console limit: <…>
M5 free-text status: recorded-n13 | recorded-both-suites | cut-to-Batch-3.
Continue from: commit sanitized fixtures → keyless bench summaries → M4 final pack → M6 → M5 pack/docs finalize or D-047 defer (keep code unexposed, no dead UI) → M7.
Do not call live APIs. Follow the approved Batch 2 plan.
```

## 4) Keyless bench (agent phase 2 or operator)

Only after fixtures exist:

```powershell
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models gemini:gemini-3.5-flash-lite,groq:openai/gpt-oss-20b --variants base,grounded --snapshot-suite adversarial --max-matches 0
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models gemini:gemini-3.5-flash-lite,groq:openai/gpt-oss-20b --variants base,grounded --snapshot-suite adversarial-heldout-ext --max-matches 0
```

Then set `singleModelPending: false`, update EVAL, commit live-profile under `evals/out-committed/bench.live-profile.json`.
