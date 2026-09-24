import { DISTANCE_ORDER } from '../db/constants.js'

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
export function parseScreenshotRows(lines) {
  const nameCandidates = []
  const distanceCandidates = []

  for (const line of lines) {
    const text = line.text.trim()

    // Points takes priority: a name+points line is the more specific/positive
    // signal, so it's checked before falling back to distance-word matching.
    const pointsMatch = text.match(POINTS_REGEX)
    if (pointsMatch) {
      const umaName = extractUmaName(line.words ?? [])
      if (!umaName) continue // no identifiable name - can't key this row on anything
      nameCandidates.push({
        umaName,
        points: Number(pointsMatch[1].replace(/,/g, '')),
        yc: lineCenter(line.bbox),
      })
      continue
    }

    const distanceMatch = findDistanceInLine(text)
    if (distanceMatch) {
      distanceCandidates.push({ distance: distanceMatch, yc: lineCenter(line.bbox) })
    }
  }

  nameCandidates.sort((a, b) => a.yc - b.yc)

  const pairs = []
  for (const n of nameCandidates) {
    for (const d of distanceCandidates) {
      pairs.push({ n, d, gap: Math.abs(n.yc - d.yc) })
    }
  }
  pairs.sort((a, b) => a.gap - b.gap)

  const usedDistances = new Set()
  const distanceByName = new Map()
  for (const { n, d, gap } of pairs) {
    if (gap > MAX_ROW_PAIR_GAP) break // sorted ascending - no valid pairs remain
    if (distanceByName.has(n) || usedDistances.has(d)) continue
    usedDistances.add(d)
    distanceByName.set(n, d.distance)
  }

  return nameCandidates.map((n) => ({
    umaName: n.umaName,
    distance: distanceByName.get(n) ?? null,
    points: n.points,
  }))
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
// overlap row.
export function mergeScreenshotRows(rowsA, rowsB) {
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
  inferMissingDistances(rows, warnings)

  return { rows, warnings }
}
