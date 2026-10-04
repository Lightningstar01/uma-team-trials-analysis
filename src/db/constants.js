export const DISTANCE_ORDER = ['Sprint', 'Mile', 'Medium', 'Long', 'Dirt']

export const DISTANCES = new Set(DISTANCE_ORDER)

// Fixed roster shape (see CLAUDE.md / team-trials-reference.md): 15 umas,
// exactly 3 per distance category.
export const ROSTER_SIZE = 15

// The one name-matching rule used everywhere (roster, matches, OCR):
// case- and surrounding-whitespace-insensitive.
export function normalizeName(name) {
  return name.trim().toLowerCase()
}
