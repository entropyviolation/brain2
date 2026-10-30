/**
 * lib/mobile/nfc-scan.ts — Which chip is which, and the line the hub accepts
 *
 * The map lives on the phone (`brain2-nfc-chips` in the app's localStorage).
 * The Mac keeps the tag list. A dose asks how many. Blank posts `nfc:{id}`
 * so the saved quantity is used. A door or a plain event posts that line
 * with no question.
 */
import { nfcScanLine, nfcSlug, nfcTagAsksQuantity, type NfcTagCatalogRow } from "@/lib/ingest/nfc-tag"

const HUB_KEY = "brain2-nfc-hub"
const CHIP_KEY = "brain2-nfc-chips"

export type { NfcTagCatalogRow }

export interface NfcHubSetup {
  origin: string
  token: string
}

export type NfcChipMap = Record<string, string>

export type AfterNfcRead =
  | { action: "bind"; uid: string }
  | { action: "ask"; uid: string; tag: NfcTagCatalogRow }
  | { action: "post"; uid: string; tag: NfcTagCatalogRow; text: string }
  | { action: "gone"; uid: string; tagId: string }

type KeyValue = Pick<Storage, "getItem" | "setItem">

/** `http://mac.local:8787` or a URL with a path. Null when it is not http(s). */
export function nfcHubOrigin(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  try {
    const url = new URL(text)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.origin
  } catch {
    return null
  }
}

/** Lowercase hex. Colons and spaces from a pasted id are dropped. */
export function normalizeNfcUid(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^0-9a-f]/g, "")
}

export function readNfcHub(storage: KeyValue): NfcHubSetup | null {
  try {
    const raw = storage.getItem(HUB_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { origin?: unknown; token?: unknown }
    if (typeof parsed.origin !== "string" || typeof parsed.token !== "string") return null
    const origin = nfcHubOrigin(parsed.origin)
    if (!origin || !parsed.token.trim()) return null
    return { origin, token: parsed.token.trim() }
  } catch {
    return null
  }
}

export function writeNfcHub(storage: KeyValue, setup: NfcHubSetup): void {
  storage.setItem(HUB_KEY, JSON.stringify({ origin: setup.origin, token: setup.token }))
}

export function readNfcChips(storage: KeyValue): NfcChipMap {
  try {
    const raw = storage.getItem(CHIP_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: NfcChipMap = {}
    for (const [uid, tagId] of Object.entries(parsed)) {
      const id = normalizeNfcUid(uid)
      const slug = typeof tagId === "string" ? nfcSlug(tagId) : ""
      if (id && slug) out[id] = slug
    }
    return out
  } catch {
    return {}
  }
}

export function rememberNfcChip(storage: KeyValue, uid: string, tagId: string): NfcChipMap {
  const id = normalizeNfcUid(uid)
  const slug = nfcSlug(tagId)
  const chips = readNfcChips(storage)
  if (!id || !slug) return chips
  chips[id] = slug
  storage.setItem(CHIP_KEY, JSON.stringify(chips))
  return chips
}

export function forgetNfcChip(storage: KeyValue, uid: string): NfcChipMap {
  const chips = readNfcChips(storage)
  delete chips[normalizeNfcUid(uid)]
  storage.setItem(CHIP_KEY, JSON.stringify(chips))
  return chips
}

/**
 * Unknown chip: ask which saved tag it is. A known dose asks how many.
 * A known door or plain event is ready to post.
 */
export function afterNfcRead(uid: string, chips: NfcChipMap, tags: readonly NfcTagCatalogRow[]): AfterNfcRead {
  const id = normalizeNfcUid(uid)
  const tagId = chips[id]
  if (!tagId) return { action: "bind", uid: id }
  const tag = tags.find((row) => row.id === tagId)
  if (!tag) return { action: "gone", uid: id, tagId }
  if (nfcTagAsksQuantity(tag)) return { action: "ask", uid: id, tag }
  return { action: "post", uid: id, tag, text: nfcScanLine(tag.id, null) }
}

/** Blank uses the saved quantity. A number is that scan's count. */
export function lineForQuantity(tagId: string, raw: string): { text: string } | { error: string } {
  const trimmed = raw.trim()
  if (!trimmed) {
    const text = nfcScanLine(tagId, null)
    return text ? { text } : { error: "That tag has no id." }
  }
  if (!/^\d{1,2}$/.test(trimmed)) {
    return { error: "How many is a number from 1 to 99. Leave it blank to use the saved quantity." }
  }
  const count = Number(trimmed)
  if (count < 1 || count > 99) {
    return { error: "How many is a number from 1 to 99. Leave it blank to use the saved quantity." }
  }
  const text = nfcScanLine(tagId, count)
  return text ? { text } : { error: "That tag has no id." }
}

export interface NfcScanPost {
  ok: boolean
  status?: string
  summary?: string
  reply?: string
  error?: string
}

export async function loadNfcCatalog(setup: NfcHubSetup): Promise<NfcTagCatalogRow[]> {
  const res = await fetch(`${setup.origin}/api/nfc/tags`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${setup.token}` },
  })
  const body = (await res.json().catch(() => null)) as { ok?: boolean; tags?: NfcTagCatalogRow[]; error?: string } | null
  if (!res.ok || !body?.ok || !Array.isArray(body.tags)) {
    throw new Error(body?.error || (res.status === 401 ? "Hub token was refused." : "The hub did not send the tag list."))
  }
  return body.tags
}

function scanClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function sendNfcScan(setup: NfcHubSetup, text: string, id = scanClientId()): Promise<NfcScanPost> {
  const res = await fetch(`${setup.origin}/api/scan`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${setup.token}`,
    },
    body: JSON.stringify({ text, id }),
  })
  const body = (await res.json().catch(() => null)) as NfcScanPost | null
  if (!body) throw new Error("The hub did not answer.")
  if (!res.ok) throw new Error(body.error || "The hub refused that scan.")
  return body
}
