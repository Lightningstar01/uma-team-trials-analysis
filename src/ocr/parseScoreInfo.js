import { DISTANCE_ORDER } from '../db/constants.js'
import { lookupUmaName } from './umaNames.js'

// Matches "80,936 pts" / "999pts" / "PTS" etc. Group 1 is the digits+commas.
const POINTS_REGEX = /(\d{1,3}(?:,\d{3})*)\s*pts?\b/i

// Uma name words in a Score Info name+points line always start in this
// x-range on the two real 1080px-wide fixtures: OCR noise bleeding in from
// the portrait/badge art ends by x1≈209, the name itself starts at
// x0≈279-280, and the points column starts at x0≈752. A different
// screenshot resolution/aspect ratio may need this re-tuned.
const NAME_COLUMN_X_RANGE = { min: 250, max: 700 }

// Max vertical gap (px) between a name+points line and a distance line for
// them to be paired as the same row. Real fixtures show legitimate same-row
// gaps of ~65-135px and the smallest cross-row gap is ~270px, so this sits
// comfortably between them. Tune alongside NAME_COLUMN_X_RANGE if
// screenshot resolution changes.
const MAX_ROW_PAIR_GAP = 200

// Fixed roster shape (see CLAUDE.md / team-trials-reference.md): 15 umas,
// exactly 3 per distance category. Used to infer a row's distance by
// elimination when neither screenshot captured it directly for that row.
const ROSTER_SIZE = 15
const EXPECTED_PER_DISTANCE = ROSTER_SIZE / DISTANCE_ORDER.length

const DISTANCE_LOOKUP = new Map(DISTANCE_ORDER.map((d) => [d.toLowerCase(), d]))

function lineCenter(bbox) {
  return (bbox.y0 + bbox.y1) / 2
}

// A distance line is sometimes OCR'd with a stray extra character (real
// fixtures produced "y Mile" for one row instead of "Mile"), so this
// matches a distance word as a whole token anywhere in a short line rather
// than requiring the full trimmed line to equal it exactly. Capped at 3
// tokens so a longer, unrelated noise line can't coincidentally match.
function findDistanceInLine(text) {
  const tokens = text.split(/\s+/).filter(Boolean)
  if (tokens.length > 3) return null
  for (const token of tokens) {
    const match = DISTANCE_LOOKUP.get(token.toLowerCase())
    if (match) return match
  }
  return null
}

function extractUmaName(words) {
  const nameWords = words.filter(
    (w) => w.bbox.x0 >= NAME_COLUMN_X_RANGE.min && w.bbox.x0 < NAME_COLUMN_X_RANGE.max
  )
  if (nameWords.length === 0) return null
  return nameWords
    .map((w) => w.text)
    .join(' ')
    .trim()
}

// Greedily pairs each item in `as` with its nearest unclaimed item in `bs`
// (by `.yc`), skipping any pair whose gap exceeds maxGap. Shared by
// name<->distance pairing and by the split-row rescue below, which both
// need "nearest unclaimed match within a vertical tolerance."
function nearestPairs(as, bs, maxGap) {
  const candidates = []
  for (const a of as) {
    for (const b of bs) {
      candidates.push({ a, b, gap: Math.abs(a.yc - b.yc) })
    }
  }
  candidates.sort((x, y) => x.gap - y.gap)

  const usedA = new Set()
  const usedB = new Set()
  const pairs = []
  for (const { a, b, gap } of candidates) {
    if (gap > maxGap) break // sorted ascending - no valid pairs remain
    if (usedA.has(a) || usedB.has(b)) continue
    usedA.add(a)
    usedB.add(b)
    pairs.push({ a, b })
  }
  return pairs
}

// Bbox-based extraction rather than a sequential line-walk: the Score Info
// screen is two-column (portrait+distance on the left, name/points on the
// right), so Tesseract's reading order doesn't reliably interleave rows.
// Instead of clustering every line into row "bands" by vertical gap (real
// bbox output showed intra-row and inter-row gaps overlap too much for that
// to be reliable), this scans for the two line types that actually matter —
// a distance-word line and a name+points line — and pairs each name+points
// line with its nearest unclaimed distance line. A name+points line with no
// nearby distance line (the real cut-off case at a screenshot's bottom
// edge) still becomes a row, with distance left null for
// mergeScreenshotRows to fill in.
//
// Tesseract sometimes splits one visual row's name and points across two
// separate OCR lines instead (seen on a real fixture - see
// docs/decisions.md), which used to drop the row entirely: the points-only
// line has no name-column words, and the name-only line's leftover text
// doesn't match POINTS_REGEX. Those orphaned halves are now paired by
// proximity too, same as name<->distance, but only when the name-only
// line's text is an exact match against the known uma roster
// (lookupUmaName) - that's what tells a real stray name apart from
// unrelated noise (badge text, epithet banners) that can also land in the
// name column's x-range.
export function parseScreenshotRows(lines) {
  const nameCandidates = []
  const distanceCandidates = []
  const orphanPoints = []
  const orphanNames = []

  for (const line of lines) {
    const text = line.text.trim()
    const words = line.words ?? []
    const yc = lineCenter(line.bbox)

    // Points takes priority: a name+points line is the more specific/positive
    // signal, so it's checked before falling back to distance-word matching.
    const pointsMatch = text.match(POINTS_REGEX)
    if (pointsMatch) {
      const umaName = extractUmaName(words)
      const points = Number(pointsMatch[1].replace(/,/g, ''))
      if (umaName) {
        nameCandidates.push({ umaName, points, yc })
      } else {
        orphanPoints.push({ points, yc })
      }
      continue
    }

    const distanceMatch = findDistanceInLine(text)
    if (distanceMatch) {
      distanceCandidates.push({ distance: distanceMatch, yc })
      continue
    }

    const knownName = lookupUmaName(extractUmaName(words) ?? '')
    if (knownName) {
      orphanNames.push({ umaName: knownName, yc })
    }
  }

  for (const { a, b } of nearestPairs(orphanNames, orphanPoints, MAX_ROW_PAIR_GAP)) {
    nameCandidates.push({ umaName: a.umaName, points: b.points, yc: (a.yc + b.yc) / 2 })
  }

  nameCandidates.sort((a, b) => a.yc - b.yc)

  const distanceByName = new Map()
  for (const { a: n, b: d } of nearestPairs(nameCandidates, distanceCandidates, MAX_ROW_PAIR_GAP)) {
    distanceByName.set(n, d.distance)
  }

  return nameCandidates.map((n) => ({
    umaName: n.umaName,
    distance: distanceByName.get(n) ?? null,
    points: n.points,
  }))
}

// Detects a screenshot's leading fragment: a distance-word line positioned
// above every name+points line in the same screenshot. This is what's left
// of the previous screenshot's last row when its distance pill renders past
// the bottom edge there but the row itself scrolls just far enough into this
// screenshot to show the pill at the very top. At most one such fragment is
// expected per screenshot. OCR only catches it sometimes (see
// docs/decisions.md - real fixtures show it legible in some pairs and
// unrecognizable noise in others), so this is an opportunistic signal for
// mergeScreenshotRows to resolve the split row directly; the elimination
// fallback in inferMissingDistances still covers the rest.
export function findLeadingDistance(lines) {
  let firstNameY = Infinity
  const distanceLines = []

  for (const line of lines) {
    const text = line.text.trim()

    if (POINTS_REGEX.test(text)) {
      firstNameY = Math.min(firstNameY, lineCenter(line.bbox))
      continue
    }

    const distanceMatch = findDistanceInLine(text)
    if (distanceMatch) {
      distanceLines.push({ distance: distanceMatch, yc: lineCenter(line.bbox) })
    }
  }

  if (firstNameY === Infinity || distanceLines.length === 0) return null

  distanceLines.sort((a, b) => a.yc - b.yc)
  const topDistance = distanceLines[0]
  return topDistance.yc < firstNameY ? topDistance.distance : null
}

function normalizeName(name) {
  return name.trim().toLowerCase()
}

// Fills a row's distance by elimination when it's still null after merging
// both screenshots: the roster always has exactly 3 umas per distance
// category, so if exactly one row is short a distance and exactly one
// category is short exactly one member, that category must be it. Anything
// less clear-cut is left alone and surfaced as a warning rather than
// guessed - see the split-row case in docs/decisions.md.
function inferMissingDistances(rows, warnings) {
  const missing = rows.filter((row) => row.distance == null)
  if (missing.length === 0) return

  if (rows.length !== ROSTER_SIZE || missing.length !== 1) {
    for (const row of missing) {
      warnings.push(`${row.umaName}: distance could not be determined — please select it manually.`)
    }
    return
  }

  const counts = new Map(DISTANCE_ORDER.map((d) => [d, 0]))
  for (const row of rows) {
    if (row.distance != null) counts.set(row.distance, counts.get(row.distance) + 1)
  }

  const short = DISTANCE_ORDER.filter((d) => counts.get(d) < EXPECTED_PER_DISTANCE)
  if (short.length === 1 && counts.get(short[0]) === EXPECTED_PER_DISTANCE - 1) {
    missing[0].distance = short[0]
  } else {
    warnings.push(`${missing[0].umaName}: distance could not be determined — please select it manually.`)
  }
}

// Merges the two screenshots' rows, de-duplicating the one row that
// overlaps between them. Matching key is the normalized uma name - safe
// because match entry already enforces unique names within a match, so a
// name collision across the two screenshots' row sets can only be the
// overlap row. `leadingDistanceForB` (from findLeadingDistance on
// screenshot B's raw lines) is optional and, when present, is only applied
// if exactly one merged row is still missing a distance - same
// can't-tell-which-row-it-is-for guard as inferMissingDistances, since a
// second unresolved row would make the fragment's target ambiguous.
export function mergeScreenshotRows(rowsA, rowsB, leadingDistanceForB = null) {
  const warnings = []
  const byName = new Map()

  for (const row of rowsA) {
    byName.set(normalizeName(row.umaName), { ...row })
  }

  for (const row of rowsB) {
    const key = normalizeName(row.umaName)
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, { ...row })
      continue
    }

    if (existing.points !== row.points) {
      warnings.push(
        `${existing.umaName}: screenshots disagreed on points (${existing.points} vs ${row.points} pts) — please verify.`
      )
    }

    if (existing.distance == null) {
      existing.distance = row.distance
    } else if (row.distance != null && existing.distance !== row.distance) {
      warnings.push(
        `${existing.umaName}: screenshots disagreed on distance (${existing.distance} vs ${row.distance}) — please verify.`
      )
    }
  }

  const rows = [...byName.values()]

  if (leadingDistanceForB != null) {
    const missing = rows.filter((row) => row.distance == null)
    if (missing.length === 1) {
      missing[0].distance = leadingDistanceForB
    }
  }

  inferMissingDistances(rows, warnings)

  return { rows, warnings }
}
