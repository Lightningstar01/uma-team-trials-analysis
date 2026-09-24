import { describe, it, expect } from 'vitest'
import { parseScreenshotRows, mergeScreenshotRows, findLeadingDistance } from './parseScoreInfo.js'
import { sampleMatch } from './__fixtures__/sampleMatch.js'

// Builders modeled on real recognizeImage() output captured from the actual
// fixtures (see docs/decisions.md): name words start at x0=279-280, noise
// before them ends by x1=209, points start at x0=752, the trailing "(i)"
// icon starts at x0=953-957.
function nameLine(y, name, points, { noise = true, icon = true } = {}) {
  const words = []
  if (noise) words.push({ text: '~~', x0: 80, x1: 167 })
  let x = 279
  for (const part of name.split(' ')) {
    const width = part.length * 14 + 20
    words.push({ text: part, x0: x, x1: x + width })
    x += width + 10
  }
  const pointsStr = points.toLocaleString('en-US')
  words.push({ text: pointsStr, x0: 752, x1: 752 + pointsStr.length * 14 })
  words.push({ text: 'pts', x0: 896, x1: 946 })
  if (icon) words.push({ text: '@)', x0: 957, x1: 1009 })

  const y0 = y - 25
  const y1 = y + 25
  return {
    text: words.map((w) => w.text).join(' ') + '\n',
    bbox: { x0: Math.min(...words.map((w) => w.x0)), y0, x1: Math.max(...words.map((w) => w.x1)), y1 },
    words: words.map((w) => ({ text: w.text, bbox: { x0: w.x0, y0, x1: w.x1, y1 } })),
  }
}

function distanceLine(y, distance) {
  const y0 = y - 15
  const y1 = y + 15
  return {
    text: distance + '\n',
    bbox: { x0: 115, y0, x1: 200, y1 },
    words: [{ text: distance, bbox: { x0: 115, y0, x1: 200, y1 } }],
  }
}

function noiseLine(y, text) {
  const y0 = y - 15
  const y1 = y + 15
  return {
    text: text + '\n',
    bbox: { x0: 80, y0, x1: 300, y1 },
    words: [{ text, bbox: { x0: 80, y0, x1: 300, y1 } }],
  }
}

// Modeled on the real word bboxes Tesseract produced for El Condor Pasa's
// row on Score_Info_2b.jpg, where it split one visual row into a
// points-only line and a separate name-only line (see docs/decisions.md).
function pointsOnlyLine(y, points) {
  const y0 = y - 27
  const y1 = y + 27
  const pointsStr = points.toLocaleString('en-US')
  const words = [
    { text: 'wv', x0: 81, x1: 209 },
    { text: pointsStr, x0: 753, x1: 753 + pointsStr.length * 14 },
    { text: 'pts', x0: 892, x1: 947 },
  ]
  return {
    text: words.map((w) => w.text).join(' ') + '\n',
    bbox: { x0: 81, y0, x1: 1009, y1 },
    words: words.map((w) => ({ text: w.text, bbox: { x0: w.x0, y0, x1: w.x1, y1 } })),
  }
}

function nameOnlyLine(y, name) {
  const y0 = y - 40
  const y1 = y + 40
  let x = 280
  const words = [{ text: 'A', x0: 106, x1: 113 }]
  for (const part of name.split(' ')) {
    const width = part.length * 18 + 20
    words.push({ text: part, x0: x, x1: x + width })
    x += width + 10
  }
  words.push({ text: 'pts', x0: 896, x1: 946 })
  return {
    text: words.map((w) => w.text).join(' ') + '\n',
    bbox: { x0: 106, y0, x1: 1071, y1 },
    words: words.map((w) => ({ text: w.text, bbox: { x0: w.x0, y0, x1: w.x1, y1 } })),
  }
}

// Mirrors Score_Info_1a.jpg: 7 complete rows plus a trailing row (Air Groove)
// cut off before its distance pill renders.
function screenshot1Lines() {
  const rows = sampleMatch.slice(0, 8)
  const lines = [noiseLine(440, 'Legendary Reprise')]
  let y = 475
  for (const [i, row] of rows.entries()) {
    lines.push(nameLine(y, row.umaName, row.points))
    if (i < 7) lines.push(distanceLine(y + 73, row.distance)) // Air Groove's distance omitted
    if (i === 0) lines.push(noiseLine(y + 158, 'U RANK'))
    y += 193
  }
  return lines
}

// Mirrors Score_Info_1b.jpg: header noise, then 7 complete rows. No usable
// fragment at all for the split row (matches the real OCR run).
function screenshot2Lines() {
  const rows = sampleMatch.slice(8, 15)
  const lines = [noiseLine(304, 'Score Info'), noiseLine(373, '- = ———')]
  let y = 565
  for (const row of rows) {
    lines.push(nameLine(y, row.umaName, row.points))
    lines.push(distanceLine(y + 73, row.distance))
    y += 198
  }
  return lines
}

describe('parseScreenshotRows', () => {
  it('extracts all complete rows plus a distance-less trailing row (screenshot 1 shape)', () => {
    const rows = parseScreenshotRows(screenshot1Lines())
    expect(rows).toHaveLength(8)
    expect(rows.slice(0, 7)).toEqual(sampleMatch.slice(0, 7))
    expect(rows[7]).toEqual({ umaName: 'Air Groove', distance: null, points: 60294 })
  })

  it('extracts all complete rows (screenshot 2 shape)', () => {
    const rows = parseScreenshotRows(screenshot2Lines())
    expect(rows).toHaveLength(7)
    expect(rows).toEqual(sampleMatch.slice(8, 15))
  })

  it('returns rows top to bottom', () => {
    const rows = parseScreenshotRows(screenshot1Lines())
    const ys = rows.map((r) => sampleMatch.findIndex((s) => s.umaName === r.umaName))
    expect(ys).toEqual([...ys].sort((a, b) => a - b))
  })

  it('drops noise lines without producing spurious rows', () => {
    const lines = [
      noiseLine(100, 'Legendary Reprise'),
      noiseLine(150, 'RANK'),
      noiseLine(200, 'Score Info'),
      distanceLine(250, 'Long'), // distance with no nearby name - dropped
    ]
    const rows = parseScreenshotRows(lines)
    expect(rows).toEqual([])
  })

  it('is case-insensitive when matching distance words', () => {
    const lines = [nameLine(500, 'Test Uma', 1000), distanceLine(570, 'sprint')]
    const rows = parseScreenshotRows(lines)
    expect(rows).toEqual([{ umaName: 'Test Uma', distance: 'Sprint', points: 1000 }])
  })

  it.each([
    ['80,936 pts', 80936],
    ['999 pts', 999],
    ['1,234pts', 1234],
    ['1,234 PTS', 1234],
    ['1,234 Pt', 1234],
  ])('parses the points regex for %s', (suffix, expectedPoints) => {
    const words = [
      { text: '~~', x0: 80, x1: 167 },
      { text: 'Test', x0: 279, x1: 340 },
      ...suffix.split(' ').map((part, i) => ({ text: part, x0: 752 + i * 100, x1: 800 + i * 100 })),
    ]
    const y0 = 480
    const y1 = 520
    const line = {
      text: `~~ Test ${suffix}\n`,
      bbox: { x0: 80, y0, x1: 1000, y1 },
      words: words.map((w) => ({ text: w.text, bbox: { x0: w.x0, y0, x1: w.x1, y1 } })),
    }
    const rows = parseScreenshotRows([line])
    expect(rows).toEqual([{ umaName: 'Test', distance: null, points: expectedPoints }])
  })

  it('drops a name+points line whose words never fall in the name column', () => {
    // Every word is noise/points/icon - nothing between x0=250 and x0=700.
    const y0 = 480
    const y1 = 520
    const words = [
      { text: '~~', x0: 80, x1: 167 },
      { text: '80,936', x0: 752, x1: 881 },
      { text: 'pts', x0: 896, x1: 946 },
    ]
    const line = {
      text: '~~ 80,936 pts\n',
      bbox: { x0: 80, y0, x1: 946, y1 },
      words: words.map((w) => ({ text: w.text, bbox: { x0: w.x0, y0, x1: w.x1, y1 } })),
    }
    expect(parseScreenshotRows([line])).toEqual([])
  })

  it('rescues a row Tesseract split into a points-only line and a separate name-only line', () => {
    const lines = [pointsOnlyLine(949, 50458), nameOnlyLine(977, 'El Condor Pasa')]
    const rows = parseScreenshotRows(lines)
    expect(rows).toEqual([{ umaName: 'El Condor Pasa', distance: null, points: 50458 }])
  })

  it('does not rescue a name-only line whose text is not a known uma name', () => {
    const lines = [pointsOnlyLine(949, 50458), nameOnlyLine(977, 'Not A Real Uma')]
    expect(parseScreenshotRows(lines)).toEqual([])
  })

  it('does not rescue a points-only/name-only pair that is too far apart to be the same row', () => {
    const lines = [pointsOnlyLine(200, 50458), nameOnlyLine(900, 'El Condor Pasa')]
    expect(parseScreenshotRows(lines)).toEqual([])
  })

  it('still resolves the distance for a rescued split row when one is nearby', () => {
    const lines = [pointsOnlyLine(949, 50458), nameOnlyLine(977, 'El Condor Pasa'), distanceLine(1028, 'Dirt')]
    const rows = parseScreenshotRows(lines)
    expect(rows).toEqual([{ umaName: 'El Condor Pasa', distance: 'Dirt', points: 50458 }])
  })
})

describe('findLeadingDistance', () => {
  it('returns the distance when it sits above every name line', () => {
    const lines = [distanceLine(429, 'Long'), nameLine(520, 'El Condor Pasa', 55887)]
    expect(findLeadingDistance(lines)).toBe('Long')
  })

  it('returns null when the only distance line belongs to a normal row (at or below the first name line)', () => {
    const lines = [nameLine(500, 'Test Uma', 1000), distanceLine(573, 'Sprint')]
    expect(findLeadingDistance(lines)).toBeNull()
  })

  it('returns null when there is no distance line', () => {
    const lines = [nameLine(500, 'Test Uma', 1000)]
    expect(findLeadingDistance(lines)).toBeNull()
  })

  it('returns null when there is no name line to compare against', () => {
    const lines = [distanceLine(250, 'Long')]
    expect(findLeadingDistance(lines)).toBeNull()
  })
})

describe('mergeScreenshotRows', () => {
  it('reconstructs all 15 rows with no warnings when the split row is inferred unambiguously', () => {
    const rowsA = parseScreenshotRows(screenshot1Lines())
    const rowsB = parseScreenshotRows(screenshot2Lines())
    const { rows, warnings } = mergeScreenshotRows(rowsA, rowsB)

    expect(warnings).toEqual([])
    expect(rows).toHaveLength(15)
    expect([...rows].sort((a, b) => a.umaName.localeCompare(b.umaName))).toEqual(
      [...sampleMatch].sort((a, b) => a.umaName.localeCompare(b.umaName))
    )
  })

  it('does not duplicate a row that parsed completely in both screenshots', () => {
    const shared = { umaName: 'Air Groove', distance: 'Sprint', points: 60294 }
    const { rows, warnings } = mergeScreenshotRows([shared], [shared])
    expect(rows).toEqual([shared])
    expect(warnings).toEqual([])
  })

  it('keeps rowsA points and warns when the two screenshots disagree on points', () => {
    const { rows, warnings } = mergeScreenshotRows(
      [{ umaName: 'Air Groove', distance: 'Sprint', points: 60294 }],
      [{ umaName: 'Air Groove', distance: 'Sprint', points: 60244 }]
    )
    expect(rows).toEqual([{ umaName: 'Air Groove', distance: 'Sprint', points: 60294 }])
    expect(warnings).toEqual([
      'Air Groove: screenshots disagreed on points (60294 vs 60244 pts) — please verify.',
    ])
  })

  it('keeps rowsA distance and warns when the two screenshots disagree on distance', () => {
    const { rows, warnings } = mergeScreenshotRows(
      [{ umaName: 'Air Groove', distance: 'Sprint', points: 60294 }],
      [{ umaName: 'Air Groove', distance: 'Mile', points: 60294 }]
    )
    expect(rows).toEqual([{ umaName: 'Air Groove', distance: 'Sprint', points: 60294 }])
    expect(warnings).toEqual([
      'Air Groove: screenshots disagreed on distance (Sprint vs Mile) — please verify.',
    ])
  })

  it('warns instead of guessing when more than one row is missing a distance', () => {
    const rowsA = sampleMatch.map((row) => ({ ...row }))
    rowsA[1] = { ...rowsA[1], distance: null } // Silence Suzuka
    rowsA[7] = { ...rowsA[7], distance: null } // Air Groove
    const { rows, warnings } = mergeScreenshotRows(rowsA, [])

    expect(rows.find((r) => r.umaName === 'Silence Suzuka').distance).toBeNull()
    expect(rows.find((r) => r.umaName === 'Air Groove').distance).toBeNull()
    expect(warnings).toEqual([
      'Silence Suzuka: distance could not be determined — please select it manually.',
      'Air Groove: distance could not be determined — please select it manually.',
    ])
  })

  it('warns instead of guessing when the row count is not the full 15-uma roster', () => {
    const rowsA = sampleMatch.slice(0, 8).map((row) => ({ ...row }))
    rowsA[7] = { ...rowsA[7], distance: null } // Air Groove, but only 8 rows total
    const { rows, warnings } = mergeScreenshotRows(rowsA, [])

    expect(rows.find((r) => r.umaName === 'Air Groove').distance).toBeNull()
    expect(warnings).toEqual(['Air Groove: distance could not be determined — please select it manually.'])
  })

  it('uses the leading-distance fragment to resolve the split row, even when elimination could not (partial roster)', () => {
    const rowsA = sampleMatch.slice(0, 8).map((row) => ({ ...row }))
    rowsA[7] = { ...rowsA[7], distance: null } // Air Groove, but only 8 rows total
    const { rows, warnings } = mergeScreenshotRows(rowsA, [], 'Sprint')

    expect(rows.find((r) => r.umaName === 'Air Groove').distance).toBe('Sprint')
    expect(warnings).toEqual([])
  })

  it('ignores the leading-distance fragment when more than one row is still missing a distance', () => {
    const rowsA = sampleMatch.map((row) => ({ ...row }))
    rowsA[1] = { ...rowsA[1], distance: null } // Silence Suzuka
    rowsA[7] = { ...rowsA[7], distance: null } // Air Groove
    const { rows, warnings } = mergeScreenshotRows(rowsA, [], 'Sprint')

    expect(rows.find((r) => r.umaName === 'Silence Suzuka').distance).toBeNull()
    expect(rows.find((r) => r.umaName === 'Air Groove').distance).toBeNull()
    expect(warnings).toEqual([
      'Silence Suzuka: distance could not be determined — please select it manually.',
      'Air Groove: distance could not be determined — please select it manually.',
    ])
  })
})
