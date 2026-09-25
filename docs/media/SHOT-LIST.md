# Screenshot shot list

**Not captured for v0.1.0; capture plan for future use.**

Do not embed image markdown in README until files exist in this folder.

## Viewports

| Shot id | Width | Height | Notes |
|---------|------:|-------:|-------|
| All primary | 1280 | 720 | Desktop default |
| `home-findings` | 390 | 844 | Mobile — **What we found** + honesty visible |

Browser zoom **100%**; hide bookmarks; clear or set first-visit tour as needed.

## Captured

*(none for v0.1.0 — screenshots intentionally skipped)*

## Not captured (planned filenames)

| Filename | Route / action | Must show |
|----------|----------------|-----------|
| `home-findings-1280.png` | Home | Primary Challenge CTA, **What we found** card, honesty one-liner |
| `home-findings-390.png` | Home @ 390px | Same block readable; no horizontal scroll |
| `challenge-reveal-1280.png` | Beat the AI → Challenge | One situation with **Show answer** revealed; recorded honesty |
| `challenge-wrap-1280.png` | Challenge after 3 answers | Session wrap + score summary |
| `watch-1280.png` | Watch | Mid-match step; recorded / Gemini note; honesty |
| `leaderboard-not-ranking-1280.png` | Leaderboard | Overlap grouping / “can’t be separated” copy; not-a-ranking cue |
| `methodology-batch4-1280.png` | How it works | Batch 4 scoped null-result paragraph in frame |
| `results-challenge-cta-1280.png` | Results (after a battle) | Challenge CTA / end-lesson tip if visible |
| `arena-mid-1280.png` | Arena mid-fight | Move choices + honesty |
| `lab-diagnostics-1280.png` | Beat the AI → Advanced → Diagnostics | Lab diagnostics panel |

Optional (demo script §8): `setup-live-panel-blur-1280.png` — Live enabled, key field covered/blurred, live honesty line.

## Local preview (Pages base)

```bash
export VITE_BASE=/robot-agent-arena/
npm run build
npm run preview:pages
```

Open the printed local URL (includes `/robot-agent-arena/` prefix). Verify assets and nav match production Pages before capturing.

Production reference: https://settar-mengli.github.io/robot-agent-arena/

## BYOK smoke checklist (operator, deployed Pages)

After merge / deploy:

1. Open Pages URL in a clean profile.
2. Home → **More ways to play** → **Play a live AI with your own key**.
3. Enable Live AI; paste throwaway OpenRouter key; pick an allowlisted model.
4. Start battle; play **3** turns; **Leave** to Home.
5. Confirm: no console errors; Live off → CPU/greedy path still works; key not in localStorage after reload.
6. Confirm Watch / Challenge / Leaderboard still show recorded honesty (unchanged by Live).

Do not commit keys or screenshots containing readable keys.
