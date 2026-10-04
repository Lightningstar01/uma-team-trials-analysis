import { DISTANCE_ORDER } from '../db/constants'

const SORT_VALUES = {
  umaName: (slot) => slot.umaName,
  distance: (slot) => DISTANCE_ORDER.indexOf(slot.distance),
  average: (slot) => slot.average,
  high: (slot) => slot.high,
  low: (slot) => slot.low,
  matchCount: (slot) => slot.matchCount,
}

// Sorts roster stats by one column. Slots with no scores (null stats) stay
// at the bottom in either direction. Ties keep their incoming order (the
// roster's distance-then-name order), since Array.prototype.sort is stable.
export function sortRosterStats(stats, { key, direction }) {
  const valueOf = SORT_VALUES[key]
  const sign = direction === 'asc' ? 1 : -1

  return [...stats].sort((a, b) => {
    const valueA = valueOf(a)
    const valueB = valueOf(b)
    if (valueA === null || valueB === null) return (valueA === null) - (valueB === null)
    if (typeof valueA === 'string') return sign * valueA.localeCompare(valueB)
    return sign * (valueA - valueB)
  })
}

// Orders a match's entry-grid rows by points, highest first, to line up with
// the Score Info screenshots. Points are grid strings; blank or non-numeric
// ones go last. Ties keep their incoming (roster) order.
export function sortEntryRowsByPoints(rows) {
  const valueOf = (row) => (row.points === '' || !Number.isFinite(Number(row.points)) ? null : Number(row.points))
  return [...rows].sort((a, b) => {
    const valueA = valueOf(a)
    const valueB = valueOf(b)
    if (valueA === null || valueB === null) return (valueA === null) - (valueB === null)
    return valueB - valueA
  })
}

// Clicking the active column flips its direction; clicking a new column
// starts it ascending.
export function nextSort(current, key) {
  if (current.key !== key) return { key, direction: 'asc' }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}
