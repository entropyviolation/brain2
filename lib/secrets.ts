/**
 * lib/secrets.ts — Secret items and the passphrase that unlocks them
 *
 * An item with `secret: true` is hidden from every search and every LLM
 * context unless the person has unlocked secrets and switched them on for that
 * surface. Pure and framework-free. The unlock state lives in
 * `lib/secrets-store.ts`.
 *
 * Hiding is the default at the seam: `searchItems` and the BIM snapshot drop
 * secret items unless the caller passes `includeSecrets: true`, so a new caller
 * is private until it opts in.
 *
 * The passphrase is a gate on the app, not encryption. The text of a secret
 * item still sits in the vault on disk. Only a salted PBKDF2 hash of the
 * passphrase is stored.
 */

/** Anything that may carry the flag. */
export interface MaybeSecret {
  secret?: boolean
}

export function isSecret(item: MaybeSecret | null | undefined): boolean {
  return item?.secret === true
}

/** `items` unchanged when secrets are included, else without the secret ones. */
export function withoutSecrets<T extends MaybeSecret>(items: readonly T[], includeSecrets = false): T[] {
  return includeSecrets ? [...items] : items.filter((item) => !isSecret(item))
}

/** Ids of the secret items, for filtering rows that only know an item by id. */
export function secretIds(items: readonly (MaybeSecret & { id: string })[]): Set<string> {
  return new Set(items.filter(isSecret).map((item) => item.id))
}

// ------------------------------------------------------------ inline secret spans
//
// Any text anywhere (a note, a title, a chat line, a tracking note, a day note) can hide part of itself:
//
//   went to the gym \secret thinking about Marilyn Monroe the whole time \secret then lunch
//
// The words between the two `\secret` marks are a secret span. Braces are optional: `\secret {text} \secret`
// reads the same. A tag picks a covert tally: `\secret[o] … \secret` (see `secretTally`). A span with no
// closing mark runs to the end of the text, so a forgotten mark hides more, never less.
//
// The text keeps its marks on disk. Every reader strips the spans unless secrets were EXPLICITLY included
// (`docs/SECRETS.md`): search, word clouds, keyphrases, the memory graph, the BIM snapshot, and every model
// call (`lib/bim-flow/ollama.ts` strips by default; only a call made with `secrets: "included"` keeps them).

const SPAN = /\\secret\b(?:\[([\w-]+)\])?([\s\S]*?)(?:\\secret\b(?:\[[\w-]+\])?|$)/gi
const MARK = /\\secret\b/i

/** True when the text holds at least one `\secret` mark. Cheap; checked before any rewrite. */
export function hasSecretSpans(text: string | null | undefined): boolean {
  return !!text && MARK.test(text)
}

function innerText(raw: string): string {
  const t = raw.trim()
  return (t.startsWith("{") && t.endsWith("}") ? t.slice(1, -1) : t).trim()
}

/** The text with every secret span removed. What every surface sees by default. */
export function stripSecretSpans(text: string): string {
  if (!hasSecretSpans(text)) return text
  return text
    .replace(SPAN, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:!?])/g, "$1")
    .replace(/^[ \t]+|[ \t]+$/gm, "")
}

/** The text with the marks taken off and the secret words kept. Only for a reader that included secrets. */
export function revealSecretSpans(text: string): string {
  if (!hasSecretSpans(text)) return text
  return text.replace(SPAN, (_, _tag: string | undefined, inner: string) => ` ${innerText(inner)} `).replace(/[ \t]{2,}/g, " ").trim()
}

export interface SecretSpan {
  /** The words inside the marks, braces trimmed. */
  text: string
  /** The tag from `\secret[tag]`, lowercased, when there is one. */
  tag?: string
}

/** Every secret span in the text, in order. */
export function secretSpans(text: string): SecretSpan[] {
  if (!hasSecretSpans(text)) return []
  const out: SecretSpan[] = []
  for (const m of text.matchAll(SPAN)) {
    const inner = innerText(m[2] ?? "")
    if (inner) out.push({ text: inner, ...(m[1] ? { tag: m[1].toLowerCase() } : {}) })
  }
  return out
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * A copy of any JSON-like value with the secret spans stripped from every string inside it. Arrays and plain
 * objects are walked; Dates, Maps and class instances are kept as they are. Untouched branches are returned as
 * the same object, so a value with no marks costs one walk and no copies.
 */
export function stripSecretsDeep<T>(value: T): T {
  if (typeof value === "string") return stripSecretSpans(value) as T
  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((v) => {
      const s = stripSecretsDeep(v)
      if (s !== v) changed = true
      return s
    })
    return (changed ? next : value) as T
  }
  if (isPlainObject(value)) {
    let next: Record<string, unknown> | null = null
    for (const [k, v] of Object.entries(value)) {
      const s = stripSecretsDeep(v)
      if (s !== v) (next ??= { ...value })[k] = s
    }
    return (next ?? value) as T
  }
  return value
}

/**
 * True when a line EXPLICITLY asks for secrets: it says "secrets included" (or "include secrets", "with
 * secrets"). Nothing else counts: not a topic, not a mood, not "therapy". `secretsAskedFor` in
 * `lib/secrets-store.ts` adds the lock check.
 */
export function asksForSecrets(text: string): boolean {
  return /\b(secrets?\s+included|include\s+(my\s+)?secrets?|with\s+(my\s+)?secrets)\b/i.test(text)
}

/**
 * The compose box's SECRET key. An empty box becomes `\secret  \secret` with the caret between the marks.
 * Otherwise the marks go in at the caret and nothing is deleted: a selection is wrapped, not replaced.
 */
export function insertSecretMarks(text: string, start = text.length, end = start): { text: string; caret: number } {
  const a = Math.max(0, Math.min(start, text.length))
  const b = Math.max(a, Math.min(end, text.length))
  const before = text.slice(0, a)
  const inside = text.slice(a, b).trim()
  const after = text.slice(b)
  const open = `${before && !/\s$/.test(before) ? " " : ""}\\secret ${inside}`
  const close = ` \\secret${after && !/^\s/.test(after) ? " " : ""}`
  return { text: before + open + close + after, caret: before.length + open.length }
}

// ------------------------------------------------------------ covert tally

export interface TallyRow {
  /** ISO time the row happened (or started). */
  at: string
  /** The row's text. Its spans with the tally's tag are the thoughts. */
  text?: string
  /** Minutes the row lasted, when known (a tracking block on the tally's pen). */
  minutes?: number
  /** True when the row is an instance by itself (a block on the tally's pen), with or without a tagged span. */
  counts?: boolean
}

export interface TallyInstance {
  at: string
  /** What you were thinking, from the tagged spans. Empty when none was written. */
  thoughts: string[]
  minutes?: number
}

/**
 * A covert count read from your own rows: every row on the tally's pen, and every row with a
 * `\secret[tag] … \secret` span, is one instance. Pure. Nothing stores this and nothing shows it unless
 * secrets were included: it is computed on demand from text that is already secret.
 */
export function secretTally(rows: readonly TallyRow[], tag: string): { count: number; minutes: number; instances: TallyInstance[] } {
  const want = tag.toLowerCase()
  const instances: TallyInstance[] = []
  for (const row of rows) {
    const thoughts = secretSpans(row.text ?? "")
      .filter((s) => s.tag === want)
      .map((s) => s.text)
    if (!row.counts && !thoughts.length) continue
    instances.push({ at: row.at, thoughts, ...(row.minutes != null ? { minutes: row.minutes } : {}) })
  }
  instances.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  return { count: instances.length, minutes: instances.reduce((n, i) => n + (i.minutes ?? 0), 0), instances }
}

export interface PassphraseRecord {
  /** base64 salt */
  salt: string
  /** base64 PBKDF2-SHA256 hash */
  hash: string
  iterations: number
}

export const PBKDF2_ITERATIONS = 210_000
export const MIN_PASSPHRASE_LENGTH = 4

function toBase64(bytes: Uint8Array): string {
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromBase64(text: string): Uint8Array {
  const s = atob(text)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function derive(passphrase: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

export async function createPassphraseRecord(passphrase: string): Promise<PassphraseRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(passphrase, salt, PBKDF2_ITERATIONS)
  return { salt: toBase64(salt), hash: toBase64(hash), iterations: PBKDF2_ITERATIONS }
}

export async function verifyPassphrase(passphrase: string, record: PassphraseRecord): Promise<boolean> {
  const got = await derive(passphrase, fromBase64(record.salt), record.iterations)
  const want = fromBase64(record.hash)
  if (got.length !== want.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i]
  return diff === 0
}
