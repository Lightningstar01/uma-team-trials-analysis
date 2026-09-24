// Known Uma Musume: Pretty Derby playable character names (Global, English
// UI), developer-supplied. Used two ways in `parseScoreInfo.js`:
//
// 1. To salvage a Score Info row when Tesseract splits its name and points
//    across two separate OCR lines instead of one (see docs/decisions.md):
//    matching a name-column line's text against this list distinguishes a
//    real uma name from unrelated noise (badge text, epithet banners) that
//    can also land in the name column's x-range. This use (`lookupUmaName`)
//    stays exact-match-only, since it's the only signal telling a real
//    stray name apart from noise - a fuzzy match here would start turning
//    noise lines into spurious rows.
// 2. To correct a name already anchored to a confirmed row (a name+points
//    line, so it's known to be a real row, just possibly OCR-garbled) to
//    its closest dictionary match (`resolveUmaName`) when it isn't an exact
//    match already - e.g. "Oguri Cap" misread as "guri Cap" on a real
//    fixture (see docs/decisions.md).
//
// "Matikanetannhauser" replaces the developer-supplied "Machikane
// Tannhauser" entry - the rest of the app already uses the one-word
// spelling, confirmed from a real screenshot (see
// docs/team-trials-reference.md's Score Info sample table), for the same
// character.
export const UMA_NAMES = [
  'Admire Groove',
  'Admire Vega',
  'Agnes Digital',
  'Agnes Tachyon',
  'Air Groove',
  'Air Messiah',
  'Air Shakur',
  'Aston Machan',
  'Bamboo Memory',
  'Biwa Hayahide',
  'Buena Vista',
  'Calstone Light O',
  'Chase the Wind',
  'Cheval Grand',
  'Copano Rickey',
  'Curren Chan',
  'Daiichi Ruby',
  'Daitaku Helios',
  'Daiwa Scarlet',
  'Dare Dare Dare',
  'Durandal',
  'Eishin Flash',
  'El Condor Pasa',
  'Fine Motion',
  'Fuji Kiseki',
  'Furioso',
  'Gentildonna',
  'Gold City',
  'Gold Ship',
  'Gran Alegria',
  'Grass Wonder',
  'Haru Urara',
  'Hishi Akebono',
  'Hishi Amazon',
  'Hishi Miracle',
  'Hokko Tarumae',
  'Inari One',
  'Ines Fujin',
  'Inghilterra',
  'Jungle Pocket',
  'K.S. Miracle',
  'Katsuragi Ace',
  'Kawakami Princess',
  'King Halo',
  'Kitasan Black',
  'Line Craft',
  "Lover's Journey",
  'Matikanefukukitaru',
  'Manhattan Cafe',
  'Maruzensky',
  'Marvelous Sunday',
  'Matikanetannhauser',
  'Mayano Top Gun',
  'Meisho Doto',
  'Mejiro Ardan',
  'Mejiro Bright',
  'Mejiro Dober',
  'Mejiro McQueen',
  'Mejiro Palmer',
  'Mejiro Ramonu',
  'Mejiro Ryan',
  'Mihono Bourbon',
  'Mr. C.B.',
  'Nakayama Festa',
  'Narita Brian',
  'Narita Taishin',
  'Narita Top Road',
  'Neo Universe',
  'Nice Nature',
  'Nishino Flower',
  'No Reason',
  'North Flight',
  'Oguri Cap',
  'Orfevre',
  'Rice Shower',
  'Rhein Kraft',
  'Sakura Bakushin O',
  'Sakura Chiyono O',
  'Sakura Laurel',
  'Satono Crown',
  'Satono Diamond',
  'Seeking the Pearl',
  'Seiun Sky',
  'Shinko Windy',
  'Silence Suzuka',
  'Smart Falcon',
  'Soul Stirring',
  'Special Week',
  'Still in Love',
  'Super Creek',
  'Sweep Tosho',
  'Symboli Kris S',
  'Symboli Rudolf',
  'T.M. Opera O',
  'Taiki Shuttle',
  'Tamamo Cross',
  'Tanino Gimlet',
  'Tap Dance City',
  'To the Glory',
  'Tokai Teio',
  'Tosen Jordan',
  'Transcend',
  'Twin Turbo',
  'Verxina',
  'Vodka',
  'Win Variete',
  'Winning Ticket',
  'Wonder Acute',
  'Yamanin Zephyr',
  'Yukino Bijin',
  'Zenno Rob Roy',
]

function normalize(name) {
  return name.trim().toLowerCase()
}

const NORMALIZED_LOOKUP = new Map(UMA_NAMES.map((name) => [normalize(name), name]))

// Returns the dictionary's canonical spelling when `text` matches a known
// uma name exactly (case/whitespace-insensitive), otherwise null. Exact
// matching only - deliberately not fuzzy, so this stays a safe filter
// against noise rather than a source of misidentification. Used to gate
// the split-row rescue in parseScoreInfo.js; for a name already anchored to
// a confirmed row, use `resolveUmaName` instead.
export function lookupUmaName(text) {
  return NORMALIZED_LOOKUP.get(normalize(text)) ?? null
}

// Standard edit-distance DP: the minimum number of single-character
// insertions/deletions/substitutions to turn `a` into `b`.
function levenshteinDistance(a, b) {
  const rows = a.length + 1
  const cols = b.length + 1
  const dp = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)])
  for (let j = 1; j < cols; j++) dp[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[rows - 1][cols - 1]
}

// Returns the dictionary entry with the smallest edit distance to `text`
// (ties broken by dictionary order), plus that distance. Always returns a
// name - there's no "no match" case, since the caller decides what counts
// as close enough.
export function closestUmaName(text) {
  const normalized = normalize(text)
  let bestName = UMA_NAMES[0]
  let bestDistance = Infinity
  for (const name of UMA_NAMES) {
    const distance = levenshteinDistance(normalized, normalize(name))
    if (distance < bestDistance) {
      bestDistance = distance
      bestName = name
    }
  }
  return { name: bestName, distance: bestDistance }
}

// Resolves OCR text already anchored to a confirmed Score Info row (a
// name+points line) to a dictionary name: an exact match if there is one,
// otherwise the closest dictionary entry. `exact: false` tells the caller
// the name was a guess, so a row can be flagged for the player to verify.
export function resolveUmaName(text) {
  const exactMatch = lookupUmaName(text)
  if (exactMatch) return { name: exactMatch, exact: true }
  return { name: closestUmaName(text).name, exact: false }
}
