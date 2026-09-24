# Uma Team Trials Score Auditor

## Working Agreement (read first)

- **Never make assumptions.** If a requirement, game mechanic, data format, or design choice is not written down in this file or in `docs/`, ask the developer instead of guessing.
- The developer can provide more information or links about Uma Musume on request; ask for them rather than filling gaps from general knowledge.
- Treat game-mechanic claims as unconfirmed unless `docs/team-trials-reference.md` tags them `[Developer]` or `[Screenshot]`.
- **Always use best practices.** Pretend you are a senior software engineer, and review your own code as if you were a senior doing a code review for a junior.
- **Never over-engineer.** Always take the simplest best-practice path that fits the problem best.
- **Write unit tests for new or changed logic.** Any new or modified function/module in `src/db/` or `src/ocr/` needs accompanying Vitest tests in the same change, co-located next to the file it tests (e.g. `matches.js` → `matches.test.js`), following the existing style (plain `describe`/`it`/`expect` imports, no test globals). React component tests (`src/components/`) are deferred until the UI stabilizes — see `docs/decisions.md`.

## Project Overview

A free, browser-based tool that uses client-side OCR to read **Uma Musume: Pretty Derby** Team Trials match result screens, tracks rolling average scores for each character on a 15-character roster, identifies the "weakest link" pulling down team scoring, and recommends who to upgrade next.

- **Game version:** Global, English UI.
- **Cost target:** $0 to host and run, indefinitely.
- **Platform:** browser-based, client-side only (desktop and mobile browsers).
- **Why it's new:** existing community tools (e.g. UmaTools, Umalator) focus on support card triggers, character stats, or stamina calculations. Existing score trackers rely on manual data entry. Combining score-screen image parsing with automated rolling-average auditing is the gap this project fills.

## Status

**Documentation first.** The developer wants the docs in place before designing the database schema or UI. A React + Vite project has been set up by the developer. The docs were drafted from an initial blueprint conversation with another AI plus the developer's sample screenshots; see the confidence tags in `docs/team-trials-reference.md`. The scoring and Advanced Mode math was then worked out with the developer in a claude.ai Project session, and the docs were moved into the repo for Claude Code afterward.

## Architecture

| Area | Decision | Status |
|---|---|---|
| Frontend framework | React with Vite | **Decided** (developer) |
| Game version | Global, English UI | **Decided** (developer) |
| MVP input | "Score Info" screenshots (2 scrolling screenshots cover all 15 umas per match); the entry form accepts a batch of screenshots for several matches at once, paired up by upload order | **Decided** (developer) |
| MVP calculation | Compare averages across all 15 umas using raw Gained Scores, with no adjustments (**Simple Mode** only) | **Decided** (developer) |
| Advanced Mode (Phase 2) | Ranks umas by `S = I + T` (the uma's own score plus the score its Rating adds to the team), after removing Ace, Support, and Opponent Rating effects from each match's score. The player enters Support rate and Team Rating once and keeps them current, each match snapshots them, and Aces are flagged per match; assumes the player always picks the Top Option | **Decided** (developer) — see `docs/roadmap.md` and `docs/decisions.md` |
| Opponent rating estimate (Advanced Mode) | Empirical curve of the Top Option's opponent rating multiplier vs. the player's Team Rating, fitted from developer-collected samples (not from Team Rank floors); assumed to continue beyond the sampled ratings, with a site disclaimer | **Decided** (developer) — see `docs/team-trials-reference.md` |
| Team Bonus | Left out of all calculations (it appears only on Score Details, not Score Info; the match's total score is also on Race History, which the app doesn't use currently); the site carries a disclaimer | **Decided** (developer) |
| Rolling average | Over all history; a replaced uma is deleted in the app, nulling its existing data | **Decided** (developer) |
| Ace detection (Advanced Mode, Phase 2) | Parse the Edit Team screenshot (manual entry stays an option); needs a database of potential umas, to be provided by the developer | **Decided** (developer) |
| Upgrading an uma | Same as replacing it: delete it in the app, nulling its existing history | **Decided** (developer) |
| Ace flag scope (Advanced Mode, Phase 2) | Per-match; a recorded match keeps the Ace flag it had at the time, even after Aces change later | **Decided** (developer) |
| App type | Static frontend, no backend; the host does zero data processing | Proposed |
| OCR | Tesseract.js, running locally in the browser (no cloud OCR APIs) | Proposed |
| Storage | IndexedDB in the user's browser, via Dexie.js | **Decided** (developer) |
| Hosting | GitHub Pages, Vercel, or Netlify (all free) | Undecided |
| Backup | Export/Import of full history as a `.json` file | Proposed |
| Storage protection | `navigator.storage.persist()` to reduce risk of browser cleanup | Proposed |

Design constraints from the blueprint:

- Images are processed locally, text scores are extracted, and the image is discarded. Only numbers are stored.
- Blueprint estimate: about 1-2 KB per logged match (all 15 characters), so about 15-20 MB for 10,000 matches.
- Data lives only in the user's browser, so backup/restore is a first-class feature, not an afterthought.

See `docs/decisions.md` for the full decision log.

## Repo Structure

The docs layout is settled. The `src/` layout comes from the Vite project the developer set up; it'll be shared later via Claude Code and filled in here once received.

```
.
├── CLAUDE.md                        # This file: project context and repo map
├── docs/
│   ├── team-trials-reference.md     # How Team Trials works (reference for design decisions)
│   ├── roadmap.md                   # MVP scope, later phases, uncommitted ideas
│   └── decisions.md                 # Log of decisions made and decisions still pending
├── .github/
│   └── workflows/
│       └── test.yml                 # CI: lint + test on push/PR to main
├── vitest.config.js                 # Vitest config (node environment, src/**/*.test.js, fake-indexeddb setup, coverage-v8 report-only)
└── src/                             # React + Vite app
    ├── db/
    │   ├── db.js                    # Dexie instance + schema
    │   ├── constants.js             # Distance category enum
    │   ├── matches.js               # Data-access layer: add/query/delete matches and umas
    │   └── matches.test.js          # Unit tests against fake-indexeddb: addMatch/getLatestMatchEntries/getRosterSummary/deleteUmaHistory
    ├── ocr/
    │   ├── imageValidation.js       # Light upload validation (file type, size cap)
    │   ├── imageValidation.test.js  # Unit tests for the type/size validation rules
    │   ├── tesseractClient.js       # Tesseract.js worker wrapper (lazy-loaded, singleton worker)
    │   ├── tesseractClient.test.js  # Unit tests for the wrapper logic (singleton reuse, flattening, terminate) against a mocked tesseract.js
    │   ├── tesseractClient.smoke.test.js  # Skipped-by-default real-OCR test against the fixtures
    │   ├── parseScoreInfo.js        # Bbox-based row parsing (parseScreenshotRows) + two-screenshot de-dup (mergeScreenshotRows) + live row-correctness warnings (validateRows)
    │   ├── parseScoreInfo.test.js   # Parsing/merge/validation unit tests (synthetic bbox fixtures, no Tesseract needed)
    │   ├── umaNames.js              # Known playable uma names (developer-supplied); exact lookup (lookupUmaName) for the split-row noise gate, closest-match correction (resolveUmaName/closestUmaName) for a confirmed row's name
    │   ├── umaNames.test.js         # Unit tests for exact lookup and closest-match correction
    │   └── __fixtures__/            # Real Score Info screenshots for OCR dev/testing, plus sampleMatch.js (15-row reference data)
    ├── components/
    │   ├── RosterDashboard.jsx      # Per-uma averages, weakest-link recommendation, delete-uma
    │   ├── MatchEntryForm.jsx       # Match entry: manual typing, or upload Score Info screenshots (one or more matches per batch) to auto-fill via OCR
    │   └── OcrDebugPanel.jsx        # Dev-only (DEV build) raw-OCR-text diagnostic tool
    ├── App.jsx
    └── main.jsx
```

Test script: `npm test` (Vitest), `npm run test:coverage` for a report-only coverage run (no enforced threshold). Real Score Info screenshots for OCR testing live only in `src/ocr/__fixtures__/`, named `Score_Info_<n><a|b>.jpg` (`<n>` = match number, `a` = top screenshot, `b` = bottom screenshot — each match needs both). React component tests (for `components/`) are not yet set up — deferred pending UI stabilization.

Update this section whenever files or folders are added.

## Key Docs

| File | Read it when |
|---|---|
| `docs/team-trials-reference.md` | Making any decision that depends on how the game's scoring, roster, screens, or match structure works |
| `docs/roadmap.md` | Deciding what to build next, or whether a feature belongs in the MVP |
| `docs/decisions.md` | Checking decision rationale not covered elsewhere, or any open question across the project |

## Core Domain Terms (see the reference doc for detail)

- **Roster:** the 15 characters (Umas) being tracked.
- **Ace slots:** 5 Umas designated as "Aces", set once and shown on the Edit Team screen. Advanced Mode (Phase 2) divides the Ace bonus out of each match's score so Aces can be compared against non-Aces. Reading them from an Edit Team screenshot (manual entry remains an option) is planned for Advanced Mode (Phase 2), not the MVP.
- **Distance categories:** Sprint, Mile, Medium, Long, Dirt. Stored per match row; the MVP's rolling average is all-time per uma across all distances combined (Simple Mode does not split by distance). Per-distance comparison is a Phase 2 (Advanced Mode) feature — see `docs/roadmap.md`.
- **Score Info screen:** the result list showing all 15 umas with their points. This is the MVP's OCR target.
- **Score Details screen:** the per-uma point breakdown, opened by the "i" button on Score Info. Not in the MVP.
- **Edit Team screen:** shows the roster by distance, Ace tags, and Team Rank.
- **Race Results screen:** shows the five races, WIN/LOSE, and finishing places. Not in the MVP.
- **RANK badge / Team Rank:** an uma's RANK badge only matters for the player's Team Rank (their current Team Trials rating), which determines the opponents' team rank/score and so the Opponent Rating Bonus. Opponents have a rating like this too. Not used in the MVP; Advanced Mode (Phase 2) uses Team Rating (entered by the player) and each uma's Rating (from its RANK badge).
- **Ignore:** player Classes, race numbers, and epithet banners. The app does not need them.
- **Weakest link:** the uma with the lowest all-history average across all 15 (Simple Mode, the MVP: lowest raw average; Advanced Mode, Phase 2: lowest contribution score `S = I + T`); recommended for upgrade next.

## Open Questions

See `docs/decisions.md`'s Open Questions section — it's the single list for the whole project.
