/**
 * lib/people-and-keys.ts — Seam types for auth and user kinds (Planned)
 *
 * Types only. Nothing imports this yet and nothing here runs. The plan is
 * `docs/PEOPLE_AND_KEYS.md`: the vault belongs to the person, identity is a
 * key, a share is a dated lens, every writer is named, and a model only
 * proposes.
 */

/** Who or what wrote a row. Missing on old rows; read it as `owner`. */
export type WriterKind = "owner" | "companion" | "device" | "agent" | "guest"

/** A dated, revocable window onto part of a vault. Never the whole vault. */
export type LensGrant = {
  /** Logical store names the grant covers, e.g. `"habits"`. */
  lens: readonly string[]
  from: string
  /** End date. A grant with no end is refused by default. */
  until: string
  detail: "summary" | "rows"
}

export const DEFAULT_WRITER: WriterKind = "owner"
