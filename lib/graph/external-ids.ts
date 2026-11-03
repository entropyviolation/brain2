/**
 * lib/graph/external-ids.ts — Canonical forms for identifiers a person pastes.
 *
 * Identity match compares these forms. A value that does not parse stays as
 * typed on the record; it simply does not count as the same id.
 */
export const EXTERNAL_ID_KINDS = ["wikidata", "orcid", "isbn", "url"] as const

export type ExternalIdKind = (typeof EXTERNAL_ID_KINDS)[number]

export function normalizeExternalId(kind: ExternalIdKind, value: string | undefined | null): string | undefined {
  if (!value) return undefined
  const raw = value.trim()
  if (!raw) return undefined
  if (kind === "wikidata") {
    const hit = raw.match(/(?:wikidata\.org\/(?:wiki|entity)\/)?(Q\d+)\b/i)
    return hit ? hit[1].toUpperCase() : undefined
  }
  if (kind === "orcid") {
    const digits = raw.replace(/[^0-9xX]/g, "")
    if (digits.length !== 16) return undefined
    const body = digits.slice(0, 15)
    const check = digits[15].toUpperCase()
    return `${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12)}${check}`
  }
  if (kind === "isbn") {
    const digits = raw.replace(/[^0-9xX]/g, "")
    if (digits.length !== 10 && digits.length !== 13) return undefined
    return digits.toUpperCase()
  }
  if (!/^https?:\/\//i.test(raw)) return undefined
  try {
    const url = new URL(raw)
    url.hash = ""
    let out = url.toString()
    if (out.endsWith("/") && url.pathname !== "/") out = out.slice(0, -1)
    return out
  } catch {
    return undefined
  }
}
