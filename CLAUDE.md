# Uma Team Trials Score Auditor

## Working Agreement (read first)

- **Never make assumptions.** If a requirement, game mechanic, data format, or design choice isn't written in this file or `docs/`, ask the developer instead of guessing. Ask the developer for more Uma Musume info or links rather than filling gaps from general knowledge.
- Game mechanics in `docs/team-trials-reference.md` are developer-confirmed unless marked "Open question" or "derived".
- **Always use best practices.** Act as a senior engineer and review your own code as you would a junior's.
- **Never over-engineer.** Take the simplest best-practice path that fits.
- **Write unit tests for new or changed logic.** Any new or changed function/module in `src/db/`, `src/ocr/`, or a pure `.js` helper in `src/components/` needs Vitest tests in the same change, co-located (`matches.js` → `matches.test.js`), in the existing style (explicit `describe`/`it`/`expect` imports, no globals). React component tests are deferred until the UI stabilizes (see `docs/decisions.md`).
- **Update docs in the same change** as the code they describe, including the Repo Structure below.

## Project Overview

A free, browser-based tool that OCRs **Uma Musume: Pretty Derby** (Global, English UI) Team Trials "Score Info" screenshots client-side, tracks each roster uma's all-history average score, flags the "weakest link", and recommends who to upgrade next. Cost target: $0 to host and run, indefinitely. Runs in desktop and mobile browsers.

Why it's new: existing community tools (UmaTools, Umalator) cover support card triggers, character stats, or stamina; existing score trackers need manual entry. Combining screenshot parsing with automated rolling-average auditing is the gap.

## Status

MVP (Simple Mode) is complete: roster setup (manual, auto-fill, or from a backup), screenshot/manual match entry, per-uma stats and weakest link, match history, Export/Import backup, persistent storage request, and the footer disclaimer. Hosted on GitHub Pages at https://lightningstar01.github.io/uma-team-trials-analysis/ (auto-deployed on push to `main`). Next: Phase 2 (Advanced Mode). See `docs/roadmap.md`. Docs began from an AI blueprint conversation plus the developer's screenshots; the scoring/Advanced Mode math was worked out with the developer.

## Architecture

| Area | Decision | Status |
|---|---|---|
| Frontend | React + Vite | **Decided** |
| App type | Static frontend, no backend; the host does no data processing | **Decided** |
| OCR | Tesseract.js, locally in the browser (no cloud OCR) | **Decided** |
| Storage | IndexedDB via Dexie.js | **Decided** |
| MVP input | "Score Info" screenshots, 2 per match (scrolling list covers all 15 umas). One upload can hold several matches, paired by upload order | **Decided** |
| Batch OCR roster fallback | A batch's matches share one identical 15-uma roster (same names and distances; a distance change counts as replacing that uma). An OCR gap (unresolved name or null distance) in one match is filled from what any other match in the batch resolved for that uma, in either direction; conflicting confident reads warn instead of guessing | **Decided** |
| Roster | Stored, set by the player (typed in, or auto-filled from the first screenshot batch). Scores belong to a roster slot; deleting an uma's scores keeps the slot, and only an empty slot can be renamed or moved. Match entry fills points for the 15 slots | **Decided** |
| MVP calculation | **Simple Mode:** compare raw Gained Score averages across all 15 umas, no adjustments | **Decided** |
| Rolling average | All history. Replacing or upgrading an uma = deleting its scores in the app, so they stop counting (kept struck through in Match history) | **Decided** |
| Team Bonus | Excluded from all calculations (only on Score Details, not Score Info; the match total is also on Race History, which the app doesn't use). Site disclaimer | **Decided** |
| Advanced Mode (Phase 2) | Ranks umas by `S = I + T` (own score + score its Rating adds to the team) after removing Ace, Support, and Opponent Rating effects. Player enters Support rate and Team Rating once and keeps them current; each match snapshots them; Aces flagged per match (a match keeps its flags after Aces change). Assumes the Top Option is always picked | **Decided** |
| Opponent rating (Phase 2) | Empirical curve of the Top Option's multiplier vs. Team Rating, fitted from developer samples (not Team Rank floors); assumed to continue beyond sampled ratings, with a site disclaimer | **Decided** |
| Ace detection (Phase 2) | Parse the Edit Team screenshot (manual entry stays an option); needs a developer-provided database of potential umas | **Decided** |
| Backup | Export/Import full history as `.json`; import replaces everything, all or nothing | **Built** |
| Storage protection | `navigator.storage.persist()`, requested once a roster exists | **Built** |
| Hosting | GitHub Pages, deployed by GitHub Actions on push to `main` (lint + test gate the deploy); Vite `base` is the repo subpath | **Built** |

Constraints: images are processed locally and discarded; only numbers are stored (blueprint estimate ~1–2 KB/match, ~15–20 MB per 10,000 matches). Data lives only in the browser, so backup/restore is first-class. Rationale and the full decision log: `docs/decisions.md`.

## Repo Structure

```
.
├── CLAUDE.md, README.md
├── docs/
│   ├── team-trials-reference.md     # How Team Trials works
│   ├── roadmap.md                   # MVP scope, later phases, parking lot
│   └── decisions.md                 # Decision rationale + all open questions
├── .github/workflows/test.yml       # CI: lint + test on push to main / any PR
├── .github/workflows/deploy.yml     # Lint, test, build, publish dist/ to GitHub Pages on push to main
├── vite.config.js                   # base: '/uma-team-trials-analysis/' (GitHub Pages subpath)
├── vitest.config.js                 # node env, src/**/*.test.js, fake-indexeddb setup, v8 coverage (report-only)
└── src/
    ├── db/
    │   ├── db.js                    # Dexie schema (v2: roster table; entries keyed by rosterId) + isActive (skips deleted entries)
    │   ├── constants.js             # Distance order, ROSTER_SIZE, normalizeName (the one name-matching rule)
    │   ├── roster.js                # Roster get/create/validate, edit an empty slot, reset everything
    │   ├── backup.js                # Export the whole DB as tagged JSON; validate and import a backup (replaces everything)
    │   ├── storage.js               # Request persistent storage (navigator.storage.persist)
    │   └── matches.js               # Add matches (optionally creating the roster), per-slot stats, weakest link, match history, duplicate-match keys, delete match / out-of-date / all, delete one uma's scores (marked deleted with a snapshot)
    ├── ocr/
    │   ├── imageValidation.js       # Upload type/size check
    │   ├── tesseractClient.js       # Lazy-loaded singleton Tesseract worker; flattens lines/words with bboxes
    │   ├── parseScoreInfo.js        # Row parsing (parseScreenshotRows), two-screenshot merge (mergeScreenshotRows), batch roster fallback (applyBatchRosterFallback), live row warnings (validateRows)
    │   ├── umaNames.js              # Developer-supplied uma names; exact lookup (split-row gate) and closest-match correction
    │   ├── readScoreInfoBatch.js    # Upload pipeline: validate, pair by order, OCR + merge each match, batch fallback
    │   ├── matchToRoster.js         # Match one match's OCR rows to roster slots, fixing one misread by elimination
    │   └── __fixtures__/            # Score_Info_<n><a|b>.jpg (n = match, a = top, b = bottom; both needed) + sampleMatch.js (15-row reference)
    ├── components/
    │   ├── RosterSetup.jsx          # First run: fill roster manually, auto-fill from screenshots, or import a backup
    │   ├── BackupCard.jsx           # Export/Import backup, non-persistent storage note
    │   ├── useBackupImport.js       # Shared import flow (pick file, validate, confirm, import)
    │   ├── RosterDashboard.jsx      # Sortable roster stats, expandable scores, weakest link, delete scores, edit empty slot, reset
    │   ├── MatchHistory.jsx         # Collapsible match list: per-match umas (deleted struck through), out-of-date flag, delete match / out-of-date / all
    │   ├── MatchEntryModal.jsx      # <dialog> for logging matches (manual or screenshots), one page per match, duplicate-match warning
    │   ├── matchEntry.js            # Entry-modal pure helpers: setup grid rows, points check, batch roster mismatch
    │   ├── rosterSort.js            # Roster column sort, entry rows by points
    │   ├── keepInPlace.js           # Keeps a toggled element at the same screen position
    │   └── format.js                # Number/date display helpers
    ├── App.jsx, App.css, index.css, main.jsx
```

Each logic module has a co-located `*.test.js`. `tesseractClient.smoke.test.js` runs real OCR on a fixture and is skipped by default. Scripts: `npm test`, `npm run test:coverage`, `npm run lint`, `npm run build`, `npm run dev`.

## Key Docs

| File | Read it when |
|---|---|
| `docs/team-trials-reference.md` | A decision depends on game scoring, roster, screens, or match structure |
| `docs/roadmap.md` | Deciding what to build next, or whether a feature is MVP |
| `docs/decisions.md` | Checking rationale, or any open question (the single list for the project) |

## Core Domain Terms (detail in the reference doc)

- **Roster:** the 15 umas tracked, exactly 3 per distance category.
- **Distance categories:** Sprint, Mile, Medium, Long, Dirt. The MVP average is all-time per uma across all distances; per-distance comparison is Phase 2.
- **Ace slots:** 5 umas (one per distance) with a +10% Ace Bonus, shown on Edit Team. Advanced Mode divides it out so Aces compare with non-Aces.
- **Score Info:** result list of all 15 umas with points; the MVP's OCR target.
- **Score Details:** per-uma point breakdown ("i" button on Score Info). Not in the MVP.
- **Edit Team:** roster by distance, Ace tags, Team Rank.
- **Race Results:** five races, WIN/LOSE, finishing places. Not in the MVP.
- **RANK badge / Team Rating:** an uma's RANK badge reflects its Rating; the 15 Ratings make up the player's Team Rating (shown with the Team Rank badge), which sets the opponents' rating and so the Opponent Rating Bonus. Not used in the MVP; Phase 2 uses Team Rating (player-entered) and each uma's Rating.
- **Ignore:** player Class, race numbers, epithet banners.
- **Weakest link:** lowest all-history average (Simple Mode) or lowest `S = I + T` (Advanced Mode); recommended for upgrade next.
