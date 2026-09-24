# Roadmap

Feature timeline for the Uma Team Trials Score Auditor. Items tagged **[Developer]** were stated by the developer; items tagged **[Blueprint]** come from the initial blueprint and are not yet confirmed.

## Phase 1: MVP (Simple Mode only)

- [x] **Screenshot input [Developer]:** the user provides the two "Score Info" screenshots for a match (a scrolling list; two screenshots cover all 15 umas).
- [x] **OCR extraction [Blueprint: Tesseract.js, client-side]:** read each row's uma name, points, and distance from the screenshots, ignoring the epithet banners.
- [x] **De-duplicate overlapping rows** between the two screenshots (a row can appear cut off in both).
- [x] **Log each match** to browser storage (IndexedDB) [Blueprint].
- [x] **Simple Mode [Developer]:** the MVP has no Ace adjustment or any other score adjustment — all 15 umas' raw Gained Scores are compared equally by their averages. Advanced Mode is Phase 2.
- [x] **Rolling average per uma [Developer]:** over all history.
- [x] **Delete/upgrade an uma [Developer]:** when the player replaces *or upgrades* an uma, they delete it in the app. This nulls all existing data for that uma; data recorded afterward is valid.
- [x] **Weakest link and upgrade recommendation [Developer]:** compare averages across all 15 umas. Whoever has the lowest raw average is recommended to upgrade next.
- [ ] **Export/Import backup [Blueprint]** as a `.json` file.
- [ ] **Request persistent storage [Blueprint]** via `navigator.storage.persist()`.

## Phase 2: Advanced Mode — rank and opponent rating [Developer: a later phase]

- [ ] **Advanced Mode [Developer]:** ranks umas by the contribution score below instead of raw averages. The player enters their Support Bonus rate and Team Trials Rating **once** and is responsible for keeping them current; each match record snapshots the values current when it is added, along with that match's Ace flags. The Opponent Rating rate is not entered: the app estimates it from Team Rating with the empirical curve in `docs/team-trials-reference.md` (assumes the player always picks the Top Option — see `docs/decisions.md`; the curve is extrapolated beyond the sampled ratings, so the site carries a disclaimer). Team Bonus is excluded (also with a disclaimer) and Streak is not modeled.
- [ ] **Ace slot input [Developer]:** Aces are set once. Advanced Mode parses an Edit Team screenshot to detect them; manual entry remains an option. Needs a database of potential umas to match against (the developer will provide it later).
- [ ] **Ace flag is per-match [Developer]:** each recorded match keeps the Ace flag it had at the time, even after the player's Aces change later. Matches logged in the MVP carry no Ace flags (see the open question in `docs/decisions.md`).
- [ ] **Take uma rank and opponent rating into consideration** in the calculations (rank badges feed Team Rating, which sets opponent selection and so the Opponent Rating Bonus). Formula confirmed: see `docs/team-trials-reference.md`'s Team Rating and Opponent Selection section, including the Empirical Opponent Rating Curve.
- [ ] **Comparisons both across all 15 umas and within each distance.**
- [ ] **Contribution-score model:** `S = I + T` ranks umas for upgrade/replace priority; the lowest S is the weakest link. This is the Advanced Mode formula; it is settled (rationale in `docs/decisions.md`). Everything is in team points per match, averaged over history, with every uma compared as a non-Ace. `Team Rating` and `SupportRate` are the player's current values; the Team Bonus is excluded.
  - **Base score** per match: `Base = Gained Score ÷ (1 + AceRate + Mopp(TeamRating) + SupportRate)`, using that match's snapshotted Team Rating, Support rate, and Ace flag. Each uma's average base is taken over its history.
  - **Reduced multiplier:** `Mopp_without_i = Mopp(TeamRating − Rating_i)`, where `Rating_i` is the uma's Rating estimated from its RANK badge (Rating floor table). The uma is removed entirely; there is no replacement baseline.
  - **I:** `I_i = average Base_i × (1 + Mopp_without_i + SupportRate)` — the uma's own score not attributable to its Rating.
  - **T:** `T_i = (Mopp(TeamRating) − Mopp_without_i) × Σ (average Base of all 15 umas)` — the score across all 15 umas due to the multiplier gained by having the uma (equivalently, the sum of the 15 scores at the current multiplier minus the sum at the reduced multiplier).
  - **S:** `S_i = I_i + T_i`, added unscaled for now (whether they need scaling is an open question).
- [ ] **Normalized scores:** Average Score / Opponent Tier Modifier, to remove bracket inflation. *(Note: this may now be superseded by the contribution-score model above — not decided.)*
- Team Rating is entered by the player (Advanced Mode) and the opponent rating comes from the curve, so neither needs a data source. Each uma's RANK badge (its Rating, needed for `T`) does: Score Info and Edit Team show it, but how it is captured is undecided (see `docs/decisions.md`).

## Much Later

- [ ] **Single-uma deep dive [Developer]:** analyze one uma's scoring breakdown from the Score Details screenshots (Base, Ace, Opponent Rating, Support, and Streak bonuses per category). Not planned for the MVP because it needs many screenshots per user. Sample breakdown structure is in `docs/team-trials-reference.md`.

## Ideas Parking Lot (uncommitted)

Ideas that have come up but haven't been decided on. Nothing here is a commitment.

- **Race Results tracking [Developer, floated for a later phase]:** use the Race Results screen to track what place each uma gets and how often they place.
- **Rank-upgrade effect on team score [Developer, undecided]:** model what one or several uma RANK upgrades would do for team score (Rating gained from badge floors → change in `Mopp` × the sum of average bases). Modeling how an upgrade changes an individual uma's own score was ruled out as too random and complicated. Not decided whether to build this.
- **Race Results as an Ace source:** the Race Results screen shows Aces (first portrait on the player's side of each race) [Developer]. Not decided whether the app will use it.

Open questions live in `docs/decisions.md`, not here.
