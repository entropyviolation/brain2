/**
 * Parse bulk-paste place lines like:
 *   Mayta — Av. Mariscal La Mar 1285, Miraflores 15027, Lima, Peru
 *   Belém Tower
 *   Name - Address
 */
export interface ParsedPlacePaste {
  /** Display / pin name */
  name: string
  /** Optional street address (geocode target) */
  address?: string
  /** Original line */
  raw: string
}

const SEP = /\s+[—–−‒-]\s+/ // em/en/minus/hyphen dash with spaces

export function parsePlacePasteLine(line: string): ParsedPlacePaste {
  const raw = line.replace(/^[-*•]\s*/, "").trim()
  if (!raw) return { name: "", raw }

  const m = raw.match(SEP)
  if (m && m.index != null) {
    const name = raw.slice(0, m.index).trim()
    const address = raw.slice(m.index + m[0].length).trim()
    if (name && address) return { name, address, raw }
  }

  // "Name, Address…" only when it looks like street (Av./Jr./Calle/number)
  const comma = raw.indexOf(",")
  if (comma > 0) {
    const left = raw.slice(0, comma).trim()
    const right = raw.slice(comma + 1).trim()
    if (left && right && looksLikeAddress(right)) {
      return { name: left, address: `${left}, ${right}`.includes(left) ? right : right, raw }
    }
  }

  return { name: raw, raw }
}

function looksLikeAddress(s: string): boolean {
  return (
    /\d/.test(s) ||
    /\b(av\.?|avenida|jr\.?|jir[oó]n|calle|street|st\.|road|rd\.|blvd|plaza|paseo)\b/i.test(s)
  )
}

export function parsePlacePasteBlock(text: string): ParsedPlacePaste[] {
  return text
    .split(/\n/)
    .map((l) => parsePlacePasteLine(l))
    .filter((p) => p.name.length > 0)
}
