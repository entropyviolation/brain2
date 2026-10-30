/**
 * lib/item-write-source.ts — Who wrote an item line
 *
 * One attribution object on every new History row (`lib/item-activity.ts`).
 * `surface` is a registry id. `client` is the shell, when there is one.
 * `name` is a list, rule, workflow, or agent name copied at write time.
 *
 * `addTask` / `updateTask` resolve it: an explicit argument, else the top
 * `withItemWriteSource` frame, else `{ surface: "unknown" }`. A missing
 * client is filled from this shell. Node (the phone hub) leaves client off.
 * Client labels: `electron`, `iOS`, `web`. The stored token for iOS is `ios`.
 */

export type ItemWriteClient = "electron" | "ios" | "web"

export interface ItemWriteAttribution {
  /** Door or process. Core ids are registered below; a later agent may register another. */
  surface: string
  /** Shell. Omitted on the Node hub, and when the caller leaves it off in Node. */
  client?: ItemWriteClient
  /** List, rule, workflow, or agent name. Not a message body, prompt, or note. */
  name?: string
}

/** Printed after the word "source". `ios` prints as `iOS`. */
export const ITEM_WRITE_CLIENT_LABEL: Record<ItemWriteClient, string> = {
  electron: "electron",
  ios: "iOS",
  web: "web",
}

const CORE_SURFACES: Record<string, string> = {
  "quick-add": "quick add",
  "bulk-add": "bulk add",
  "item-detail": "item detail",
  list: "list",
  bim: "BIM",
  rule: "rule",
  workflow: "workflow",
  "membership-rule": "membership rule",
  "list-link": "list link",
  agent: "agent",
  import: "import",
  "working-on-now": "working on now",
  unknown: "unknown",
  notes: "notes",
  reminder: "reminder",
  "log-item-detail": "log item detail",
  "header-tracking": "header tracking",
}

const surfaceLabels = new Map<string, string>(Object.entries(CORE_SURFACES))

/** A later agent registers its own door. An unregistered id still stores and prints as itself. */
export function registerItemWriteSurface(entry: { id: string; label: string }): void {
  const id = entry.id.trim()
  const label = entry.label.trim()
  if (!id || !label) return
  surfaceLabels.set(id, label)
}

export function itemWriteSurfaceLabel(id: string): string {
  return surfaceLabels.get(id) ?? id
}

let clientReader: () => ItemWriteClient | undefined = detectItemWriteClient

/**
 * Electron when the user agent says Electron. iOS when Capacitor's platform
 * is `ios` or the origin is `capacitor:`. Otherwise `web` in a browser.
 * Nothing in Node (no `window`), so a hub write is not called electron.
 */
export function currentItemWriteClient(): ItemWriteClient | undefined {
  return clientReader()
}

/** Tests pin the shell so a jsdom user agent cannot decide the clause. Pass null to restore detection. */
export function setItemWriteClientForTests(reader: (() => ItemWriteClient | undefined) | null): void {
  clientReader = reader ?? detectItemWriteClient
}

function detectItemWriteClient(): ItemWriteClient | undefined {
  if (typeof window === "undefined") return undefined
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
  if (/Electron/i.test(ua)) return "electron"
  const protocol = window.location?.protocol ?? ""
  if (protocol === "capacitor:" || protocol === "ionic:") return "ios"
  const cap = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor
  if (typeof cap?.getPlatform === "function" && cap.getPlatform() === "ios") return "ios"
  return "web"
}

const frames: ItemWriteAttribution[] = []

function peekFrame(): ItemWriteAttribution | undefined {
  return frames[frames.length - 1]
}

/**
 * Runs `fn` under an attribution frame. Nested frames override, so a rule
 * write inside a user edit is the rule. An async `fn` keeps the frame until
 * the promise settles, so a write after `await` still sees it.
 */
export function withItemWriteSource<T>(attribution: ItemWriteAttribution, fn: () => T): T {
  frames.push(attribution)
  let settled = false
  const pop = () => {
    if (settled) return
    settled = true
    frames.pop()
  }
  try {
    const result = fn()
    if (isPromise(result)) {
      return Promise.resolve(result).then(
        (value) => {
          pop()
          return value
        },
        (err: unknown) => {
          pop()
          throw err
        },
      ) as T
    }
    pop()
    return result
  } catch (err) {
    pop()
    throw err
  }
}

function isPromise(value: unknown): value is Promise<unknown> {
  return !!value && typeof (value as { then?: unknown }).then === "function"
}

const unknownWarned = new Set<string>()

/** Tests that assert the once-only warning start from an empty set. */
export function resetItemWriteUnknownWarnings(): void {
  unknownWarned.clear()
}

function warnUnknown(): void {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") return
  const stack = new Error().stack ?? ""
  const sig =
    stack
      .split("\n")
      .slice(2, 8)
      .map((line) => line.trim())
      .join(" > ") || "unknown"
  if (unknownWarned.has(sig)) return
  unknownWarned.add(sig)
  console.error(`[item-write-source] source unknown\n${sig}`)
}

/** Explicit argument, else the current frame, else unknown. Stamps the shell when client was left off. */
export function resolveItemWriteAttribution(explicit?: ItemWriteAttribution | null): ItemWriteAttribution {
  const raw = explicit ?? peekFrame() ?? { surface: "unknown" }
  const surface = raw.surface?.trim() || "unknown"
  const name = raw.name?.trim() || undefined
  let client = raw.client
  if (!client) {
    const shell = currentItemWriteClient()
    if (shell) client = shell
  }
  if (surface === "unknown") warnUnknown()
  return {
    surface,
    ...(client ? { client } : {}),
    ...(name ? { name } : {}),
  }
}

const AUTO_RULE_SURFACES = new Set(["rule", "membership-rule"])
const CREATE_FROM_SURFACES = new Set(["quick-add", "bulk-add"])

/**
 * The source clause, without the leading " — ".
 * Create + list: `source from {name}, {client}`.
 * Create + quick/bulk add that also names a list: `source quick add, from {name}, {client}`.
 * Rule and membership rule: `source autoapplied rule {name}`.
 * A shell appends `, electron` / `, iOS` / `, web` except on `unknown`, which stays `source unknown`.
 */
export function formatItemWriteClause(
  entry: { attribution?: ItemWriteAttribution; source?: string },
  opts?: { create?: boolean },
): string {
  const attr = entry.attribution
  if (!attr) {
    if (entry.source) return `source ${entry.source}`
    return "source recorded before sources"
  }
  if (attr.surface === "unknown") return "source unknown"

  const client = attr.client ? ITEM_WRITE_CLIENT_LABEL[attr.client] ?? attr.client : ""
  const name = attr.name?.trim() ?? ""
  const create = opts?.create === true

  if (AUTO_RULE_SURFACES.has(attr.surface)) {
    const rule = name ? `autoapplied rule ${name}` : "autoapplied rule"
    return joinClause([rule, client])
  }

  const label = itemWriteSurfaceLabel(attr.surface)
  if (create && attr.surface === "list" && name) return joinClause([`from ${name}`, client])
  if (create && CREATE_FROM_SURFACES.has(attr.surface) && name) return joinClause([label, `from ${name}`, client])
  return joinClause([label, name, client])
}

function joinClause(parts: string[]): string {
  return `source ${parts.filter(Boolean).join(", ")}`
}
