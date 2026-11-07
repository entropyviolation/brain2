/**
 * lib/flight-bimby/airlines.ts — Airline names ↔ IATA codes
 *
 * Two jobs: a flight number is only trusted when its two-character prefix is a real airline
 * (so "NY 12" or "ST 5" is not a flight), and "Operated by Alaska" becomes `Alaska Airlines`.
 */

export interface Airline {
  code: string
  name: string
  /** Lower-case words that name it in prose. */
  words: string[]
}

export const AIRLINES: Airline[] = [
  { code: "B6", name: "JetBlue", words: ["jetblue"] },
  { code: "AS", name: "Alaska Airlines", words: ["alaska airlines", "alaska"] },
  { code: "DL", name: "Delta Air Lines", words: ["delta air lines", "delta airlines", "delta"] },
  { code: "UA", name: "United Airlines", words: ["united airlines", "united"] },
  { code: "AA", name: "American Airlines", words: ["american airlines", "american"] },
  { code: "WN", name: "Southwest Airlines", words: ["southwest airlines", "southwest"] },
  { code: "NK", name: "Spirit Airlines", words: ["spirit airlines", "spirit"] },
  { code: "F9", name: "Frontier Airlines", words: ["frontier airlines", "frontier"] },
  { code: "HA", name: "Hawaiian Airlines", words: ["hawaiian airlines", "hawaiian"] },
  { code: "G4", name: "Allegiant", words: ["allegiant"] },
  { code: "SY", name: "Sun Country", words: ["sun country"] },
  { code: "MX", name: "Breeze Airways", words: ["breeze airways", "breeze"] },
  { code: "XP", name: "Avelo Airlines", words: ["avelo"] },
  { code: "AC", name: "Air Canada", words: ["air canada"] },
  { code: "WS", name: "WestJet", words: ["westjet"] },
  { code: "Y4", name: "Volaris", words: ["volaris"] },
  { code: "AM", name: "Aeroméxico", words: ["aeromexico", "aeroméxico"] },
  { code: "BA", name: "British Airways", words: ["british airways"] },
  { code: "VS", name: "Virgin Atlantic", words: ["virgin atlantic"] },
  { code: "LH", name: "Lufthansa", words: ["lufthansa"] },
  { code: "AF", name: "Air France", words: ["air france"] },
  { code: "KL", name: "KLM", words: ["klm"] },
  { code: "IB", name: "Iberia", words: ["iberia"] },
  { code: "TP", name: "TAP Air Portugal", words: ["tap air portugal", "tap portugal"] },
  { code: "EK", name: "Emirates", words: ["emirates"] },
  { code: "QR", name: "Qatar Airways", words: ["qatar airways"] },
  { code: "TK", name: "Turkish Airlines", words: ["turkish airlines"] },
  { code: "FR", name: "Ryanair", words: ["ryanair"] },
  { code: "U2", name: "easyJet", words: ["easyjet"] },
  { code: "QF", name: "Qantas", words: ["qantas"] },
  { code: "JQ", name: "Jetstar Airways", words: ["jetstar"] },
  { code: "LA", name: "LATAM", words: ["latam"] },
  { code: "CM", name: "Copa Airlines", words: ["copa airlines", "copa"] },
  { code: "AV", name: "Avianca", words: ["avianca"] },
]

const BY_CODE = new Map(AIRLINES.map((a) => [a.code, a]))

export function airlineByCode(code?: string): Airline | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined
}

/** The airline a stretch of prose names (longest name first), or undefined. */
export function airlineInText(text: string): Airline | undefined {
  const lower = text.toLowerCase()
  let best: { airline: Airline; at: number } | undefined
  for (const airline of AIRLINES) {
    for (const word of airline.words) {
      const m = new RegExp(`(?<![a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`).exec(lower)
      if (m && (!best || m.index < best.at)) best = { airline, at: m.index }
    }
  }
  return best?.airline
}
