export function formatPoints(points) {
  return points === null ? '—' : Math.round(points).toLocaleString()
}

export function formatPlayedAt(playedAt) {
  return new Date(playedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
