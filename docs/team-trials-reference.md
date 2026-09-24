# Team Trials Reference

How Team Trials works in Uma Musume: Pretty Derby (Global, English). Everything here is developer-confirmed unless marked "Open question" — those are also logged in `decisions.md`'s Open Questions section, which is the single place to check for anything still unresolved.

## Roster and Aces

A roster is 15 characters (umas). Five are "Aces" — exactly one per distance category, always the top slot of that distance's column on the Edit Team screen. Aces get a scoring bonus (see Multipliers, below). Aces are set once; the player can change them, and the app can pick them up either from manual entry or from an Edit Team screenshot.

The Edit Team and Race Results screens show umas only as portraits with RANK badges — no names — so matching a portrait to a specific uma needs a reference database of umas, and the matching method itself isn't decided (see `decisions.md`).

## Match Structure

A Team Trials match ("race set") is five races, one per distance category: Sprint, Mile, Medium, Long, Dirt. Each race has 12 finishers: the player's 3 umas, the opponent's 3 umas, and 6 lower-stat NPC umas filling out the rest of the field (placement can be anywhere from 1st to 12th). The Race Results screen only shows the player's and opponent's umas — not the NPCs, who still occupy some of the finishing slots.

A player's Class is their in-game rank within Team Trials (6 is the highest) and doesn't affect scoring. Race numbers just record which race was run first, second, etc. Epithet banners above an uma's name are a player-chosen cosmetic label with no meaning. None of these three matter to scoring.

## Distance Categories and Surfaces

The five distance categories are Sprint, Mile, Medium, Long, and Dirt. A race's actual surface and metric distance can differ from its category label — e.g. a race run on "Kawasaki Dirt 1600m," a Mile-length track, is still categorized and labeled "Dirt" throughout the UI (Score Info, team columns, etc.) because Dirt is a surface, not a distance.

Open question: whether scores are only meaningfully comparable within the same distance category (longer distances may yield different base-point structures due to different skill-activation counts). Unconfirmed — flagged for further research.

## Team Rating and Opponent Selection

An uma's RANK badge is the game's assessment of that uma's **Rating** — a separate stat from its Team Trials **Gained Score** (the points tracked from Score Info). Rating feeds the player's Team Rating, the number shown on the Edit Team screen next to the Team Rank badge (e.g. 323,886 next to badge UG4). "Team Rating" and "Team Rank" (the numeric value, not the badge tier) refer to the same number, and it's the same figure used in the Opponent Rating Bonus formula below. Opponents have a Team Rating too.

**Rating floor values by RANK badge** (the minimum Rating for that badge tier; used to estimate an uma's Rating from its badge when the exact number isn't shown). Ranks above UF9 exist but aren't needed yet.

| Rank | Rating | Rank | Rating | Rank | Rating | Rank | Rating |
|---|---|---|---|---|---|---|---|
| G | 0 | C | 3,500 | S | 14,500 | UG4 | 21,200 |
| G+ | 300 | C+ | 4,900 | S+ | 15,900 | UG5 | 21,600 |
| F | 600 | B | 6,500 | SS | 17,500 | UG6 | 22,100 |
| F+ | 900 | B+ | 8,200 | SS+ | 19,200 | UG7 | 22,500 |
| E | 1,300 | A | 10,000 | UG | 19,600 | UG8 | 23,000 |
| E+ | 1,800 | A+ | 12,100 | UG1 | 20,000 | UG9 | 23,400 |
| D | 2,300 | | | UG2 | 20,400 | UF | 23,900 |
| D+ | 2,900 | | | UG3 | 20,800 | UF1–UF9 | 24,300–28,300 (steps of 500) |

**How Team Rating is built:** it's the sum of the 15 umas' individual Ratings (not their average Gained Scores), each adjusted by that uma's aptitude bonus or penalty for the race category's relevant Surface and Distance aptitudes:

| Race category | Distance aptitude wanted | Surface aptitude wanted |
|---|---|---|
| Sprint | Sprint | Turf |
| Mile | Mile | Turf |
| Medium | Medium | Turf |
| Long | Long | Turf |
| Dirt | Mile | Dirt |

Aptitude rank bonus/penalty (applies per S/A/B/F–G aptitude the uma holds — Field, Distance, or Strategy — though only the two aptitudes in the table above are the ones relevant to a given race category):

| Aptitude rank | Effect |
|---|---|
| S | +2% per S-rank aptitude |
| A | No bonus or penalty |
| B | −5% to −10% penalty |
| F–G | −50% to −70% penalty |

The app does not model this aptitude adjustment — see `decisions.md` for the scope decision and the resulting site disclaimer.

**Opponent selection:** each match, three opponent options are offered at Team Ratings relative to the player's own: a Top Option, a Middle Option, and a Bottom Option. Only the Top Option has been measured (see Empirical Opponent Rating Curve, below); its rating does not follow Team Rank floors. The Middle and Bottom Options' ratings aren't documented — see `decisions.md`. The app assumes the player always picks the Top Option (see `decisions.md`).

**Opponent Rating Bonus** (the multiplier this produces — also called the "opponent tier modifier"; same thing) is the largest of the score multipliers and the main reason absolute scores vary match to match:

```
denominator = 200,000 − (Top Option's Opponent Team Rating) + (Player's Team Rating)
multiplier  = (Chosen Option's Opponent Team Rating) ÷ denominator
```

The denominator is fixed per match by the Top Option's rating, regardless of which option is actually chosen — so the Top Option always yields the highest of the three multipliers. This multiplier is constant for the whole match: the same rate applies to every scoring category, for all 15 umas, across all 5 races of that match (it can differ between different matches).

Worked example — Player Team Rating 220,000, Base Score 3,000:
- Top Option, Opponent Team Rating 230,000: denominator = 200,000 − 230,000 + 220,000 = 190,000; multiplier = 230,000 ÷ 190,000 = 1.21; Score = 3,000 × 1.21 = 3,630.
- Middle Option, Opponent Team Rating 220,000: same denominator (190,000); multiplier = 220,000 ÷ 190,000 = 1.1; Score = 3,000 × 1.1 = 3,300.

Cross-check against a real match: Team Rating 323,886, Top Option Opponent Team Rating 328,714 → denominator = 200,000 − 328,714 + 323,886 = 195,172; multiplier = 328,714 ÷ 195,172 = 1.68423 — matching the 1.6843–1.685 Opponent Rating rate observed directly in that match's Score Details lines (see Score Details Screen, below).

### Empirical Opponent Rating Curve

The developer sampled the Top Option's Opponent Team Rating at ten different Team Ratings **[Developer: raw samples]**. The fit and the observations below are **derived** from those samples, not developer-confirmed.

| Team Rating (P) | Samples | Mean Top Opponent | Offset (Opp − P) | Multiplier (Mopp) |
|---|---|---|---|---|
| 65,493 | 1 | 73,456 | +7,963 | 0.3825 |
| 115,904 | 1 | 125,153 | +9,249 | 0.6561 |
| 144,838 | 1 | 154,536 | +9,698 | 0.8121 |
| 181,639 | 1 | 191,610 | +9,971 | 1.0083 |
| 222,086 | 6 | 230,763 | +8,677 | 1.2061 |
| 315,459 | 6 | 321,093 | +5,634 | 1.6520 |
| 323,886 | 7 | 329,048 | +5,162 | 1.6888 |
| 327,423 | 6 | 332,262 | +4,839 | 1.7025 |
| 329,276 | 6 | 334,293 | +5,017 | 1.7145 |
| 335,567 | 6 | 340,139 | +4,572 | 1.7405 |

Raw samples (Team Rating → Top Option opponent ratings), usable as a test fixture:

```
65,493  → 73456
115,904 → 125153
144,838 → 154536
181,639 → 191610
222,086 → 231352, 229440, 229406, 231825, 230897, 231659
315,459 → 321056, 320884, 321370, 321104, 321229, 320916
323,886 → 328714, 328768, 329251, 329334, 329336, 328419, 329512
327,423 → 332819, 332786, 331678, 331963, 331739, 332587
329,276 → 334820, 333746, 333546, 334142, 334885, 334620
335,567 → 340369, 339227, 339278, 340680, 341288, 339992
```

What the samples show:

- The Top Option's rating tracks the player's with an offset that is not constant (about +8,000 to +10,000 at low ratings, shrinking to about +4,600 to +5,600 near 315,000–336,000) and does not follow Team Rank floors.
- The multiplier's denominator (`200,000 − Opp + P`) stays between about 190,000 and 195,000 at every sampled rating, so the multiplier itself is a smooth function of Team Rating.
- A quadratic fit of the multiplier, with `k = Team Rating ÷ 1,000`:

```
Mopp(P) = 0.00428094 + 0.00589541 × k − 0.00000214452 × k²
```

  It matches all ten mean values within 0.004. Individual matches scatter around the curve by about 0.0075 in the multiplier (1 standard deviation, 41 samples). The slope near 324,000 is about +0.0045 per +1,000 Team Rating.

Limits: the fit covers Team Ratings 65,493–335,567 only, with single samples between 65,493 and 181,639, and only the Top Option was measured. The app assumes the curve continues outside the sampled range; the site carries a disclaimer about the lack of data. `Mopp(P)` is used directly as `OpponentRatingRate`.

## Scoring Formula

Each uma's Gained Score for a race is a **Base Score** from several sources, scaled up by additive percentage **Multipliers** (Ace, Opponent Rating, Support, Winstreak), applied in one multiplication:

```
Category Total = Base × (1 + AceRate + OpponentRatingRate + SupportRate + StreakRate)
```

`AceRate` is 10% if the uma is that distance's Ace, else 0%. `OpponentRatingRate` is the Opponent Rating multiplier above, used as is — not minus 1 (constant across all of a uma's categories for the match). The Super Creek breakdown below confirms this: `10,000 × (1 + 0.10 + 1.6843 + 0.1069 + 0.02) = 29,112`, whereas subtracting 1 would give 19,112. `SupportRate` and `StreakRate` are defined below. The Team Bonus block (a separate score, not part of any uma's Gained Score) uses the same formula without `AceRate`, since the Ace Bonus is a property of the uma, not the team.

### Base Score sources

**Final Position** — by placement (12 possible finishers):

| Position | 1st | 2nd | 3rd | 4th | 5th | 6th | 7th | 8th | 9th | 10th | 11th | 12th |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Score | 10,000 | 8,000 | 7,000 | 6,000 | 5,000 | 4,000 | 4,000 | 3,000 | 3,000 | 2,000 | 2,000 | 2,000 |

**Team Bonus** (separate from an uma's Gained Score):

| Condition | Score |
|---|---|
| Team gets 1st, 2nd, and 3rd Place | 5,000 |
| Team members all place within Top 5 | 4,000 |

**Beat Target Time:** every track has a Reference Time. Beating it awards 100 points per 0.1 seconds faster than reference, capped at 2,000 points.

**1st–2nd place margin bonus** (only when the player's uma wins): both very close and very dominant wins score highest; mid-range margins score lowest.

| Margin | 10L | 9L | 8L | 7L | 6L | 5L | 4L | 3½L | 3L | 2½L | 2L | 1¾L | 1½L | 1¼L | 1L | ¾L | ½L | Neck | Head | Nose |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Score | 3,000 | 2,600 | 2,500 | 2,400 | 2,300 | 2,200 | 2,100 | 2,000 | 1,900 | 1,800 | 1,700 | 1,500 | 1,400 | 1,300 | 1,200 | 1,100 | 1,000 | 2,000 | 3,000 | 5,000 |

**Skill activation:**

| Skill type | Score |
|---|---|
| Gold Skill | 1,200 |
| White Skill | 500 |
| Inherited Unique Skill | 500 |

Unique Skill activation scales with skill level and star rating:

| Skill Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| ⭐ / ⭐⭐ | 1,500 | 1,700 | 1,800 | 1,900 | 2,000 | 2,100 | 2,200 | 2,300 | 2,400 | 2,500 |
| ⭐⭐⭐+ | 2,000 | 2,200 | 2,300 | 2,400 | 2,500 | 2,600 | 2,700 | 2,800 | 2,900 | 3,000 |

**Good Positioning:** up to 1,000 points each for early-, mid-, and late-race good positioning per running style on the team (max 3,000/uma). Diversifying running styles across the team increases how many of these are available.

**Strong Start:** 1,000 points if the uma gets a strong start (the Focus and Concentration skills increase the chance of this).

**Long Shot:** umas at 8th Favorite or worse that place 3rd or better get a 4,000-point bonus.

**Rushed penalty:** −500 points base, plus −100 points for every 0.1 seconds spent Rushed.

### Multipliers

- **Ace Bonus:** +10% to score for the uma in the top teambuilder slot for its distance.
- **Support Bonus:** an account-wide rate, identical for every uma, driven by Support Card levels — unrelated to Team Trials itself. The app doesn't model Support Cards (see `decisions.md`). Simple Mode ignores the rate: being identical across all 15 umas in a match, it adds noise to absolute Gained Score numbers without biasing relative "weakest link" comparisons. Advanced Mode (Phase 2) takes the rate as a player-entered input and divides it out of each match's score.
- **Winstreak Bonus:** tracked across the 5 races of one match (not per distance), following the match's randomized race order. A loss resets the streak to 0. The bonus starts at the 2nd consecutive win and caps at the 5th: +2%/+3%/+4%/+5% for a 2/3/4/5-streak.
- **Opponent Rating Bonus:** see Team Rating and Opponent Selection, above.

## Score Info Screen (MVP data source)

Header: "Score Info." A "Close" button sits at the bottom. The list scrolls and is sorted by points, highest first (top row carries an "MVP" medal); two screenshots are needed to cover all 15 rows, and they overlap by one row, which must not be double-counted.

Each row shows: a portrait with a distance label underneath, a RANK badge on the portrait (values seen: UG, UG2–UG6, UF, SS+), an epithet banner (ignored), the uma's name, points ("80,936 pts"), an "i" button (opens Score Details), and a horizontal bar. The screen shows no opponent rating and no Ace status.

### Sample data (one match; usable as an OCR test fixture)

The Ace column comes from the Edit Team screenshot for the same roster.

| Rank in list | Uma | Distance | RANK badge | Ace | Points |
|---|---|---|---|---|---|
| 1 (MVP) | Super Creek | Long | UG2 | Yes | 80,936 |
| 2 | Silence Suzuka | Sprint | UG6 | Yes | 70,840 |
| 3 | Curren Chan | Sprint | UF | No | 69,225 |
| 4 | Mihono Bourbon | Medium | UG3 | Yes | 68,526 |
| 5 | Maruzensky | Mile | UG5 | Yes | 66,503 |
| 6 | Taiki Shuttle | Dirt | UG6 | No | 65,039 |
| 7 | El Condor Pasa | Mile | UG5 | No | 64,481 |
| 8 | Air Groove | Sprint | SS+ | No | 60,294 |
| 9 | Special Week | Medium | SS+ | No | 57,362 |
| 10 | Smart Falcon | Dirt | UG6 | Yes | 56,383 |
| 11 | Agnes Tachyon | Medium | UG4 | No | 56,107 |
| 12 | Grass Wonder | Long | UF | No | 53,976 |
| 13 | Matikanetannhauser | Long | UG2 | No | 51,450 |
| 14 | Haru Urara | Dirt | UG3 | No | 41,312 |
| 15 | Gold City | Mile | UG (no number shown) | No | 39,918 |

## Edit Team Screen

Header: "Edit Team," with an "i" button. Top: the Team Rank badge and value (with an arrow showing how the rating would change if the roster changed), then large illustrations of the five Aces. Below: five columns headed Sprint, Mile, Medium, Long, Dirt, each with three stacked umas — the top slot of each column carries an "ACE" tag. Each portrait has a RANK badge and a small circular icon bottom-left (meaning unknown). No uma names are shown, only portraits and badges. Buttons: "Auto-Select," "Back," "Confirm."

| Distance | Slot 1 (ACE) | Slot 2 | Slot 3 |
|---|---|---|---|
| Sprint | Silence Suzuka (UG6) | Curren Chan (UF) | Air Groove (SS+) |
| Mile | Maruzensky (UG5) | El Condor Pasa (UG5) | Gold City (UG) |
| Medium | Mihono Bourbon (UG3) | Agnes Tachyon (UG4) | Special Week (SS+) |
| Long | Super Creek (UG2) | Matikanetannhauser (UG2) | Grass Wonder (UF) |
| Dirt | Smart Falcon (UG6) | Haru Urara (UG3) | Taiki Shuttle (UG6) |

## Race Results Screen

Header: "Race Results." Five race rows, each showing: race number, course name with surface, distance in metres and distance-class label in parentheses, turn direction, season, ground condition, weather icons, WIN/LOSE, the player's 3 umas with finishing places, "VS," and the opponents' 3 umas with finishing places. No points are shown. Umas appear as portraits with RANK badges, no names. A gift box icon appeared at the left of one race row in the sample (meaning unknown). The first portrait on the player's side of each race is that distance's Ace.

| Race | Course | Result | Your umas (place) | Opponent places |
|---|---|---|---|---|
| 1 | Fukushima Turf 2000m (Medium) Right | LOSE | Mihono Bourbon 2nd, Agnes Tachyon 4th, Special Week 6th | 5th, 1st, 3rd |
| 2 | Sapporo Turf 1800m (Mile) Right | WIN | Maruzensky 1st, El Condor Pasa 2nd, Gold City 6th | 3rd, 4th, 7th |
| 3 | Nakayama Turf 2500m (Long) Right / Inner | WIN | Super Creek 1st, Grass Wonder 2nd, Matikanetannhauser 3rd | 4th, 5th, 6th |
| 4 | Kawasaki Dirt 1600m (Mile) Left | LOSE | Taiki Shuttle 3rd, Smart Falcon 5th, Haru Urara 6th | 1st, 4th, 2nd |
| 5 | Chukyo Turf 1400m (Sprint) Left | WIN | Curren Chan 1st, Silence Suzuka 3rd, Air Groove 6th | 2nd, 4th, 5th |

In the sample, the side marked WIN always had the lower sum of finishing places (e.g. Race 5: 10 vs 11) — a single observation, unconfirmed as the actual win rule.

## Race History Screen

Mentioned by the developer, not yet documented in detail: it shows a match's total score. The app doesn't use it currently.

## Score Details Screen

Opened by the "i" button on Score Info. Structure: a "Team Bonus" block first, then one block per uma with a portrait, placement medal, "Gained Score," and a line per scoring category. Each category lists Base Points, Ace Bonus, Opponent Rating Bonus, Support Bonus, and a Streak Bonus line (Team Bonus has no Ace Bonus line).

### Super Creek breakdown (Long, Gained Score 80,936; Ace; match-wide Opponent Rating rate 168.43%, Support rate 10.69%, Streak rate 2%)

| Category | Base | Ace | Opponent Rating | Support | 2 Streak | Total |
|---|---|---|---|---|---|---|
| 1st place | 10,000 | 1,000 | 16,843 | 1,069 | 200 | 29,112 |
| 1 3/4 Lengths | 1,500 | 150 | 2,527 | 161 | 30 | 4,368 |
| Strong Start | 1,000 | 100 | 1,685 | 107 | 20 | 2,912 |
| Unique Skill Lvl 3 Activated (3★+) | 2,300 | 230 | 3,874 | 246 | 46 | 6,696 |
| Rare Skill Activated x5 | 6,000 | 600 | 10,106 | 642 | 120 | 17,468 |
| Skill Activated x12 | 6,000 | 600 | 10,106 | 642 | 120 | 17,468 |
| Good Positioning (Mid-Race) | 1,000 | 100 | 1,685 | 107 | 20 | 2,912 |

Category totals sum to Super Creek's Gained Score exactly: 29,112 + 4,368 + 2,912 + 6,696 + 17,468 + 17,468 + 2,912 = 80,936. (Team Bonus — Base 5,000, Opponent Rating 8,422, Support 535, 2 Streak 100, total 14,057 — is separate, not part of that sum, and shows the same match-wide rates with no Ace line.)

Each bonus line is a fixed rate of that category's Base: `10,000 × (1 + 0.10 + 1.6843 + 0.1069 + 0.02) = 29,112`, matching the "1st place" row exactly — confirming the additive-rate, single-multiplication model above.

Ace's effect in isolation is diluted by the match's other rates: Super Creek's total is only about 1.0344× (29,112 / 28,112) what an identical non-Ace would score, not 1.10×, because the Ace's 10-point contribution to the summed rate is a small slice of a 291.12% total multiplier that match. This dilution factor changes match to match with the Opponent Rating and Streak rates — which the Score Info screen doesn't expose, so a flat ÷1.1 can't isolate the Ace effect from Gained Score alone.

### Gold City breakdown (Mile, 6th place, Gained Score 39,918 — same match as Super Creek)

Not an Ace, no active streak — so no Ace Bonus or Streak Bonus line.

| Category | Base | Opponent Rating | Support | Total |
|---|---|---|---|---|
| 6th place | 4,000 | 6,737 | 428 | 11,165 |
| Rare Skill Activated x4 | 4,800 | 8,085 | 514 | 13,399 |
| Skill Activated x9 | 4,500 | 7,580 | 482 | 12,562 |
| Good Positioning (Mid-Race) | 1,000 | 1,685 | 107 | 2,792 |

Category totals sum exactly (e.g. 4,000+6,737+428 = 11,165) and sum to the full Gained Score: 11,165+13,399+12,562+2,792 = 39,918. Opponent Rating (≈168.4–168.5%) and Support (≈10.7%) rates match Super Creek's, from the same match — confirming those rates are match-wide constants shared across every uma.

## Worked Example: Contribution Score (Advanced Mode)

Illustrative, from the sample match above (spec in `roadmap.md`, Phase 2). Inputs: Team Rating 323,886, so `Mopp` = 1.6888 from the curve; Support rate 10.69%; Ace flags from the Edit Team table; each uma's Rating taken as its RANK-badge floor; Streak and Team Bonus ignored, so base is slightly high (Super Creek: 27,951 vs. its true 27,800). Sum of base = 318,530. The 15 badge floors sum to 318,900, about 5,000 below the actual Team Rating, so floors underestimate Rating (and slightly understate T). Sorted by S, weakest first; figures rounded.

| Uma | Distance | Ace | Gained | Base | Rating (floor) | I | T | S |
|---|---|---|---|---|---|---|---|---|
| Gold City | Mile | No | 39,918 | 14,279 | 19,600 | 38,645 | 28,396 | 67,041 |
| Haru Urara | Dirt | No | 41,312 | 14,777 | 20,800 | 39,913 | 30,151 | 70,065 |
| Matikanetannhauser | Long | No | 51,450 | 18,404 | 20,400 | 49,742 | 29,566 | 79,308 |
| Special Week | Medium | No | 57,362 | 20,518 | 19,200 | 55,571 | 27,811 | 83,382 |
| Smart Falcon | Dirt | Yes | 56,383 | 19,472 | 22,100 | 52,476 | 32,055 | 84,532 |
| Agnes Tachyon | Medium | No | 56,107 | 20,069 | 21,200 | 54,170 | 30,737 | 84,907 |
| Air Groove | Sprint | No | 60,294 | 21,567 | 19,200 | 58,411 | 27,811 | 86,222 |
| Grass Wonder | Long | No | 53,976 | 19,307 | 23,900 | 51,873 | 34,696 | 86,569 |
| Maruzensky | Mile | Yes | 66,503 | 22,966 | 21,600 | 61,948 | 31,323 | 93,271 |
| El Condor Pasa | Mile | No | 64,481 | 23,065 | 21,600 | 62,213 | 31,323 | 93,536 |
| Mihono Bourbon | Medium | Yes | 68,526 | 23,665 | 20,800 | 63,919 | 30,151 | 94,071 |
| Taiki Shuttle | Dirt | No | 65,039 | 23,264 | 22,100 | 62,698 | 32,055 | 94,753 |
| Silence Suzuka | Sprint | Yes | 70,840 | 24,464 | 22,100 | 65,932 | 32,055 | 97,987 |
| Curren Chan | Sprint | No | 69,225 | 24,762 | 23,900 | 66,528 | 34,696 | 101,224 |
| Super Creek | Long | Yes | 80,936 | 27,951 | 20,400 | 75,547 | 29,566 | 105,112 |

In this match the weakest link is Gold City. T only ranges from about 27,800 to 34,700, so I mostly decides the ranking.

## Team Rank Floors

The minimum Team Rating for each Team Rank badge **[Developer]**. Within each row the floors rise by a constant step from the first rank listed (floor = first floor + step × position in the row). Not used for the opponent-rating model (see Empirical Opponent Rating Curve); kept as reference.

| Ranks (in order) | First floor | Step | Last floor |
|---|---|---|---|
| E, E1, E2, E3 | 3,000 | irregular: E1 7,000; E2 12,500; E3 20,000 | 20,000 |
| D, D1, D2, D3 | 27,500 | +7,500 | 50,000 |
| C, C1, C2, C3 | 60,000 | +10,000 | 90,000 |
| B, B1, B2, B3 | 100,000 | +15,000 | 145,000 |
| A, A1–A5, S, S1–S3 | 160,000 | +10,000 | 250,000 |
| S4, S5, SS, SS1–SS5 | 255,000 | +5,000 | 290,000 |
| UG, UG1–UG9 | 295,000 | +6,500 | 353,500 |
| UF, UF1–UF9 | 360,000 | +7,500 | 427,500 |
| UE, UE1–UE9 | 435,000 | +8,500 | 511,500 |
| UD, UD1–UD9 | 520,000 | +9,000 | 601,000 |

Example: UG4 = 295,000 + 6,500 × 4 = 321,000.

## Glossary

| Term | Meaning |
|---|---|
| Uma | A playable racing character |
| Score Info | Result screen listing all 15 umas with points |
| Score Details | Per-uma scoring breakdown, opened by the "i" button on Score Info |
| Edit Team | Screen showing the roster by distance, Ace tags, and Team Rank |
| Race Results | Screen showing the five races, WIN/LOSE, and finishing places |
| Gained Score | An uma's total points for the match; equals its Score Info points |
| Team Bonus | A separate bonus block on Score Details, not part of any uma's Gained Score |
| RANK badge | The game's assessment of an uma's score; feeds Team Rating |
| Team Rating / Team Rank | The player's current Team Trials rating (badge and numeric value, e.g. UG4 323,886); same figure used for opponent selection and the Opponent Rating Bonus. Opponents have one too |
| Ace | The designated top slot per distance on Edit Team; adds a +10% Ace Bonus |
| Opponent Rating Bonus | The score multiplier driven by the chosen opponent's Team Rating, relative to the player's own (also called the "opponent tier modifier") |
| Class | The player's rank within Team Trials; doesn't affect scoring |
| Epithet banner | Player-chosen cosmetic label above an uma's name; no scoring effect |
| NPC uma | One of 6 lower-stat umas filling out a race field alongside the player's 3 and the opponent's 3, for 12 total finishers per race |
| Reference Time | A track's target time; beating it awards bonus points, capped at 2,000 |
| Winstreak Bonus | +2%/+3%/+4%/+5% score bonus for a 2/3/4/5-race win streak within one match |
| Base Score (de-multiplied) | An uma's Gained Score divided by (1 + AceRate + OpponentRatingRate + SupportRate [+ StreakRate, not modeled]); recovers the sum of its category Base Points (Super Creek: 80,936 ÷ 2.9112 = 27,800) |
| Mopp(P) | The empirical Opponent Rating multiplier as a function of Team Rating P (see Empirical Opponent Rating Curve) |
