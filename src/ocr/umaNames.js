// Known Uma Musume: Pretty Derby playable character names (Global, English
// UI), developer-supplied. Used to salvage a Score Info row when Tesseract
// splits its name and points across two separate OCR lines instead of one
// (see docs/decisions.md): matching a name-column line's text against this
// list distinguishes a real uma name from unrelated noise (badge text,
// epithet banners) that can also land in the name column's x-range.
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
// against noise rather than a source of misidentification.
export function lookupUmaName(text) {
  return NORMALIZED_LOOKUP.get(normalize(text)) ?? null
}
