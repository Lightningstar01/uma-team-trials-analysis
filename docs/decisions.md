# Decisions

Holds only (1) decisions and rationale not already stated as current state in `CLAUDE.md`, `roadmap.md`, or `team-trials-reference.md`, and (2) every open question in the project.

## Decisions

### Scoring and Advanced Mode

- **Ace adjustment:** dividing an Ace's score by 1.1 was tried and removed. The Ace Bonus is diluted by that match's Opponent Rating and Streak rates (see `team-trials-reference.md`, Score Details). The standalone formula `Gained Score × (M − 0.10) / M` was also dropped, because dividing down to base score in `S = I + T` already removes the Ace bonus.
- Ace slot input (Edit Team parsing, the potential-uma database) and per-match Ace flags are Phase 2, since Advanced Mode is their only user.
- **Support Cards** are out of scope. The Support rate is account-wide and the same for every uma; Simple Mode ignores it, and Advanced Mode takes it as player input.
- **Top Option assumption:** matches the developer's play pattern, and lets the Opponent Rating Bonus come from Team Rating alone via the empirical curve, instead of tracking per-match opponent choice. Asking for the average opponent rating (an earlier design) was dropped because typing it every race is too much effort.
- **Streak Bonus** isn't modeled in Advanced Mode: small next to Opponent Rating, judged negligible for now.
- **Aptitude modifiers** on Team Rating (S/A/B/F–G; see `team-trials-reference.md`) aren't modeled. Team Rating is treated as the flat sum of the 15 Ratings. Site disclaimer: notes the simplification, and that an S-rank in either relevant aptitude (surface, distance) for a race category is worth +2% each.
- In Advanced Mode, Team Rating is entered manually, not derived from RANK badges.
- **`S = I + T` design:**
  - `I` uses base score (Gained Score ÷ full multiplier), not raw or Ace-adjusted score, so history stays comparable when Team Rating or Support rate change and Ace/Support/Opponent effects are isolated. Every uma is compared as a non-Ace; the player supplies which umas are Aces.
  - `I = average base × (1 + Mopp_without + Support)`, and `T` covers all 15 umas including the uma itself. That way the slice of the uma's own score earned by its own Rating counts only in `T`, never twice. Both terms are in real team points, so `S` equals the team's score drop if the uma were removed.
  - Removal is total (no replacement baseline), so the value is the points the uma brings.
  - `R' = R − (that uma's Rating)`, using the RANK-badge floor value, not the uma's average score.
- **Team Rank floors** (E–UD9) were tried and dropped for modeling opponent rating: the Top Option doesn't follow them (at Team Rating 115,904 the top opponent, 125,153, was still below the next floor). The empirical curve replaces them; the floor table stays as reference.
- **"Normalized scores"** (Average Score ÷ Opponent Tier Modifier) was dropped: `S = I + T` already divides the Opponent Rating multiplier out of each score.

### OCR (Score Info)

- **Review UX:** OCR fills the same editable grid manual entry uses. There's no separate review or fallback screen; a failed or misread row is just edited.
- **Upload validation is light:** jpg/png/webp only, ≤15 MB, no crop or dimension rules. Bad reads are caught in review like a typo.
- **Extracted fields:** `umaName`, `distance`, `points` only. RANK badge, Ace status, and epithets aren't extracted (Phase 2/Edit Team concerns).
- **Name extraction** uses each word's `bbox.x0` in the name column, not token stripping: portrait/badge art noise bleeds into nearly every row's text, which regex can't reliably remove.
- **Row detection** pairs each name+points line with its nearest distance line (within a max gap) instead of clustering lines into bands by gap: intra-row and inter-row gaps overlap too much, and anchor pairing ignores all other noise.
- **Distance words** match as a whole token in a ≤3-token line, not as the exact line: real OCR produced `"y Mile"`, which an exact match missed (breaking the elimination below).
- **Split overlap row:** the overlap row (Air Groove, fixture 1) is cut in *both* screenshots. The top one has name+points but the distance pill is cut off; the bottom one's fragment didn't OCR into anything usable. So a name+points line with no nearby distance is kept with `distance: null`, and `mergeScreenshotRows` infers it by elimination (exactly 3 umas per category): only when exactly one row is missing a distance and exactly one category is short by one. Anything else becomes a warning. Cross-screenshot text stitching was rejected because the fragment's text wasn't recognizable.
- **Leading-distance fragment:** legible in only 2 of 6 pairs tested (noise in 4), so it's opportunistic only. `findLeadingDistance` supplies it as `mergeScreenshotRows`'s optional third argument, applied only when exactly one merged row lacks a distance, before elimination.
- **Split-row rescues:** Tesseract sometimes splits one row across two lines. Each fix below is scoped to a shape verified in real fixture output:
  - *Name-only + points-only lines:* a name-only line counts only if it's an exact dictionary match (`lookupUmaName`), then pairs by proximity with a points-only line. This recovered El Condor Pasa (`2a/2b`) and Grass Wonder (`3a/3b`).
  - *Thousands-group prefix:* a bare 1–3 digit token in the points column with no "pts", within `MAX_POINTS_SPLIT_GAP`, is reassembled as `prefix + remainder.padStart(3, '0')`, only for candidates still under 1,000 (later comma groups are always 3 digits). Seen once: Oguri Cap, `"WHY ogu 42"` / `"I guri Cap 711 pts"` (`3b`). Digits Tesseract truly failed to read can't be recovered; the under-10,000 warning is the backstop.
  - *Bare full score:* a comma-formatted points-column token with no "pts" (`BARE_POINTS_REGEX`) becomes orphan points, paired with the nearest orphan name. Seen: Maruzensky, `"(<i 45,216 |"` / `"“2 Maruzensky ’ pts"` (`7b`). `PSM.SINGLE_COLUMN` was tried and rejected: it fixed the split but dropped the distance word for nearly every other row, since the default `AUTO` layout is what keeps the narrow distance column separate.
- **Name auto-correction:** the uma list is closed, so a name on a confirmed row (it has points) is corrected to its closest dictionary entry by edit distance (`resolveUmaName`/`closestUmaName`), e.g. `"guri Cap"` → Oguri Cap. The split-row rescue gate stays exact-only, because fuzzy matching there would turn badge/epithet noise into spurious rows. Every name or points correction adds a "please verify" warning naming the raw OCR value.
- **Dictionary** (`umaNames.js`) is developer-supplied; its "Machikane Tannhauser" was replaced by the screenshot-confirmed "Matikanetannhauser".
- **Row-count warning:** setup mode (`toSetupGridRows`) warns when OCR finds more *or fewer* than 15 rows, instead of silently padding, since a split row could vanish without a trace.
- **Live row warnings:** `validateRows` re-runs on the live grid every render, so a warning clears once fixed. It flags names not in the dictionary, a distance category with ≠3 umas, and scores under 10,000.
- **Batch upload:** any number of screenshots (capped at 40 as a sanity guard), paired by upload order with no reorder UI, so the upload hint states the order (top then bottom, oldest match first). Each match is reviewed on its own page before saving, which catches a mispairing. The batch shares one date: screenshots carry no timestamp, and per-match dates aren't worth the UI.
- **Batch roster fallback [Developer]** (rule in `CLAUDE.md`):
  - Row order isn't assumed stable across matches, so matching is always by name.
  - Two passes: names first, by single-gap elimination against every match's exact reads; then distances, from a map built *after* the name fixes. That way an uma identified only by elimination can still fill another match's distance gap. Motivating case: match A misreads the name but has the distance; match B has the name but not the distance.
  - A field OCR resolved (exact name, non-null distance) is never overridden, and nothing is fuzzy-matched against the batch roster.
  - There's no guard against a mid-batch roster swap; the review grid and the modal's batch hint (shown for 2+ matches) cover it.
  - *Dropped row:* when a match is short exactly one known uma and has no uncertain row left over, a row is inserted with that uma's distance and blank points (there's no reading to recover), with a warning saying so. Real testing found this more common than a misread name.
  - *Corrections count:* a closest-match-corrected row counts as present when another match read that name exactly. Before this, "Tiki Shuttle" → Taiki Shuttle looked missing, a second blank row was inserted, and the real score was discarded. Roster checks always see names after correction.
- **Roster mapping [Developer]** (`mapOcrRowsToRoster`, once a roster exists): rows match slots by name. On a repeated name the first row with points wins, and the extra gets a "shows X more than once" warning rather than a misleading "not on the roster". One misread per match is fixed by elimination: exactly one unmatched slot plus exactly one off-roster row means the row's points go to that slot, with a "matched by elimination, please verify" warning. This isn't done if the row's OCR distance disagrees with the slot's. More gaps stay as warnings. It runs after the batch fallback, so single-match uploads get it too.

### Roster and data

- **Roster-first [Developer]:** the roster is stored (`roster` table, schema v2), not implied by logged names. On first open, the player types it in or picks "Auto-fill from screenshots", which opens the upload right away. The batch's first match, after review, becomes the roster on save. Every other match in the batch must have the same umas, each exactly once, at the same distances. Scores reference their slot by `rosterId`.
- **Schema v2 starts fresh [Developer]:** v1 history had no roster to attach to, so the upgrade clears `matches` and `matchEntries`.
- **Deleting scores keeps the slot [Developer]:**
  - A slot can be renamed or moved only once it has no active scores, so its history always belongs to the name and distance it shows. To swap two umas' distances, delete both umas' scores, then edit both.
  - Deleted scores are marked, not erased: `deleted: { umaName, distance }` snapshot, unindexed, no schema bump. They never count toward stats or the duplicate check.
  - A match with no active scores left is removed.
  - An upgraded uma with the same name works the same way: its old scores are deleted, and new matches add active scores to the slot.

### UI

- **Entry modal [Developer]:** native `<dialog>` (`MatchEntryModal`), one page per match with Back/Next, opened from "Upload screenshots" / "Enter manually" below the roster. With a roster, it shows the 15 slots and only points are editable.
- **Entry grid sorted by score [Developer]:** with a roster, each screenshot match's rows are ordered by points, highest first (blanks last). They're sorted once, when reading finishes, not live (re-sorting would move the row being edited). Manual entry stays in roster order; setup mode keeps the screenshot order.
- **Duplicate match warning [Developer]:** before saving, each match is compared with every logged match (not with others in the same batch). It's a duplicate when all 15 slots' points are equal; the date is ignored because it's typed by hand. The check runs live once every row has valid points, so it reflects fixes to OCR gaps. A duplicate shows the logged match's date and a "Don't save this match" checkbox, ticked by default. It applies to manual entry too, and is skipped in setup mode.
- **Roster view [Developer]:**
  - A summary table (average, high, low, match count) whose rows expand to show every score.
  - Every column header sorts: a new column sorts ascending, and clicking again flips it (▲/▼). Distance sorts by category order (Sprint → Dirt). Umas with no scores stay at the bottom either way. The default is distance ascending.
- **Match history [Developer]:**
  - A collapsible list. Each match expands to all its umas (distance, name, points, highest first), so batch-mates can be told apart. A deleted uma is struck through and labeled "Deleted".
  - The collapsed row shows an "N deleted" badge and "Out of date with current roster". The player decides whether to keep the match (other umas' scores still count) or delete it.
  - Any match can be deleted. At the top right: "Delete out-of-date matches (N)" (shown only when N ≥ 1, with a confirm), then "Delete all matches", which keeps the roster, unlike Reset roster.

### Testing strategy

- Dexie code is tested against `fake-indexeddb` rather than a hand-rolled mock, so real queries run.
- `tesseractClient.js` is tested with `tesseract.js` mocked (`vi.mock`); the skipped smoke test is the only real-OCR check.
- React component tests are deferred until the UI stabilizes, since rewriting them alongside frequent UI changes isn't worth it yet. Pure logic is pulled out of components into `.js` modules (`rosterSort.js`, `matchEntry.js`) and tested like `src/db/`/`src/ocr/`.
- Coverage is report-only (no threshold).

## Open Questions

- Opponent Rating handling for players who don't always pick the Top Option.
- Middle and Bottom Option opponent ratings relative to the player's (only the Top Option is measured).
- More Top Option samples above 335,567 and between the sparse points from 65,493 to 181,639, to confirm the curve.
- Whether scores are only meaningfully comparable within the same distance category (longer distances may have different base-point structures).
- Whether `I` and `T` need scaling to be comparable (currently added unscaled).
- How each uma's RANK badge (its Rating, needed for `T`) is captured: manual entry, or OCR/portrait matching on Score Info or Edit Team.
- Should Phase 2 derive Team Rating from OCR'd badges via the floor table instead of manual entry? (Revisits the manual-entry decision.)
- How umas are identified from Edit Team/Race Results portraits (matching method against the uma database).
- How Advanced Mode treats MVP-logged matches, which carry no Ace flags or Team Rating/Support rate snapshots.
- The G rank's floor (0) had a footnote marker with no footnote text; double-check if a G-ranked uma ever needs to be told apart from Rating 0.
- Hosting platform: GitHub Pages, Vercel, or Netlify.
- Whether to self-host Tesseract.js's worker/wasm/lang-data (e.g. under `public/`) instead of its jsDelivr CDN default (deferred hardening).

## Template for new entries

Decision: one bullet with what was decided, plus why only if that isn't implied elsewhere. Open question: one bullet with the question only.
