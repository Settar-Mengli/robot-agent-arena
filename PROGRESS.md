# PROGRESS

## Status Snapshot
- Date: 2026-09-23
- Branch: `feat/ux-bugs-d050` → PR (D-050)
- Current state: Batch 3 (D-049) on main. **D-050** plain-language UX + AppView/save fixes + lazy Lab/Watch shipped in this PR (PR number filled after open). Next: locked batch **9**.
- Verification: typecheck / lint / vitest / coverage / build (incl. base path) / eval:replay / seven drifts / protected-path empty — run in this PR gate pass.

## Completed
- Repository baseline through Batch 3 (PR #37 / D-049) on main.
- B.2d (PR #35 / D-043) and Evidence+Ship ES (PR #36 / D-044–D-048).
- **D-050** UX + bugs (this PR): plain landing, guided Challenge, honesty/tour/a11y, AppView saves, Advanced Lab Compare (n=13), battle juice, lazy Lab/Watch, ~380px layout. No artifact / engine changes.

## Open
- Locked batch **9**: three new measurements.
- Memory variants unmeasured.
- Heldout-ext freetext deferred (D-047).
- Issue #28 vitest worker noise on long drift steps (assertions still green).
