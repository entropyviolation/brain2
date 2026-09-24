/**
 * lib/ingest/expand.ts — Custom + built-in phrase expansions before parse
 *
 * Custom aliases live on the ingest store (`shop` → `groc`). Built-ins rewrite
 * one-letter SMS habits (`w gym` → `at: gym`) so the parser stays a verb table.
 * Expansions that still point at bare `g` (retired grocery) are rewritten to
 * `groc` so old Settings shortcuts keep working.
 */
import { useIngestStore } from "./ingest-store"
import { remapRetiredGroceryExpansion } from "./shortcut-remap"

export {
  remapRetiredGroceryExpansion,
  remapRetiredGroceryShortcuts,
} from "./shortcut-remap"

const TOKEN = /^([^\s:：]+)([:：]?)([\s\S]*)$/

interface Contextual {
  alias: string
  empty: string
  withPayload: string
}

/** First-token rewrites that change meaning when a payload is present. */
const CONTEXTUAL: Contextual[] = [
  { alias: "w", empty: "where", withPayload: "at:" },
  { alias: "@", empty: "where", withPayload: "at:" },
  { alias: "h", empty: "help", withPayload: "habit:" },
  { alias: "m", empty: "mood", withPayload: "mood:" },
  { alias: "tt", empty: "track", withPayload: "track:" },
  { alias: "trk", empty: "track", withPayload: "track:" },
  { alias: "pause", empty: "stop", withPayload: "stop" },
  { alias: "day", empty: "today", withPayload: "n day:" },
]

export function expandIngestText(raw: string, shortcuts?: Record<string, string>): string {
  const text = String(raw ?? "").replace(/^\uFEFF/, "").trim()
  if (!text) return text

  const map = shortcuts ?? useIngestStore.getState().shortcuts ?? {}
  const hit = TOKEN.exec(text)
  if (!hit) return text
  const token = hit[1].toLowerCase()
  const payload = hit[3].replace(/^\s+/, "")

  const custom = lookupShortcut(map, token)
  if (custom) {
    const expansion = remapRetiredGroceryExpansion(custom.trim())
    return payload ? joinExpansion(expansion, payload) : expansion
  }

  const ctx = CONTEXTUAL.find((row) => row.alias === token)
  if (ctx) {
    return payload ? joinExpansion(ctx.withPayload, payload) : ctx.empty
  }

  return text
}

function lookupShortcut(map: Record<string, string>, token: string): string | undefined {
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(token)) return undefined
  const value = map[token]
  return typeof value === "string" && value.trim() ? value : undefined
}

function joinExpansion(expansion: string, payload: string): string {
  const trimmed = expansion.trim()
  if (/[:：]\s*$/.test(trimmed)) return `${trimmed} ${payload}`.replace(/\s+/g, " ")
  return `${trimmed} ${payload}`
}

export function sanitizeShortcutAlias(alias: string): string | null {
  const token = alias.trim().toLowerCase()
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(token)) return null
  if (/^\d+$/.test(token)) return null
  return token
}
