# Decisions

This file holds two things only: decisions/rationale not already reflected as current state in `CLAUDE.md`, `roadmap.md`, or `team-trials-reference.md`, and every open question across the project. If something is settled and stated as fact elsewhere, it doesn't belong here.

## Decisions

- An earlier Ace-adjustment approach — dividing an Ace's score by 1.1 — was tried and removed, superseded by the Advanced Mode contribution-score formula (Phase 2) in `roadmap.md`. It didn't work because the Ace Bonus gets diluted by whatever Opponent Rating and Streak rates apply that match; see `team-trials-reference.md`'s Score Details section for why.
- The MVP ships Simple Mode only (raw averages); Advanced Mode (`S = I + T`) is Phase 2. The standalone Ace-adjustment formula (`Gained Score × (M − 0.10) / M`) that the roadmap once listed for Advanced Mode was dropped, because dividing each match's score down to base score in `S = I + T` already removes the Ace bonus.
- Ace slot input (Edit Team parsing and the potential-uma database) and per-match Ace flags moved from the MVP to Phase 2, since Advanced Mode is their only user.
- Support Cards are out of scope: the app doesn't model them. The Support rate is account-wide and identical for every uma; Simple Mode ignores it, and Advanced Mode takes it as a player-entered input.
- Advanced Mode assumes the player always picks the Top Option when choosing opponents. Chosen because it matches the developer's own play pattern, and lets the Opponent Rating Bonus be computed from Team Rating alone via the empirical curve (originally from one manually entered average-opponent-rating input) instead of tracking per-match opponent choice.
- Streak Bonus isn't modeled in Advanced Mode (Simple Mode uses raw scores). Its effect is small next to Opponent Rating, which dominates — judged negligible for now.
- Aptitude bonuses/penalties on Team Rating (S/A/B/F–G rank modifiers — see `team-trials-reference.md`'s Team Rating section) are not modeled. The app treats Team Rating as the flat sum of the 15 umas' individual Ratings. The site will carry a disclaimer noting this simplification and reminding players that an S-rank in either of the two relevant aptitudes (surface, distance) for a race category is worth a 2% bonus each.
- In Advanced Mode (Phase 2), Team Rating is entered manually by the player rather than derived by the app from uma RANK badges.
- **Contribution-score formula (`S = I + T`), base score:** `I` is built from each match's base score (Gained Score divided by the full multiplier) rather than raw or Ace-adjusted Gained Score, so history stays comparable when Team Rating or Support rate changed between matches, and Ace, Support, and Opponent Rating effects are isolated. Every uma is compared as a non-Ace; the player supplies which umas are Aces.
- **Contribution-score formula, `I` at the reduced multiplier:** `I = average base × (1 + Mopp_without + Support)`, and `T` covers all 15 umas including the uma itself. This way the slice of the uma's own score that comes from the multiplier its Rating earns is counted only in `T`, never twice, and both terms are in real team points, so `S = I + T` equals the team's score drop if the uma were removed.
- **Contribution-score formula, removal:** the uma is removed entirely (no replacement baseline) so its value is the points it brings to the team.
- **Phase 2 contribution-score formula, `R'` definition:** `R' = R − (that uma's Rating)`, where Rating is the RANK-badge-derived value (see the Rating floor table in `team-trials-reference.md`), not the uma's average score.
- Team Rank floors (the developer-supplied table, E through UD9) were tried and dropped for modeling the opponent rating: the Top Option's rating does not follow them (e.g. at Team Rating 115,904 the top opponent, 125,153, was still below the next floor). The empirical curve in `team-trials-reference.md` replaces them. The floor table is kept in `team-trials-reference.md` as reference only.
- The empirical curve is assumed to continue beyond the sampled Team Ratings (65,493–335,567); the site will carry a disclaimer about the lack of data. Team Bonus is excluded from all calculations (it appears only on Score Details, not Score Info), and the site will carry a disclaimer for that too.
- Advanced Mode no longer asks for the average opponent rating, because typing it for every race is too much effort; the curve estimates it. The player enters Team Rating and Support rate once, is responsible for keeping them up to date, and each match snapshots the current values.
- Corrected an earlier reference-doc statement that `OpponentRatingRate` is the multiplier minus 1: the Score Details rows show the rate equals the multiplier (Super Creek 1st place: `10,000 × (1 + 0.10 + 1.6843 + 0.1069 + 0.02) = 29,112`).

## Open Questions

- Opponent Rating handling for players who don't always pick the Top Option (Advanced Mode currently assumes they do).
- How umas are identified from Edit Team/Race Results portraits — matching method against the uma database isn't decided.
- Whether scores are only meaningfully comparable within the same distance category (longer distances may have different base-point structures) — unconfirmed, flagged for further research.
- Middle and Bottom Option opponent ratings relative to the player's (only the Top Option is measured).
- Whether `I` and `T` need scaling to be comparable (currently added unscaled).
- How each uma's RANK badge (its Rating, needed for `T`) is captured: manual entry, or OCR/portrait matching on Score Info or Edit Team.
- How Advanced Mode treats matches logged in the MVP, which carry no Ace flags and no Team Rating or Support rate snapshots.
- More Top Option samples above 335,567 and between the sparse points from 65,493 to 181,639, to confirm the curve.
- Which fields must be extracted from each Score Info row.
- Should manual score entry exist as a fallback if OCR fails?
- Should the app show extracted values for the user to confirm before saving?
- Hosting platform: GitHub Pages, Vercel, or Netlify.
- Database schema for match history, and the score-overview UI mockup (after docs).
- How these docs get updated now that they live in the repo (moved from a claude.ai Project into Claude Code).
- Now that per-uma Rating can be estimated from RANK badges via the floor table, should Phase 2 derive Team Rating from OCR'd badges instead of manual entry? (Revisits the manual-entry decision above.)
- The G rank's floor value (0) carried a footnote marker in the source with no footnote text provided — worth double-checking if a G-ranked uma ever needs to be distinguished from Rating 0 exactly.

## Template for new entries

Decisions: one bullet — what was decided, and why, only if that reasoning isn't already implied by the decision's presence as fact elsewhere. Open questions: one bullet — the question, nothing else.
